import type { SchemaContext } from 'astro:content';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { type ComponentSchema, fields } from '@keystatic/core';
import { createReader } from '@keystatic/core/reader';
import { z } from 'astro/zod';
import { applicationSchema, pageSchema, settingsSchema } from '../lib/content-schemas.ts';
import { UI_KEYS } from '../lib/i18n.ts';
import { NAV_CHILDREN_MAX, navigationSchema } from '../lib/navigation-schema.ts';
import {
  ACTION_HREF_PATTERN,
  DURATION_PATTERN,
  LABEL_MAX,
  MAX_ACTIONS,
  MAX_ITEMS,
  SECTION_TYPES,
  type SectionType,
  sectionSchemas,
} from '../lib/sections-schema.ts';
import { collections, DESCRIPTION_LIMIT, TAGLINE_LIMIT } from './collections.ts';
import { LOCAL_CONFIG } from './keystatic-config.ts';
import { DURATION_REGEX, HREF_REGEX, SECTION_LIMITS } from './sections.ts';
import { NAV_CHILDREN_LIMIT, singletons } from './singletons.ts';

// The real `image()` helper needs the Astro content runtime; a string stands in for it.
const context: SchemaContext = {
  image: (() => z.string()) as unknown as SchemaContext['image'],
};
const SEED_ROOTS = ['src/content/pages', 'src/content/applications'];
const SETTINGS_FILE = `${singletons.settings.path}.yaml`;

type CollectionName = keyof typeof collections;
const COLLECTION_NAMES = Object.keys(collections) as CollectionName[];

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

const collectionDir = (name: CollectionName) => collections[name].path.replace(/\*$/, '');

const yamlFilesUnder = (root: string) =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => `${root}/${file}`);

/** The stored blocks of a collection's `sections` field, by type. */
function blockSchemas(name: CollectionName): Record<string, ComponentSchema> {
  const sections: ComponentSchema = collections[name].schema.sections;
  assert.equal(sections.kind, 'array', name);
  const block = sections.kind === 'array' ? sections.element : sections;
  assert.equal(block.kind, 'conditional', name);
  return block.kind === 'conditional' ? block.values : {};
}

/** An image field's stored path, with the property path Keystatic names its file after. */
type ImageUse = {
  field: Extract<ComponentSchema, { formKind: 'asset' }>;
  stored: string;
  propPath: string[];
};

function imageUses(schema: ComponentSchema, value: unknown, propPath: string[] = []): ImageUse[] {
  if (schema.kind === 'object') {
    const record = (value ?? {}) as Record<string, unknown>;
    return Object.entries(schema.fields).flatMap(([key, field]) =>
      imageUses(field, record[key], [...propPath, key]),
    );
  }
  if (schema.kind === 'array') {
    return ((value ?? []) as unknown[]).flatMap((item, i) =>
      imageUses(schema.element, item, [...propPath, String(i)]),
    );
  }
  if (schema.kind === 'conditional') {
    const block = value as { discriminant: string; value: unknown };
    const inner = schema.values[block.discriminant];
    return inner ? imageUses(inner, block.value, [...propPath, 'value']) : [];
  }
  if (schema.kind === 'form' && schema.formKind === 'asset' && typeof value === 'string') {
    return [{ field: schema, stored: value, propPath }];
  }
  return [];
}

/** Checks every image of one entry: stored as Keystatic writes it, and on disk there. */
function assertImagesInPlace(
  schema: Record<string, ComponentSchema>,
  entry: unknown,
  yamlFile: string,
  slug: string | undefined,
) {
  const uses = imageUses(fields.object(schema), entry);
  for (const { field, stored, propPath } of uses) {
    const extension = stored.split('.').at(-1) ?? '';
    const written = field.serialize(
      { data: new Uint8Array(), filename: '', extension },
      { suggestedFilenamePrefix: propPath.join('/'), slug },
    );
    const where = `${yamlFile} ${propPath.join('.')}`;
    assert.equal(stored, written.value, where);
    const file = join(field.directory ?? '', slug ?? '', written.asset?.filename ?? '');
    assert.ok(existsSync(file), `${where}: ${file}`);
    assert.equal(resolve(dirname(yamlFile), stored), resolve(file), where);
  }
  return uses.length;
}

test('every singleton path is a YAML file on disk', () => {
  for (const [name, entry] of Object.entries(singletons)) {
    assert.equal(entry.format, 'yaml', name);
    assert.ok(existsSync(`${entry.path}.yaml`), `${name}: ${entry.path}.yaml`);
  }
});

test('every collection path matches the seed files on disk', () => {
  for (const name of COLLECTION_NAMES) {
    assert.deepEqual(collections[name].format, { data: 'yaml' }, name);
    assert.match(collections[name].path, /\/\*$/, name);
  }
  const seeds = SEED_ROOTS.flatMap(yamlFilesUnder);
  for (const file of seeds) {
    const owners = COLLECTION_NAMES.filter(
      (name) => dirname(file) === collectionDir(name).slice(0, -1),
    );
    assert.equal(owners.length, 1, `${file}: ${owners.join(', ')}`);
  }
  for (const name of ['pagesEn', 'pagesTr', 'applicationsEn'] as const) {
    assert.ok(
      seeds.some((file) => file.startsWith(collectionDir(name))),
      name,
    );
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

test('page and application field keys equal the Zod schema keys', () => {
  for (const name of ['pagesEn', 'pagesTr'] as const) {
    assert.deepEqual(
      keystaticKeys(fields.object(collections[name].schema)),
      zodKeys(pageSchema(context)),
    );
  }
  for (const name of ['applicationsEn', 'applicationsTr'] as const) {
    assert.deepEqual(
      keystaticKeys(fields.object(collections[name].schema)),
      zodKeys(applicationSchema(context)),
    );
  }
});

test('every block field key equals its SECTION_SCHEMAS key', () => {
  const schemas = sectionSchemas(context);
  const applicationTypes = SECTION_TYPES.filter((type) => type !== 'hero');
  for (const name of COLLECTION_NAMES) {
    const blocks = blockSchemas(name);
    const expected = name.startsWith('pages') ? SECTION_TYPES : applicationTypes;
    assert.deepEqual(Object.keys(blocks), [...expected], name);
    for (const [type, block] of Object.entries(blocks)) {
      const { type: _discriminant, ...keys } = zodKeys(schemas[type as SectionType]) ?? {};
      assert.deepEqual(keystaticKeys(block), keys, `${name} ${type}`);
    }
  }
});

test('the admin limits and patterns match the Zod schemas', () => {
  assert.equal(NAV_CHILDREN_LIMIT, NAV_CHILDREN_MAX);
  assert.deepEqual(SECTION_LIMITS, { label: LABEL_MAX, actions: MAX_ACTIONS, items: MAX_ITEMS });
  assert.equal(HREF_REGEX.source, ACTION_HREF_PATTERN.source);
  assert.equal(DURATION_REGEX.source, DURATION_PATTERN.source);
  const { description } = pageSchema(context).shape;
  const { tagline } = applicationSchema(context).shape;
  for (const [field, limit] of [
    [description, DESCRIPTION_LIMIT],
    [tagline, TAGLINE_LIMIT],
  ] as const) {
    assert.equal(field.safeParse('x'.repeat(limit)).success, true);
    assert.equal(field.safeParse('x'.repeat(limit + 1)).success, false);
  }
});

test('Keystatic reads every singleton seed', async () => {
  const reader = createReader(process.cwd(), LOCAL_CONFIG);
  for (const name of Object.keys(singletons) as (keyof typeof singletons)[]) {
    assert.notEqual(await reader.singletons[name].read(), null, name);
  }
});

test('Keystatic reads every page and application seed', async () => {
  const reader = createReader(process.cwd(), LOCAL_CONFIG);
  let read = 0;
  for (const name of COLLECTION_NAMES) {
    for (const slug of await reader.collections[name].list()) {
      assert.notEqual(await reader.collections[name].read(slug), null, `${name} ${slug}`);
      read += 1;
    }
  }
  assert.equal(read, SEED_ROOTS.flatMap(yamlFilesUnder).length);
});

test('every seed image path resolves to a file, where Keystatic writes it', async () => {
  const reader = createReader(process.cwd(), LOCAL_CONFIG);
  let images = assertImagesInPlace(
    singletons.settings.schema,
    await reader.singletons.settings.read(),
    SETTINGS_FILE,
    undefined,
  );
  for (const name of COLLECTION_NAMES) {
    for (const { slug, entry } of await reader.collections[name].all()) {
      const file = `${collectionDir(name)}${slug}.yaml`;
      images += assertImagesInPlace(collections[name].schema, entry, file, slug);
    }
  }
  // logo, ogImage, two hero images and three covers
  const SEED_IMAGES = 7;
  assert.equal(images, SEED_IMAGES);
});
