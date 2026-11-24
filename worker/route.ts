import { KEYSTATIC_API_PREFIX, KEYSTATIC_SHELL_PATH } from '../src/keystatic/paths.ts';

export type WorkerRoute = 'quote' | 'keystatic' | 'assets';

const QUOTE_PATH = '/api/quote';

/** Which handler owns a path; everything else is a static asset. */
export function routeFor(pathname: string): WorkerRoute {
  if (pathname === QUOTE_PATH) return 'quote';
  if (pathname.startsWith(KEYSTATIC_API_PREFIX) || pathname.startsWith(KEYSTATIC_SHELL_PATH)) {
    return 'keystatic';
  }
  return 'assets';
}
