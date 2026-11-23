/**
 * Pure logic of the ASCII "live signal" (no DOM). Each effect stands for a broadcast idea:
 * acquisition is tuning in (static resolves into the picture), the live frame sends rings of
 * brightness out from the transmitter (the wave origin) and lets a few glyphs flicker like
 * signal grain. The AsciiImage script applies it to the page. Randomness and time are injected
 * so tests can pin them.
 */
import type { AsciiRun, Tone } from './ascii.ts';
import { ASCII_RAMP, CHAR_ASPECT, TONE_COUNT } from './ascii-glyphs.ts';

/** A source of uniform numbers in [0, 1), like `Math.random`. */
export type Random = () => number;
/** A point of the picture as fractions of its width and height. */
export type Origin = { x: number; y: number };

/** Signal acquisition: static resolves into the picture over this long. */
export const ACQUIRE_DURATION_MS = 1200;
/** Acquisition frame: 25 fps, the PAL rate the tally timecode runs at. */
export const ACQUIRE_FRAME_MS = 40;
/** Live frame: 12.5 fps (every other PAL frame), smooth rings at half the DOM work. */
export const LIVE_FRAME_MS = 80;
/** Chance per glyph and live frame of stepping to a neighbouring glyph (signal grain). */
export const FLICKER_RATIO = 0.004;
/** Unresolved cells are static in one dim tone, so they merge into long runs (little markup). */
export const NOISE_TONE: Tone = 1;
/** Share of a cell's reveal time set by its row: the picture locks roughly top-down. */
export const REVEAL_ROW_BIAS = 0.35;

/** Where the rings start: the top-centre region (the seed's mast top). Per figure via data. */
export const WAVE_ORIGIN: Origin = { x: 0.5, y: 1 / 3 };
const MS_PER_S = 1000;

/** Ring speed, in picture widths per second. */
export const WAVE_SPEED = 0.16;
/** A new ring leaves the transmitter this often: calm, like a beacon, not a strobe. */
export const WAVE_CADENCE_MS = 2500;
/** Gap between successive rings, in picture widths. */
export const WAVE_SPACING = (WAVE_SPEED * WAVE_CADENCE_MS) / MS_PER_S;
/** Length of the glow trailing each front, in picture widths. */
export const WAVE_WIDTH = 0.07;
/** Tone steps added right on a front, before falloff. */
export const WAVE_GAIN = 2;
/** Distance, in picture widths, at which the signal has faded out. */
export const WAVE_REACH = 0.9;
/** Where a front crosses blank sky it leaves faint dots, so each ring reads whole. */
export const WAVE_TRACE_GLYPH = '.';
/** Depth of that dotted front, in picture widths (about one glyph). */
export const WAVE_TRACE_WIDTH = 0.012;

/**
 * Cold load: a figure already in view whose first report comes later than this was painted as the
 * still picture first, so it goes straight to live instead of dropping back to static.
 */
export const TUNE_IN_WINDOW_MS = 300;

const MAX_TONE = TONE_COUNT - 1;
/** Cell centre offset, in cells. */
const CENTRE = 0.5;
const ORIGIN_PATTERN = /^(\d*\.?\d+) (\d*\.?\d+)$/;
const BLANK = ' ';
/** Static fills the whole raster: every ramp glyph but the blank. */
const NOISE_GLYPHS = ASCII_RAMP.slice(1);
const FIRST_GLYPH = 1;
const LAST_GLYPH = ASCII_RAMP.length - 1;
const TONE_CLASS = /^t(\d)$/;
/** Below this draw a neighbour steps down the ramp, above it up. */
const HALF = 0.5;

function pushCell(runs: AsciiRun[], tone: Tone, glyph: string): void {
  const last = runs.at(-1);
  if (last?.tone === tone) last.text += glyph;
  else runs.push({ tone, text: glyph });
}

/** A row's glyphs and tones cell by cell, padded with blanks to `cols`. */
function cells(source: readonly AsciiRun[], cols: number): { glyphs: string; tones: Tone[] } {
  const glyphs = source
    .map((run) => run.text)
    .join('')
    .padEnd(cols, BLANK);
  const tones = source.flatMap((run) => Array.from(run.text, () => run.tone));
  return { glyphs, tones };
}

function pick(length: number, random: Random): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

/** What can stop the live signal: reduced motion, a hidden tab, the visitor's HOLD key. */
export type MotionState = { reduced: boolean; hidden: boolean; held: boolean };

export function canAnimate({ reduced, hidden, held }: MotionState): boolean {
  return !(reduced || hidden || held);
}

/** Skip the tune-in when the figure was in view at its first report and that came late. */
export function skipsTuneIn(inViewAtFirstReport: boolean, sinceNavigationMs: number): boolean {
  return inViewAtFirstReport && sinceNavigationMs > TUNE_IN_WINDOW_MS;
}

/** The tone of a run span (`t0`…`t5`); anything else is a markup bug. */
export function toneFromClass(className: string): Tone {
  const digit = TONE_CLASS.exec(className)?.[1];
  const tone = Number(digit);
  if (digit === undefined || tone >= TONE_COUNT) {
    throw new Error(`Unexpected ASCII tone class "${className}"`);
  }
  return tone as Tone;
}

/** The glyph one step denser or sparser on the ramp; blanks and foreign glyphs stay put. */
export function rampNeighbour(glyph: string, random: Random): string {
  const index = ASCII_RAMP.indexOf(glyph);
  if (index < FIRST_GLYPH) return glyph;
  const down = random() < HALF;
  const step = (down && index > FIRST_GLYPH) || index === LAST_GLYPH ? -1 : 1;
  return ASCII_RAMP.charAt(index + step);
}

export function noiseGlyph(random: Random): string {
  return NOISE_GLYPHS.charAt(pick(NOISE_GLYPHS.length, random));
}

/**
 * When each cell locks in, as a share of the acquisition (row-major, all in [0, 1)): mostly
 * random per glyph, nudged by its row so the lock rolls down the picture like a refresh.
 */
export function revealThresholds(rows: number, cols: number, random: Random): Float64Array {
  const thresholds = new Float64Array(rows * cols);
  for (let i = 0; i < thresholds.length; i++) {
    // Both terms stay below their weight (row < rows, random < 1), so the sum stays below 1.
    const row = Math.floor(i / cols) / rows;
    thresholds[i] = REVEAL_ROW_BIAS * row + (1 - REVEAL_ROW_BIAS) * random();
  }
  return thresholds;
}

/**
 * One row at `progress` (0 static … 1 picture): cells whose time has come show the source glyph
 * and tone, the rest fresh static. The row is padded to `cols` so static fills the raster;
 * `offset` is the row's first index in `thresholds`.
 */
export function acquisitionRuns(
  source: readonly AsciiRun[],
  cols: number,
  thresholds: ArrayLike<number>,
  offset: number,
  progress: number,
  random: Random,
): AsciiRun[] {
  const { glyphs, tones } = cells(source, cols);
  const runs: AsciiRun[] = [];
  for (let x = 0; x < cols; x++) {
    const resolved = (thresholds[offset + x] ?? 0) < progress;
    if (resolved) pushCell(runs, tones[x] ?? 0, glyphs.charAt(x));
    else pushCell(runs, NOISE_TONE, noiseGlyph(random));
  }
  return runs;
}

/** "x y" fractions from a figure's data attribute; no attribute means `WAVE_ORIGIN`. */
export function parseOrigin(value: string | undefined): Origin {
  if (value === undefined) return WAVE_ORIGIN;
  const match = ORIGIN_PATTERN.exec(value);
  const x = Number(match?.[1]);
  const y = Number(match?.[2]);
  if (!match || x > 1 || y > 1) throw new Error(`Bad ASCII wave origin "${value}"`);
  return { x, y };
}

/** Distance of a cell's centre from the origin, in picture widths (a row is 1 / aspect columns). */
export function ringDistance(x: number, y: number, cols: number, rows: number, origin: Origin) {
  const dx = x + CENTRE - origin.x * cols;
  const dy = (y + CENTRE - origin.y * rows) / CHAR_ASPECT;
  return Math.hypot(dx, dy) / cols;
}

/**
 * How far behind the latest ring front `distance` lies at `timeMs`, in picture widths. Rings
 * leave the origin every SPACING / SPEED seconds; before the first one arrives there is none.
 */
export function waveTrail(distance: number, timeMs: number): number {
  const behind = (timeMs / MS_PER_S) * WAVE_SPEED - distance;
  return behind < 0 ? Number.POSITIVE_INFINITY : behind % WAVE_SPACING;
}

/**
 * Tone steps a ring adds at `distance` `trail` behind its front: most on the front, fading over
 * a short trail and with distance from the transmitter.
 */
export function waveBoost(distance: number, trail: number): number {
  if (trail >= WAVE_WIDTH || distance >= WAVE_REACH) return 0;
  return Math.round(WAVE_GAIN * (1 - trail / WAVE_WIDTH) * (1 - distance / WAVE_REACH));
}

/**
 * Row `y` of a live frame at `timeMs`: the source glyphs, brightened under the rings (dots
 * where a live front crosses blank sky), with a little flicker. Padded to `cols`.
 */
export function liveRuns(
  source: readonly AsciiRun[],
  cols: number,
  y: number,
  rows: number,
  origin: Origin,
  timeMs: number,
  random: Random,
): AsciiRun[] {
  const { glyphs, tones } = cells(source, cols);
  const runs: AsciiRun[] = [];
  for (let x = 0; x < cols; x++) {
    const glyph = glyphs.charAt(x);
    const distance = ringDistance(x, y, cols, rows, origin);
    const trail = waveTrail(distance, timeMs);
    const boost = waveBoost(distance, trail);
    if (glyph === BLANK) {
      // The trace's tone follows the boost (one step dimmer), so it fades out with the signal.
      if (boost > 0 && trail < WAVE_TRACE_WIDTH)
        pushCell(runs, (boost - 1) as Tone, WAVE_TRACE_GLYPH);
      else pushCell(runs, 0, BLANK);
      continue;
    }
    const tone = Math.min(MAX_TONE, (tones[x] ?? 0) + boost) as Tone;
    pushCell(runs, tone, random() < FLICKER_RATIO ? rampNeighbour(glyph, random) : glyph);
  }
  return runs;
}
