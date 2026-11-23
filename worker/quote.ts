import { isLocale, type Locale, localizePath } from '../src/lib/i18n.ts';
import {
  formDataToInput,
  QUOTE_LIMITS,
  type QuoteState,
  quoteSchema,
  TURNSTILE_FIELD,
} from '../src/lib/quote-schema.ts';
import { withWorkerHeaders } from './headers.ts';
import { buildQuoteEmail } from './mail.ts';
import { verifyTurnstile } from './turnstile.ts';

export type QuoteEnv = {
  TURNSTILE_SECRET_KEY?: string;
  QUOTE_TO?: string;
  QUOTE_FROM?: string;
  MAX_BODY_BYTES: string;
};

export type OutgoingMail = { from: string; to: string; raw: string };

export type QuoteDeps = {
  allowList: ReadonlySet<string>;
  fetch: typeof fetch;
  send: (mail: OutgoingMail) => Promise<void>;
  now: () => Date;
  messageId: () => string;
};

type LogCode = 'guard' | 'invalid' | 'verify' | 'send' | 'config';

const TURNSTILE_ACTION = 'quote';
const QUOTE_PATH = '/quote/';
const LOCALE_FIELD = 'locale';
const FALLBACK_LOCALE: Locale = 'en';
const REMOTE_IP_HEADER = 'CF-Connecting-IP';
const FORM_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data']);
const STATUS_SEE_OTHER = 303;
const STATUS_METHOD_NOT_ALLOWED = 405;
const DIGITS = /^\d+$/;

/** The only server-side log: a code and a step, never request data. */
function fail(code: LogCode, step: string): void {
  console.error({ code, step });
}

function redirect(origin: string, locale: Locale, state: QuoteState): Response {
  const location = `${origin}${localizePath(QUOTE_PATH, locale)}#${state}`;
  return withWorkerHeaders(
    new Response(null, { status: STATUS_SEE_OTHER, headers: { Location: location } }),
  );
}

function parseLimit(value: string): number | null {
  return DIGITS.test(value) ? Number(value) : null;
}

function mediaType(request: Request): string {
  return (request.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
}

/** Reads at most `limit` bytes; null when the body is larger (reading stops at the cap). */
async function readCapped(request: Request, limit: number): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function declaredLengthTooLarge(request: Request, limit: number): boolean {
  const declared = request.headers.get('Content-Length');
  if (declared === null) return false;
  const length = parseLimit(declared);
  return length === null || length > limit;
}

async function parseForm(request: Request, limit: number): Promise<FormData | null> {
  const headers = { 'Content-Type': request.headers.get('Content-Type') ?? '' };
  try {
    const bytes = await readCapped(request, limit);
    if (bytes === null) return null;
    return await new Response(bytes, { headers }).formData();
  } catch {
    return null;
  }
}

/** Locale for failures before the form is read: the Referer's first path segment, via `isLocale` only. */
function refererLocale(request: Request): Locale {
  const referer = request.headers.get('Referer');
  if (referer === null || !URL.canParse(referer)) return FALLBACK_LOCALE;
  const segment = new URL(referer).pathname.split('/')[1];
  return isLocale(segment) ? segment : FALLBACK_LOCALE;
}

function localeOf(form: FormData): Locale {
  const value = form.get(LOCALE_FIELD);
  return isLocale(value) ? value : FALLBACK_LOCALE;
}

function tokenOf(form: FormData): string {
  const value = form.get(TURNSTILE_FIELD);
  return typeof value === 'string' ? value : '';
}

export async function handleQuote(
  request: Request,
  env: QuoteEnv,
  deps: QuoteDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return withWorkerHeaders(
      new Response(null, { status: STATUS_METHOD_NOT_ALLOWED, headers: { Allow: 'POST' } }),
    );
  }
  const { origin, hostname } = new URL(request.url);
  const earlyLocale = refererLocale(request);
  const invalid = (code: LogCode, step: string, locale: Locale = earlyLocale): Response => {
    fail(code, step);
    return redirect(origin, locale, 'error-invalid');
  };

  if (request.headers.get('Origin') !== origin) return invalid('guard', 'origin');
  if (!FORM_TYPES.has(mediaType(request))) return invalid('guard', 'content-type');
  const limit = parseLimit(env.MAX_BODY_BYTES);
  if (limit === null) {
    fail('config', 'max-body');
    return redirect(origin, earlyLocale, 'error-send');
  }
  if (declaredLengthTooLarge(request, limit)) return invalid('guard', 'content-length');
  const form = await parseForm(request, limit);
  if (form === null) return invalid('guard', 'body');

  const locale = localeOf(form);
  const parsed = quoteSchema.safeParse(formDataToInput(form));
  if (!parsed.success) return invalid('invalid', 'schema', locale);
  const quote = parsed.data;
  if (!quote.solutions.every((solution) => deps.allowList.has(solution))) {
    return invalid('invalid', 'solutions', locale);
  }

  const token = tokenOf(form);
  if (token === '' || token.length > QUOTE_LIMITS.token) {
    fail('verify', 'token');
    return redirect(origin, locale, 'error-verify');
  }

  const { TURNSTILE_SECRET_KEY: secret, QUOTE_TO: to, QUOTE_FROM: from } = env;
  if (!secret || !to || !from) {
    fail('config', 'secrets');
    return redirect(origin, locale, 'error-send');
  }

  const verdict = await verifyTurnstile(
    {
      token,
      secret,
      remoteip: request.headers.get(REMOTE_IP_HEADER),
      hostname,
      action: TURNSTILE_ACTION,
    },
    deps.fetch,
  );
  if (!verdict.ok) {
    fail('verify', verdict.reason);
    return redirect(origin, locale, 'error-verify');
  }

  try {
    const raw = buildQuoteEmail({ from, to, quote, date: deps.now(), messageId: deps.messageId() });
    await deps.send({ from, to, raw });
  } catch {
    fail('send', 'send');
    return redirect(origin, locale, 'error-send');
  }
  return redirect(origin, locale, 'sent');
}
