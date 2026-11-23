import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import sharp from 'sharp';
import { ASCII_RAMP, gridRows, renderAscii, toAsciiGrid } from './ascii.ts';

const HEIGHT = 2;
const WHITE = 255;
const BLACK = 0;
const OPAQUE = 255;
const HALF_ALPHA = 128;

/** A grey pixel; with `alpha` the whole image becomes RGBA (missing alphas are opaque). */
type Pixel = { grey: number; alpha?: number };

const HALF_WHITE: Pixel[] = [{ grey: WHITE }, { grey: WHITE }, { grey: BLACK }, { grey: BLACK }];
const HALF_WHITE_LINE = [
  { tone: 5, text: '@@' },
  { tone: 0, text: '  ' },
];

let dir = '';

/** A PNG with one column per pixel, each column HEIGHT pixels tall. */
async function columnsPng(name: string, columns: Pixel[]): Promise<string> {
  const withAlpha = columns.some((pixel) => pixel.alpha !== undefined);
  const channels = withAlpha ? 4 : 3;
  const pixels: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (const { grey, alpha = OPAQUE } of columns) {
      pixels.push(grey, grey, grey);
      if (withAlpha) pixels.push(alpha);
    }
  }
  const file = join(dir, name);
  await sharp(Buffer.from(pixels), { raw: { width: columns.length, height: HEIGHT, channels } })
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

test('renderAscii renders a white half as @ and a black half as space', async () => {
  const grid = await renderAscii(await columnsPng('rgb.png', HALF_WHITE), HALF_WHITE.length);
  assert.equal(grid.cols, HALF_WHITE.length);
  assert.equal(grid.rows, gridRows(HALF_WHITE.length, HALF_WHITE.length, HEIGHT));
  assert.deepEqual(grid.lines[0], HALF_WHITE_LINE);
});

test('renderAscii reads an opaque RGBA image the same way', async () => {
  const opaque = HALF_WHITE.map(({ grey }) => ({ grey, alpha: OPAQUE }));
  const grid = await renderAscii(await columnsPng('rgba.png', opaque), opaque.length);
  assert.deepEqual(grid.lines[0], HALF_WHITE_LINE);
});

test('renderAscii blends translucent pixels onto black', async () => {
  const columns = [{ grey: WHITE }, { grey: WHITE, alpha: HALF_ALPHA }, ...HALF_WHITE.slice(2)];
  const grid = await renderAscii(await columnsPng('half-alpha.png', columns), columns.length);
  assert.deepEqual(grid.lines[0], [
    { tone: 5, text: '@' },
    { tone: 3, text: '+' },
    { tone: 0, text: '  ' },
  ]);
});

test('renderAscii stretches a low-contrast image across the tone range', async () => {
  const LOW = 100;
  const STEP = 8;
  const COUNT = 8;
  const columns = Array.from({ length: COUNT }, (_, i) => ({ grey: LOW + i * STEP }));
  const flatTones = new Set(
    toAsciiGrid(
      Uint8Array.from(columns, ({ grey }) => grey),
      COUNT,
      1,
    ).lines[0]?.map((r) => r.tone),
  );
  const grid = await renderAscii(await columnsPng('low-contrast.png', columns), COUNT);
  const tones = new Set(grid.lines[0]?.map((r) => r.tone));
  assert.ok(
    tones.size > flatTones.size,
    `${tones.size} tones after stretch, ${flatTones.size} before`,
  );
  assert.ok(tones.has(0) && tones.has(5));
});

test('renderAscii sizes rows from the EXIF-upright image', async () => {
  const QUARTER_TURN = 6;
  const file = join(dir, 'rotated.jpg');
  await sharp(await columnsPng('to-rotate.png', HALF_WHITE))
    .withMetadata({ orientation: QUARTER_TURN })
    .jpeg()
    .toFile(file);
  const grid = await renderAscii(file, HALF_WHITE.length);
  assert.equal(grid.rows, gridRows(HALF_WHITE.length, HEIGHT, HALF_WHITE.length));
});

test('renderAscii memoizes per file and column count', async () => {
  const file = await columnsPng('memo.png', HALF_WHITE);
  assert.equal(
    await renderAscii(file, HALF_WHITE.length),
    await renderAscii(file, HALF_WHITE.length),
  );
});
