import { DEFAULT_LOCALE, LOCALES, type Locale, localizePath } from './i18n.ts';

export const TITLE_SEPARATOR = ' · ';

const SCHEMA_CONTEXT = 'https://schema.org';
const ORGANIZATION_TYPE = 'Organization';
const X_DEFAULT = 'x-default';
/** JSON-LD sits in a `<script>` element; escaping `<` keeps `</script>` in content inert. */
const LESS_THAN = /</g;
const LESS_THAN_ESCAPED = '\\u003c';

export type Alternate = { hreflang: Locale | typeof X_DEFAULT; href: string };

export type OrganizationInput = {
  name: string;
  legalName: string;
  url: string;
  logoUrl: string;
  sameAs: readonly string[];
  email?: string;
  telephone?: string;
  address?: string;
};

export function formatTitle(page: string, brand: string): string {
  return `${page}${TITLE_SEPARATOR}${brand}`;
}

export function absoluteUrl(path: string, site: URL | string): string {
  return new URL(path, site).href;
}

/** One link per available locale (in `LOCALES` order) plus `x-default`, which is always EN. */
export function hreflangLinks(
  neutralPath: string,
  available: readonly Locale[],
  site: URL | string,
): Alternate[] {
  const href = (locale: Locale) => absoluteUrl(localizePath(neutralPath, locale), site);
  const links: Alternate[] = LOCALES.filter((locale) => available.includes(locale)).map(
    (locale) => ({ hreflang: locale, href: href(locale) }),
  );
  return [...links, { hreflang: X_DEFAULT, href: href(DEFAULT_LOCALE) }];
}

/** Organization JSON-LD as a string safe to place inside `<script type="application/ld+json">`. */
export function organizationJsonLd(org: OrganizationInput): string {
  const data = {
    '@context': SCHEMA_CONTEXT,
    '@type': ORGANIZATION_TYPE,
    name: org.name,
    legalName: org.legalName,
    url: org.url,
    logo: org.logoUrl,
    sameAs: org.sameAs,
    ...(org.email === undefined ? {} : { email: org.email }),
    ...(org.telephone === undefined ? {} : { telephone: org.telephone }),
    ...(org.address === undefined ? {} : { address: org.address }),
  };
  return JSON.stringify(data).replace(LESS_THAN, LESS_THAN_ESCAPED);
}
