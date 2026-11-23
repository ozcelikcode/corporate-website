import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertEnglishTwins,
  assertSlugMatches,
  type Entry,
  localesFor,
  mergeByLocale,
  parseEntryId,
  type Resolved,
  resolveLocalized,
  selectApps,
} from './entries.ts';

type Data = { order: number };
const en = (slug: string, order = 0): Entry<Data> => ({ id: `en/${slug}`, data: { order } });
const tr = (slug: string, order = 0): Entry<Data> => ({ id: `tr/${slug}`, data: { order } });

test('parseEntryId splits locale and slug and rejects bad ids', () => {
  assert.deepEqual(parseEntryId('tr/home'), { locale: 'tr', slug: 'home' });
  assert.throws(() => parseEntryId('de/home'));
  assert.throws(() => parseEntryId('home'));
});

test('resolveLocalized prefers the locale and falls back to EN', () => {
  assert.equal(resolveLocalized([en('about')], 'tr', 'about')?.locale, 'en');
  assert.equal(resolveLocalized([en('about'), tr('about')], 'tr', 'about')?.locale, 'tr');
  assert.equal(resolveLocalized([en('about')], 'tr', 'missing'), undefined);
});

test('localesFor lists the locales that have the slug', () => {
  assert.deepEqual(localesFor([en('home'), tr('home')], 'home'), ['en', 'tr']);
  assert.deepEqual(localesFor([en('home')], 'home'), ['en']);
});

test('mergeByLocale returns one entry per EN slug, sorted by order then slug', () => {
  assert.deepEqual(
    mergeByLocale([en('b', 2), en('a', 1), tr('b', 2)], 'tr').map((r) => [r.slug, r.locale]),
    [
      ['a', 'en'],
      ['b', 'tr'],
    ],
  );
  assert.deepEqual(
    mergeByLocale([en('b', 1), en('a', 1)], 'en').map((r) => r.slug),
    ['a', 'b'],
  );
});

test('mergeByLocale throws on a TR entry without an EN twin', () => {
  assert.throws(() => mergeByLocale([en('a', 1), tr('orphan', 2)], 'tr'), /tr\/orphan/);
});

test('selectApps returns all for no slugs, else the given order', () => {
  const all: Resolved<Data>[] = [
    { data: { order: 1 }, locale: 'en', slug: 'a' },
    { data: { order: 2 }, locale: 'en', slug: 'b' },
  ];
  assert.deepEqual(
    selectApps(all, []).map((r) => r.slug),
    ['a', 'b'],
  );
  assert.deepEqual(
    selectApps(all, ['b', 'a']).map((r) => r.slug),
    ['b', 'a'],
  );
  assert.throws(() => selectApps(all, ['missing']), /missing/);
});

test('assertSlugMatches fails when the slug differs from the file name', () => {
  assert.throws(() => assertSlugMatches('en/newsroom-desk', 'newsroom'), /newsroom-desk/);
  assert.doesNotThrow(() => assertSlugMatches('en/newsroom-desk', 'newsroom-desk'));
});

test('assertEnglishTwins returns EN slugs and throws on an orphan', () => {
  assert.deepEqual([...assertEnglishTwins([en('a'), tr('a')])], ['a']);
  assert.throws(() => assertEnglishTwins([en('a'), tr('orphan')]), /tr\/orphan/);
});
