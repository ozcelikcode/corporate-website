/** URL prefixes of the Keystatic admin, shared by the dev server integration and the Worker. */
export const KEYSTATIC_API_PREFIX = '/api/keystatic/';
export const KEYSTATIC_SHELL_PATH = '/keystatic/';

/**
 * Where collection images live, and the prefix of every stored image path: each entry sits at
 * `src/content/<collection>/<locale>/<slug>.yaml`, so its YAML reaches the uploads folder three
 * levels up. Shared by the collections and the ASCII source lookup (`lib/ascii-source.ts`).
 */
export const UPLOADS_DIRECTORY = 'src/assets/uploads';
export const ENTRY_UPLOADS_PUBLIC_PATH = '../../../assets/uploads';
