import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREVIEW_SITE_URL, resolveBuildMode, TURNSTILE_TEST_SITE_KEY } from './build-mode.ts';

test('main with production vars is production', () =>
  assert.deepEqual(
    resolveBuildMode({
      WORKERS_CI_BRANCH: 'main',
      SITE_URL: 'https://example.com/',
      PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAA',
    }),
    { isProduction: true, siteUrl: 'https://example.com', turnstileSiteKey: '0x4AAAAAAA' },
  ));

test('non-main branch ignores production vars', () =>
  assert.deepEqual(
    resolveBuildMode({
      WORKERS_CI_BRANCH: 'feature/x',
      SITE_URL: 'https://example.com',
      PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAA',
    }),
    { isProduction: false, siteUrl: PREVIEW_SITE_URL, turnstileSiteKey: TURNSTILE_TEST_SITE_KEY },
  ));

test('local build without a branch is non-production', () =>
  assert.equal(resolveBuildMode({}).isProduction, false));

test('main without SITE_URL throws', () =>
  assert.throws(
    () => resolveBuildMode({ WORKERS_CI_BRANCH: 'main', PUBLIC_TURNSTILE_SITE_KEY: 'k' }),
    /SITE_URL/,
  ));

test('main with non-https SITE_URL throws', () =>
  assert.throws(
    () =>
      resolveBuildMode({
        WORKERS_CI_BRANCH: 'main',
        SITE_URL: 'http://example.com',
        PUBLIC_TURNSTILE_SITE_KEY: 'k',
      }),
    /SITE_URL/,
  ));

test('main without site key throws', () =>
  assert.throws(
    () => resolveBuildMode({ WORKERS_CI_BRANCH: 'main', SITE_URL: 'https://example.com' }),
    /PUBLIC_TURNSTILE_SITE_KEY/,
  ));

test('main with empty SITE_URL throws', () =>
  assert.throws(
    () =>
      resolveBuildMode({
        WORKERS_CI_BRANCH: 'main',
        SITE_URL: '',
        PUBLIC_TURNSTILE_SITE_KEY: 'k',
      }),
    /SITE_URL/,
  ));

test('main with empty site key throws', () =>
  assert.throws(
    () =>
      resolveBuildMode({
        WORKERS_CI_BRANCH: 'main',
        SITE_URL: 'https://example.com',
        PUBLIC_TURNSTILE_SITE_KEY: '',
      }),
    /PUBLIC_TURNSTILE_SITE_KEY/,
  ));

test('main with SITE_URL lacking a host throws', () =>
  assert.throws(
    () =>
      resolveBuildMode({
        WORKERS_CI_BRANCH: 'main',
        SITE_URL: 'https://',
        PUBLIC_TURNSTILE_SITE_KEY: 'k',
      }),
    /SITE_URL/,
  ));
