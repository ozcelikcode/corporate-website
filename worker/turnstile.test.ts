import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SITEVERIFY_URL, type TurnstileCheck, verifyTurnstile } from './turnstile.ts';

const CHECK: TurnstileCheck = {
  token: 'tok',
  secret: 'sec',
  remoteip: '203.0.113.9',
  hostname: 'site.example',
  action: 'quote',
};

function respond(body: unknown): typeof fetch {
  return async () => new Response(typeof body === 'string' ? body : JSON.stringify(body));
}

test('POSTs secret, response and remoteip as a form body to SITEVERIFY_URL', async () => {
  let seen: { url: string; init: RequestInit | undefined } | undefined;
  const fetchFn: typeof fetch = async (input, init) => {
    seen = { url: String(input), init };
    return new Response(
      JSON.stringify({ success: true, hostname: 'site.example', action: 'quote' }),
    );
  };
  await verifyTurnstile(CHECK, fetchFn);
  assert.equal(seen?.url, SITEVERIFY_URL);
  assert.equal(seen?.init?.method, 'POST');
  const body = new URLSearchParams(String(seen?.init?.body));
  assert.equal(body.get('secret'), 'sec');
  assert.equal(body.get('response'), 'tok');
  assert.equal(body.get('remoteip'), '203.0.113.9');
});

test('omits remoteip when unknown', async () => {
  let body = '';
  const fetchFn: typeof fetch = async (_input, init) => {
    body = String(init?.body);
    return new Response('{}');
  };
  await verifyTurnstile({ ...CHECK, remoteip: null }, fetchFn);
  assert.equal(new URLSearchParams(body).has('remoteip'), false);
});

test('success with matching hostname and action is ok', async () => {
  const result = await verifyTurnstile(
    CHECK,
    respond({ success: true, hostname: 'site.example', action: 'quote' }),
  );
  assert.deepEqual(result, { ok: true });
});

test('failures map to rejected, hostname and action', async () => {
  assert.deepEqual(await verifyTurnstile(CHECK, respond({ success: false })), {
    ok: false,
    reason: 'rejected',
  });
  assert.deepEqual(
    await verifyTurnstile(
      CHECK,
      respond({ success: true, hostname: 'other.example', action: 'quote' }),
    ),
    { ok: false, reason: 'hostname' },
  );
  assert.deepEqual(
    await verifyTurnstile(
      CHECK,
      respond({ success: true, hostname: 'site.example', action: 'login' }),
    ),
    { ok: false, reason: 'action' },
  );
});

test('a throwing fetch, a non-JSON body or an HTTP error is a network failure', async () => {
  const throwing: typeof fetch = async () => {
    throw new Error('down');
  };
  assert.deepEqual(await verifyTurnstile(CHECK, throwing), { ok: false, reason: 'network' });
  assert.deepEqual(await verifyTurnstile(CHECK, respond('<html>')), {
    ok: false,
    reason: 'network',
  });
  const failing: typeof fetch = async () => new Response('{}', { status: 500 });
  assert.deepEqual(await verifyTurnstile(CHECK, failing), { ok: false, reason: 'network' });
});
