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

/** A record without its blank entries, so an emptied TR ui string falls back to EN. */
export function withoutBlankValues(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => !isBlank(entry)));
}
