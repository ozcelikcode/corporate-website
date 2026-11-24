import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { ADMIN_CSP } from './headers.ts';
import {
  handleKeystatic,
  type KeystaticDeps,
  type KeystaticEnv,
  toApiResult,
} from './keystatic.ts';

const ORIGIN = 'https://site.example';
const SECRET_LENGTH = 32;
const ENV: KeystaticEnv = {
  KEYSTATIC_GITHUB_CLIENT_ID: 'id',
  KEYSTATIC_GITHUB_CLIENT_SECRET: 'secret',
  KEYSTATIC_SECRET: 'x'.repeat(SECRET_LENGTH),
};
const COOKIES: [string, string][] = [
  ['Set-Cookie', 'a=1; Path=/'],
  ['Set-Cookie', 'b=2; Path=/'],
];

type Harness = { deps: KeystaticDeps; assetUrls: string[]; apiUrls: string[] };

function harness(options: { apiThrows?: boolean } = {}): Harness {
  const assetUrls: string[] = [];
  const apiUrls: string[] = [];
  const assets = {
    fetch: async (input: Request | string) => {
      assetUrls.push(input instanceof Request ? input.url : String(input));
      return new Response('<html></html>', {
        headers: { 'Content-Security-Policy': "default-src 'self'", 'Content-Type': 'text/html' },
      });
    },
  } as unknown as Fetcher;
  const deps: KeystaticDeps = {
    assets,
    api: async (request) => {
      apiUrls.push(request.url);
      if (options.apiThrows) throw new Error('boom user@example.com');
      return { body: 'ok', status: 200, headers: COOKIES };
    },
  };
  return { deps, assetUrls, apiUrls };
}

function captureErrors(t: TestContext): unknown[] {
  const logged: unknown[] = [];
  t.mock.method(console, 'error', (entry: unknown) => {
    logged.push(entry);
  });
  return logged;
}

test('a deep admin path serves the /keystatic/ page with the admin CSP', async () => {
  const { deps, assetUrls } = harness();
  const response = await handleKeystatic(
    new Request(`${ORIGIN}/keystatic/branch/main/collection/pagesEn`),
    ENV,
    deps,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(assetUrls, [`${ORIGIN}/keystatic/`]);
  const csp = [...response.headers.entries()].filter(([k]) => k === 'content-security-policy');
  assert.deepEqual(csp, [['content-security-policy', ADMIN_CSP]]);
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('api paths go to the handler and keep both Set-Cookie headers', async () => {
  const { deps, apiUrls } = harness();
  const response = await handleKeystatic(
    new Request(`${ORIGIN}/api/keystatic/github/login`),
    ENV,
    deps,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(apiUrls, [`${ORIGIN}/api/keystatic/github/login`]);
  assert.deepEqual(response.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('missing secrets answer 503 and log { code: "config", step: "keystatic" }', async (t) => {
  const logged = captureErrors(t);
  const { deps, apiUrls } = harness();
  const response = await handleKeystatic(
    new Request(`${ORIGIN}/api/keystatic/github/login`),
    { ...ENV, KEYSTATIC_SECRET: undefined },
    deps,
  );
  assert.equal(response.status, 503);
  assert.deepEqual(apiUrls, []);
  assert.deepEqual(logged, [{ code: 'config', step: 'keystatic' }]);
});

test('a handler that throws answers 500 and logs { code: "keystatic", step: "api" }, no PII', async (t) => {
  const logged = captureErrors(t);
  const { deps } = harness({ apiThrows: true });
  const response = await handleKeystatic(
    new Request(`${ORIGIN}/api/keystatic/github/login`),
    ENV,
    deps,
  );
  assert.equal(response.status, 500);
  assert.deepEqual(logged, [{ code: 'keystatic', step: 'api' }]);
  assert.equal((await response.text()).includes('user@example.com'), false);
});

test('a dotted branch name still gets the /keystatic/ page', async () => {
  const { deps, assetUrls } = harness();
  await handleKeystatic(new Request(`${ORIGIN}/keystatic/branch/release-1.2`), ENV, deps);
  assert.deepEqual(assetUrls, [`${ORIGIN}/keystatic/`]);
});

test('a secret shorter than the minimum answers 503 config', async (t) => {
  const logged = captureErrors(t);
  const { deps, apiUrls } = harness();
  const response = await handleKeystatic(
    new Request(`${ORIGIN}/api/keystatic/github/login`),
    { ...ENV, KEYSTATIC_SECRET: 'x'.repeat(SECRET_LENGTH - 1) },
    deps,
  );
  assert.equal(response.status, 503);
  assert.deepEqual(apiUrls, []);
  assert.deepEqual(logged, [{ code: 'config', step: 'keystatic' }]);
});

test('an asset fetch that throws answers 500 and logs { code: "keystatic", step: "shell" }', async (t) => {
  const logged = captureErrors(t);
  const deps: KeystaticDeps = {
    assets: {
      fetch: async () => {
        throw new Error('down');
      },
    } as unknown as Fetcher,
    api: async () => ({ body: null, status: 200, headers: [] }),
  };
  const response = await handleKeystatic(new Request(`${ORIGIN}/keystatic/`), ENV, deps);
  assert.equal(response.status, 500);
  assert.deepEqual(logged, [{ code: 'keystatic', step: 'shell' }]);
});

test('toApiResult keeps two Set-Cookie entries from an array and from a Headers object', () => {
  const fromArray = toApiResult({ body: 'b', status: 302, headers: COOKIES });
  assert.equal(fromArray.status, 302);
  const wrapped = new Response(null, { headers: fromArray.headers });
  assert.deepEqual(wrapped.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);

  const headers = new Headers();
  for (const [name, value] of COOKIES) headers.append(name, value);
  const fromObject = toApiResult({ body: null, headers });
  assert.equal(fromObject.status, 200);
  const rewrapped = new Response(null, { headers: fromObject.headers });
  assert.deepEqual(rewrapped.headers.getSetCookie(), ['a=1; Path=/', 'b=2; Path=/']);
});
