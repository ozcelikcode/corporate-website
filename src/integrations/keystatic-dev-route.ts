/**
 * How the dev server treats a request for Keystatic: `api` goes to the local-mode API handler,
 * `shell` serves the static admin page (so reloads and deep links work), `pass` leaves the
 * request to Vite and Astro, `redirect` sends `/admin` and everything under it to the shell (the
 * production `_redirects` rule does not run under `astro dev`). `isLocalDevHost` gates the API, which reads and writes the working
 * tree and runs ahead of Vite's own host check.
 */
import { KEYSTATIC_API_PREFIX, KEYSTATIC_SHELL_PATH } from '../keystatic/paths.ts';

export type KeystaticDevRoute = 'api' | 'shell' | 'redirect' | 'pass';

export { KEYSTATIC_SHELL_PATH };

const FILE_EXTENSION_MARK = '.';
const ADMIN_ALIAS = '/admin';
const PATH_SEPARATOR = '/';

/** A Host header: a name or IPv4, or a bracketed IPv6, then an optional port. Nothing else. */
const HOST_HEADER = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d+)?$/i;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOCALHOST_SUFFIX = '.localhost';
/** Vite's `allowedHosts` syntax: a leading dot allows the domain and all its subdomains. */
const SUBDOMAIN_WILDCARD = '.';

export function keystaticDevRoute(pathname: string): KeystaticDevRoute {
  if (pathname.startsWith(KEYSTATIC_API_PREFIX)) return 'api';
  if (pathname === ADMIN_ALIAS || pathname.startsWith(ADMIN_ALIAS + PATH_SEPARATOR)) {
    return 'redirect';
  }
  // A path with a dot is an asset. Keystatic deep links carry entry slugs, which have no dots
  // under the current slug rules, so every real deep link still gets the shell.
  if (pathname.startsWith(KEYSTATIC_SHELL_PATH) && !pathname.includes(FILE_EXTENSION_MARK)) {
    return 'shell';
  }
  return 'pass';
}

function matchesAllowedHost(hostname: string, allowed: string): boolean {
  const entry = allowed.toLowerCase();
  if (!entry.startsWith(SUBDOMAIN_WILDCARD)) return hostname === entry;
  return hostname === entry.slice(SUBDOMAIN_WILDCARD.length) || hostname.endsWith(entry);
}

/**
 * Whether a request's Host header names this machine (localhost, `*.localhost`, 127.0.0.1,
 * [::1], any port) or a host listed in Vite's resolved `server.allowedHosts`. `true` there (Vite
 * allows any host) does not widen this check. A missing or malformed header is refused, so a
 * DNS-rebinding page never reaches the local write API.
 */
export function isLocalDevHost(
  host: string | undefined,
  allowedHosts: readonly string[] | true,
): boolean {
  const hostname = host?.match(HOST_HEADER)?.[1]?.toLowerCase();
  if (hostname === undefined) return false;
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(LOCALHOST_SUFFIX)) return true;
  return (
    allowedHosts !== true && allowedHosts.some((allowed) => matchesAllowedHost(hostname, allowed))
  );
}
