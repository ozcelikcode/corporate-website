/**
 * Maps an imported upload back to its file on disk, so `renderAscii` can read the original.
 * Never relies on Astro's internal `fsPath`.
 *
 * It lists `src/assets/uploads` on disk instead of using `import.meta.glob`. Importing an image
 * module makes Astro emit its original (EXIF included) into `dist/_astro`, and an original is
 * only removed when the image is optimized, so a glob over the uploads would ship every one.
 * The match is the file name Astro gives `image.src`: `<stem>.<hash>.<ext>` in builds,
 * `<stem>.<ext>` in dev.
 */
import { readdirSync } from 'node:fs';
import { extname, join, parse } from 'node:path';
import type { ImageMetadata } from 'astro';

const UPLOADS_DIR = join(process.cwd(), 'src', 'assets', 'uploads');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
/** What may sit between stem and extension: nothing (dev) or one `.<hash>` (build). */
const HASH_SUFFIX = /^(\.[\w-]+)?$/;

/** Last path segment of a URL without its query string. */
function urlFileName(src: string): string {
  return src.split('?')[0]?.split('/').at(-1) ?? '';
}

function isEmittedFrom(target: string, file: string): boolean {
  const extension = extname(file);
  const stem = parse(file).name;
  return (
    IMAGE_EXTENSIONS.has(extension.toLowerCase()) &&
    target.startsWith(stem) &&
    target.endsWith(extension) &&
    HASH_SUFFIX.test(target.slice(stem.length, target.length - extension.length))
  );
}

export function resolveUploadPath(image: ImageMetadata): string {
  const target = urlFileName(image.src);
  const matches = readdirSync(UPLOADS_DIR, { recursive: true, encoding: 'utf8' }).filter((file) =>
    isEmittedFrom(target, file),
  );
  const [match, ...others] = matches;
  if (match === undefined) {
    throw new Error(`ASCII source ${image.src} is not an image under src/assets/uploads`);
  }
  if (others.length > 0) {
    throw new Error(`ASCII source ${image.src} is ambiguous: ${matches.join(', ')}; rename one`);
  }
  return join(UPLOADS_DIR, match);
}
