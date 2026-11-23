/**
 * Post-build fixes to `dist/`, run on `astro:build:done`:
 * - `relocateLocale404`: Astro writes a locale's 404 as `<locale>/404/index.html`, but the edge
 *   serves `<locale>/404.html`; move it there (idempotent).
 * - `writeSolutionsAllowList`: the Worker's quote allow-list (every application slug plus
 *   `general`), generated from the built pages, so there is no runtime lookup.
 * - `appendNoindex`: non-production builds add `X-Robots-Tag: noindex` to `dist/_headers`.
 * - `pruneUnreferencedImages`: a content image that never goes through `<Image>`, `<Picture>` or
 *   `getImage` (the ASCII source) is emitted as an original, EXIF included. Optimized images are
 *   referenced by the built pages, so any raster file in `_astro` that no page, stylesheet or
 *   feed mentions is such an original and is deleted.
 */
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n.ts';
import { GENERAL_SOLUTION } from '../lib/quote-schema.ts';

export const GENERATED_SOLUTIONS_PATH = 'worker/generated/solutions.json';
const HEADERS_FILE = '_headers';
const NOINDEX_HEADER = 'X-Robots-Tag: noindex';
const ALL_PATHS_RULE = '/*\n';
const NOINDEX_LINE = `  ${NOINDEX_HEADER}\n`;
const APPLICATION_PATH = /^\/?(?:tr\/)?applications\/([^/]+)\/$/;
const NOT_FOUND_DIR = '404';
const NOT_FOUND_INDEX = 'index.html';
const NOT_FOUND_FILE = '404.html';
const ASSETS_DIR = '_astro';
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const REFERENCING_EXTENSIONS = new Set(['.html', '.css', '.xml', '.txt', '.json', '.js']);

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
    const source = join(directory, NOT_FOUND_INDEX);
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
 * Adds the noindex header to the `/*` rule. It goes into the existing block: a second `/*` block
 * would replace the first one's headers (CSP included) instead of merging with them.
 */
export function appendNoindex(headers: string): string {
  if (headers.includes(NOINDEX_HEADER)) return headers;
  if (headers.startsWith(ALL_PATHS_RULE)) {
    return `${ALL_PATHS_RULE}${NOINDEX_LINE}${headers.slice(ALL_PATHS_RULE.length)}`;
  }
  return `${ALL_PATHS_RULE}${NOINDEX_LINE}\n${headers}`;
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
        await pruneUnreferencedImages(dir);
        if (!options.isProduction) await markNoindex(dir);
      },
    },
  };
}
