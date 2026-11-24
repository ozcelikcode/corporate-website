/**
 * Blank CMS values. An editor who clears an optional field may leave `""` (or whitespace, or
 * `null`) in the YAML instead of removing the key; that must read as "not set", never fail the
 * build or render an empty element.
 */
import { z } from 'astro/zod';

export function isBlank(value: unknown): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

function blankToUndefined(value: unknown): unknown {
  return isBlank(value) ? undefined : value;
}

/** `schema` as an optional field whose blank value counts as absent. */
export function optionalField<T extends z.ZodType>(schema: T) {
  return z.preprocess(blankToUndefined, schema.optional());
}

/**
 * A list that may be left out: missing, `null` (the CMS saving a cleared list) or blank all parse
 * as `[]`; a list that is set must still pass `schema` (item shape, `max`).
 */
export function listField<T extends z.ZodType>(schema: z.ZodArray<T>) {
  return z.preprocess(blankToUndefined, schema.default([]));
}

/** A record without its blank entries, so an emptied TR ui string falls back to EN. */
export function withoutBlankValues(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => !isBlank(entry)));
}

/** Blank at every depth: a blank leaf, or an object whose values all are (`{}` included). */
function isBlankDeep(value: unknown): boolean {
  if (isBlank(value)) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(isBlankDeep);
}

/**
 * An optional nested object. Keystatic saves an emptied one as `{}` (or with blank leaves), so
 * `undefined`, `null`, `{}` and an object whose leaves are all blank parse as absent; anything
 * else must pass `schema`.
 */
export function optionalObjectField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (isBlankDeep(value) ? undefined : value), schema.optional());
}
