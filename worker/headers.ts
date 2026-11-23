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
