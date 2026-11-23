import { listTranslatedApplications, listTranslatedPages } from './content.ts';
import type { Locale } from './i18n.ts';

/** Pages with their own route or role: `quote` has its own page, `not-found` feeds the 404. */
export const RESERVED_PAGE_SLUGS = ['quote', 'not-found'] as const;

const HOME_SLUG = 'home';

type PageParams = { params: { slug: string | undefined } };
type ApplicationParams = { params: { slug: string } };

function isReserved(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.some((reserved) => reserved === slug);
}

/** Pages translated into `locale` itself (EN: every page), `home` as the root route. */
export async function pageStaticPaths(locale: Locale): Promise<PageParams[]> {
  const pages = await listTranslatedPages(locale);
  return pages
    .filter((page) => !isReserved(page.slug))
    .map((page) => ({ params: { slug: page.slug === HOME_SLUG ? undefined : page.slug } }));
}

/** Applications translated into `locale` itself; the other locale's cards link to the EN page. */
export async function applicationStaticPaths(locale: Locale): Promise<ApplicationParams[]> {
  const applications = await listTranslatedApplications(locale);
  return applications.map((application) => ({ params: { slug: application.slug } }));
}
