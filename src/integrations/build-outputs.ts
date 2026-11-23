/**
 * Post-build fixes to `dist/`, run on `astro:build:done`:
 * - `relocateLocale404`: Astro writes a locale's 404 as `<locale>/404/index.html`, but the edge
 *   serves `<locale>/404.html`; move it there (idempotent).
 * - `writeSolutionsAllowList`: the Worker's quote allow-list (every application slug plus
 *   `general`), generated from the built pages, so there is no runtime lookup.
 * - `appendNoindex`: non-production builds add `X-Robots-Tag: noindex` to `dist/_headers`.
 * - `findCrossLocaleLinks`: a page of a non-default locale must not link to the EN URL of a page
 *   that exists in its own locale (a TR page linking `/quote/` while `/tr/quote/` is built).
 *   Content hrefs are localized at render time (`hrefLocalizer`), so this is a safety net for a
 *   link that skipped it. The language toggle is exempt: its links carry `hreflang`. The build
 *   fails and names each link with the content files that can hold it.
 * - `pruneUnreferencedImages`: a content image that never goes through `<Image>`, `<Picture>` or
 *   `getImage` (the ASCII source) is emitted as an original, EXIF included. Optimized images are
 *   referenced by the built pages, so any raster file in `_astro` that no page, stylesheet or
 *   feed mentions is such an original and is deleted.
 */
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { NAVIGATION_SLUG } from '../lib/entries.ts';
import { DEFAULT_LOCALE, HOME_SLUG, LOCALES, type Locale } from '../lib/i18n.ts';
import { NOT_FOUND_SLUG, RESERVED_PAGE_SLUGS } from '../lib/page-slugs.ts';
import { GENERAL_SOLUTION } from '../lib/quote-schema.ts';

export const GENERATED_SOLUTIONS_PATH = 'worker/generated/solutions.json';
const HEADERS_FILE = '_headers';
const NOINDEX_HEADER = 'X-Robots-Tag: noindex';
const ALL_PATHS_RULE = /^\/\*[ \t]*\r?$/m;
const NOINDEX_LINE = `  ${NOINDEX_HEADER}`;
const LINE_BREAK = /\r?\n/;
const NON_DEFAULT_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);
export const APPLICATION_PATH = new RegExp(
  `^/?(?:(?:${NON_DEFAULT_LOCALES.join('|')})/)?applications/([^/]+)/$`,
);
const NOT_FOUND_DIR = '404';
const INDEX_FILE = 'index.html';
const NOT_FOUND_FILE = '404.html';
const ASSETS_DIR = '_astro';
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const REFERENCING_EXTENSIONS = new Set(['.html', '.css', '.xml', '.txt', '.json', '.js']);
const HTML_EXTENSION = '.html';
/**
 * Anchors as Astro serializes them: every attribute value double-quoted, so `HREF_ATTRIBUTE` only
 * reads `href="…"` (a single-quoted or unquoted href would be missed). Anchors carrying
 * `hreflang` (the language toggle) are exempt.
 */
const ANCHOR_TAG = /<a\s[^>]*>/g;
const HREF_ATTRIBUTE = /\shref="([^"]*)"/;
const HREFLANG_ATTRIBUTE = /\shreflang=/;
/** A site path: one leading slash, not `//host`; query and fragment are cut off. */
const SITE_PATH = /^(\/(?!\/)[^?#]*)/;
const CONTENT_DIR = 'src/content';
const APPLICATIONS_DIR = 'applications';
/** `applications/<slug>/index.html`; `applications/index.html` is the index page. */
const APPLICATION_PAGE_DEPTH = 3;
const PATH_SEPARATOR = '/';

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
}

export async function relocateLocale404(dist: URL): Promise<void> {
  const root = fileURLToPath(dist);
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const directory = join(root, locale, NOT_FOUND_DIR);
    const source = join(directory, INDEX_FILE);
    if (!(await exists(source))) continue;
    await rename(source, join(root, locale, NOT_FOUND_FILE));
    await rm(directory, { recursive: true });
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Content files that can hold the links of the page at `page` (relative to the locale's dist
 * folder): its entry, the EN twin where the route falls back to EN (quote, 404), and navigation.
 */
export function contentSources(page: string, locale: Locale): string[] {
  const parts = page.split(PATH_SEPARATOR);
  const [first = '', second = '', third] = parts;
  const navigation = `${CONTENT_DIR}/navigation/${locale}/${NAVIGATION_SLUG}.yaml`;
  const isApplication =
    parts.length === APPLICATION_PAGE_DEPTH && first === APPLICATIONS_DIR && third === INDEX_FILE;
  if (isApplication) {
    return [`${CONTENT_DIR}/${APPLICATIONS_DIR}/${locale}/${second}.yaml`, navigation];
  }
  const slug = page === NOT_FOUND_FILE ? NOT_FOUND_SLUG : parts.length === 1 ? HOME_SLUG : first;
  const entryLocales = RESERVED_PAGE_SLUGS.some((reserved) => reserved === slug)
    ? [locale, DEFAULT_LOCALE]
    : [locale];
  return [
    ...entryLocales.map((entryLocale) => `${CONTENT_DIR}/pages/${entryLocale}/${slug}.yaml`),
    navigation,
  ];
}

/** Site paths of a locale's page that should carry the locale prefix; messages name page and link. */
export async function findCrossLocaleLinks(dist: URL): Promise<string[]> {
  const root = fileURLToPath(dist);
  const problems: string[] = [];
  for (const locale of NON_DEFAULT_LOCALES) {
    const localeRoot = join(root, locale);
    if (!(await exists(localeRoot))) continue;
    const pages = (await listFiles(localeRoot)).filter((file) => extname(file) === HTML_EXTENSION);
    for (const page of pages.sort()) {
      const html = await readFile(page, 'utf8');
      for (const [tag] of html.matchAll(ANCHOR_TAG)) {
        if (HREFLANG_ATTRIBUTE.test(tag)) continue;
        const href = HREF_ATTRIBUTE.exec(tag)?.[1];
        const path = href === undefined ? undefined : SITE_PATH.exec(href)?.[1];
        if (href === undefined || path === undefined || path.startsWith(`/${locale}/`)) continue;
        const twin = join(localeRoot, path);
        if (!(await exists(join(twin, INDEX_FILE)))) continue;
        const pagePath = relative(localeRoot, page).split(sep).join(PATH_SEPARATOR);
        const sources = contentSources(pagePath, locale).join(', ');
        problems.push(
          `/${locale}/${pagePath} links to ${href} instead of /${locale}${path} (link written in ${sources})`,
        );
      }
    }
  }
  return problems;
}

async function assertLocalizedLinks(dist: URL): Promise<void> {
  const problems = await findCrossLocaleLinks(dist);
  if (problems.length > 0) {
    throw new Error(
      `Links to the wrong language. Content hrefs are localized at render time, so each hit means a renderer skipped the href localizer (hrefLocalizer in src/lib/content.ts): fix that component. The files after each link are where its link text lives:\n${problems.join('\n')}`,
    );
  }
}

export async function pruneUnreferencedImages(dist: URL): Promise<string[]> {
  const root = fileURLToPath(dist);
  const files = await listFiles(root);
  const sources = files.filter((file) => REFERENCING_EXTENSIONS.has(extname(file)));
  const text = (await Promise.all(sources.map((file) => readFile(file, 'utf8')))).join('\n');
  const assetsDir = join(root, ASSETS_DIR);
  const originals = files.filter(
    (file) =>
      file.startsWith(`${assetsDir}/`) &&
      RASTER_EXTENSIONS.has(extname(file).toLowerCase()) &&
      !text.includes(basename(file)),
  );
  await Promise.all(originals.map((file) => rm(file)));
  return originals.map((file) => basename(file));
}

/** Sorted unique application slugs from page paths (any locale), then `general`. */
export function solutionSlugs(pathnames: readonly string[]): string[] {
  const slugs = new Set<string>();
  for (const pathname of pathnames) {
    const slug = APPLICATION_PATH.exec(pathname)?.[1];
    if (slug === undefined) continue;
    if (slug === GENERAL_SOLUTION) {
      throw new Error(`Application slug "${GENERAL_SOLUTION}" is reserved for general enquiries`);
    }
    slugs.add(slug);
  }
  return [...slugs].sort().concat(GENERAL_SOLUTION);
}

/**
 * Adds the noindex header to the `/*` rule, tolerating CRLF, trailing spaces and leading comments.
 * It goes into the existing block: a second `/*` block would replace the first one's headers
 * (CSP included) instead of merging with them. Throws when no `/*` rule exists.
 */
export function appendNoindex(headers: string): string {
  if (headers.includes(NOINDEX_HEADER)) return headers;
  const rule = ALL_PATHS_RULE.exec(headers);
  if (rule === null) throw new Error('dist/_headers has no /* rule to add X-Robots-Tag to');
  const end = rule.index + rule[0].length;
  const newline = headers.slice(end).startsWith('\r\n') || rule[0].endsWith('\r') ? '\r\n' : '\n';
  const lineEnd = LINE_BREAK.exec(headers.slice(end));
  const insertAt = lineEnd === null ? headers.length : end + lineEnd.index + lineEnd[0].length;
  const prefix = lineEnd === null ? newline : '';
  return `${headers.slice(0, insertAt)}${prefix}${NOINDEX_LINE}${newline}${headers.slice(insertAt)}`;
}

export async function writeSolutionsAllowList(
  root: URL,
  pathnames: readonly string[],
): Promise<void> {
  const target = join(fileURLToPath(root), GENERATED_SOLUTIONS_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(solutionSlugs(pathnames))}\n`);
}

async function markNoindex(dist: URL): Promise<void> {
  const file = join(fileURLToPath(dist), HEADERS_FILE);
  await writeFile(file, appendNoindex(await readFile(file, 'utf8')));
}

export function buildOutputs(options: { isProduction: boolean }): AstroIntegration {
  let root: URL | undefined;
  return {
    name: 'build-outputs',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': async ({ dir, pages }) => {
        if (root === undefined) throw new Error('build-outputs: project root unknown');
        await writeSolutionsAllowList(
          root,
          pages.map((page) => page.pathname),
        );
        await relocateLocale404(dir);
        await assertLocalizedLinks(dir);
        await pruneUnreferencedImages(dir);
        if (!options.isProduction) await markNoindex(dir);
      },
    },
  };
}
