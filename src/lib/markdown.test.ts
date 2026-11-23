import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMarkdown } from './markdown.ts';

const PREFIX = 's4';

test('renderMarkdown turns Markdown into HTML', async () => {
  const html = await renderMarkdown('## Support\n\nWrite to **us**.', PREFIX);
  assert.match(html, /<h2[^>]*>Support<\/h2>/);
  assert.match(html, /<p>Write to <strong>us<\/strong>\.<\/p>/);
});

test('renderMarkdown leaves code blocks unhighlighted', async () => {
  const html = await renderMarkdown('```js\nconst a = 1;\n```', PREFIX);
  assert.match(html, /<pre><code class="language-js">const a = 1;\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /shiki|style=/);
});

test('renderMarkdown renders concurrent calls independently', async () => {
  const [first, second] = await Promise.all([
    renderMarkdown('One', PREFIX),
    renderMarkdown('Two', PREFIX),
  ]);
  assert.equal(first, '<p>One</p>');
  assert.equal(second, '<p>Two</p>');
});

test('renderMarkdown demotes an ATX h1 to h2', async () => {
  const html = await renderMarkdown('# Title', PREFIX);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<h2[^>]*>Title<\/h2>/);
});

test('renderMarkdown demotes a setext h1 to h2', async () => {
  const html = await renderMarkdown('Title\n=====', PREFIX);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<h2[^>]*>Title<\/h2>/);
});

test('renderMarkdown demotes a raw HTML h1 to h2', async () => {
  const html = await renderMarkdown('<h1 class="x">Raw</h1>\n\nText with <H1>inline</H1>.', PREFIX);
  assert.doesNotMatch(html, /<\/?h1/i);
  assert.match(html, /<h2 class="x">Raw<\/h2>/);
  assert.match(html, /<h2>inline<\/h2>/i);
});

test('renderMarkdown leaves other heading levels and h1-like tags alone', async () => {
  const html = await renderMarkdown('### Three\n\n<header>x</header> <h10>y</h10>', PREFIX);
  assert.match(html, /<h3[^>]*>Three<\/h3>/);
  assert.match(html, /<header>x<\/header>/);
  assert.match(html, /<h10>y<\/h10>/);
});

test('renderMarkdown numbers heading ids under the caller prefix, not by slug', async () => {
  const html = await renderMarkdown('## Main\n\n## Main\n\n# Top', PREFIX);
  const ids = [...html.matchAll(/ id="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['s4-1', 's4-2', 's4-3']);
});

test('renderMarkdown keeps ids apart across prefixes', async () => {
  const [a, b] = await Promise.all([renderMarkdown('## A', 's1'), renderMarkdown('## A', 's2')]);
  assert.match(a, /id="s1-1"/);
  assert.match(b, /id="s2-1"/);
});
