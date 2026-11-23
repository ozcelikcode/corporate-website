import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localizeHref } from './localize-href.ts';
import { renderMarkdown } from './markdown.ts';

const PREFIX = 's4';
const KEEP = (href: string): string => href;
const TR_PATHS: ReadonlySet<string> = new Set(['/', '/quote/', '/about/']);
const toTurkish = (href: string): string => localizeHref(href, 'tr', TR_PATHS);

test('renderMarkdown turns Markdown into HTML', async () => {
  const html = await renderMarkdown('## Support\n\nWrite to **us**.', PREFIX, KEEP);
  assert.match(html, /<h2[^>]*>Support<\/h2>/);
  assert.match(html, /<p>Write to <strong>us<\/strong>\.<\/p>/);
});

test('renderMarkdown leaves code blocks unhighlighted', async () => {
  const html = await renderMarkdown('```js\nconst a = 1;\n```', PREFIX, KEEP);
  assert.match(html, /<pre><code class="language-js">const a = 1;\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /shiki|style=/);
});

test('renderMarkdown renders concurrent calls independently', async () => {
  const [first, second] = await Promise.all([
    renderMarkdown('One', PREFIX, KEEP),
    renderMarkdown('Two', PREFIX, KEEP),
  ]);
  assert.equal(first, '<p>One</p>');
  assert.equal(second, '<p>Two</p>');
});

test('renderMarkdown demotes an ATX h1 to h2', async () => {
  const html = await renderMarkdown('# Title', PREFIX, KEEP);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<h2[^>]*>Title<\/h2>/);
});

test('renderMarkdown demotes a setext h1 to h2', async () => {
  const html = await renderMarkdown('Title\n=====', PREFIX, KEEP);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<h2[^>]*>Title<\/h2>/);
});

test('renderMarkdown demotes a raw HTML h1 to h2', async () => {
  const html = await renderMarkdown(
    '<h1 class="x">Raw</h1>\n\nText with <H1>inline</H1>.',
    PREFIX,
    KEEP,
  );
  assert.doesNotMatch(html, /<\/?h1/i);
  assert.match(html, /<h2 class="x">Raw<\/h2>/);
  assert.match(html, /<h2>inline<\/h2>/i);
});

test('renderMarkdown leaves other heading levels and h1-like tags alone', async () => {
  const html = await renderMarkdown('### Three\n\n<header>x</header> <h10>y</h10>', PREFIX, KEEP);
  assert.match(html, /<h3[^>]*>Three<\/h3>/);
  assert.match(html, /<header>x<\/header>/);
  assert.match(html, /<h10>y<\/h10>/);
});

test('renderMarkdown numbers heading ids under the caller prefix, not by slug', async () => {
  const html = await renderMarkdown('## Main\n\n## Main\n\n# Top', PREFIX, KEEP);
  const ids = [...html.matchAll(/ id="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['s4-1', 's4-2', 's4-3']);
});

test('renderMarkdown keeps ids apart across prefixes', async () => {
  const [a, b] = await Promise.all([
    renderMarkdown('## A', 's1', KEEP),
    renderMarkdown('## A', 's2', KEEP),
  ]);
  assert.match(a, /id="s1-1"/);
  assert.match(b, /id="s2-1"/);
});

test('renderMarkdown passes every link href through the rewrite', async () => {
  const html = await renderMarkdown(
    '[About](/about/) [Privacy](/privacy/#data) [Out](https://example.com/about/) [Mail](mailto:a@example.com) [Top](#main)',
    PREFIX,
    toTurkish,
  );
  const hrefs = [...html.matchAll(/ href="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, [
    '/tr/about/',
    '/privacy/#data',
    'https://example.com/about/',
    'mailto:a@example.com',
    '#main',
  ]);
});

test('renderMarkdown rewrites raw HTML anchors and keeps their other attributes', async () => {
  const html = await renderMarkdown(
    '<a title="a > b" href="/about/?x=1&y=2">raw</a> and <A HREF=\'/quote/\'>upper</A>',
    PREFIX,
    toTurkish,
  );
  assert.match(html, /<a title="a > b" href="\/tr\/about\/\?x=1&#x26;y=2">raw<\/a>/);
  assert.match(html, /<a href="\/tr\/quote\/">upper<\/a>/);
});

test('renderMarkdown rewrites only the href attribute itself', async () => {
  const html = await renderMarkdown(
    '<a data-href="/about/" href="/privacy/">x</a>',
    PREFIX,
    toTurkish,
  );
  assert.match(html, /<a data-href="\/about\/" href="\/privacy\/">x<\/a>/);
});

test('renderMarkdown leaves text that only looks like a link alone', async () => {
  const html = await renderMarkdown('Write `href="/about/"` in code.', PREFIX, toTurkish);
  assert.match(html, /<code>href="\/about\/"<\/code>/);
});
