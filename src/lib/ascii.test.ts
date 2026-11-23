import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import { ASCII_RAMP, gridRows, renderAscii, toAsciiGrid } from './ascii.ts';

const WIDTH = 4;
const HEIGHT = 2;
const WHITE = 255;
const BLACK = 0;
const OPAQUE = 255;
const HALF_ALPHA = 128;

let dir = '';

/**
 * A WIDTH×HEIGHT PNG whose left half is white and right half black.
 * With `alpha`, it is RGBA and every pixel carries that alpha.
 */
async function halfWhitePng(name: string, alpha?: number): Promise<string> {
  const channels = alpha === undefined ? 3 : 4;
  const pixels: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const value = x < WIDTH / 2 ? WHITE : BLACK;
      pixels.push(value, value, value);
      if (alpha !== undefined) pixels.push(alpha);
    }
  }
  const file = join(dir, name);
  await sharp(Buffer.from(pixels), { raw: { width: WIDTH, height: HEIGHT, channels } })
    .png()
    .toFile(file);
  return file;
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ascii-test-'));
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
});

test('toAsciiGrid maps dark to space and bright to the densest glyph', () => {
  assert.deepEqual(toAsciiGrid(Uint8Array.from([0, 255]), 2, 1).lines[0], [
    { tone: 0, text: ' ' },
    { tone: 5, text: '@' },
  ]);
});

test('toAsciiGrid merges neighbouring same-tone glyphs into one run', () => {
  assert.deepEqual(toAsciiGrid(Uint8Array.from([255, 255, 128, 0]), 4, 1).lines[0], [
    { tone: 5, text: '@@' },
    { tone: 3, text: '+' },
    { tone: 0, text: ' ' },
  ]);
});

test('toAsciiGrid keeps every line exactly cols glyphs wide', () => {
  const g = toAsciiGrid(
    new Uint8Array(18).map((_, i) => i * 14),
    6,
    3,
  );
  assert.equal(g.lines.length, 3);
  for (const line of g.lines) assert.equal(line.map((r) => r.text).join('').length, 6);
});

test('toAsciiGrid throws when luma does not match cols × rows', () => {
  assert.throws(() => toAsciiGrid(new Uint8Array(5), 2, 2));
});

test('gridRows halves the height for the glyph cell aspect', () => {
  assert.equal(gridRows(96, 1280, 720), 27);
});

test('ASCII_RAMP holds no HTML-special characters', () => {
  assert.ok(!/[<>&"']/.test(ASCII_RAMP));
});

const HALF_WHITE_LINE = [
  { tone: 5, text: '@@' },
  { tone: 0, text: '  ' },
];

test('renderAscii renders a white half as @ and a black half as space', async () => {
  const grid = await renderAscii(await halfWhitePng('rgb.png'), WIDTH);
  assert.equal(grid.cols, WIDTH);
  assert.equal(grid.rows, gridRows(WIDTH, WIDTH, HEIGHT));
  assert.deepEqual(grid.lines[0], HALF_WHITE_LINE);
});

test('renderAscii reads an opaque RGBA image the same way', async () => {
  const grid = await renderAscii(await halfWhitePng('rgba.png', OPAQUE), WIDTH);
  assert.deepEqual(grid.lines[0], HALF_WHITE_LINE);
});

test('renderAscii blends translucent pixels onto black', async () => {
  const grid = await renderAscii(await halfWhitePng('half-alpha.png', HALF_ALPHA), WIDTH);
  assert.deepEqual(grid.lines[0], [
    { tone: 3, text: '++' },
    { tone: 0, text: '  ' },
  ]);
});

test('renderAscii sizes rows from the EXIF-upright image', async () => {
  const QUARTER_TURN = 6;
  const file = join(dir, 'rotated.jpg');
  await sharp(await halfWhitePng('to-rotate.png'))
    .withMetadata({ orientation: QUARTER_TURN })
    .jpeg()
    .toFile(file);
  const grid = await renderAscii(file, WIDTH);
  assert.equal(grid.rows, gridRows(WIDTH, HEIGHT, WIDTH));
});

test('renderAscii memoizes per file and column count', async () => {
  const file = await halfWhitePng('memo.png');
  assert.equal(await renderAscii(file, WIDTH), await renderAscii(file, WIDTH));
});
