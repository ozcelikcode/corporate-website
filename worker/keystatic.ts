import { KEYSTATIC_API_PREFIX, KEYSTATIC_SHELL_PATH } from '../src/keystatic/paths.ts';
import { withAdminHeaders, withWorkerHeaders } from './headers.ts';

export type KeystaticEnv = {
  KEYSTATIC_GITHUB_CLIENT_ID?: string;
  KEYSTATIC_GITHUB_CLIENT_SECRET?: string;
  KEYSTATIC_SECRET?: string;
};

export type KeystaticApiResult = {
  body: BodyInit | null;
  status: number;
  headers: [string, string][];
};

export type KeystaticDeps = {
  assets: Fetcher;
  api: (request: Request) => Promise<KeystaticApiResult>;
};

/** What the generic handler returns: status and headers are optional, headers may be any init. */
export type KeystaticHandlerResult = {
  body: BodyInit | null;
  status?: number;
  headers?: HeadersInit;
};

const STATUS_OK = 200;
const STATUS_UNAVAILABLE = 503;
const STATUS_SERVER_ERROR = 500;
/** Cookie-signing secret floor, as Keystatic documents it. */
const MIN_SECRET_LENGTH = 32;
const FAILURE_TEXT = 'Keystatic is unavailable.';

/** The only server-side log: a code and a step, never request data. */
function fail(code: 'config' | 'keystatic', step: 'keystatic' | 'api' | 'shell'): void {
  console.error({ code, step });
}

function failure(status: number): Response {
  return withWorkerHeaders(new Response(FAILURE_TEXT, { status }));
}

function isConfigured(env: KeystaticEnv): boolean {
  return Boolean(
    env.KEYSTATIC_GITHUB_CLIENT_ID &&
      env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
      env.KEYSTATIC_SECRET &&
      env.KEYSTATIC_SECRET.length >= MIN_SECRET_LENGTH,
  );
}

/** Any header init becomes pairs through `Headers` (its iteration yields each Set-Cookie). */
export function toApiResult({
  body,
  status = STATUS_OK,
  headers = [],
}: KeystaticHandlerResult): KeystaticApiResult {
  return { body, status, headers: [...new Headers(headers)] };
}

async function handleApi(
  request: Request,
  env: KeystaticEnv,
  deps: KeystaticDeps,
): Promise<Response> {
  if (!isConfigured(env)) {
    fail('config', 'keystatic');
    return failure(STATUS_UNAVAILABLE);
  }
  try {
    const { body, status, headers } = await deps.api(request);
    // A header-pair array keeps both Set-Cookie headers (a plain object would merge them).
    return withWorkerHeaders(new Response(body, { status, headers }));
  } catch {
    fail('keystatic', 'api');
    return failure(STATUS_SERVER_ERROR);
  }
}

async function handleAdmin(request: Request, deps: KeystaticDeps): Promise<Response> {
  // Every admin path is a client-side route (branch names may contain dots): always the shell.
  const shell = new Request(new URL(KEYSTATIC_SHELL_PATH, request.url), request);
  try {
    return withAdminHeaders(await deps.assets.fetch(shell));
  } catch {
    fail('keystatic', 'shell');
    return failure(STATUS_SERVER_ERROR);
  }
}

export function handleKeystatic(
  request: Request,
  env: KeystaticEnv,
  deps: KeystaticDeps,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  return pathname.startsWith(KEYSTATIC_API_PREFIX)
    ? handleApi(request, env, deps)
    : handleAdmin(request, deps);
}
