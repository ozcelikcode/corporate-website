/**
 * Keystatic's `fields.blocks` stores each section as `{ discriminant, value }`. The content schema
 * turns that back into the flat `{ type, ...fields }` section the components render, so they never
 * see the stored shape.
 */
export type StoredBlock = { discriminant: string; value: Record<string, unknown> };

const STORED_KEYS = ['discriminant', 'value'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Exactly `{ discriminant: string, value: object }`; a `type` inside the value would shadow the
 * discriminant, so such a block is not one.
 */
export function isStoredBlock(value: unknown): value is StoredBlock {
  return (
    isPlainObject(value) &&
    Object.keys(value).length === STORED_KEYS.length &&
    typeof value.discriminant === 'string' &&
    isPlainObject(value.value) &&
    !('type' in value.value)
  );
}

/** A stored block as a flat section; anything else is returned unchanged for the schema to reject. */
export function toFlatSection(value: unknown): unknown {
  return isStoredBlock(value) ? { type: value.discriminant, ...value.value } : value;
}
