/**
 * Dev-only Keystatic local mode: serves the local-storage API at `/api/keystatic/*` (it reads and
 * writes the working tree) and the admin shell for every `/keystatic/*` deep link. Only
 * `astro dev` registers it; production uses GitHub mode through the Worker, and nothing from this
 * file reaches `dist/`.
 *
 * Coupled to Astro 7 / Vite 8 internals; re-check on every Astro or Vite upgrade:
 * - The middleware is unshifted onto `server.middlewares.stack` from a post `configureServer`
 *   hook, so it runs before Astro's trailing-slash and route-guard middleware (which would 404
 *   `/api/keystatic/tree` and slash-less deep links). `astro:server:setup` is too late.
 * - `@keystatic/core/api/generic` and the config pieces are imported statically: this file runs
 *   in Astro's config-loader module runner, which is closed by the time requests arrive, so a
 *   request-time `import()` fails with "Vite module runner has been closed".
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '@keystatic/core';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import type { AstroIntegration } from 'astro';
import { singletons } from '../keystatic/singletons.ts';
import { LOCAL_STORAGE } from '../keystatic/storage.ts';
import { KEYSTATIC_SHELL_PATH, keystaticDevRoute } from './keystatic-dev-route.ts';

const HTTP_OK = 200;
const DEFAULT_METHOD = 'GET';
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
/** Only the path matters to the handler; the host fills in when a request has none. */
const FALLBACK_HOST = 'localhost';

type ApiHandler = ReturnType<typeof makeGenericAPIRouteHandler>;
type Next = (error?: unknown) => void;

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? KEYSTATIC_SHELL_PATH, `http://${req.headers.host ?? FALLBACK_HOST}`);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk);
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

function keystaticMiddleware(handleApi: ApiHandler) {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    const route = keystaticDevRoute(requestUrl(req).pathname);
    if (route === 'api') {
      sendApi(handleApi, req, res).catch(next);
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
        const middleware = keystaticMiddleware(
          makeGenericAPIRouteHandler({ config: config({ storage: LOCAL_STORAGE, singletons }) }),
        );
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'keystatic-dev',
                apply: 'serve',
                configureServer: (server) => () => {
                  server.middlewares.stack.unshift({ route: '', handle: middleware });
                },
              },
            ],
          },
        });
      },
    },
  };
}
