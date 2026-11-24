import { PUBLIC_KEYSTATIC_GITHUB_APP_SLUG, PUBLIC_TURNSTILE_SITE_KEY } from 'astro:env/client';
import { SITE_URL, WORKERS_CI_BRANCH } from 'astro:env/server';
import { type BuildMode, resolveBuildMode } from './build-mode.ts';

export const BUILD: BuildMode = resolveBuildMode({
  WORKERS_CI_BRANCH,
  SITE_URL,
  PUBLIC_TURNSTILE_SITE_KEY,
  PUBLIC_KEYSTATIC_GITHUB_APP_SLUG,
});
