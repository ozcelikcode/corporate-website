import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  accentContrast,
  contrastRatio,
  MIN_ACCENT_CONTRAST,
  oklchToSrgb,
  parseHex,
} from './color.ts';

test('parseHex reads six-digit hex and rejects anything else', () => {
  assert.deepEqual(parseHex('#FFB000'), { r: 255, g: 176, b: 0 });
  for (const bad of ['#fff', 'ffb000', '#ggg000']) assert.throws(() => parseHex(bad), bad);
});

test('contrastRatio gives 21:1 for black on white', () => {
  assert.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 0.01);
});

test('accentContrast accepts amber and rejects near-canvas grey', () => {
  assert.ok(accentContrast('#ffb000') >= MIN_ACCENT_CONTRAST);
  assert.ok(accentContrast('#1a1a1a') < MIN_ACCENT_CONTRAST);
});

test('oklchToSrgb maps white to white', () => {
  assert.deepEqual(oklchToSrgb(1, 0, 0), { r: 255, g: 255, b: 255 });
});

test('CANVAS_OKLCH matches the canvas token', () => {
  assert.match(
    readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8'),
    /--color-canvas:\s*oklch\(0\.17 0\.008 255\)/,
  );
});

const TOKENS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const OKLCH_VALUE = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/;
const MIX_VALUE = /^color-mix\(in oklab, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/;
const PERCENT = 100;
const HALF_TURN = 180;
const WHITE_SEED = '#ffffff';
/** A rule may be this share fainter than the page's own rule (line on canvas) and still read. */
const RULE_FLOOR = 0.8;

type Oklab = { l: number; a: number; b: number };

const declared = (name: string): string => {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(TOKENS);
  assert.ok(match?.[1], `${name} is declared in tokens.css`);
  return match[1].trim();
};

/** Resolves a token (an oklch value, a `var()` or an oklab `color-mix`) to OKLab. */
function resolve(name: string, overrides: Record<string, Oklab> = {}): Oklab {
  const override = overrides[name];
  if (override !== undefined) return override;
  const value = declared(name);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference?.[1]) return resolve(reference[1], overrides);
  const mix = MIX_VALUE.exec(value);
  if (mix?.[1] && mix[2] && mix[3]) {
    const share = Number(mix[2]) / PERCENT;
    const from = resolve(mix[1], overrides);
    const to = resolve(mix[3], overrides);
    return {
      l: from.l * share + to.l * (1 - share),
      a: from.a * share + to.a * (1 - share),
      b: from.b * share + to.b * (1 - share),
    };
  }
  const oklch = OKLCH_VALUE.exec(value);
  assert.ok(oklch?.[1] && oklch[2] && oklch[3], `${name} is a supported token: ${value}`);
  const hue = (Number(oklch[3]) * Math.PI) / HALF_TURN;
  const chroma = Number(oklch[2]);
  return { l: Number(oklch[1]), a: chroma * Math.cos(hue), b: chroma * Math.sin(hue) };
}

const toRgb = ({ l, a, b }: Oklab) =>
  oklchToSrgb(l, Math.hypot(a, b), (Math.atan2(b, a) * HALF_TURN) / Math.PI);

test('the white seed keeps 3:1 for the contrast band accent on its ground and tiles', () => {
  // A white seed is the worst case: the accent is the seed mixed toward the band's dark ink.
  assert.deepEqual(oklchToSrgb(1, 0, 0), parseHex(WHITE_SEED));
  const white: Oklab = { l: 1, a: 0, b: 0 };
  const accent = toRgb(resolve('--contrast-accent', { '--accent-seed': white }));
  for (const ground of ['--contrast-canvas', '--contrast-surface']) {
    const ratio = contrastRatio(accent, toRgb(resolve(ground)));
    assert.ok(ratio >= MIN_ACCENT_CONTRAST, `${ground}: ${ratio.toFixed(2)}:1`);
  }
});

test('the divider rule stays visible on the subtle and contrast band grounds', () => {
  const reference = contrastRatio(toRgb(resolve('--color-line')), toRgb(resolve('--color-canvas')));
  const bands = [
    ['--color-line', '--band-subtle'],
    ['--contrast-line', '--contrast-canvas'],
  ] as const;
  for (const [line, ground] of bands) {
    const ratio = contrastRatio(toRgb(resolve(line)), toRgb(resolve(ground)));
    assert.ok(
      ratio >= reference * RULE_FLOOR,
      `${line} on ${ground}: ${ratio.toFixed(2)} vs ${reference.toFixed(2)}`,
    );
  }
});
