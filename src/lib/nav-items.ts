/**
 * Header navigation as the layout renders it: the auto applications list expanded, every href
 * localized, and the current-page state resolved (no Astro runtime, so it can be tested).
 */
import { applicationPath, type Locale } from './i18n.ts';
import { isCurrentPage, isSectionActive } from './nav-state.ts';
import type { NavChildEntry, NavEntry, NavFeature } from './navigation-schema.ts';

export const NAV_APPLICATIONS_MAX = 8;

/** The slice of an application the menu needs; the caller resolves the locale fallback. */
export type NavApplication = { slug: string; name: string; tagline: string; order: number };
export type NavChild = NavChildEntry & { current: boolean };
export type NavItem = {
  label: string;
  href?: string | undefined;
  current: boolean;
  active: boolean;
  children: readonly NavChild[];
  feature?: NavFeature | undefined;
};

export function applicationLinks(apps: readonly NavApplication[], locale: Locale): NavChildEntry[] {
  return [...apps]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, locale))
    .slice(0, NAV_APPLICATIONS_MAX)
    .map((app) => ({
      label: app.name,
      description: app.tagline,
      href: applicationPath(app.slug),
    }));
}

export function resolveNavItems(input: {
  entries: readonly NavEntry[];
  applications: readonly NavApplication[];
  locale: Locale;
  localize: (href: string) => string;
  currentPath: string;
}): NavItem[] {
  const { entries, applications, locale, localize, currentPath } = input;
  return entries.map((entry) => {
    const rawChildren =
      entry.source === 'applications' ? applicationLinks(applications, locale) : entry.children;
    const children = rawChildren.map((child) => {
      const href = localize(child.href);
      return { ...child, href, current: isCurrentPage(currentPath, href) };
    });
    const href = entry.href === undefined ? undefined : localize(entry.href);
    const current = href !== undefined && isCurrentPage(currentPath, href);
    const active =
      current ||
      (href !== undefined && isSectionActive(currentPath, href)) ||
      children.some((child) => child.current || isSectionActive(currentPath, child.href));
    const feature = entry.feature && {
      ...entry.feature,
      action: { ...entry.feature.action, href: localize(entry.feature.action.href) },
    };
    return { label: entry.label, href, current, active, children, feature };
  });
}
