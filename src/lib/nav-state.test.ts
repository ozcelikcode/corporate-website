import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCurrentPage, isSectionActive } from './nav-state.ts';

test('isSectionActive needs a whole-segment match', () => {
  assert.equal(isSectionActive('/applications/', '/app'), false);
  assert.equal(isSectionActive('/applications/', '/app/'), false);
  assert.equal(isSectionActive('/applications/x/', '/applications'), true);
  assert.equal(isSectionActive('/applications/x/', '/applications/'), true);
  assert.equal(isSectionActive('/applications/', '/applications/'), true);
  assert.equal(isSectionActive('/applications', '/applications/'), true);
});

test('isSectionActive never marks the root', () => {
  assert.equal(isSectionActive('/', '/'), false);
  assert.equal(isSectionActive('/about/', '/'), false);
  assert.equal(isSectionActive('/tr/', '/'), false);
});

test('isSectionActive compares concrete URLs, locale prefix included', () => {
  // currentPath is Astro.url.pathname (locale-prefixed); nav hrefs are the content's real URLs.
  assert.equal(isSectionActive('/tr/applications/x/', '/applications/'), false);
  assert.equal(isSectionActive('/tr/applications/x/', '/tr/applications/'), true);
  assert.equal(isSectionActive('/applications/x/', '/tr/applications/'), false);
});

test('isSectionActive ignores non-path hrefs', () => {
  assert.equal(isSectionActive('/contact/', 'mailto:hello@example.com'), false);
  assert.equal(isSectionActive('/contact/', 'https://example.com/contact/'), false);
});

test('isCurrentPage is an exact match up to the trailing slash', () => {
  assert.equal(isCurrentPage('/about/', '/about/'), true);
  assert.equal(isCurrentPage('/about/', '/about'), true);
  assert.equal(isCurrentPage('/about/team/', '/about/'), false);
  assert.equal(isCurrentPage('/', '/'), true);
});
