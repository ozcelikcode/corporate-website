/**
 * Keystatic admin config (bundled into `/keystatic/` only). `pnpm dev` edits the working tree
 * through the dev-only local API; a build commits through GitHub. The dev API and the parity test
 * build their own local-mode config from the same pieces, because `import.meta.env` exists only
 * inside Vite.
 */
import { type Config, config } from '@keystatic/core';
import { SINGLETON_NAVIGATION, singletons } from './src/keystatic/singletons.ts';
import { GITHUB_STORAGE, LOCAL_STORAGE } from './src/keystatic/storage.ts';

// The admin component takes the default-generic `Config`; `ui.navigation` makes a narrower one
// unassignable (TypeScript reads it as invariant), so the generics are widened here.
type AnyCollections = NonNullable<Config['collections']>;
type AnySingletons = NonNullable<Config['singletons']>;

export default config<AnyCollections, AnySingletons>({
  storage: import.meta.env.DEV ? LOCAL_STORAGE : GITHUB_STORAGE,
  singletons,
  ui: { navigation: SINGLETON_NAVIGATION },
});
