import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import type { ImageMetadata } from 'astro';
import { resolveUploadPath } from './ascii-source.ts';

const SEED = join(process.cwd(), 'src', 'assets', 'uploads', 'transmitter.png');
const SEED_WIDTH = 1280;
const SEED_HEIGHT = 720;

function image(src: string): ImageMetadata {
  return { src, width: SEED_WIDTH, height: SEED_HEIGHT, format: 'png' };
}

test('resolveUploadPath maps a built asset name back to the upload', () => {
  assert.equal(resolveUploadPath(image('/_astro/transmitter.D30-05J7.png')), SEED);
});

test('resolveUploadPath maps a dev URL back to the upload', () => {
  assert.equal(
    resolveUploadPath(image(`/@fs${SEED}?origWidth=1280&origHeight=720&origFormat=png`)),
    SEED,
  );
});

test('resolveUploadPath rejects names that only share a prefix', () => {
  assert.throws(
    () => resolveUploadPath(image('/_astro/transmitter.extra.D30-05J7.png')),
    /transmitter\.extra/,
  );
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
