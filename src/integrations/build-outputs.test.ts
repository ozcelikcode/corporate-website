import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  appendNoindex,
  pruneUnreferencedImages,
  relocateLocale404,
  solutionSlugs,
} from './build-outputs.ts';

async function withDist(run: (root: string, dist: URL) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'build-outputs-'));
  try {
    await run(root, pathToFileURL(`${root}/`));
  } finally {
    await rm(root, { recursive: true });
  }
}

test('relocateLocale404 moves tr/404/index.html to tr/404.html and is idempotent', async () => {
  await withDist(async (root, dist) => {
    await mkdir(join(root, 'tr', '404'), { recursive: true });
    await writeFile(join(root, 'tr', '404', 'index.html'), 'tr 404');
    await writeFile(join(root, '404.html'), 'en 404');
    await relocateLocale404(dist);
    await relocateLocale404(dist);
    assert.equal(await readFile(join(root, 'tr', '404.html'), 'utf8'), 'tr 404');
    assert.equal(await readFile(join(root, '404.html'), 'utf8'), 'en 404');
    assert.deepEqual(await readdir(join(root, 'tr')), ['404.html']);
  });
});

test('relocateLocale404 leaves a dist without a locale 404 untouched', async () => {
  await withDist(async (root, dist) => {
    await writeFile(join(root, '404.html'), 'en 404');
    await relocateLocale404(dist);
    assert.deepEqual(await readdir(root), ['404.html']);
  });
});

test('pruneUnreferencedImages deletes only rasters no page or stylesheet mentions', async () => {
  await withDist(async (root, dist) => {
    const assets = join(root, '_astro');
    await mkdir(assets);
    await writeFile(join(root, 'index.html'), '<img src="/_astro/cover.AAA_bbb.webp">');
    await writeFile(join(assets, 'site.css'), 'a{background:url(/_astro/bg.CCC_ddd.png)}');
    for (const name of ['cover.AAA_bbb.webp', 'bg.CCC_ddd.png', 'card.EEE.png', 'logo.FFF.svg']) {
      await writeFile(join(assets, name), 'x');
    }
    const removed = await pruneUnreferencedImages(dist);
    assert.deepEqual(removed, ['card.EEE.png']);
    assert.deepEqual((await readdir(assets)).sort(), [
      'bg.CCC_ddd.png',
      'cover.AAA_bbb.webp',
      'logo.FFF.svg',
      'site.css',
    ]);
  });
});

test('solutionSlugs returns sorted unique application slugs across locales, then general', () => {
  assert.deepEqual(
    solutionSlugs([
      '/applications/b/',
      'tr/applications/b/',
      'applications/a/',
      '/about/',
      '/applications/',
    ]),
    ['a', 'b', 'general'],
  );
});

test('solutionSlugs rejects an application using the reserved general slug', () => {
  assert.throws(() => solutionSlugs(['applications/general/']), /general/);
});

test('appendNoindex adds one X-Robots-Tag inside the /* block and is idempotent', () => {
  const headers = '/*\n  X-Frame-Options: DENY\n';
  const once = appendNoindex(headers);
  assert.equal(once.match(/X-Robots-Tag: noindex/g)?.length, 1);
  assert.ok(once.startsWith('/*\n  X-Robots-Tag: noindex\n  X-Frame-Options: DENY\n'));
  assert.equal(appendNoindex(once), once);
});
