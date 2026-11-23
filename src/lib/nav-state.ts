/**
 * Nav highlight rules. `currentPath` is `Astro.url.pathname` (locale-prefixed, e.g. `/tr/...`)
 * and `href` is the nav entry's real URL from content, so both are compared as concrete paths:
 * a TR page never lights a link that points to the EN URL.
 */

import { withTrailingSlash } from './i18n.ts';

const SLASH = '/';
const ROOT = SLASH;

/** The link points at this very page (`aria-current="page"`). */
export function isCurrentPage(currentPath: string, href: string): boolean {
  return withTrailingSlash(currentPath) === withTrailingSlash(href);
}

/**
 * The page is the link's target or lies below it, on whole path segments (`/app` never matches
 * `/applications/`). The root never counts as a section; non-path hrefs never match.
 */
export function isSectionActive(currentPath: string, href: string): boolean {
  if (!href.startsWith(SLASH)) return false;
  const section = withTrailingSlash(href);
  return section !== ROOT && withTrailingSlash(currentPath).startsWith(section);
}
