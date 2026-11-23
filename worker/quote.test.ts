import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { QUOTE_LIMITS, TURNSTILE_FIELD } from '../src/lib/quote-schema.ts';
import { handleQuote, type OutgoingMail, type QuoteDeps, type QuoteEnv } from './quote.ts';

const ORIGIN = 'https://site.example';
const URL_QUOTE = `${ORIGIN}/api/quote`;
const MAX_BODY = 16384;
const ENV: QuoteEnv = {
  TURNSTILE_SECRET_KEY: 's',
  QUOTE_TO: 'inbox@example.com',
  QUOTE_FROM: 'quote@example.com',
  MAX_BODY_BYTES: String(MAX_BODY),
};
const GOOD_VERIFY = { success: true, hostname: 'site.example', action: 'quote' };

type Harness = { deps: QuoteDeps; fetched: string[]; sent: OutgoingMail[] };

function harness(options: { verify?: unknown; fetchThrows?: boolean; sendThrows?: boolean } = {}) {
  const fetched: string[] = [];
  const sent: OutgoingMail[] = [];
  const fetchFn: typeof fetch = async (input) => {
    fetched.push(String(input));
    if (options.fetchThrows) throw new Error('down');
    return new Response(JSON.stringify(options.verify ?? GOOD_VERIFY));
  };
  const deps: QuoteDeps = {
    allowList: new Set(['archive-search', 'general']),
    fetch: fetchFn,
    send: async (mail) => {
      if (options.sendThrows) throw new Error('smtp');
      sent.push(mail);
    },
    now: () => new Date('2026-11-23T10:00:00Z'),
    messageId: () => 'id-1',
  };
  return { deps, fetched, sent } satisfies Harness;
}

function fields(overrides: Record<string, string | string[]> = {}): [string, string][] {
  const base: Record<string, string | string[]> = {
    name: 'Ada',
    email: 'visitor@example.org',
    company: 'Co',
    role: 'Eng',
    country: 'UK',
    solutions: ['archive-search'],
    timeline: 'asap',
    message: 'Hello',
    consent: 'on',
    locale: 'en',
    [TURNSTILE_FIELD]: 'tok',
    ...overrides,
  };
  return Object.entries(base).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v): [string, string] => [key, v]),
  );
}

function multipart(entries: [string, string][]): FormData {
  const form = new FormData();
  for (const [key, value] of entries) form.append(key, value);
  return form;
}

function post(body: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request(URL_QUOTE, { method: 'POST', headers: { Origin: ORIGIN, ...headers }, body });
}

function formPost(overrides: Record<string, string | string[]> = {}, headers = {}): Request {
  return post(multipart(fields(overrides)), headers);
}

function location(response: Response): string {
  assert.equal(response.status, 303);
  return response.headers.get('Location') ?? '';
}

test('valid EN post redirects to #sent and sends one mail with Reply-To', async () => {
  const h = harness();
  const response = await handleQuote(formPost(), ENV, h.deps);
  assert.equal(location(response), `${ORIGIN}/quote/#sent`);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0]?.from, 'quote@example.com');
  assert.equal(h.sent[0]?.to, 'inbox@example.com');
  assert.match(h.sent[0]?.raw ?? '', /Reply-To: visitor@example\.org/);
});

test('locale tr goes to /tr/quote/, unknown locale falls back to /quote/', async () => {
  const tr = await handleQuote(formPost({ locale: 'tr' }), ENV, harness().deps);
  assert.equal(location(tr), `${ORIGIN}/tr/quote/#sent`);
  const de = await handleQuote(formPost({ locale: 'de' }), ENV, harness().deps);
  assert.equal(location(de), `${ORIGIN}/quote/#error-invalid`);
});

test('GET is 405 with Allow: POST', async () => {
  const response = await handleQuote(new Request(URL_QUOTE), ENV, harness().deps);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
});

test('a foreign or missing Origin is #error-invalid without any fetch', async () => {
  const h = harness();
  const foreign = await handleQuote(formPost({}, { Origin: 'https://evil.example' }), ENV, h.deps);
  assert.equal(location(foreign), `${ORIGIN}/quote/#error-invalid`);
  const missing = new Request(URL_QUOTE, { method: 'POST', body: multipart(fields()) });
  assert.equal(location(await handleQuote(missing, ENV, h.deps)), `${ORIGIN}/quote/#error-invalid`);
  assert.equal(h.fetched.length, 0);
});

test('a non-form content type is #error-invalid', async () => {
  const response = await handleQuote(
    post('{}', { 'Content-Type': 'application/json' }),
    ENV,
    harness().deps,
  );
  assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
});

test('a Content-Length over the cap is rejected without reading the body', async () => {
  let pulled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        pulled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request(URL_QUOTE, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': '20000',
    },
    body,
    duplex: 'half',
  } as RequestInit);
  const response = await handleQuote(request, ENV, harness().deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
  assert.equal(pulled, false);
});

test('a chunked body over the cap without Content-Length is rejected', async () => {
  const chunk = new Uint8Array(1000).fill(97);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= 20) return controller.close();
      sent += 1;
      controller.enqueue(chunk);
    },
  });
  const request = new Request(URL_QUOTE, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    duplex: 'half',
  } as RequestInit);
  assert.equal(request.headers.get('Content-Length'), null);
  const response = await handleQuote(request, ENV, harness().deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
  assert.ok(sent < 20, 'stopped reading at the cap');
});

const MAX_FIELDS = {
  name: 'ş'.repeat(QUOTE_LIMITS.name),
  email: `${'a'.repeat(QUOTE_LIMITS.email - '@example.org'.length)}@example.org`,
  company: 'ş'.repeat(QUOTE_LIMITS.company),
  role: 'ş'.repeat(QUOTE_LIMITS.role),
  country: 'ş'.repeat(QUOTE_LIMITS.country),
  message: 'ş'.repeat(QUOTE_LIMITS.message),
  [TURNSTILE_FIELD]: 't'.repeat(QUOTE_LIMITS.token),
};

test('an all-max non-ASCII multipart form fits under the cap and is sent', async () => {
  const h = harness();
  const request = formPost(MAX_FIELDS);
  const size = (await request.clone().arrayBuffer()).byteLength;
  assert.ok(size < MAX_BODY, `${size} bytes`);
  assert.equal(location(await handleQuote(request, ENV, h.deps)), `${ORIGIN}/quote/#sent`);
  assert.equal(h.sent.length, 1);
});

test('the same all-max payload urlencoded exceeds the cap (why the form is multipart)', async () => {
  const body = new URLSearchParams(fields(MAX_FIELDS));
  const response = await handleQuote(post(body), ENV, harness().deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
});

test('a token over QUOTE_LIMITS.token is #error-verify without fetch', async () => {
  const h = harness();
  const response = await handleQuote(
    formPost({ [TURNSTILE_FIELD]: 't'.repeat(QUOTE_LIMITS.token + 1) }),
    ENV,
    h.deps,
  );
  assert.equal(location(response), `${ORIGIN}/quote/#error-verify`);
  assert.equal(h.fetched.length, 0);
});

test('an empty token is #error-verify without fetch', async () => {
  const h = harness();
  const response = await handleQuote(formPost({ [TURNSTILE_FIELD]: '' }), ENV, h.deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-verify`);
  assert.equal(h.fetched.length, 0);
});

test('no turnstile field (no-JS post) is #error-verify without fetch', async () => {
  const h = harness();
  const entries = fields().filter(([key]) => key !== TURNSTILE_FIELD);
  const response = await handleQuote(post(multipart(entries)), ENV, h.deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-verify`);
  assert.equal(h.fetched.length, 0);
});

test('an unknown solution or CR/LF in a header-bound field is #error-invalid', async () => {
  const h = harness();
  const unknown = await handleQuote(formPost({ solutions: ['mystery'] }), ENV, h.deps);
  assert.equal(location(unknown), `${ORIGIN}/quote/#error-invalid`);
  const crlf = await handleQuote(formPost({ name: 'Ada\r\nBcc: x@y.z' }), ENV, h.deps);
  assert.equal(location(crlf), `${ORIGIN}/quote/#error-invalid`);
  assert.equal(h.fetched.length, 0);
});

test('siteverify failures all land on #error-verify', async () => {
  const cases = [
    harness({ verify: { success: false } }),
    harness({ verify: { ...GOOD_VERIFY, hostname: 'other.example' } }),
    harness({ verify: { ...GOOD_VERIFY, action: 'login' } }),
    harness({ fetchThrows: true }),
  ];
  for (const h of cases) {
    const response = await handleQuote(formPost(), ENV, h.deps);
    assert.equal(location(response), `${ORIGIN}/quote/#error-verify`);
    assert.equal(h.sent.length, 0);
  }
});

test('a rejecting send is #error-send', async () => {
  const response = await handleQuote(formPost(), ENV, harness({ sendThrows: true }).deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-send`);
});

test('missing config is #error-send and nothing is verified or sent', async () => {
  for (const env of [
    { ...ENV, QUOTE_TO: undefined },
    { ...ENV, QUOTE_FROM: undefined },
    { ...ENV, TURNSTILE_SECRET_KEY: undefined },
    { ...ENV, MAX_BODY_BYTES: 'abc' },
  ]) {
    const h = harness();
    const response = await handleQuote(formPost(), env, h.deps);
    assert.equal(location(response), `${ORIGIN}/quote/#error-send`);
    assert.equal(h.fetched.length, 0);
    assert.equal(h.sent.length, 0);
  }
});

test('every response carries the Worker security headers', async () => {
  const responses = [
    await handleQuote(formPost(), ENV, harness().deps),
    await handleQuote(formPost({}, { Origin: 'https://evil.example' }), ENV, harness().deps),
    await handleQuote(new Request(URL_QUOTE), ENV, harness().deps),
  ];
  for (const response of responses) {
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.match(response.headers.get('Strict-Transport-Security') ?? '', /max-age=31536000/);
  }
});

test('console.error gets exactly { code, step } and never the visitor email', async (t: TestContext) => {
  const calls: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    calls.push(args);
  });
  await handleQuote(formPost({}, { Origin: 'https://evil.example' }), ENV, harness().deps);
  await handleQuote(formPost({ [TURNSTILE_FIELD]: '' }), ENV, harness().deps);
  await handleQuote(formPost(), ENV, harness({ sendThrows: true }).deps);
  await handleQuote(formPost(), ENV, harness({ fetchThrows: true }).deps);
  assert.ok(calls.length >= 4);
  for (const args of calls) {
    assert.equal(args.length, 1);
    assert.deepEqual(Object.keys(args[0] as object).sort(), ['code', 'step']);
    assert.equal(JSON.stringify(args).includes('visitor@example.org'), false);
  }
});

test('a body stream that errors mid-upload is a 303 #error-invalid with Worker headers', async (t: TestContext) => {
  const calls: unknown[][] = [];
  t.mock.method(console, 'error', (...args: unknown[]) => {
    calls.push(args);
  });
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error('disconnect'));
    },
  });
  const request = new Request(URL_QUOTE, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    duplex: 'half',
  } as RequestInit);
  const response = await handleQuote(request, ENV, harness().deps);
  assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(calls, [[{ code: 'guard', step: 'body' }]]);
});

test('early guard failures take the locale from the Referer path via isLocale only', async () => {
  const tr = await handleQuote(
    formPost({}, { Origin: 'https://evil.example', Referer: `${ORIGIN}/tr/quote/` }),
    ENV,
    harness().deps,
  );
  assert.equal(location(tr), `${ORIGIN}/tr/quote/#error-invalid`);
  for (const referer of [
    'https://evil.example/\\tr/',
    'javascript:alert(1)',
    'not a url',
    'https://x.example/tx/quote/',
  ]) {
    const response = await handleQuote(
      formPost({}, { Origin: 'https://evil.example', Referer: referer }),
      ENV,
      harness().deps,
    );
    assert.equal(location(response), `${ORIGIN}/quote/#error-invalid`);
  }
});
