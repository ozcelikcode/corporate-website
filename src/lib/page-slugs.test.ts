import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCALES } from './i18n.ts';
import { assertPageSlug, FORBIDDEN_PAGE_SLUGS, isOwnRoutePage } from './page-slugs.ts';

test('FORBIDDEN_PAGE_SLUGS covers the CMS, the Worker API and every locale code', () => {
  for (const slug of ['admin', 'keystatic', 'api', ...LOCALES])
    assert.ok(FORBIDDEN_PAGE_SLUGS.includes(slug), slug);
});

test('assertPageSlug fails the build on a forbidden slug and names it', () => {
  for (const slug of FORBIDDEN_PAGE_SLUGS) {
    assert.throws(() => assertPageSlug(`en/${slug}`), new RegExp(`"${slug}"`), slug);
  }
  assert.throws(() => assertPageSlug('tr/api'), /tr\/api/);
  assert.throws(() => assertPageSlug('en/keystatic'), /keystatic/);
});

test('assertPageSlug accepts ordinary and own-route slugs', () => {
  for (const id of [
    'en/home',
    'en/about',
    'tr/quote',
    'en/not-found',
    'en/admins',
    'en/api-docs',
  ]) {
    assert.doesNotThrow(() => assertPageSlug(id), id);
  }
});

test('isOwnRoutePage marks the pages that have their own route', () => {
  assert.equal(isOwnRoutePage('quote'), true);
  assert.equal(isOwnRoutePage('not-found'), true);
  assert.equal(isOwnRoutePage('about'), false);
});
