import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HEX_PATTERN } from './color.ts';
import { UI_KEYS } from './i18n.ts';
import { DURATION_PATTERN, SECTION_TYPES } from './sections-schema.ts';

const config = readFileSync(new URL('../../public/admin/config.yml', import.meta.url), 'utf8');
const html = readFileSync(new URL('../pages/admin/index.astro', import.meta.url), 'utf8');

test('config.yml declares every section block type', () => {
  // Line-anchored: a longer key must not satisfy a shorter one.
  for (const type of SECTION_TYPES) assert.match(config, new RegExp(`name: ${type}$`, 'm'), type);
});

test('config.yml declares every UI string key', () => {
  for (const key of UI_KEYS) assert.match(config, new RegExp(`name: ${key}$`, 'm'), key);
});

test('config.yml carries the workflow, i18n, media and accent settings', () => {
  for (const setting of [
    'publish_mode: editorial_workflow',
    'structure: multiple_folders',
    'media_folder: src/assets/uploads',
    'typeKey: type',
    HEX_PATTERN.source,
    DURATION_PATTERN.source,
  ])
    assert.ok(config.includes(setting), setting);
});

test('admin page loads the pinned Sveltia bundle with an SRI hash', () => {
  assert.match(html, /@sveltia\/cms@0\.271\.2\/dist\/sveltia-cms\.js/);
  assert.match(html, /integrity="sha384-[A-Za-z0-9+/]{64}"/);
});

test('config.yml ui collection declares exactly UI_KEYS (no dead strings)', () => {
  const ui = config.slice(
    config.indexOf('  - name: ui\n'),
    config.indexOf('  - name: navigation\n'),
  );
  const names = [...ui.matchAll(/^ {6}- name: (\w+)$/gm)].map((match) => match[1]);
  assert.deepEqual(names.sort(), [...UI_KEYS].sort());
});

test('config.yml omits empty optional fields and creates new entries in EN only', () => {
  assert.match(config, /^output:\n {2}omit_empty_optional_fields: true$/m);
  assert.match(config, /^i18n:\n(?: {2}.*\n)* {2}initial_locales: default$/m);
});

test('config.yml limits the hero image to rasters the ASCII renderer reads', () => {
  assert.match(
    config,
    /- name: image\n {16}label: Image\n {16}widget: image\n {16}accept: "image\/png,image\/jpeg,image\/webp"$/m,
  );
});
