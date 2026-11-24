/**
 * Page slugs with a special meaning. A page's URL is `/<slug>/` (TR `/tr/<slug>/`), so some slugs
 * would collide with paths the site already serves.
 */
import { parseEntryId } from './entries.ts';
import { LOCALES } from './i18n.ts';

/** The quote page's entry; every locale builds its route (`/quote/`, `/tr/quote/`). */
export const QUOTE_SLUG = 'quote';
/** The 404's entry; it has no URL of its own. */
export const NOT_FOUND_SLUG = 'not-found';
/** Pages with their own route or role: `quote` has its own page, `not-found` feeds the 404. */
export const RESERVED_PAGE_SLUGS = [QUOTE_SLUG, NOT_FOUND_SLUG] as const;

/** No page may take these: they would shadow the CMS (and its old `/admin/` redirect), the quote Worker or a locale prefix. */
export const FORBIDDEN_PAGE_SLUGS: readonly string[] = ['admin', 'keystatic', 'api', ...LOCALES];

export function isOwnRoutePage(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.some((reserved) => reserved === slug);
}

/** Fails the build on a page whose slug would shadow `/keystatic/`, `/api/` or a locale root. */
export function assertPageSlug(id: string): void {
  const { slug } = parseEntryId(id);
  if (FORBIDDEN_PAGE_SLUGS.includes(slug)) {
    throw new Error(
      `Page "${id}": the slug "${slug}" is reserved (${FORBIDDEN_PAGE_SLUGS.join(', ')}); rename the page`,
    );
  }
}
