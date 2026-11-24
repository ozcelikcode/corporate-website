export const PRODUCTION_BRANCH = 'main';
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
// Interim: previews are noindex and visual-review only, so localhost canonicals do no harm.
export const PREVIEW_SITE_URL = 'http://localhost:4321';

const HTTPS_PROTOCOL = 'https:';
const TRAILING_SLASHES = /\/+$/;

export type BuildEnv = Readonly<
  Partial<
    Record<
      | 'WORKERS_CI_BRANCH'
      | 'SITE_URL'
      | 'PUBLIC_TURNSTILE_SITE_KEY'
      | 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG',
      string | undefined
    >
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
  if (!URL.canParse(siteUrl) || new URL(siteUrl).protocol !== HTTPS_PROTOCOL) {
    throw new Error('SITE_URL must be an https URL with a host');
  }
  // Baked into the admin bundle: without it the GitHub-mode admin cannot start a sign-in.
  requireVar(env.PUBLIC_KEYSTATIC_GITHUB_APP_SLUG, 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG');
  return {
    isProduction: true,
    siteUrl: siteUrl.replace(TRAILING_SLASHES, ''),
    turnstileSiteKey: requireVar(env.PUBLIC_TURNSTILE_SITE_KEY, 'PUBLIC_TURNSTILE_SITE_KEY'),
  };
}
