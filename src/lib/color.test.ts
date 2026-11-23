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
