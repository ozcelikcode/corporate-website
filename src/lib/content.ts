import { type CollectionEntry, getCollection } from 'astro:content';
import { z } from 'astro/zod';
import {
  assertEnglishTwins,
  assertSlugMatches,
  localesFor,
  mergeByLocale,
  NAVIGATION_SLUG,
  parseEntryId,
  type Resolved,
  resolveLocalized,
} from './entries.ts';
import { DEFAULT_LOCALE, type Locale, UI_KEYS, type UiDictionary } from './i18n.ts';
import { localizedPathSet, localizeHref } from './localize-href.ts';
import { assertPageSlug } from './page-slugs.ts';

export type SiteSettings = CollectionEntry<'settings'>['data'];
export type PageData = CollectionEntry<'pages'>['data'];
export type ApplicationData = CollectionEntry<'applications'>['data'];
export type NavigationData = CollectionEntry<'navigation'>['data'];

const SETTINGS_ID = 'site';
const UI_SLUG = 'strings';

const englishUiSchema = z.record(z.enum(UI_KEYS), z.string().min(1));

export async function getSettings(): Promise<SiteSettings> {
  const entries = await getCollection('settings');
  const site = entries.find((entry) => entry.id === SETTINGS_ID);
  if (!site) throw new Error(`Missing settings entry "${SETTINGS_ID}" (src/content/settings/)`);
  return site.data;
}

export async function getUiDictionary(): Promise<UiDictionary> {
  const entries = await getCollection('ui');
  const strings = (locale: Locale) =>
    entries.find((entry) => entry.id === `${locale}/${UI_SLUG}`)?.data;
  const en = strings(DEFAULT_LOCALE);
  if (!en) throw new Error(`Missing ui/${DEFAULT_LOCALE}/${UI_SLUG}.yaml`);
  const parsed = englishUiSchema.safeParse(en);
  if (!parsed.success) {
    // The collection drops blank strings, so an emptied EN key shows up as missing.
    const missing = UI_KEYS.filter((key) => en[key] === undefined);
    throw new Error(
      `ui/${DEFAULT_LOCALE}/${UI_SLUG}.yaml must set every key; missing or blank: ${missing.join(', ')}`,
    );
  }
  return { en: parsed.data, tr: strings('tr') ?? {} };
}

export async function getNavigation(locale: Locale): Promise<Resolved<NavigationData>> {
  const resolved = resolveLocalized(await getCollection('navigation'), locale, NAVIGATION_SLUG);
  if (!resolved) throw new Error(`Missing navigation/${DEFAULT_LOCALE}/${NAVIGATION_SLUG}.yaml`);
  return resolved;
}

export async function getPage(locale: Locale, slug: string): Promise<Resolved<PageData>> {
  const resolved = resolveLocalized(await getCollection('pages'), locale, slug);
  if (!resolved) throw new Error(`Missing page "${DEFAULT_LOCALE}/${slug}" (src/content/pages/)`);
  return resolved;
}

/**
 * Pages that exist in `locale` itself. A translation without an EN twin, or a slug that would
 * shadow `/keystatic/`, `/api/` or a locale root, fails the build.
 */
export async function listTranslatedPages(locale: Locale): Promise<Resolved<PageData>[]> {
  const entries = await getCollection('pages');
  for (const entry of entries) assertPageSlug(entry.id);
  assertEnglishTwins(entries);
  const resolved = entries.map((entry) => ({ data: entry.data, ...parseEntryId(entry.id) }));
  return resolved.filter((page) => page.locale === locale);
}

/** Every application for `locale`: its translation, else the EN entry. */
export async function listApplications(locale: Locale): Promise<Resolved<ApplicationData>[]> {
  const entries = await getCollection('applications');
  for (const entry of entries) assertSlugMatches(entry.id, entry.data.slug);
  return mergeByLocale(entries, locale);
}

/** Only the applications that have a version in `locale` itself. */
export async function listTranslatedApplications(
  locale: Locale,
): Promise<Resolved<ApplicationData>[]> {
  const merged = await listApplications(locale);
  return merged.filter((app) => app.locale === locale);
}

export async function availableLocales(
  collection: 'pages' | 'applications',
  slug: string,
): Promise<Locale[]> {
  return collection === 'pages'
    ? localesFor(await getCollection('pages'), slug)
    : localesFor(await getCollection('applications'), slug);
}

/**
 * Maps a content href (written as an EN site path) to the URL a page in `locale` links: the
 * locale's own URL when `locale` builds that page or application, else the EN one. Cheap to build
 * (`getCollection` is cached): BaseLayout, SectionRenderer and ApplicationPage each build their own
 * per render, every link inside them shares it.
 */
export async function hrefLocalizer(locale: Locale): Promise<(href: string) => string> {
  const [pages, applications] = await Promise.all([
    listTranslatedPages(locale),
    listTranslatedApplications(locale),
  ]);
  const localized = localizedPathSet(
    pages.map((page) => page.slug),
    applications.map((application) => application.slug),
  );
  return (href) => localizeHref(href, locale, localized);
}
