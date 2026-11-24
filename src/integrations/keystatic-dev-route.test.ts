import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keystaticDevRoute } from './keystatic-dev-route.ts';

test('routes api, deep links and passes the rest', () => {
  assert.equal(keystaticDevRoute('/api/keystatic/tree'), 'api');
  assert.equal(keystaticDevRoute('/keystatic/collection/pagesEn'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/x.js'), 'pass');
  assert.equal(keystaticDevRoute('/about/'), 'pass');
});

test('look-alike prefixes pass', () => {
  assert.equal(keystaticDevRoute('/api/keystatic'), 'pass');
  assert.equal(keystaticDevRoute('/api/keystaticx/tree'), 'pass');
  assert.equal(keystaticDevRoute('/keystatic'), 'pass');
  assert.equal(keystaticDevRoute('/keystaticx/'), 'pass');
  assert.equal(keystaticDevRoute('/tr/keystatic/'), 'pass');
});
