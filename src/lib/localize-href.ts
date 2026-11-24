/**
 * Content hrefs are written once, as locale-neutral site paths (`/about/`, `/quote/`), whatever
 * the entry's language. At render time a page of a non-default locale links the locale's own URL
 * of every target that locale builds, and the EN URL of every other one (EN fallback). So a page
 * that gets translated is linked under `/tr/` everywhere without editing navigation or links.
 */
import {
  applicationPath,
  DEFAULT_LOCALE,
  type Locale,
  localizePath,
  pagePath,
  withTrailingSlash,
} from './i18n.ts';
import { FORBIDDEN_PAGE_SLUGS, NOT_FOUND_SLUG, QUOTE_SLUG } from './page-slugs.ts';

/** A site path: one leading slash, not `//host` and not a backslash after it. */
const SITE_PATH = /^\/(?![/\\])/;
/** The path ends where the query or the fragment starts. */
const SUFFIX_START = /[?#]/;
const SEGMENT_SEPARATOR = '/';
/** Build assets (`/_astro/…`) are files, never pages. */
const ASSETS_SEGMENT = '_astro';
/** First path segments that are never a page: the CMS, the Worker, assets and locale prefixes. */
const NON_PAGE_ROOTS: ReadonlySet<string> = new Set([...FORBIDDEN_PAGE_SLUGS, ASSETS_SEGMENT]);

/**
 * Neutral paths a non-default locale builds itself: its translated pages (the 404 entry has no
 * path) and applications, plus the quote route, which every locale builds (EN content as fallback).
 */
export function localizedPathSet(
  pageSlugs: readonly string[],
  applicationSlugs: readonly string[],
): ReadonlySet<string> {
  return new Set([
    pagePath(QUOTE_SLUG),
    ...pageSlugs.filter((slug) => slug !== NOT_FOUND_SLUG).map(pagePath),
    ...applicationSlugs.map(applicationPath),
  ]);
}

/**
 * The href a page in `locale` renders for a content href. A site path whose target is in
 * `localized` (from `localizedPathSet`) gets the locale prefix and the trailing slash, keeping its
 * query and fragment; everything else (the default locale, untranslated targets, external,
 * `mailto:`, `tel:` and fragment-only hrefs, `/api/`, `/keystatic/`, `/_astro/`, already prefixed
 * paths) is returned unchanged.
 */
export function localizeHref(href: string, locale: Locale, localized: ReadonlySet<string>): string {
  if (locale === DEFAULT_LOCALE || !SITE_PATH.test(href)) return href;
  const cut = href.search(SUFFIX_START);
  const path = cut === -1 ? href : href.slice(0, cut);
  const suffix = cut === -1 ? '' : href.slice(cut);
  const [, root = ''] = path.split(SEGMENT_SEPARATOR);
  if (NON_PAGE_ROOTS.has(root)) return href;
  const neutral = withTrailingSlash(path);
  return localized.has(neutral) ? `${localizePath(neutral, locale)}${suffix}` : href;
}
