import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HEX_PATTERN } from './color.ts';
import { UI_KEYS } from './i18n.ts';
import { DURATION_PATTERN, SECTION_TYPES } from './sections-schema.ts';

const config = readFileSync(new URL('../../public/admin/config.yml', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/admin/index.html', import.meta.url), 'utf8');

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

test('index.html loads the pinned Sveltia bundle with an SRI hash', () => {
  assert.match(html, /@sveltia\/cms@0\.271\.2\/dist\/sveltia-cms\.js/);
  assert.match(html, /integrity="sha384-[A-Za-z0-9+/]{64}"/);
});
