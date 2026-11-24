/**
 * Maps an imported upload back to its file on disk, so `renderAscii` can read the original.
 * Never relies on Astro's internal `fsPath`.
 *
 * It lists `src/assets/uploads` on disk instead of using `import.meta.glob`. Importing an image
 * module makes Astro emit its original (EXIF included) into `dist/_astro`, and an original is
 * only removed when the image is optimized, so a glob over the uploads would ship every one.
 *
 * Dev URLs (`/@fs/<absolute path>?…`) name the file itself. A build URL only carries the file
 * name Astro gives `image.src` (`/_astro/<stem>.<hash>.<ext>`), and Keystatic names every upload
 * after its field (`image.png` for each hero), in per-locale, per-entry folders. When several
 * uploads share the name, the one whose bytes equal the emitted file (written to the build output
 * before pages render) is the source; byte-identical copies are interchangeable. Anything else
 * fails, naming the candidates.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, parse, relative, sep } from 'node:path';
import type { ImageMetadata } from 'astro';

/** Where uploads live and where the build writes `/_astro/…` files. */
export type UploadRoots = { uploads: string; outDir: string };

const PROJECT_ROOTS: UploadRoots = {
  uploads: join(process.cwd(), 'src', 'assets', 'uploads'),
  outDir: join(process.cwd(), 'dist'),
};
/** Rasters the ASCII renderer reads; the CMS hero image field accepts the same types. */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
/** What may sit between stem and extension: nothing (dev) or one `.<hash>` (build). */
const HASH_SUFFIX = /^(\.[\w-]+)?$/;
/** Vite's dev prefix for a file served by absolute path. */
const DEV_FS_PREFIX = '/@fs';

/** URL path without its query string. */
function urlPath(src: string): string {
  return src.split('?')[0] ?? '';
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

/** The dev URL's own file, when it is an upload. */
function devUpload(path: string, uploads: string): string | undefined {
  if (!path.startsWith(`${DEV_FS_PREFIX}/`)) return undefined;
  const file = decodeURI(path.slice(DEV_FS_PREFIX.length));
  const inside = relative(uploads, file);
  return inside.startsWith(`..${sep}`) || !existsSync(file) ? undefined : file;
}

function sameBytes(files: string[]): boolean {
  const [first, ...rest] = files.map((file) => readFileSync(file));
  return first !== undefined && rest.every((bytes) => bytes.equals(first));
}

export function resolveUploadPath(
  image: ImageMetadata,
  roots: UploadRoots = PROJECT_ROOTS,
): string {
  const path = urlPath(image.src);
  const target = path.split('/').at(-1) ?? '';
  if (!IMAGE_EXTENSIONS.has(extname(target).toLowerCase())) {
    throw new Error(
      `ASCII source ${target} must be a PNG, JPEG or WebP raster (SVG, GIF and AVIF are not supported); upload one of those as the hero image`,
    );
  }
  const dev = devUpload(path, roots.uploads);
  if (dev !== undefined) return dev;
  const matches = readdirSync(roots.uploads, { recursive: true, encoding: 'utf8' })
    .filter((file) => isEmittedFrom(target, file))
    .sort()
    .map((file) => join(roots.uploads, file));
  if (matches.length === 0) {
    throw new Error(`ASCII source ${image.src} is not an image under src/assets/uploads`);
  }
  const emitted = join(roots.outDir, path);
  const reference = existsSync(emitted) ? readFileSync(emitted) : undefined;
  const sources =
    reference === undefined || matches.length === 1
      ? matches
      : matches.filter((file) => readFileSync(file).equals(reference));
  const [source] = sources;
  if (source === undefined || !sameBytes(sources)) {
    const names = matches.map((file) => relative(roots.uploads, file)).join(', ');
    throw new Error(
      `ASCII source ${target} matches several different uploads (${names}) and no emitted file under ${roots.outDir} tells which one is referenced`,
    );
  }
  return source;
}
