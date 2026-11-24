import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  applicationPath,
  fallbackLang,
  isLocale,
  localizePath,
  pagePath,
  t,
  toggleTarget,
  UI_KEYS,
  type UiDictionary,
} from './i18n.ts';

const en = Object.fromEntries(UI_KEYS.map((key) => [key, `en:${key}`])) as UiDictionary['en'];
const dict: UiDictionary = { en, tr: { menuOpen: 'Menü' } };

test('localizePath keeps EN at the root and prefixes TR', () => {
  assert.equal(localizePath('/', 'en'), '/');
  assert.equal(localizePath('/', 'tr'), '/tr/');
  assert.equal(localizePath('/about/', 'tr'), '/tr/about/');
  assert.equal(localizePath('/about', 'en'), '/about/');
});

test('pagePath maps home to the root', () => {
  assert.equal(pagePath('home'), '/');
  assert.equal(pagePath('about'), '/about/');
});

test('applicationPath nests under /applications/', () => {
  assert.equal(applicationPath('x'), '/applications/x/');
});

test('toggleTarget links to the twin, or to the TR home when none exists', () => {
  assert.equal(toggleTarget('/about/', 'en', ['en']), '/tr/');
  assert.equal(toggleTarget('/', 'en', ['en', 'tr']), '/tr/');
  assert.equal(toggleTarget('/about/', 'en', ['en', 'tr']), '/tr/about/');
  assert.equal(toggleTarget('/quote/', 'tr', ['en']), '/quote/');
  assert.equal(toggleTarget('/quote/', 'tr', ['en', 'tr']), '/quote/');
});

test('t returns the locale string and falls back to EN', () => {
  assert.equal(t(dict, 'tr', 'menuOpen'), 'Menü');
  assert.equal(t(dict, 'tr', 'tallyFormat'), dict.en.tallyFormat);
  assert.equal(t(dict, 'en', 'menuOpen'), 'en:menuOpen');
});

test('isLocale narrows only known locales', () => {
  assert.equal(isLocale('de'), false);
  assert.equal(isLocale('tr'), true);
  assert.equal(isLocale(undefined), false);
});

/** Top-level keys of a flat `key: value` YAML file (the ui seed files hold nothing else). */
const yamlKeys = (locale: string) =>
  readFileSync(new URL(`../content/ui/${locale}/strings.yaml`, import.meta.url), 'utf8')
    .match(/^[A-Za-z]+(?=:)/gm)
    ?.sort() ?? [];

test('EN ui strings carry exactly UI_KEYS', () => {
  assert.deepEqual(yamlKeys('en'), [...UI_KEYS].sort());
});

test('TR ui strings use only UI_KEYS', () => {
  const known = new Set<string>(UI_KEYS);
  assert.deepEqual(
    yamlKeys('tr').filter((key) => !known.has(key)),
    [],
  );
});

test('UI_KEYS has the broadcast tally and slate keys', () => {
  for (const key of ['tallyProgram', 'tallyPreview', 'noSignal'])
    assert.ok((UI_KEYS as readonly string[]).includes(key), key);
});

test('fallbackLang marks only content in another language than the page', () => {
  assert.equal(fallbackLang('en', 'tr'), 'en');
  assert.equal(fallbackLang('tr', 'tr'), undefined);
  assert.equal(fallbackLang('en', 'en'), undefined);
});
