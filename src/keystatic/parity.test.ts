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
import { NAV_CHILDREN_MAX, NAV_HEADER_MAX, navigationSchema } from '../lib/navigation-schema.ts';
import {
  DURATION_PATTERN,
  LABEL_MAX,
  LOGOS_MAX,
  LOGOS_MIN,
  MAX_ACTIONS,
  MAX_ITEMS,
  SECTION_TYPES,
  type SectionType,
  STATS_MAX,
  STATS_MIN,
  sectionSchemas,
} from '../lib/sections-schema.ts';
import { collections, DESCRIPTION_LIMIT, TAGLINE_LIMIT } from './collections.ts';
import { LOCAL_CONFIG } from './keystatic-config.ts';
import { DURATION_REGEX, SECTION_LIMITS } from './sections.ts';
import { NAV_CHILDREN_LIMIT, NAV_HEADER_LIMIT, singletons } from './singletons.ts';

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
      assert.deepEqual(
        keystaticKeys(block),
        zodKeys(schemas[type as SectionType]),
        `${name} ${type}`,
      );
    }
  }
});

test('the admin limits and patterns match the Zod schemas', () => {
  assert.equal(NAV_CHILDREN_LIMIT, NAV_CHILDREN_MAX);
  assert.equal(NAV_HEADER_LIMIT, NAV_HEADER_MAX);
  for (const nav of [singletons.navigationEn, singletons.navigationTr]) {
    assert.deepEqual(nav.schema.header.validation?.length, { min: 1, max: NAV_HEADER_MAX });
  }
  assert.deepEqual(SECTION_LIMITS, {
    label: LABEL_MAX,
    actions: MAX_ACTIONS,
    items: MAX_ITEMS,
    stats: { min: STATS_MIN, max: STATS_MAX },
    logos: { min: LOGOS_MIN, max: LOGOS_MAX },
  });
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

/** The Zod schema of the key at `path`; lists, defaults, optionals and preprocessing are transparent. */
function zodAt(schema: z.ZodType, path: readonly string[]): z.ZodType {
  const [key, ...rest] = path;
  if (key === undefined) return schema;
  const def = (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
  if (def.shape) {
    const next = def.shape[key];
    assert.ok(next, `no Zod key ${key}`);
    return zodAt(next, rest);
  }
  const inner = def.type === 'pipe' ? def.out : (def.innerType ?? def.element);
  assert.ok(inner, `no Zod key ${key}`);
  return zodAt(inner, path);
}

/** The Keystatic field at `path`; lists are transparent. */
function fieldAt(schema: ComponentSchema, path: readonly string[]): ComponentSchema {
  const [key, ...rest] = path;
  if (key === undefined) return schema;
  if (schema.kind === 'object') {
    const next = schema.fields[key];
    assert.ok(next, `no Keystatic field ${key}`);
    return fieldAt(next, rest);
  }
  assert.equal(schema.kind, 'array', `no Keystatic field ${key}`);
  return fieldAt(schema.kind === 'array' ? schema.element : schema, path);
}

/** What the admin says when it refuses `value` (Keystatic's own check on save), or undefined. */
function adminRefusal(field: ComponentSchema, value: string): string | undefined {
  assert.equal(field.kind, 'form');
  if (field.kind !== 'form') return undefined;
  try {
    field.validate(value, undefined);
    return undefined;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return error.message;
  }
}

const LINK_SAMPLES = [
  '/about/',
  '/',
  'about/',
  '//evil.example',
  '/\\evil.example',
  'https://example.com/',
  'https://',
  'http://example.com/',
  'www.example.com',
  'mailto:team@example.com',
  'tel:+15550100',
  'javascript:alert(1)',
  'https://exa mple.com',
  '',
];

/**
 * A link in the admin and its Zod rule. `group` marks a link inside an optional group (a button
 * that may be left empty): its own empty value stands for "no group", which Zod reads as absent.
 */
type LinkPair = { name: string; field: ComponentSchema; zod: z.ZodType; group?: true };

function linkPairs(): LinkPair[] {
  const settings = fields.object(singletons.settings.schema);
  const settingsZod = settingsSchema(context);
  const pairs: LinkPair[] = [
    ['contacts', 'href'],
    ['socials', 'href'],
    ['organization', 'url'],
  ].map((path) => ({
    name: `settings ${path.join('.')}`,
    field: fieldAt(settings, path),
    zod: zodAt(settingsZod, path),
  }));
  for (const entry of [singletons.navigationEn, singletons.navigationTr]) {
    const nav = fields.object(entry.schema);
    for (const path of [
      ['header', 'href'],
      ['header', 'children', 'href'],
      ['footer', 'href'],
    ]) {
      pairs.push({
        name: `${entry.path} ${path.join('.')}`,
        field: fieldAt(nav, path),
        zod: zodAt(navigationSchema, path),
      });
    }
    const feature = ['header', 'feature', 'action', 'href'];
    pairs.push({
      name: `${entry.path} ${feature.join('.')}`,
      field: fieldAt(nav, feature),
      zod: zodAt(navigationSchema, feature),
      group: true,
    });
  }
  for (const name of ['applicationsEn', 'applicationsTr'] as const) {
    const application = fields.object(collections[name].schema);
    for (const path of [['links', 'href'], ['brochure']]) {
      pairs.push({
        name: `${name} ${path.join('.')}`,
        field: fieldAt(application, path),
        zod: zodAt(applicationSchema(context), path),
      });
    }
  }
  const schemas = sectionSchemas(context);
  const blockLinks: [SectionType, string[], true?][] = [
    ['hero', ['actions', 'href']],
    ['cta', ['action', 'href']],
    ['logos', ['items', 'href']],
    ['media-split', ['action', 'href'], true],
  ];
  for (const name of COLLECTION_NAMES) {
    const blocks = blockSchemas(name);
    for (const [type, path, group] of blockLinks) {
      const block = blocks[type];
      if (block === undefined) continue;
      pairs.push({
        name: `${name} ${type} ${path.join('.')}`,
        field: fieldAt(block, path),
        zod: zodAt(schemas[type], path),
        ...(group ? { group } : {}),
      });
    }
  }
  return pairs;
}

test('every admin link takes and refuses what the build does, with a message', () => {
  const pairs = linkPairs();
  // Settings 3, navigation 2 × 4, applications 2 × 2, blocks: pages 2 × 4, applications 2 × 3.
  assert.equal(pairs.length, 3 + 8 + 4 + 8 + 6);
  for (const { name, field, zod, group } of pairs) {
    for (const value of LINK_SAMPLES) {
      const refusal = adminRefusal(field, value);
      const where = `${name} "${value}"`;
      if (group && value === '') {
        assert.equal(refusal, undefined, `${where}: an empty optional group must save`);
        continue;
      }
      assert.equal(refusal === undefined, zod.safeParse(value).success, where);
      if (refusal !== undefined && value !== '') {
        assert.match(refusal, /^Use /, `${where}: ${refusal}`);
      }
    }
  }
});

test('optional groups tell the editor to fill every field or none', () => {
  const nav = fields.object(singletons.navigationEn.schema);
  const groups = [fieldAt(nav, ['header', 'feature'])];
  for (const name of COLLECTION_NAMES) {
    const mediaSplit = blockSchemas(name)['media-split'];
    assert.ok(mediaSplit, name);
    groups.push(fieldAt(mediaSplit, ['action']));
  }
  for (const group of groups) {
    assert.equal(group.kind, 'object');
    if (group.kind === 'object') {
      assert.match(group.description ?? '', /Fill all fields or leave all empty/);
    }
  }
});

test('the nav feature button label has the action label limit', () => {
  const nav = fields.object(singletons.navigationEn.schema);
  const label = fieldAt(nav, ['header', 'feature', 'action', 'label']);
  const zod = zodAt(navigationSchema, ['header', 'feature', 'action', 'label']);
  for (const value of ['x'.repeat(LABEL_MAX), 'x'.repeat(LABEL_MAX + 1)]) {
    assert.equal(adminRefusal(label, value) === undefined, zod.safeParse(value).success);
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
  // Settings logo and ogImage, three covers; per home (EN, TR): hero, two media, six logos and a
  // portrait; one media image on about and on each application.
  const SEED_IMAGES = 2 + 3 + 2 * (1 + 2 + 6 + 1) + 1 + 3;
  assert.equal(images, SEED_IMAGES);
});
