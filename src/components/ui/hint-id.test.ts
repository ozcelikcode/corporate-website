import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hintId } from './hint-id.ts';

test('hintId suffixes the control id with -hint', () => {
  assert.equal(hintId('quote-email'), 'quote-email-hint');
});
