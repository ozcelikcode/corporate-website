import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocalDevHost, keystaticDevRoute } from './keystatic-dev-route.ts';

test('routes api, deep links and passes the rest', () => {
  assert.equal(keystaticDevRoute('/api/keystatic/tree'), 'api');
  assert.equal(keystaticDevRoute('/keystatic/collection/pagesEn'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/x.js'), 'pass');
  assert.equal(keystaticDevRoute('/about/'), 'pass');
});

test('the admin alias redirects, look-alikes pass', () => {
  for (const path of ['/admin', '/admin/', '/admin/x', '/admin/collection/pagesEn']) {
    assert.equal(keystaticDevRoute(path), 'redirect', path);
  }
  for (const path of ['/administrator/', '/adminx', '/tr/admin/', '/about/admin']) {
    assert.equal(keystaticDevRoute(path), 'pass', path);
  }
});

test('look-alike prefixes pass', () => {
  assert.equal(keystaticDevRoute('/api/keystatic'), 'pass');
  assert.equal(keystaticDevRoute('/api/keystaticx/tree'), 'pass');
  assert.equal(keystaticDevRoute('/keystatic'), 'pass');
  assert.equal(keystaticDevRoute('/keystaticx/'), 'pass');
  assert.equal(keystaticDevRoute('/tr/keystatic/'), 'pass');
});

test('local hosts reach the api, with or without a port', () => {
  for (const host of [
    'localhost',
    'localhost:4321',
    'LOCALHOST:4321',
    'admin.localhost:4321',
    '127.0.0.1',
    '127.0.0.1:4321',
    '[::1]',
    '[::1]:4321',
  ]) {
    assert.equal(isLocalDevHost(host, []), true, host);
  }
});

test('other hosts are refused, a rebinding name included', () => {
  for (const host of [
    'evil.example',
    'evil.example:4321',
    'localhost.evil.example',
    '127.0.0.1.evil.example',
    '192.168.1.10:4321',
    '[::2]:4321',
    '',
    'not a host',
  ]) {
    assert.equal(isLocalDevHost(host, []), false, host);
  }
  assert.equal(isLocalDevHost(undefined, []), false, 'missing Host');
});

test("Vite's allowed hosts widen the list only when they are a list", () => {
  assert.equal(isLocalDevHost('box.lan:4321', ['box.lan']), true);
  assert.equal(isLocalDevHost('dev.box.lan', ['.box.lan']), true);
  assert.equal(isLocalDevHost('box.lan', ['.box.lan']), true);
  assert.equal(isLocalDevHost('other.lan', ['box.lan', '.box.lan']), false);
  assert.equal(isLocalDevHost('evil.example', true), false);
});
