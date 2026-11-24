/**
 * Keystatic admin config (bundled into `/keystatic/` only). `pnpm dev` edits the working tree
 * through the dev-only local API; a build commits through GitHub. The pieces live in
 * `src/keystatic/keystatic-config.ts`, shared with the dev API and the parity test.
 */
import { keystaticConfig } from './src/keystatic/keystatic-config.ts';
import { GITHUB_STORAGE, LOCAL_STORAGE } from './src/keystatic/storage.ts';

export default keystaticConfig(import.meta.env.DEV ? LOCAL_STORAGE : GITHUB_STORAGE);
