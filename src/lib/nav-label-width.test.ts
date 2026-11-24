import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labelWidthPerMille } from './nav-label-width.ts';

test('a label sums the advances of its glyphs', () => {
  assert.equal(labelWidthPerMille('Applications'), 5930);
  assert.equal(labelWidthPerMille(''), 0);
});

test('a glyph outside the table counts wider than any measured one', () => {
  assert.ok(labelWidthPerMille('Œ') > labelWidthPerMille('W'));
  assert.equal(labelWidthPerMille('Œ'), labelWidthPerMille('Ǆ'));
});
