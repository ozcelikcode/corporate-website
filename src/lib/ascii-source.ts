/**
 * Maps a hero image, as its YAML stores it, to the upload on disk, so `renderAscii` can read the
 * original. Deterministic: it uses only the stored path (kept by the section schema as
 * `imagePath`, before `image()` resolves it), never the build output, Astro's internal `fsPath`
 * or `import.meta.glob` (importing an image module would ship its original).
 *
 * Keystatic stores every collection image as `../../../assets/uploads/<collection>/<locale>/
 * <slug>/<field path>.<ext>` (relative to `src/content/<collection>/<locale>/<slug>.yaml`), so
 * the path after that prefix is the file under `src/assets/uploads`, the same in dev and build.
 * EN and TR heroes share a file name but never a folder. Anything else fails, naming the path.
 */
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { ENTRY_UPLOADS_PUBLIC_PATH, UPLOADS_DIRECTORY } from '../keystatic/paths.ts';

const PROJECT_UPLOADS = join(process.cwd(), UPLOADS_DIRECTORY);
const STORED_PREFIX = `${ENTRY_UPLOADS_PUBLIC_PATH}/`;
/** Rasters the ASCII renderer reads; the CMS hero image field hints the same types. */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export function resolveUploadPath(stored: string, uploads: string = PROJECT_UPLOADS): string {
  const inside = stored.startsWith(STORED_PREFIX) ? stored.slice(STORED_PREFIX.length) : undefined;
  const file = inside === undefined ? undefined : resolve(uploads, inside);
  if (file === undefined || relative(uploads, file).split(sep)[0] === '..') {
    throw new Error(
      `ASCII source ${stored} is not an upload under ${UPLOADS_DIRECTORY} (stored as ${STORED_PREFIX}…); upload the hero image through the CMS`,
    );
  }
  if (!IMAGE_EXTENSIONS.has(extname(file).toLowerCase())) {
    throw new Error(
      `ASCII source ${stored} must be a PNG, JPEG or WebP raster (SVG, GIF and AVIF are not supported); upload one of those as the hero image`,
    );
  }
  if (!existsSync(file)) {
    throw new Error(`ASCII source ${stored} does not exist (looked for ${file})`);
  }
  return file;
}
