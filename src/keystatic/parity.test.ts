import type { SchemaContext } from 'astro:content';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { type ComponentSchema, fields } from '@keystatic/core';
import { createReader } from '@keystatic/core/reader';
import { z } from 'astro/zod';
import { settingsSchema } from '../lib/content-schemas.ts';
import { UI_KEYS } from '../lib/i18n.ts';
import { NAV_CHILDREN_MAX, navigationSchema } from '../lib/navigation-schema.ts';
import { LOCAL_CONFIG } from './keystatic-config.ts';
import { NAV_CHILDREN_LIMIT, singletons } from './singletons.ts';

// The real `image()` helper needs the Astro content runtime; a string stands in for it.
const context: SchemaContext = {
  image: (() => z.string()) as unknown as SchemaContext['image'],
};

/** Object keys at every depth; lists are transparent, leaves are `null`. */
type KeyTree = { [key: string]: KeyTree } | null;
type ZodDef = {
  type: string;
  shape?: Record<string, z.ZodType>;
  out?: z.ZodType;
  innerType?: z.ZodType;
  element?: z.ZodType;
};

function zodKeys(schema: z.ZodType): KeyTree {
  // Reads Zod 4 internals (`_zod.def`: type, shape, out, innerType, element); re-check on a Zod
  // (astro/zod) upgrade.
  const def = (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
  if (def.shape) {
    return Object.fromEntries(Object.entries(def.shape).map(([key, v]) => [key, zodKeys(v)]));
  }
  const inner = def.type === 'pipe' ? def.out : (def.innerType ?? def.element);
  return inner ? zodKeys(inner) : null;
}

function keystaticKeys(field: ComponentSchema): KeyTree {
  if (field.kind === 'object') {
    return Object.fromEntries(
      Object.entries(field.fields).map(([key, v]) => [key, keystaticKeys(v)]),
    );
  }
  return field.kind === 'array' ? keystaticKeys(field.element) : null;
}

test('every singleton path is a YAML file on disk', () => {
  for (const [name, entry] of Object.entries(singletons)) {
    assert.equal(entry.format, 'yaml', name);
    assert.ok(existsSync(`${entry.path}.yaml`), `${name}: ${entry.path}.yaml`);
  }
});

test('every ui field is a UI key and every UI key a field', () => {
  for (const entry of [singletons.uiEn, singletons.uiTr]) {
    assert.deepEqual(Object.keys(entry.schema), [...UI_KEYS], entry.path);
  }
});

test('settings and navigation field keys equal the Zod schema keys', () => {
  assert.deepEqual(
    keystaticKeys(fields.object(singletons.settings.schema)),
    zodKeys(settingsSchema(context)),
  );
  for (const entry of [singletons.navigationEn, singletons.navigationTr]) {
    assert.deepEqual(
      keystaticKeys(fields.object(entry.schema)),
      zodKeys(navigationSchema),
      entry.path,
    );
  }
});

test('the admin children limit matches the navigation schema', () =>
  assert.equal(NAV_CHILDREN_LIMIT, NAV_CHILDREN_MAX));

test('Keystatic reads every singleton seed', async () => {
  const reader = createReader(process.cwd(), LOCAL_CONFIG);
  for (const name of Object.keys(singletons) as (keyof typeof singletons)[]) {
    assert.notEqual(await reader.singletons[name].read(), null, name);
  }
});
