import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Section, SectionLayout } from '../../lib/sections-schema.ts';
import {
  BAND,
  bandBefore,
  DEFAULT_LAYOUT,
  DIVIDER,
  FIRST_BAND,
  PLAIN_BAND,
  sectionBand,
} from './band-class.ts';

const MIDDLE = PLAIN_BAND;
const FIRST = undefined;
const tinted = (background: 'subtle' | 'contrast'): SectionLayout => ({
  ...DEFAULT_LAYOUT,
  background,
});
const AFTER_TINT = tinted('subtle');
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

test('every previous-band case keeps the output of the old place flags', () => {
  const TINT_CLASS = { subtle: 'band-subtle', contrast: 'band-contrast' } as const;
  for (const background of ['subtle', 'contrast'] as const) {
    const layout = tinted(background);
    const tint = TINT_CLASS[background];
    const body = `py-16 md:py-24 ${tint}`;
    assert.equal(sectionBand(layout, PLAIN_BAND), body);
    assert.equal(sectionBand(layout, FIRST), `${body} ${FIRST_BAND}`);
    // A tinted band after the other tint is its own edge, as before.
    const other = tinted(background === 'subtle' ? 'contrast' : 'subtle');
    assert.equal(sectionBand(layout, other), body);
    // A plain band after a tint skips the rule, as before.
    assert.equal(sectionBand(DEFAULT_LAYOUT, layout), BAND);
  }
  assert.equal(sectionBand(DEFAULT_LAYOUT, DEFAULT_LAYOUT), `${BAND} ${DIVIDER}`);
});

test('two adjacent bands of the same tint keep one hairline rule between them', () => {
  for (const background of ['subtle', 'contrast'] as const) {
    const layout = tinted(background);
    const band = classes(sectionBand(layout, layout));
    for (const part of classes(DIVIDER)) assert.ok(band.includes(part), background);
    assert.ok(band.includes(`band-${background}`), background);
    // The rule needs a ground that differs from it, and only the border colour token is used.
    assert.ok(DIVIDER.includes('border-line'));
  }
});

test('bandBefore reads the band above: a layout, a plain band, the title band or nothing', () => {
  const layout = tinted('contrast');
  const hero = { type: 'hero' } as Section;
  const statement = { type: 'statement', layout } as Section;
  assert.equal(bandBefore([], 0, false), undefined);
  assert.equal(bandBefore([hero, statement], 0, false), undefined);
  assert.equal(bandBefore([hero, statement], 0, true), PLAIN_BAND);
  assert.equal(bandBefore([hero, statement], 1, false), PLAIN_BAND);
  assert.equal(bandBefore([hero, statement], 2, true), layout);
  assert.equal(bandBefore([], 0, true), PLAIN_BAND);
});
