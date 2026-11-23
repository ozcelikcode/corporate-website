import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ASCII_COLUMNS, ASCII_COLUMNS_COMPACT, renderAscii, toAsciiGrid } from './ascii.ts';
import { ASCII_HTML_BUDGET, asciiMarkup, assertAsciiBudget, runsHtml } from './ascii-markup.ts';

const SEED = fileURLToPath(new URL('../assets/uploads/test-card.png', import.meta.url));

test('asciiMarkup wraps toned runs in spans and leaves blank runs bare', () => {
  const grid = toAsciiGrid(Uint8Array.from([0, 255, 0, 0]), 4, 1);
  assert.equal(asciiMarkup(grid), '<span> <span class="t5">@</span></span>');
});

test('asciiMarkup gives every row its own span, a blank row included', () => {
  const grid = toAsciiGrid(Uint8Array.from([0, 0, 255, 255]), 2, 2);
  assert.equal(asciiMarkup(grid), '<span></span>\n<span><span class="t5">@@</span></span>');
});

test('runsHtml is one row without its wrapper, trailing blanks dropped', () => {
  assert.equal(
    runsHtml([
      { tone: 3, text: '#' },
      { tone: 0, text: '   ' },
    ]),
    '<span class="t3">#</span>',
  );
});

test('assertAsciiBudget fails a noisy render, naming the source and its size', () => {
  const COLS = ASCII_COLUMNS;
  const ROWS = 27;
  const NOISE_LOW = 128;
  const NOISE_HIGH = 255;
  const noise = new Uint8Array(COLS * ROWS).map((_, i) => (i % 2 === 0 ? NOISE_LOW : NOISE_HIGH));
  const markup = asciiMarkup(toAsciiGrid(noise, COLS, ROWS));
  assert.ok(new TextEncoder().encode(markup).length > ASCII_HTML_BUDGET);
  assert.throws(
    () => assertAsciiBudget([markup], 'noise.png'),
    (error: Error) =>
      error.message.includes('noise.png') &&
      error.message.includes(String(new TextEncoder().encode(markup).length)),
  );
});

test('the seed test card fits the budget at both column counts', async () => {
  const markups = await Promise.all(
    [ASCII_COLUMNS, ASCII_COLUMNS_COMPACT].map(async (cols) =>
      asciiMarkup(await renderAscii(SEED, cols)),
    ),
  );
  assert.doesNotThrow(() => assertAsciiBudget(markups, SEED));
});
