/**
 * The one Keystatic config, per storage mode. `keystatic.config.ts` (the admin) picks the mode;
 * the dev API and the parity test use `LOCAL_CONFIG`, so every singleton and collection added here
 * reaches all three.
 */
import { type Config, config } from '@keystatic/core';
import { brandMark } from './brand-mark.ts';
import { collections } from './collections.ts';
import { LOCALE_NAMES } from './locale-names.ts';
import { singletons } from './singletons.ts';
import { LOCAL_STORAGE } from './storage.ts';

// The admin component takes the default-generic `Config`; `ui.navigation` makes a narrower one
// unassignable (TypeScript reads it as invariant), so the generics are widened here.
type AnyCollections = NonNullable<Config['collections']>;
type AnySingletons = NonNullable<Config['singletons']>;
type EntryName = keyof typeof collections | keyof typeof singletons;

/** The sidebar name; generic, since the admin serves any tenant. */
const ADMIN_BRAND_NAME = 'Content';

/** Sidebar groups (Keystatic `ui.navigation`). */
const ADMIN_NAVIGATION: Record<string, EntryName[]> = {
  Site: ['settings'],
  [LOCALE_NAMES.en]: ['pagesEn', 'applicationsEn', 'navigationEn', 'uiEn'],
  [LOCALE_NAMES.tr]: ['pagesTr', 'applicationsTr', 'navigationTr', 'uiTr'],
};

export function keystaticConfig(storage: Config['storage']): Config {
  return config<AnyCollections, AnySingletons>({
    storage,
    collections,
    singletons,
    ui: { brand: { name: ADMIN_BRAND_NAME, mark: brandMark }, navigation: ADMIN_NAVIGATION },
  });
}

export const LOCAL_CONFIG = keystaticConfig(LOCAL_STORAGE);
