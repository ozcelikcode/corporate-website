/**
 * Keystatic's `fields.blocks` stores each section as `{ discriminant, value }`. The content schema
 * validates that stored shape (so errors name the YAML path) and then turns it into the flat
 * `{ type, ...fields }` section the components render, so they never see the stored shape.
 */
export type StoredBlock<T extends string, V extends object> = { discriminant: T; value: V };

/** A validated stored block as a flat section (its strict value schema has no `type` key). */
export function toFlatSection<T extends string, V extends object>({
  discriminant,
  value,
}: StoredBlock<T, V>): { type: T } & V {
  return { type: discriminant, ...value };
}
