import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Locale } from './i18n.ts';
import {
  applicationLinks,
  NAV_APPLICATIONS_MAX,
  type NavApplication,
  resolveNavItems,
} from './nav-items.ts';
import type { NavEntry } from './navigation-schema.ts';

const app = (slug: string, order: number, name = slug, locale: Locale = 'en'): NavApplication => ({
  slug,
  name,
  tagline: `${name} tagline`,
  order,
  locale,
});
const action = { label: 'Quote', href: '/quote/' };
const entry = (extra: Partial<NavEntry> & { label: string }): NavEntry => ({
  children: [],
  ...extra,
});
const resolve = (entries: NavEntry[], currentPath: string) =>
  resolveNavItems({
    entries,
    applications: [],
    locale: 'en',
    localize: (href) => href,
    currentPath,
  });

test('source applications lists by order, then name, capped at 8', () => {
  const apps = [
    app('z', 1, 'Zeta'),
    app('a', 1, 'Alpha'),
    app('first', 0, 'First'),
    ...Array.from({ length: NAV_APPLICATIONS_MAX - 2 }, (_, i) => app(`n${i}`, 5 + i)),
  ];
  assert.equal(apps.length, NAV_APPLICATIONS_MAX + 1);
  const links = applicationLinks(apps, 'en');
  assert.equal(links.length, NAV_APPLICATIONS_MAX);
  assert.deepEqual(
    links.slice(0, 3).map((link) => link.label),
    ['First', 'Alpha', 'Zeta'],
  );
  assert.deepEqual(links[0], {
    label: 'First',
    description: 'First tagline',
    href: '/applications/first/',
  });
});

test('every href is localized, feature action included', () => {
  const [item] = resolveNavItems({
    entries: [
      entry({
        label: 'Apps',
        href: '/applications/',
        source: 'applications',
        feature: { heading: 'H', text: 'T', action },
      }),
    ],
    applications: [app('x', 0)],
    locale: 'tr',
    localize: (href) => `/tr${href}`,
    currentPath: '/tr/',
  });
  assert.equal(item?.href, '/tr/applications/');
  assert.equal(item?.children[0]?.href, '/tr/applications/x/');
  assert.equal(item?.feature?.action.href, '/tr/quote/');
});

test('a current child marks the parent active, not current', () => {
  const entries = [
    entry({ label: 'Company', href: '/company/', children: [{ label: 'About', href: '/about/' }] }),
  ];
  const [item] = resolve(entries, '/about/');
  assert.equal(item?.current, false);
  assert.equal(item?.active, true);
  assert.equal(item?.children[0]?.current, true);
});

test('an href-less parent is active only through its children', () => {
  const entries = [
    entry({ label: 'Company', children: [{ label: 'About', href: '/about/' }] }),
    entry({ label: 'Contact', href: '/contact/' }),
  ];
  const [company, contact] = resolve(entries, '/about/');
  assert.equal(company?.href, undefined);
  assert.equal(company?.current, false);
  assert.equal(company?.active, true);
  assert.equal(contact?.active, false);
  assert.equal(resolve(entries, '/other/')[0]?.active, false);
});

test('an application that fell back to another locale is marked with that language', () => {
  const links = applicationLinks(
    [app('own', 0, 'Own', 'tr'), app('spare', 1, 'Spare', 'en')],
    'tr',
  );
  assert.equal(links[0]?.lang, undefined);
  assert.equal(links[1]?.lang, 'en');
  assert.equal('lang' in (links[0] ?? {}), false);
});

test('resolved children keep the language mark of a fallback entry', () => {
  const items = resolveNavItems({
    entries: [entry({ label: 'Apps', source: 'applications' })],
    applications: [app('spare', 0, 'Spare', 'en')],
    locale: 'tr',
    localize: (href) => href,
    currentPath: '/tr/',
  });
  assert.equal(items[0]?.children[0]?.lang, 'en');
});

test('an applications menu with no applications and no page of its own is dropped', () => {
  const entries = [
    entry({ label: 'Apps', source: 'applications' }),
    entry({ label: 'Apps page', href: '/applications/', source: 'applications' }),
    entry({ label: 'About', href: '/about/' }),
  ];
  assert.deepEqual(
    resolve(entries, '/').map((item) => item.label),
    ['Apps page', 'About'],
  );
});
