import assert from 'node:assert/strict';
import { test } from 'node:test';
import { padIndex } from './pad-index.ts';

test('padIndex zero-pads to two digits', () => {
  assert.equal(padIndex(1), '01');
  assert.equal(padIndex(9), '09');
});

test('padIndex keeps wider numbers whole', () => {
  assert.equal(padIndex(12), '12');
  assert.equal(padIndex(123), '123');
});
