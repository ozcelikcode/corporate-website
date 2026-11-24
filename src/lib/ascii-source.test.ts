import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type { ImageMetadata } from 'astro';
import { resolveUploadPath } from './ascii-source.ts';

/** The seed hero (EN home); TR home holds a byte-identical copy under its own locale folder. */
const SEED = join(process.cwd(), 'src/assets/uploads/pages/en/home/sections/0/value/image.png');
const SEED_WIDTH = 1280;
const SEED_HEIGHT = 720;

function image(src: string): ImageMetadata {
  return { src, width: SEED_WIDTH, height: SEED_HEIGHT, format: 'png' };
}

test('resolveUploadPath maps a built asset name back to the upload', () => {
  assert.equal(resolveUploadPath(image('/_astro/image.D30-05J7.png')), SEED);
});

test('resolveUploadPath maps a dev URL back to the upload', () => {
  assert.equal(
    resolveUploadPath(image(`/@fs${SEED}?origWidth=1280&origHeight=720&origFormat=png`)),
    SEED,
  );
});

test('resolveUploadPath rejects names that only share a prefix', () => {
  assert.throws(() => resolveUploadPath(image('/_astro/image.extra.D30-05J7.png')), /image\.extra/);
  assert.throws(() => resolveUploadPath(image('/_astro/test.D30-05J7.png')), /not an image under/);
});

test('resolveUploadPath names a hero image that is not a PNG, JPEG or WebP raster', () => {
  for (const name of ['mast.D30-05J7.svg', 'mast.D30-05J7.gif', 'mast.D30-05J7.avif']) {
    assert.throws(
      () => resolveUploadPath(image(`/_astro/${name}`)),
      new RegExp(`${name.replaceAll('.', '\\.')} .*PNG, JPEG or WebP`),
      name,
    );
  }
});

/** Two locales' hero uploads, same file name, different bytes; plus the build's emitted copy. */
function sameNamedUploads(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'ascii-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const uploads = join(root, 'uploads');
  const outDir = join(root, 'dist');
  const en = join(uploads, 'pages/en/home/sections/0/value/image.png');
  const tr = join(uploads, 'pages/tr/home/sections/0/value/image.png');
  for (const [file, bytes] of [
    [en, 'en-bytes'],
    [tr, 'tr-bytes'],
  ] as const) {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, bytes);
  }
  mkdirSync(join(outDir, '_astro'), { recursive: true });
  writeFileSync(join(outDir, '_astro', 'image.TRhash1.png'), 'tr-bytes');
  writeFileSync(join(outDir, '_astro', 'image.ENhash1.png'), 'en-bytes');
  return { roots: { uploads, outDir }, en, tr };
}

test('two uploads with the same file name in different folders resolve to the referenced one', (t) => {
  const { roots, en, tr } = sameNamedUploads(t);
  assert.equal(resolveUploadPath(image('/_astro/image.TRhash1.png'), roots), tr);
  assert.equal(resolveUploadPath(image('/_astro/image.ENhash1.png'), roots), en);
  assert.equal(resolveUploadPath(image(`/@fs${tr}?origWidth=1280`), roots), tr);
  assert.equal(resolveUploadPath(image(`/@fs${en}?origWidth=1280`), roots), en);
});

test('same-named uploads that the build output cannot tell apart fail loudly, naming both', (t) => {
  const { roots } = sameNamedUploads(t);
  assert.throws(
    () => resolveUploadPath(image('/_astro/image.Missing1.png'), roots),
    /image\.Missing1\.png .*pages\/en\/home\/sections\/0\/value\/image\.png.*pages\/tr\/home/,
  );
});
