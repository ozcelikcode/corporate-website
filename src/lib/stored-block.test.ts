import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStoredBlock, toFlatSection } from './stored-block.ts';

const action = { label: 'Go', href: '/quote/' };

test('stored block becomes a flat section', () =>
  assert.deepEqual(toFlatSection({ discriminant: 'cta', value: { heading: 'H', action } }), {
    type: 'cta',
    heading: 'H',
    action,
  }));

test('non-stored values pass through unchanged', () => {
  const flat = { type: 'cta', heading: 'H', action };
  const extraKey = { discriminant: 'cta', value: { heading: 'H' }, type: 'cta' };
  const typeInValue = { discriminant: 'cta', value: { type: 'hero', heading: 'H' } };
  for (const value of [
    flat,
    extraKey,
    typeInValue,
    { discriminant: 'cta' },
    { discriminant: 1, value: {} },
    { discriminant: 'cta', value: null },
    { discriminant: 'cta', value: [] },
    null,
    'cta',
    [],
  ]) {
    assert.equal(toFlatSection(value), value);
    assert.equal(isStoredBlock(value), false, JSON.stringify(value));
  }
});

test('a stored block with an empty value is still a stored block', () =>
  assert.deepEqual(toFlatSection({ discriminant: 'statement', value: {} }), {
    type: 'statement',
  }));
