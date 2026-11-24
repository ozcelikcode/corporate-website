import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toFlatSection } from './stored-block.ts';

const action = { label: 'Go', href: '/quote/' };

test('stored block becomes a flat section', () =>
  assert.deepEqual(toFlatSection({ discriminant: 'cta', value: { heading: 'H', action } }), {
    type: 'cta',
    heading: 'H',
    action,
  }));

test('a stored block with an empty value becomes a section with only its type', () =>
  assert.deepEqual(toFlatSection({ discriminant: 'statement', value: {} }), {
    type: 'statement',
  }));
