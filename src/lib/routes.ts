import { listTranslatedApplications, listTranslatedPages } from './content.ts';
import { HOME_SLUG, type Locale } from './i18n.ts';
import { isOwnRoutePage } from './page-slugs.ts';

type PageParams = { params: { slug: string | undefined } };
type ApplicationParams = { params: { slug: string } };

/** Pages translated into `locale` itself (EN: every page), `home` as the root route. */
export async function pageStaticPaths(locale: Locale): Promise<PageParams[]> {
  const pages = await listTranslatedPages(locale);
  return pages
    .filter((page) => !isOwnRoutePage(page.slug))
    .map((page) => ({ params: { slug: page.slug === HOME_SLUG ? undefined : page.slug } }));
}

/** Applications translated into `locale` itself; the other locale's cards link to the EN page. */
export async function applicationStaticPaths(locale: Locale): Promise<ApplicationParams[]> {
  const applications = await listTranslatedApplications(locale);
  return applications.map((application) => ({ params: { slug: application.slug } }));
}
