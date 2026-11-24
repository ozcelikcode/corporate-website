import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_LABEL_MAX, itemLabel } from './item-label.ts';

test('a row label is the type and the text', () => {
  assert.equal(
    itemLabel('Hero', 'Software for the control room'),
    'Hero · Software for the control room',
  );
});

test('an empty text falls back to the type name', () => {
  for (const text of ['', '   ', '\n', null, undefined]) {
    assert.equal(itemLabel('Statement', text), 'Statement');
  }
});

test('line breaks collapse and long text is cut to the limit', () => {
  assert.equal(itemLabel('Statement', 'One\n  two'), 'Statement · One two');
  const label = itemLabel('Media and text', 'x'.repeat(ITEM_LABEL_MAX * 2));
  assert.equal(label.length, ITEM_LABEL_MAX);
  assert.ok(label.endsWith('…'));
});
