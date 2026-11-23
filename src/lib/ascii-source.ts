/**
 * Maps an imported upload back to its file on disk, so `renderAscii` can read the original.
 * Matches on `image.src` against the uploads glob; never relies on Astro's internal `fsPath`.
 */
import { join } from 'node:path';
import type { ImageMetadata } from 'astro';

const UPLOADS = import.meta.glob<ImageMetadata>('/src/assets/uploads/**/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
});

export function resolveUploadPath(image: ImageMetadata): string {
  const key = Object.keys(UPLOADS).find((path) => UPLOADS[path]?.src === image.src);
  if (key === undefined) {
    throw new Error(`ASCII source ${image.src} is not an image under src/assets/uploads`);
  }
  return join(process.cwd(), key);
}
