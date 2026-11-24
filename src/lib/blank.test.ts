import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'astro/zod';
import {
  isBlank,
  listField,
  optionalField,
  optionalObjectField,
  withoutBlankValues,
} from './blank.ts';

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

test('listField reads a missing or null list as empty and still validates a set one', () => {
  const schema = z.strictObject({ items: listField(z.array(z.string()).max(1)) });
  assert.deepEqual(schema.parse({}).items, []);
  assert.deepEqual(schema.parse({ items: null }).items, []);
  assert.deepEqual(schema.parse({ items: ['a'] }).items, ['a']);
  assert.equal(schema.safeParse({ items: ['a', 'b'] }).success, false);
  assert.equal(schema.safeParse({ items: [1] }).success, false);
});

test('optionalObjectField: undefined, null, {} and all-blank leaves are absent; a set object validates', () => {
  const inner = z.strictObject({
    a: z.string().min(1),
    b: z.strictObject({ c: z.string().min(1) }),
  });
  const schema = z.strictObject({ item: optionalObjectField(inner) });
  assert.equal(schema.parse({}).item, undefined);
  for (const item of [null, {}, { a: '', b: {} }, { a: ' ', b: { c: null } }]) {
    assert.equal(schema.parse({ item }).item, undefined, JSON.stringify(item));
  }
  assert.deepEqual(schema.parse({ item: { a: 'A', b: { c: 'C' } } }).item, {
    a: 'A',
    b: { c: 'C' },
  });
  assert.equal(schema.safeParse({ item: { a: 'A', b: {} } }).success, false);
  assert.equal(schema.safeParse({ item: { a: 'A', b: { c: 'C' }, x: 1 } }).success, false);
});
