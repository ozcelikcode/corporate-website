import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { resolveUploadPath } from './ascii-source.ts';

const UPLOADS = join(process.cwd(), 'src/assets/uploads');
/** The seed heroes as their YAML stores them; EN and TR each own a file under their locale. */
const STORED = {
  en: '../../../assets/uploads/pages/en/home/sections/0/value/image.png',
  tr: '../../../assets/uploads/pages/tr/home/sections/0/value/image.png',
};

test('resolveUploadPath maps the stored hero path to its own upload, per locale', () => {
  assert.equal(
    resolveUploadPath(STORED.en),
    join(UPLOADS, 'pages/en/home/sections/0/value/image.png'),
  );
  assert.equal(
    resolveUploadPath(STORED.tr),
    join(UPLOADS, 'pages/tr/home/sections/0/value/image.png'),
  );
});

/** A temporary uploads folder holding one file at `path`. */
function uploadsWith(t: TestContext, path: string): string {
  const root = mkdtempSync(join(tmpdir(), 'ascii-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), 'bytes');
  return root;
}

test('two same-named uploads in different folders never mix', (t) => {
  const uploads = uploadsWith(t, 'pages/en/about/sections/2/value/image.webp');
  mkdirSync(join(uploads, 'pages/tr/about/sections/2/value'), { recursive: true });
  writeFileSync(join(uploads, 'pages/tr/about/sections/2/value/image.webp'), 'other bytes');
  for (const locale of ['en', 'tr']) {
    const path = `pages/${locale}/about/sections/2/value/image.webp`;
    assert.equal(
      resolveUploadPath(`../../../assets/uploads/${path}`, uploads),
      join(uploads, path),
    );
  }
});

test('resolveUploadPath names a hero image that is not a PNG, JPEG or WebP raster', (t) => {
  for (const name of ['image.svg', 'image.gif', 'image.avif']) {
    const uploads = uploadsWith(t, `pages/en/home/sections/0/value/${name}`);
    assert.throws(
      () =>
        resolveUploadPath(
          `../../../assets/uploads/pages/en/home/sections/0/value/${name}`,
          uploads,
        ),
      new RegExp(`${name.replace('.', '\\.')} .*PNG, JPEG or WebP`),
      name,
    );
  }
});

test('a stored path outside the uploads convention fails, naming it', () => {
  for (const stored of [
    './image.png',
    '/src/assets/uploads/pages/en/home/sections/0/value/image.png',
    '../../assets/uploads/pages/en/home/sections/0/value/image.png',
    '../../../assets/uploads/../../content/pages/en/home.png',
  ]) {
    assert.throws(
      () => resolveUploadPath(stored),
      new RegExp(
        `ASCII source ${stored.replaceAll('.', '\\.').replaceAll('/', '\\/')} .*src/assets/uploads`,
      ),
      stored,
    );
  }
});

test('a stored path whose upload is missing fails, naming the file', () => {
  const stored = '../../../assets/uploads/pages/en/gone/sections/0/value/image.png';
  assert.throws(
    () => resolveUploadPath(stored),
    /pages\/en\/gone\/sections\/0\/value\/image\.png .*does not exist/,
  );
});
