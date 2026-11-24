import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { DEFAULT_LOCALE, LOCALES } from '../lib/i18n.ts';
import {
  appendNoindex,
  contentSources,
  findCrossLocaleLinks,
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

test('appendNoindex handles CRLF, trailing spaces and leading comments', () => {
  const headers = '# security\r\n/*  \r\n  X-Frame-Options: DENY\r\n';
  const result = appendNoindex(headers);
  assert.equal(
    result,
    '# security\r\n/*  \r\n  X-Robots-Tag: noindex\r\n  X-Frame-Options: DENY\r\n',
  );
  assert.equal(appendNoindex(result), result);
});

test('appendNoindex throws when there is no /* rule', () => {
  assert.throws(() => appendNoindex('/keystatic/*\n  X-A: b\n'), /\/\*/);
});

test('APPLICATION_PATH is built from LOCALES', () => {
  for (const locale of LOCALES) {
    const prefix = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
    assert.deepEqual(solutionSlugs([`${prefix}applications/x/`]), ['x', 'general']);
  }
  assert.deepEqual(solutionSlugs(['de/applications/x/']), ['general']);
});

test('findCrossLocaleLinks flags a TR page linking the EN URL of a page TR has', async () => {
  await withDist(async (root, dist) => {
    await mkdir(join(root, 'quote'), { recursive: true });
    await mkdir(join(root, 'tr', 'quote'), { recursive: true });
    await writeFile(join(root, 'quote', 'index.html'), '<a href="/about/">en</a>');
    await writeFile(join(root, 'tr', 'quote', 'index.html'), 'tr quote');
    await writeFile(
      join(root, 'tr', 'index.html'),
      [
        '<a class="x" href="/quote/#form">wrong</a>',
        '<a href="/tr/quote/">right</a>',
        '<a href="/about/">untranslated</a>',
        '<a href="/quote/" hreflang="en" lang="en">EN</a>',
        '<a href="https://example.com/quote/">outbound</a>',
        '<a href="//quote/">protocol-relative</a>',
      ].join(''),
    );
    await writeFile(join(root, 'tr', '404.html'), '<a href="/">home</a>');
    await mkdir(join(root, 'tr', '404'), { recursive: true });
    await mkdir(join(root, 'tr', 'applications', 'x'), { recursive: true });
    await writeFile(join(root, 'tr', 'applications', 'x', 'index.html'), '<a href="/quote/">q</a>');
    const navigation = 'src/content/navigation/tr/main.yaml';
    assert.deepEqual(await findCrossLocaleLinks(dist), [
      `/tr/404.html links to / instead of /tr/ (link written in src/content/pages/tr/not-found.yaml, src/content/pages/en/not-found.yaml, ${navigation})`,
      `/tr/applications/x/index.html links to /quote/ instead of /tr/quote/ (link written in src/content/applications/tr/x.yaml, ${navigation})`,
      `/tr/index.html links to /quote/#form instead of /tr/quote/ (link written in src/content/pages/tr/home.yaml, ${navigation})`,
    ]);
  });
});

test('contentSources names the entry (and its EN twin where the route falls back) plus navigation', () => {
  const navigation = 'src/content/navigation/tr/main.yaml';
  assert.deepEqual(contentSources('about/index.html', 'tr'), [
    'src/content/pages/tr/about.yaml',
    navigation,
  ]);
  assert.deepEqual(contentSources('applications/index.html', 'tr'), [
    'src/content/pages/tr/applications.yaml',
    navigation,
  ]);
  assert.deepEqual(contentSources('applications/x/index.html', 'tr'), [
    'src/content/applications/tr/x.yaml',
    navigation,
  ]);
  assert.deepEqual(contentSources('quote/index.html', 'tr'), [
    'src/content/pages/tr/quote.yaml',
    'src/content/pages/en/quote.yaml',
    navigation,
  ]);
});

test('findCrossLocaleLinks passes a dist without locale pages', async () => {
  await withDist(async (root, dist) => {
    await writeFile(join(root, 'index.html'), '<a href="/quote/">q</a>');
    assert.deepEqual(await findCrossLocaleLinks(dist), []);
  });
});
