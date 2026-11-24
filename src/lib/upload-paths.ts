/**
 * Where uploaded images live, and the prefix of every stored collection image path: each entry
 * sits at `src/content/<collection>/<locale>/<slug>.yaml`, so its YAML reaches the uploads folder
 * three levels up. Shared by the Keystatic config (where to write) and the ASCII source lookup
 * (`ascii-source.ts`, where to read); plain constants, so the admin bundle stays Zod-free.
 */
export const UPLOADS_DIRECTORY = 'src/assets/uploads';
export const ENTRY_UPLOADS_PUBLIC_PATH = '../../../assets/uploads';
