/** Security headers for Worker responses; `public/_headers` only applies to static assets. */
export const WORKER_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cache-Control': 'no-store',
} as const;

export function withWorkerHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(WORKER_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

/** Relaxed policy for the Keystatic admin only: the GitHub hosts in connect-src, nothing else widened. */
export const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

const ADMIN_ONLY_HEADERS = {
  'Content-Security-Policy': ADMIN_CSP,
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

/** `set` replaces the `/*` policy that `_headers` put on the asset, so exactly one CSP is sent. */
export function withAdminHeaders(response: Response): Response {
  const secured = withWorkerHeaders(response);
  for (const [name, value] of Object.entries(ADMIN_ONLY_HEADERS)) secured.headers.set(name, value);
  return secured;
}
