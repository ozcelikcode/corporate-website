export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** The page slug served at the locale root. */
export const HOME_SLUG = 'home';
const APPLICATIONS_ROOT = '/applications/';
const TRAILING_SLASH = '/';

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** `path` ending in a slash, as every site URL does. */
export function withTrailingSlash(path: string): string {
  return path.endsWith(TRAILING_SLASH) ? path : `${path}${TRAILING_SLASH}`;
}

/** Maps a locale-neutral path ("/about/") to the path served for `locale`. */
export function localizePath(neutralPath: string, locale: Locale): string {
  const path = withTrailingSlash(neutralPath);
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

export function pagePath(slug: string): string {
  return slug === HOME_SLUG ? TRAILING_SLASH : `/${slug}/`;
}

export function applicationPath(slug: string): string {
  return `${APPLICATIONS_ROOT}${slug}${TRAILING_SLASH}`;
}

/** Language toggle: the other locale's twin of this page, or that locale's home when none exists. */
export function toggleTarget(
  neutralPath: string,
  current: Locale,
  available: readonly Locale[],
): string {
  const target: Locale = current === DEFAULT_LOCALE ? 'tr' : DEFAULT_LOCALE;
  return available.includes(target)
    ? localizePath(neutralPath, target)
    : localizePath(TRAILING_SLASH, target);
}

export const UI_KEYS = [
  'skipToContent',
  'menuOpen',
  'menuClose',
  'navPrimaryLabel',
  'navFooterLabel',
  'navSubmenu',
  'navOverview',
  'languageLabel',
  'navQuote',
  'tallyLive',
  'tallyTimecode',
  'tallyChannel',
  'tallyFormat',
  'tallyProgram',
  'tallyPreview',
  'tallyOnAir',
  'motionHold',
  'motionHoldHint',
  'noSignal',
  'appBrochure',
  'footerContact',
  'footerApplications',
  'footerSocial',
  'footerRights',
  'quoteName',
  'quoteEmail',
  'quoteCompany',
  'quoteRole',
  'quoteCountry',
  'quoteSolutions',
  'quoteSolutionsGeneral',
  'quoteSolutionsHint',
  'quoteTimeline',
  'quoteTimelinePlaceholder',
  'quoteTimelineAsap',
  'quoteTimelineQuarter',
  'quoteTimelineHalfYear',
  'quoteTimelineExploring',
  'quoteMessage',
  'quoteConsent',
  'quoteConsentLink',
  'quoteSubmit',
  'quoteOptional',
  'quoteNoScript',
  'quoteSentTitle',
  'quoteSentBody',
  'quoteErrorInvalidTitle',
  'quoteErrorInvalidBody',
  'quoteErrorVerifyTitle',
  'quoteErrorVerifyBody',
  'quoteErrorSendTitle',
  'quoteErrorSendBody',
] as const;
export type UiKey = (typeof UI_KEYS)[number];

export type UiDictionary = {
  en: Readonly<Record<UiKey, string>>;
  tr: Readonly<Partial<Record<UiKey, string>>>;
};

export function t(dict: UiDictionary, locale: Locale, key: UiKey): string {
  return dict[locale][key] ?? dict.en[key];
}
