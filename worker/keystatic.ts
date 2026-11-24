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

export const KEYSTATIC_API_PREFIX = '/api/keystatic/';
export const KEYSTATIC_ADMIN_PREFIX = '/keystatic/';

const STATUS_UNAVAILABLE = 503;
const STATUS_SERVER_ERROR = 500;
const FAILURE_TEXT = 'Keystatic is unavailable.';

/** The only server-side log: a code and a step, never request data. */
function fail(code: 'config' | 'keystatic', step: 'keystatic' | 'api'): void {
  console.error({ code, step });
}

function failure(status: number): Response {
  return withWorkerHeaders(new Response(FAILURE_TEXT, { status }));
}

function isConfigured(env: KeystaticEnv): boolean {
  return Boolean(
    env.KEYSTATIC_GITHUB_CLIENT_ID && env.KEYSTATIC_GITHUB_CLIENT_SECRET && env.KEYSTATIC_SECRET,
  );
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
  const url = new URL(request.url);
  const lastSegment = url.pathname.split('/').pop() ?? '';
  // Files (the admin module, its assets) pass through; every other path is the SPA route.
  const target = lastSegment.includes('.')
    ? request
    : new Request(new URL(KEYSTATIC_ADMIN_PREFIX, url), request);
  return withAdminHeaders(await deps.assets.fetch(target));
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
