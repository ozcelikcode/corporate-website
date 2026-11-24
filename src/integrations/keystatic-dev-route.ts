/**
 * How the dev server treats a request path for Keystatic: `api` goes to the local-mode API
 * handler, `shell` serves the static admin page (so reloads and deep links work), `pass` leaves
 * the request to Vite and Astro (admin page assets carry a dot and pass too).
 */
export type KeystaticDevRoute = 'api' | 'shell' | 'pass';

export const KEYSTATIC_API_PREFIX = '/api/keystatic/';
export const KEYSTATIC_SHELL_PATH = '/keystatic/';
const FILE_EXTENSION_MARK = '.';

export function keystaticDevRoute(pathname: string): KeystaticDevRoute {
  if (pathname.startsWith(KEYSTATIC_API_PREFIX)) return 'api';
  if (pathname.startsWith(KEYSTATIC_SHELL_PATH) && !pathname.includes(FILE_EXTENSION_MARK)) {
    return 'shell';
  }
  return 'pass';
}
