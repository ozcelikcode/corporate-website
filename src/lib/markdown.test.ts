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

test('renderMarkdown leaves text that only looks like a link alone', async () => {
  const html = await renderMarkdown('Write `href="/about/"` in code.', PREFIX, toTurkish);
  assert.match(html, /<code>href="\/about\/"<\/code>/);
});

test('renderMarkdown keeps heading levels other than h1', async () => {
  const html = await renderMarkdown('### Three', PREFIX, KEEP);
  assert.match(html, /<h3[^>]*>Three<\/h3>/);
});

test('renderMarkdown drops raw HTML, block and inline', async () => {
  const html = await renderMarkdown(
    [
      '<script>alert(1)</script>',
      '',
      '<meta http-equiv="refresh" content="0;url=https://evil.example">',
      '',
      '<style>body{display:none}</style>',
      '',
      '<form action="https://evil.example"><input name="x"></form>',
      '',
      '<iframe src="https://evil.example"></iframe>',
      '',
      '<h1 class="x">Raw</h1>',
      '',
      'Safe <b onclick="x()">text</b> <img src=x onerror="alert(1)"> end <!-- note -->',
    ].join('\n'),
    PREFIX,
    KEEP,
  );
  assert.doesNotMatch(
    html,
    /<(script|meta|style|form|input|iframe|h1|b|img)\b|onerror|onclick|<!--/i,
  );
  assert.match(html, /Safe\s+text\s+end/);
});

test('renderMarkdown rejects non-allowed link and image schemes', async () => {
  for (const source of [
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](  javascript:alert(1))',
    '[x](java&#x09;script:alert(1))',
    '[x](&#106;avascript:alert(1))',
    '[x](<java\tscript:alert(1)>)',
    '![x](data:image/svg+xml;base64,PHN2Zz4=)',
    '[x](vbscript:msgbox(1))',
    '[x](http://example.com/)',
    '[x](//evil.example/)',
    '[x](/\\evil.example/)',
    '[x](</\t/evil.example/>)',
    '[x](relative/page/)',
    '[x](< /about/>)',
    '[x][r]\n\n[r]: javascript:alert(1)',
    '<javascript:alert(1)>',
  ])
    await assert.rejects(renderMarkdown(source, PREFIX, KEEP), /Unsafe URL in Markdown/, source);
});

test('renderMarkdown names the section and URL in the rejection', async () => {
  await assert.rejects(
    renderMarkdown('[x](http://example.com/)', 's7-2', KEEP),
    /section "s7-2".*"http:\/\/example\.com\/"/,
  );
});

test('renderMarkdown keeps links and images with allowed URLs', async () => {
  const html = await renderMarkdown(
    '[a](/about/) [b](https://example.com/) [c](mailto:a@example.com) [d](tel:+10000000) [e](#top) ![i](/img.png) ![j](https://example.com/i.png)',
    PREFIX,
    KEEP,
  );
  assert.equal(html.match(/<a href=/g)?.length, 5);
  assert.equal(html.match(/<img src=/g)?.length, 2);
});

test('renderMarkdown keeps bare www and http text as plain text, https autolinks as links', async () => {
  const html = await renderMarkdown(
    'See www.example.com or http://example.com/a and https://example.com/b.',
    PREFIX,
    KEEP,
  );
  assert.match(html, /See www\.example\.com or http:\/\/example\.com\/a and /);
  assert.deepEqual(
    [...html.matchAll(/ href="([^"]*)"/g)].map((m) => m[1]),
    ['https://example.com/b'],
  );
  await assert.rejects(renderMarkdown('<http://example.com>', PREFIX, KEEP), /Unsafe URL/);
  await assert.rejects(renderMarkdown('[http://x.com](http://x.com)', PREFIX, KEEP), /Unsafe URL/);
});

test('renderMarkdown scopes footnote ids and links to the block prefix', async () => {
  const source = 'Hi[^1]\n\n[^1]: Note.';
  const [a, b] = await Promise.all([
    renderMarkdown(source, 's1', KEEP),
    renderMarkdown(source, 's2', KEEP),
  ]);
  for (const [html, prefix] of [
    [a, 's1'],
    [b, 's2'],
  ] as const) {
    assert.doesNotMatch(html, /user-content|"footnote-label"/);
    const ids = [...html.matchAll(/ id="([^"]*)"/g)].map((m) => m[1] as string);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(
      ids.every((id) => id.startsWith(`${prefix}-`)),
      ids.join(),
    );
    for (const ref of html.matchAll(/(?:href="#|aria-describedby=")([^"]*)"/g))
      assert.ok(ids.includes(ref[1] as string), `${ref[1]} resolves`);
  }
  assert.ok(![...a.matchAll(/ id="([^"]*)"/g)].some((m) => b.includes(` id="${m[1]}"`)));
});
