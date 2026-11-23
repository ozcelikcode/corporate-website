export const PRODUCTION_BRANCH = 'main';
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
// Interim: previews are noindex and visual-review only, so localhost canonicals do no harm.
export const PREVIEW_SITE_URL = 'http://localhost:4321';

const HTTPS_PREFIX = 'https://';
const TRAILING_SLASHES = /\/+$/;

export type BuildEnv = Readonly<
  Partial<
    Record<'WORKERS_CI_BRANCH' | 'SITE_URL' | 'PUBLIC_TURNSTILE_SITE_KEY', string | undefined>
  >
>;

export type BuildMode = {
  isProduction: boolean;
  siteUrl: string;
  turnstileSiteKey: string;
};

function requireVar(value: string | undefined, name: string): string {
  if (value === undefined || value === '') {
    throw new Error(`${name} is required for a production build`);
  }
  return value;
}

export function resolveBuildMode(env: BuildEnv): BuildMode {
  if (env.WORKERS_CI_BRANCH !== PRODUCTION_BRANCH) {
    return {
      isProduction: false,
      siteUrl: PREVIEW_SITE_URL,
      turnstileSiteKey: TURNSTILE_TEST_SITE_KEY,
    };
  }
  const siteUrl = requireVar(env.SITE_URL, 'SITE_URL');
  if (!siteUrl.startsWith(HTTPS_PREFIX)) {
    throw new Error(`SITE_URL must start with ${HTTPS_PREFIX}`);
  }
  return {
    isProduction: true,
    siteUrl: siteUrl.replace(TRAILING_SLASHES, ''),
    turnstileSiteKey: requireVar(env.PUBLIC_TURNSTILE_SITE_KEY, 'PUBLIC_TURNSTILE_SITE_KEY'),
  };
}
