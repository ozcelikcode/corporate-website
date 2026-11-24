import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SectionLayout } from '../../lib/sections-schema.ts';
import { BAND, bandTinted, DIVIDER, FIRST_BAND, sectionBand } from './band-class.ts';

const DEFAULT_LAYOUT: SectionLayout = { background: 'default', spacing: 'regular' };
const MIDDLE = { first: false, afterTint: false };
const FIRST = { first: true, afterTint: false };
const AFTER_TINT = { first: false, afterTint: true };
const classes = (value: string) => value.split(' ').filter((part) => part !== '');

test('the default layout renders the usual band, first or after a divider', () => {
  assert.equal(BAND, 'py-16 md:py-24 last:pb-0');
  assert.equal(sectionBand(DEFAULT_LAYOUT, MIDDLE), `${BAND} ${DIVIDER}`);
  assert.equal(sectionBand(DEFAULT_LAYOUT, FIRST), `${BAND} ${FIRST_BAND}`);
});

test('spacing swaps only the vertical padding', () => {
  assert.equal(
    sectionBand({ ...DEFAULT_LAYOUT, spacing: 'compact' }, MIDDLE),
    `py-10 md:py-16 last:pb-0 ${DIVIDER}`,
  );
  assert.equal(
    sectionBand({ ...DEFAULT_LAYOUT, spacing: 'spacious' }, FIRST),
    `py-24 md:py-32 last:pb-0 ${FIRST_BAND}`,
  );
});

test('a tinted band is its own edge and keeps its bottom padding when last', () => {
  for (const background of ['subtle', 'contrast'] as const) {
    const band = classes(sectionBand({ ...DEFAULT_LAYOUT, background }, MIDDLE));
    assert.ok(band.includes(`band-${background}`), background);
    assert.ok(!band.includes('last:pb-0'), background);
    for (const part of classes(DIVIDER)) assert.ok(!band.includes(part), background);
    const first = classes(sectionBand({ ...DEFAULT_LAYOUT, background }, FIRST));
    for (const part of classes(FIRST_BAND)) assert.ok(first.includes(part), background);
  }
});

test('the band after a tinted one skips the divider', () => {
  assert.equal(sectionBand(DEFAULT_LAYOUT, AFTER_TINT), BAND);
});

test('only subtle and contrast backgrounds are tinted', () => {
  assert.equal(bandTinted(DEFAULT_LAYOUT), false);
  assert.equal(bandTinted({ ...DEFAULT_LAYOUT, background: 'subtle' }), true);
  assert.equal(bandTinted({ ...DEFAULT_LAYOUT, background: 'contrast' }), true);
});
