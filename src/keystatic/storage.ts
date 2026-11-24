/**
 * Keystatic storage modes: `local` writes the working tree through the dev-only API
 * (`integrations/keystatic-dev.ts`); `github` commits through the GitHub API in production.
 */
import type { GitHubConfig, LocalConfig } from '@keystatic/core';
import { KEYSTATIC_REPO } from './repo.ts';

export const LOCAL_STORAGE: LocalConfig['storage'] = { kind: 'local' };
export const GITHUB_STORAGE: GitHubConfig['storage'] = { kind: 'github', repo: KEYSTATIC_REPO };
