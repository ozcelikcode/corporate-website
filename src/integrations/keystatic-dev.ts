/**
 * Dev-only Keystatic local mode: serves the local-storage API at `/api/keystatic/*` (it reads and
 * writes the working tree), the admin shell for every `/keystatic/*` deep link and the `/admin`
 * redirect to it. Only
 * `astro dev` registers it; production uses GitHub mode through the Worker, and nothing from this
 * file reaches `dist/`.
 *
 * Coupled to Astro 7 / Vite 8 internals; re-check on every Astro or Vite upgrade:
 * - The middleware is unshifted onto `server.middlewares.stack` from a post `configureServer`
 *   hook, so it runs before Astro's trailing-slash and route-guard middleware (which would 404
 *   `/api/keystatic/tree` and slash-less deep links). `astro:server:setup` is too late. Index 0
 *   is also ahead of Vite's cors and host-validation middleware, hence its own Host check.
 * - `@keystatic/core/api/generic` and the config pieces are imported statically: this file runs
 *   in Astro's config-loader module runner, which is closed by the time requests arrive, so a
 *   request-time `import()` fails with "Vite module runner has been closed".
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import type { AstroIntegration } from 'astro';
import { LOCAL_CONFIG } from '../keystatic/keystatic-config.ts';
import { isLocalDevHost, KEYSTATIC_SHELL_PATH, keystaticDevRoute } from './keystatic-dev-route.ts';

const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_MOVED_PERMANENTLY = 301;
const DEFAULT_METHOD = 'GET';
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
/** Routing and the handler only read the path, so a fixed origin keeps the Host header out. */
const LOCAL_ORIGIN = 'http://localhost';

type ApiHandler = ReturnType<typeof makeGenericAPIRouteHandler>;
type AllowedHosts = readonly string[] | true;
type Next = (error?: unknown) => void;

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? KEYSTATIC_SHELL_PATH, LOCAL_ORIGIN);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Uint8Array[] = [];
  // Without `setEncoding` a request streams Buffers; the iterator is typed `any`, so narrow it.
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of [value ?? []].flat()) headers.append(name, item);
  }
  const method = req.method ?? DEFAULT_METHOD;
  const body = BODYLESS_METHODS.has(method) ? null : Buffer.concat(chunks);
  return new Request(requestUrl(req), { method, headers, body });
}

/** Local mode answers with a header object, GitHub mode with pairs; `Headers` takes both. */
async function sendApi(handleApi: ApiHandler, req: IncomingMessage, res: ServerResponse) {
  const result = await handleApi(await toRequest(req));
  res.statusCode = result.status ?? HTTP_OK;
  for (const [name, value] of new Headers(result.headers)) res.appendHeader(name, value);
  res.end(result.body ?? undefined);
}

/**
 * Runs first in the stack, ahead of Vite's host check, so the API checks the Host header itself:
 * a DNS-rebinding page must not list, read or write the working tree.
 */
function keystaticMiddleware(handleApi: ApiHandler, allowedHosts: AllowedHosts) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const route = keystaticDevRoute(requestUrl(req).pathname);
    if (route === 'api') {
      if (!isLocalDevHost(req.headers.host, allowedHosts)) {
        res.statusCode = HTTP_FORBIDDEN;
        res.end();
        return;
      }
      sendApi(handleApi, req, res).catch(next);
      return;
    }
    if (route === 'redirect') {
      res.statusCode = HTTP_MOVED_PERMANENTLY;
      res.setHeader('Location', KEYSTATIC_SHELL_PATH);
      res.end();
      return;
    }
    if (route === 'shell') req.url = KEYSTATIC_SHELL_PATH;
    next();
  };
}

export function keystaticDev(): AstroIntegration {
  return {
    name: 'keystatic-dev',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if (command !== 'dev') return;
        const handleApi = makeGenericAPIRouteHandler({ config: LOCAL_CONFIG });
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'keystatic-dev',
                apply: 'serve',
                configureServer: (server) => () => {
                  const handle = keystaticMiddleware(handleApi, server.config.server.allowedHosts);
                  server.middlewares.stack.unshift({ route: '', handle });
                },
              },
            ],
          },
        });
      },
    },
  };
}
