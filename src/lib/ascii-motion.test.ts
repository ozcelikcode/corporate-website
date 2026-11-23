import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AsciiRun } from './ascii.ts';
import { ASCII_RAMP } from './ascii-glyphs.ts';
import {
  acquisitionRuns,
  liveRuns,
  NOISE_TONE,
  noiseGlyph,
  parseOrigin,
  type Random,
  rampNeighbour,
  revealThresholds,
  ringDistance,
  toneFromClass,
  WAVE_GAIN,
  WAVE_ORIGIN,
  WAVE_REACH,
  WAVE_SPACING,
  WAVE_SPEED,
  WAVE_TRACE_GLYPH,
  WAVE_TRACE_WIDTH,
  WAVE_WIDTH,
  waveBoost,
  waveTrail,
} from './ascii-motion.ts';

/** mulberry32: a tiny seeded generator, so every run of the suite sees the same numbers. */
function seeded(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

const always =
  (value: number): Random =>
  () =>
    value;
const LOW = 0;
const HIGH = 0.999;
const SEED = 42;
const ROWS = 27;
const COLS = 96;

function cellsOf(runs: readonly AsciiRun[]): string {
  return runs.map((run) => run.text).join('');
}

test('toneFromClass reads the tone of a run span and rejects anything else', () => {
  assert.equal(toneFromClass('t0'), 0);
  assert.equal(toneFromClass('t5'), 5);
  for (const bad of ['t6', 't', 'x3', 't12', '']) {
    assert.throws(() => toneFromClass(bad), /ASCII tone class/);
  }
});

test('rampNeighbour steps one glyph up or down the ramp, never to blank', () => {
  assert.equal(rampNeighbour('#', always(LOW)), '*');
  assert.equal(rampNeighbour('#', always(HIGH)), '%');
  assert.equal(rampNeighbour('@', always(HIGH)), '%');
  assert.equal(rampNeighbour('.', always(LOW)), ':');
});

test('rampNeighbour leaves blanks and foreign characters alone', () => {
  assert.equal(rampNeighbour(' ', always(HIGH)), ' ');
  assert.equal(rampNeighbour('x', always(HIGH)), 'x');
});

test('noiseGlyph draws any ramp glyph except blank', () => {
  const random = seeded(SEED);
  const seen = new Set(Array.from({ length: 500 }, () => noiseGlyph(random)));
  assert.deepEqual([...seen].sort(), [...ASCII_RAMP.slice(1)].sort());
  assert.equal(noiseGlyph(always(LOW)), ASCII_RAMP.charAt(1));
  assert.equal(noiseGlyph(always(HIGH)), ASCII_RAMP.at(-1));
});

test('revealThresholds gives every cell a time in [0, 1), earlier rows earlier on average', () => {
  const thresholds = revealThresholds(ROWS, COLS, seeded(SEED));
  assert.equal(thresholds.length, ROWS * COLS);
  assert.ok(thresholds.every((value) => value >= 0 && value < 1));
  const mean = (row: number) =>
    thresholds.slice(row * COLS, (row + 1) * COLS).reduce((sum, value) => sum + value, 0) / COLS;
  assert.ok(mean(0) < mean(ROWS - 1));
});

test('revealThresholds stays below 1 even when the generator returns its maximum', () => {
  const thresholds = revealThresholds(ROWS, COLS, always(HIGH));
  assert.ok(thresholds.every((value) => value < 1));
});

const SOURCE: AsciiRun[] = [
  { tone: 0, text: '  ' },
  { tone: 5, text: '@@' },
  { tone: 3, text: '#' },
];
const SOURCE_COLS = 8;

test('acquisitionRuns at progress 0 is all static in the noise tone, padded to the width', () => {
  const thresholds = revealThresholds(1, SOURCE_COLS, seeded(SEED));
  const runs = acquisitionRuns(SOURCE, SOURCE_COLS, thresholds, 0, 0, always(LOW));
  assert.deepEqual(runs, [{ tone: NOISE_TONE, text: ASCII_RAMP.charAt(1).repeat(SOURCE_COLS) }]);
});

test('acquisitionRuns at progress 1 is the source picture, padded with blanks', () => {
  const thresholds = revealThresholds(1, SOURCE_COLS, seeded(SEED));
  const runs = acquisitionRuns(SOURCE, SOURCE_COLS, thresholds, 0, 1, seeded(SEED));
  assert.equal(cellsOf(runs), '  @@#   ');
  assert.deepEqual(runs.slice(0, 3), SOURCE);
});

test('acquisitionRuns resolves exactly the cells whose time has come and merges same-tone runs', () => {
  const thresholds = Float32Array.from([0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.9, 0.9]);
  const runs = acquisitionRuns(SOURCE, SOURCE_COLS, thresholds, 0, 0.5, always(HIGH));
  const noise = ASCII_RAMP.at(-1);
  assert.equal(cellsOf(runs), ` ${noise}@${noise}#${noise}${noise}${noise}`);
  for (let i = 1; i < runs.length; i++) {
    assert.notEqual(runs[i]?.tone, runs[i - 1]?.tone);
  }
});

test('acquisitionRuns reads the thresholds from the row offset', () => {
  const thresholds = new Float32Array(SOURCE_COLS * 2).fill(0.9);
  thresholds.fill(0, SOURCE_COLS);
  const runs = acquisitionRuns(SOURCE, SOURCE_COLS, thresholds, SOURCE_COLS, 0.5, always(LOW));
  assert.equal(cellsOf(runs), '  @@#   ');
});

const MS_PER_S = 1000;
/** A hair after the first front (it leaves the origin at 0 ms) passes `distance`: no float edge. */
const AFTER_MS = 1;
const arrival = (distance: number) => (distance / WAVE_SPEED) * MS_PER_S + AFTER_MS;

test('ringDistance measures in picture widths, a row counting as two columns', () => {
  const origin = { x: 0.05, y: 0.05 };
  assert.equal(ringDistance(0, 0, 10, 10, origin), 0);
  assert.equal(ringDistance(2, 0, 10, 10, origin), 0.2);
  assert.equal(ringDistance(0, 1, 10, 10, origin), 0.2);
});

test('waveTrail is infinite until the first front arrives, then near zero on it', () => {
  assert.equal(waveTrail(0.3, 0), Number.POSITIVE_INFINITY);
  assert.equal(waveTrail(0.3, arrival(0.3) - 2 * AFTER_MS), Number.POSITIVE_INFINITY);
  assert.ok(waveTrail(0.3, arrival(0.3)) < WAVE_TRACE_WIDTH);
});

test('waveTrail repeats every ring spacing', () => {
  const near = 0.1;
  const first = waveTrail(near, arrival(near));
  const second = waveTrail(near, arrival(near + WAVE_SPACING));
  assert.ok(Math.abs(first - second) < 1e-9);
});

test('waveBoost peaks on the front and fades with distance from the mast', () => {
  assert.equal(waveBoost(0.1, 0), WAVE_GAIN);
  assert.ok(waveBoost(0.6, 0) < WAVE_GAIN);
  assert.equal(waveBoost(WAVE_REACH, 0), 0);
  assert.equal(waveBoost(0.1, Number.POSITIVE_INFINITY), 0);
});

test('waveBoost lights only a short trail behind each front', () => {
  assert.equal(waveBoost(0.1, WAVE_WIDTH), 0);
  assert.ok(waveBoost(0.1, WAVE_WIDTH / 4) > 0);
});

const LIVE_COLS = 8;
const LEFT_MIDDLE = { x: 0, y: 0.5 };
/** Cell 0's distance from `LEFT_MIDDLE` on a one-row grid. */
const CELL_0 = ringDistance(0, 0, LIVE_COLS, 1, LEFT_MIDDLE);

test('liveRuns between fronts and without flicker is the source, padded with blanks', () => {
  const runs = liveRuns(SOURCE, LIVE_COLS, 0, 1, LEFT_MIDDLE, 0, always(HIGH));
  assert.equal(cellsOf(runs), '  @@#   ');
  assert.deepEqual(runs.slice(0, 3), SOURCE);
});

test('liveRuns brightens glyphs under a front, never past the top tone', () => {
  const source: AsciiRun[] = [
    { tone: 2, text: '#' },
    { tone: 5, text: '@' },
  ];
  const at = arrival(CELL_0);
  const runs = liveRuns(source, LIVE_COLS, 0, 1, LEFT_MIDDLE, at, always(HIGH));
  const boost = waveBoost(CELL_0, waveTrail(CELL_0, at));
  assert.ok(boost > 0);
  assert.deepEqual(runs[0], { tone: Math.min(5, 2 + boost), text: '#' });
  assert.ok(runs.every((run) => run.tone <= 5));
});

test('liveRuns draws a live front as dots across blank sky, nothing behind it', () => {
  const at = arrival(CELL_0);
  assert.ok(waveBoost(CELL_0, waveTrail(CELL_0, at)) > 0);
  const runs = liveRuns([], LIVE_COLS, 0, 1, LEFT_MIDDLE, at, always(HIGH));
  assert.equal(cellsOf(runs).charAt(0), WAVE_TRACE_GLYPH);
  const later = liveRuns(
    [],
    LIVE_COLS,
    0,
    1,
    LEFT_MIDDLE,
    arrival(CELL_0 + WAVE_TRACE_WIDTH),
    always(HIGH),
  );
  assert.equal(cellsOf(later).charAt(0), ' ');
});

test('liveRuns flickers a glyph to a ramp neighbour when the draw falls under the ratio', () => {
  const runs = liveRuns([{ tone: 3, text: '#' }], 1, 0, 1, LEFT_MIDDLE, 0, always(LOW));
  assert.equal(cellsOf(runs), '*');
});

test('parseOrigin reads "x y" fractions and defaults to the wave origin', () => {
  assert.deepEqual(parseOrigin('0.25 0.75'), { x: 0.25, y: 0.75 });
  assert.deepEqual(parseOrigin(undefined), WAVE_ORIGIN);
  for (const bad of ['', '0.5', '0.5 1.5', 'a b', '0.1 0.2 0.3']) {
    assert.throws(() => parseOrigin(bad), /wave origin/);
  }
});
