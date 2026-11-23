/**
 * Post-build fixes to `dist/`, run on `astro:build:done`:
 * - `relocateLocale404`: Astro writes a locale's 404 as `<locale>/404/index.html`, but the edge
 *   serves `<locale>/404.html`; move it there (idempotent).
 * - `pruneUnreferencedImages`: a content image that never goes through `<Image>`, `<Picture>` or
 *   `getImage` (the ASCII source) is emitted as an original, EXIF included. Optimized images are
 *   referenced by the built pages, so any raster file in `_astro` that no page, stylesheet or
 *   feed mentions is such an original and is deleted.
 */
import { readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n.ts';

const NOT_FOUND_DIR = '404';
const NOT_FOUND_INDEX = 'index.html';
const NOT_FOUND_FILE = '404.html';
const ASSETS_DIR = '_astro';
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const REFERENCING_EXTENSIONS = new Set(['.html', '.css', '.xml', '.txt', '.json', '.js']);

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    },
  );
}

export async function relocateLocale404(dist: URL): Promise<void> {
  const root = fileURLToPath(dist);
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const directory = join(root, locale, NOT_FOUND_DIR);
    const source = join(directory, NOT_FOUND_INDEX);
    if (!(await exists(source))) continue;
    await rename(source, join(root, locale, NOT_FOUND_FILE));
    await rm(directory, { recursive: true });
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

export async function pruneUnreferencedImages(dist: URL): Promise<string[]> {
  const root = fileURLToPath(dist);
  const files = await listFiles(root);
  const sources = files.filter((file) => REFERENCING_EXTENSIONS.has(extname(file)));
  const text = (await Promise.all(sources.map((file) => readFile(file, 'utf8')))).join('\n');
  const assetsDir = join(root, ASSETS_DIR);
  const originals = files.filter(
    (file) =>
      file.startsWith(`${assetsDir}/`) &&
      RASTER_EXTENSIONS.has(extname(file).toLowerCase()) &&
      !text.includes(basename(file)),
  );
  await Promise.all(originals.map((file) => rm(file)));
  return originals.map((file) => basename(file));
}

export function buildOutputs(): AstroIntegration {
  return {
    name: 'build-outputs',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await relocateLocale404(dir);
        await pruneUnreferencedImages(dir);
      },
    },
  };
}
