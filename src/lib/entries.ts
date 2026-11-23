import { DEFAULT_LOCALE, isLocale, type Locale } from './i18n.ts';

export type Entry<T> = { id: string; data: T };
export type Resolved<T> = { data: T; locale: Locale; slug: string };

const ID_SEPARATOR = '/';

/** Entry ids are `<locale>/<slug>`, taken from the file path. */
export function parseEntryId(id: string): { locale: Locale; slug: string } {
  const parts = id.split(ID_SEPARATOR);
  const [locale, slug] = parts;
  if (parts.length !== 2 || !isLocale(locale) || slug === undefined || slug === '') {
    throw new Error(`Invalid entry id "${id}": expected "<locale>/<slug>" with a known locale`);
  }
  return { locale, slug };
}

function find<T>(entries: readonly Entry<T>[], locale: Locale, slug: string): Entry<T> | undefined {
  return entries.find((entry) => entry.id === `${locale}${ID_SEPARATOR}${slug}`);
}

/** The entry in `locale`, else its EN twin, else undefined. */
export function resolveLocalized<T>(
  entries: readonly Entry<T>[],
  locale: Locale,
  slug: string,
): Resolved<T> | undefined {
  const localized = find(entries, locale, slug);
  if (localized) return { data: localized.data, locale, slug };
  const fallback = find(entries, DEFAULT_LOCALE, slug);
  return fallback ? { data: fallback.data, locale: DEFAULT_LOCALE, slug } : undefined;
}

export function localesFor<T>(entries: readonly Entry<T>[], slug: string): Locale[] {
  return entries.flatMap((entry) => {
    const parsed = parseEntryId(entry.id);
    return parsed.slug === slug ? [parsed.locale] : [];
  });
}

/** Slugs of the EN entries; throws on any entry (e.g. a TR one) whose slug has no EN twin. */
export function assertEnglishTwins<T>(entries: readonly Entry<T>[]): Set<string> {
  const enSlugs = new Set<string>();
  for (const entry of entries) {
    const parsed = parseEntryId(entry.id);
    if (parsed.locale === DEFAULT_LOCALE) enSlugs.add(parsed.slug);
  }
  for (const entry of entries) {
    if (!enSlugs.has(parseEntryId(entry.id).slug)) {
      throw new Error(`Entry "${entry.id}" has no ${DEFAULT_LOCALE} twin`);
    }
  }
  return enSlugs;
}

/** One entry per EN slug (the locale's version when translated), sorted by `order`, then slug. */
export function mergeByLocale<T extends { order: number }>(
  entries: readonly Entry<T>[],
  locale: Locale,
): Resolved<T>[] {
  const enSlugs = assertEnglishTwins(entries);
  const merged: Resolved<T>[] = [];
  for (const slug of enSlugs) {
    const resolved = resolveLocalized(entries, locale, slug);
    if (resolved) merged.push(resolved);
  }
  return merged.sort(
    (a, b) => a.data.order - b.data.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
}

/** Empty `slugs` selects everything; otherwise exactly those, in that order. */
export function selectApps<T>(
  all: readonly Resolved<T>[],
  slugs: readonly string[],
): Resolved<T>[] {
  if (slugs.length === 0) return [...all];
  return slugs.map((slug) => {
    const app = all.find((candidate) => candidate.slug === slug);
    if (!app) throw new Error(`app-grid lists unknown application slug "${slug}"`);
    return app;
  });
}

/** The loader's id comes from the file path, so the `slug` field must equal the file name. */
export function assertSlugMatches(id: string, slug: string): void {
  const { slug: fileSlug } = parseEntryId(id);
  if (fileSlug !== slug) {
    throw new Error(`Entry "${id}": slug "${slug}" must equal the file name "${fileSlug}"`);
  }
}
