import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMarkdown } from './markdown.ts';

test('renderMarkdown turns Markdown into HTML', async () => {
  const html = await renderMarkdown('## Support\n\nWrite to **us**.');
  assert.match(html, /<h2[^>]*>Support<\/h2>/);
  assert.match(html, /<p>Write to <strong>us<\/strong>\.<\/p>/);
});

test('renderMarkdown leaves code blocks unhighlighted', async () => {
  const html = await renderMarkdown('```js\nconst a = 1;\n```');
  assert.match(html, /<pre><code class="language-js">const a = 1;\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /shiki|style=/);
});

test('renderMarkdown renders concurrent calls independently', async () => {
  const [first, second] = await Promise.all([renderMarkdown('One'), renderMarkdown('Two')]);
  assert.equal(first, '<p>One</p>');
  assert.equal(second, '<p>Two</p>');
});
