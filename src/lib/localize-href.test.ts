import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localizedPathSet, localizeHref } from './localize-href.ts';

const TR_PATHS: ReadonlySet<string> = new Set(['/', '/quote/', '/about/', '/applications/x/']);

test('localizeHref returns every href unchanged for the default locale', () => {
  assert.equal(localizeHref('/about/', 'en', TR_PATHS), '/about/');
  assert.equal(localizeHref('/', 'en', TR_PATHS), '/');
});

test('localizeHref prefixes a site path the locale has translated', () => {
  assert.equal(localizeHref('/about/', 'tr', TR_PATHS), '/tr/about/');
  assert.equal(localizeHref('/', 'tr', TR_PATHS), '/tr/');
  assert.equal(localizeHref('/quote/', 'tr', TR_PATHS), '/tr/quote/');
  assert.equal(localizeHref('/applications/x/', 'tr', TR_PATHS), '/tr/applications/x/');
});

test('localizeHref adds the trailing slash the site always serves', () => {
  assert.equal(localizeHref('/about', 'tr', TR_PATHS), '/tr/about/');
});

test('localizeHref keeps the EN URL of an untranslated target', () => {
  assert.equal(localizeHref('/privacy/', 'tr', TR_PATHS), '/privacy/');
  assert.equal(localizeHref('/applications/y/', 'tr', TR_PATHS), '/applications/y/');
  assert.equal(localizeHref('/about/team/', 'tr', TR_PATHS), '/about/team/');
});

test('localizeHref leaves external, mailto, tel and fragment hrefs alone', () => {
  for (const href of [
    'https://example.com/about/',
    'mailto:hello@example.com',
    'tel:+10000000000',
    '#main',
    '?q=1',
    '//example.com/about/',
    '/\\example.com/about/',
  ]) {
    assert.equal(localizeHref(href, 'tr', TR_PATHS), href);
  }
});

test('localizeHref keeps the query and the fragment', () => {
  assert.equal(localizeHref('/about/?ref=nav#team', 'tr', TR_PATHS), '/tr/about/?ref=nav#team');
  assert.equal(localizeHref('/quote/#sent', 'tr', TR_PATHS), '/tr/quote/#sent');
  assert.equal(localizeHref('/about?x=1', 'tr', TR_PATHS), '/tr/about/?x=1');
  assert.equal(localizeHref('/privacy/#cookies', 'tr', TR_PATHS), '/privacy/#cookies');
});

test('localizeHref never touches the Worker, the CMS, build assets or a locale prefix', () => {
  const careless = new Set([
    '/api/quote/',
    '/admin/',
    '/keystatic/',
    '/_astro/x.js/',
    '/tr/',
    '/tr/about/',
    '/en/',
  ]);
  for (const href of [
    '/api/quote',
    '/admin/',
    '/keystatic/',
    '/_astro/x.js',
    '/tr/',
    '/tr',
    '/tr/about/',
    '/en/',
  ]) {
    assert.equal(localizeHref(href, 'tr', careless), href);
  }
});

test('localizedPathSet lists translated pages and applications plus the quote route', () => {
  const paths = localizedPathSet(['home', 'about', 'quote'], ['x']);
  assert.deepEqual([...paths].sort(), ['/', '/about/', '/applications/x/', '/quote/']);
});

test('localizedPathSet always has the quote route and never the 404 entry', () => {
  assert.deepEqual([...localizedPathSet(['not-found'], [])], ['/quote/']);
});
