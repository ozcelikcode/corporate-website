import { EmailMessage } from 'cloudflare:email';
import { makeGenericAPIRouteHandler } from '@keystatic/core/api/generic';
import { KEYSTATIC_REPO } from '../src/keystatic/repo.ts';
import solutions from './generated/solutions.json' with { type: 'json' };
import {
  handleKeystatic,
  type KeystaticDeps,
  type KeystaticEnv,
  toApiResult,
} from './keystatic.ts';
import { handleQuote, type QuoteDeps, type QuoteEnv } from './quote.ts';
import { routeFor } from './route.ts';

type Env = QuoteEnv & KeystaticEnv & { ASSETS: Fetcher; QUOTE_MAILER: SendEmail };
type HandlerConfig = Parameters<typeof makeGenericAPIRouteHandler>[0]['config'];

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
      return toApiResult(await handler(request));
    },
  };
}

export default {
  fetch(request, env) {
    switch (routeFor(new URL(request.url).pathname)) {
      case 'quote':
        return handleQuote(request, env, depsFor(env));
      case 'keystatic':
        return handleKeystatic(request, env, keystaticDepsFor(env));
      case 'assets':
        return env.ASSETS.fetch(request);
    }
  },
} satisfies ExportedHandler<Env>;
