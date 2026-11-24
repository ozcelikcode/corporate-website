import { EmailMessage } from 'cloudflare:email';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import { KEYSTATIC_REPO } from '../src/keystatic/repo.ts';
import solutions from './generated/solutions.json' with { type: 'json' };
import {
  handleKeystatic,
  KEYSTATIC_ADMIN_PREFIX,
  KEYSTATIC_API_PREFIX,
  type KeystaticDeps,
  type KeystaticEnv,
} from './keystatic.ts';
import { handleQuote, type QuoteDeps, type QuoteEnv } from './quote.ts';

type Env = QuoteEnv & KeystaticEnv & { ASSETS: Fetcher; QUOTE_MAILER: SendEmail };
type HandlerConfig = Parameters<typeof makeGenericAPIRouteHandler>[0]['config'];

const QUOTE_PATH = '/api/quote';
const STATUS_OK = 200;
const SLUG_ENV_NAME = 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG';
/** GitHub storage only (all the handler reads): no schema or field UI enters the Worker bundle. */
const KEYSTATIC_HANDLER_CONFIG: HandlerConfig = {
  storage: { kind: 'github', repo: KEYSTATIC_REPO },
};
const ALLOW_LIST: ReadonlySet<string> = new Set(solutions);

function depsFor(env: Env): QuoteDeps {
  return {
    allowList: ALLOW_LIST,
    fetch,
    send: async ({ from, to, raw }) => {
      await env.QUOTE_MAILER.send(new EmailMessage(from, to, raw));
    },
    now: () => new Date(),
    messageId: () => crypto.randomUUID(),
  };
}

function keystaticDepsFor(env: Env): KeystaticDeps {
  return {
    assets: env.ASSETS,
    api: async (request) => {
      const handler = makeGenericAPIRouteHandler(
        {
          clientId: env.KEYSTATIC_GITHUB_CLIENT_ID,
          clientSecret: env.KEYSTATIC_GITHUB_CLIENT_SECRET,
          secret: env.KEYSTATIC_SECRET,
          config: KEYSTATIC_HANDLER_CONFIG,
        },
        { slugEnvName: SLUG_ENV_NAME },
      );
      const { body, status = STATUS_OK, headers } = await handler(request);
      return { body, status, headers: [...new Headers(headers)] };
    },
  };
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === QUOTE_PATH) {
      return handleQuote(request, env, depsFor(env));
    }
    if (pathname.startsWith(KEYSTATIC_API_PREFIX) || pathname.startsWith(KEYSTATIC_ADMIN_PREFIX)) {
      return handleKeystatic(request, env, keystaticDepsFor(env));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
