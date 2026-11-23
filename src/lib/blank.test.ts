import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'astro/zod';
import { isBlank, optionalField, withoutBlankValues } from './blank.ts';

test('isBlank is true for an empty or whitespace-only string and for null', () => {
  for (const value of ['', '   ', '\n\t', null]) assert.equal(isBlank(value), true, String(value));
  for (const value of ['x', ' x ', 0, false, [], {}, undefined]) {
    assert.equal(isBlank(value), false, String(value));
  }
});

test('optionalField reads a blank value as absent and keeps a real one', () => {
  const schema = z.strictObject({ text: optionalField(z.string()) });
  assert.deepEqual(schema.parse({}), {});
  assert.equal(schema.parse({ text: '' }).text, undefined);
  assert.equal(schema.parse({ text: '  ' }).text, undefined);
  assert.equal(schema.parse({ text: null }).text, undefined);
  assert.equal(schema.parse({ text: 'Hello' }).text, 'Hello');
});

test('optionalField still validates a value that is not blank', () => {
  const schema = optionalField(z.string().regex(/^\d+$/));
  assert.equal(schema.safeParse('12').success, true);
  assert.equal(schema.safeParse('1a').success, false);
});

test('withoutBlankValues drops blank entries of a record and leaves other values alone', () => {
  assert.deepEqual(withoutBlankValues({ a: 'A', b: '', c: '  ', d: null }), { a: 'A' });
  assert.equal(withoutBlankValues('text'), 'text');
  assert.equal(withoutBlankValues(null), null);
  assert.deepEqual(withoutBlankValues(['', 'x']), ['', 'x']);
});
