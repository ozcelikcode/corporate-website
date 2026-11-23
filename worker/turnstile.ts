export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const SITEVERIFY_TIMEOUT_MS = 5000;

export type TurnstileCheck = {
  token: string;
  secret: string;
  remoteip: string | null;
  hostname: string;
  action: string;
};

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: 'network' | 'rejected' | 'hostname' | 'action' };

const NETWORK_FAILURE = { ok: false, reason: 'network' } as const;

type Siteverify = { success?: unknown; hostname?: unknown; action?: unknown };

function isSiteverify(value: unknown): value is Siteverify {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Never throws: every failure, including a timeout, maps to a reason. */
export async function verifyTurnstile(
  check: TurnstileCheck,
  fetchFn: typeof fetch,
): Promise<TurnstileResult> {
  const body = new URLSearchParams({ secret: check.secret, response: check.token });
  if (check.remoteip !== null) body.set('remoteip', check.remoteip);
  let outcome: unknown;
  try {
    const response = await fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return NETWORK_FAILURE;
    outcome = await response.json();
  } catch {
    return NETWORK_FAILURE;
  }
  if (!isSiteverify(outcome) || outcome.success !== true) return { ok: false, reason: 'rejected' };
  if (outcome.hostname !== check.hostname) return { ok: false, reason: 'hostname' };
  if (outcome.action !== check.action) return { ok: false, reason: 'action' };
  return { ok: true };
}
