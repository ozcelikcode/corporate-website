import { EmailMessage } from 'cloudflare:email';
import solutions from './generated/solutions.json' with { type: 'json' };
import { handleQuote, type QuoteDeps, type QuoteEnv } from './quote.ts';

type Env = QuoteEnv & { ASSETS: Fetcher; QUOTE_MAILER: SendEmail };

const QUOTE_PATH = '/api/quote';
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

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === QUOTE_PATH) {
      return handleQuote(request, env, depsFor(env));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
