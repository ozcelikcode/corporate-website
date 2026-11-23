import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import type { ImageMetadata } from 'astro';
import { resolveUploadPath } from './ascii-source.ts';

const SEED = join(process.cwd(), 'src', 'assets', 'uploads', 'test-card.png');
const SEED_WIDTH = 1280;
const SEED_HEIGHT = 720;

function image(src: string): ImageMetadata {
  return { src, width: SEED_WIDTH, height: SEED_HEIGHT, format: 'png' };
}

test('resolveUploadPath maps a built asset name back to the upload', () => {
  assert.equal(resolveUploadPath(image('/_astro/test-card.D30-05J7.png')), SEED);
});

test('resolveUploadPath maps a dev URL back to the upload', () => {
  assert.equal(
    resolveUploadPath(image(`/@fs${SEED}?origWidth=1280&origHeight=720&origFormat=png`)),
    SEED,
  );
});

test('resolveUploadPath rejects names that only share a prefix', () => {
  assert.throws(
    () => resolveUploadPath(image('/_astro/test-card.extra.D30-05J7.png')),
    /test-card\.extra/,
  );
  assert.throws(() => resolveUploadPath(image('/_astro/test.D30-05J7.png')), /not an image under/);
});
