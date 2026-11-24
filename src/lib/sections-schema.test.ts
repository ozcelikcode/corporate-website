import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'astro/zod';
import {
  applicationSectionsSchema,
  DURATION_PATTERN,
  LABEL_MAX,
  SECTION_TYPES,
  type SectionType,
  sectionSchemas,
  sectionsSchema,
} from './sections-schema.ts';

// The real `image()` helper needs the Astro content runtime; a string stands in for it.
const context = { image: () => z.string() } as never;
const schema = sectionsSchema(context);
const action = { label: 'Go', href: '/quote/' };
/** Block values as Keystatic stores them (`{discriminant, value}`), without the discriminant. */
const values: Record<SectionType, Record<string, unknown>> = {
  hero: {
    label: 'Intro',
    headline: 'One',
    headlineAccent: 'Two',
    lede: 'Lede',
    actions: [action],
    image: 'x.png',
    imageAlt: 'Alt',
  },
  statement: { label: 'Mission', text: 'Text' },
  'app-grid': { label: 'Apps', heading: 'Apps' },
  'feature-list': { label: 'Why', heading: 'Why', items: [{ title: 'T', body: 'B' }] },
  'rich-text': { body: '# Hi' },
  cta: { heading: 'Talk', action },
  faq: { label: 'FAQ', items: [{ q: 'Q', a: 'A' }] },
};
/** A stored block of `type`, its value overridden by `changes`. */
const block = (type: SectionType, changes: Record<string, unknown> = {}) => ({
  discriminant: type,
  value: { ...values[type], ...changes },
});
/** A stored block of `type` without the value key `omitted`. */
const blockWithout = (type: SectionType, omitted: string) => ({
  discriminant: type,
  value: Object.fromEntries(Object.entries(values[type]).filter(([key]) => key !== omitted)),
});
const parse = (section: unknown) => schema.safeParse([section]);

test('accepts all seven section types and returns them flat', () => {
  const parsed = schema.parse(SECTION_TYPES.map((type) => block(type)));
  assert.deepEqual(
    parsed.map((s) => s.type),
    [...SECTION_TYPES],
  );
  assert.deepEqual(parsed[SECTION_TYPES.indexOf('cta')], { type: 'cta', heading: 'Talk', action });
});

test('the old flat shape is rejected', () => {
  for (const type of SECTION_TYPES) {
    assert.equal(parse({ type, ...values[type] }).success, false, type);
  }
});

test('a stored block with extra keys, a type inside its value or no value object is rejected', () => {
  for (const stored of [
    { ...block('statement'), type: 'statement' },
    block('statement', { type: 'statement' }),
    { discriminant: 'statement', value: null },
    { discriminant: 'statement' },
  ]) {
    assert.equal(parse(stored).success, false, JSON.stringify(stored));
  }
});

const issuePaths = (sections: unknown[]) => {
  const result = schema.safeParse(sections);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
};

test('field errors name the stored YAML path (sections.<n>.value.<field>)', () => {
  assert.deepEqual(issuePaths([block('statement'), block('cta', { heading: 1 })]), [
    [1, 'value', 'heading'],
  ]);
  assert.deepEqual(
    issuePaths([block('feature-list', { items: [{ title: 'T', body: 'B', duration: 'x' }] })]),
    [[0, 'value', 'items', 0, 'duration']],
  );
  assert.deepEqual(issuePaths([{ discriminant: 'video', value: {} }]), [[0, 'discriminant']]);
  assert.deepEqual(issuePaths([block('faq', { items: [{ q: 'Q', a: '{% x %}' }] })]), [
    [0, 'value', 'items', 0, 'a'],
  ]);
});

test('section schemas cover every section type and only those', () => {
  assert.deepEqual(Object.keys(sectionSchemas(context)), [...SECTION_TYPES]);
});

test('rejects an unknown type', () => {
  assert.equal(parse({ discriminant: 'video', value: {} }).success, false);
});

test('rejects three hero actions', () => {
  assert.equal(parse(block('hero', { actions: [action, action, action] })).success, false);
});

test('rejects javascript: and http: hrefs', () => {
  for (const href of ['javascript:alert(1)', 'http://example.com']) {
    assert.equal(parse(block('hero', { actions: [{ label: 'Go', href }] })).success, false, href);
  }
});

test('rejects a label over the maximum length', () => {
  assert.equal(parse(block('statement', { label: 'x'.repeat(LABEL_MAX + 1) })).success, false);
  assert.equal(parse(block('statement', { label: 'x'.repeat(LABEL_MAX) })).success, true);
});

test('app-grid apps defaults to an empty list', () => {
  const [section] = schema.parse([block('app-grid')]);
  assert.deepEqual(section?.type === 'app-grid' ? section.apps : undefined, []);
});

test('null hero actions and null app-grid apps (cleared in the CMS) parse as empty lists', () => {
  const [hero, grid] = schema.parse([
    block('hero', { actions: null }),
    block('app-grid', { apps: null }),
  ]);
  assert.deepEqual(hero?.type === 'hero' ? hero.actions : undefined, []);
  assert.deepEqual(grid?.type === 'app-grid' ? grid.apps : undefined, []);
});

test('blank optionals in a stored block parse as absent', () => {
  const [missingText, emptyText] = schema.parse([
    blockWithout('cta', 'text'),
    block('cta', { text: '' }),
  ]);
  assert.equal(missingText?.type === 'cta' ? missingText.text : 'x', undefined);
  assert.equal(emptyText?.type === 'cta' ? emptyText.text : 'x', undefined);

  const [features] = schema.parse([block('feature-list', { items: [{ title: 'T', body: 'B' }] })]);
  assert.equal(features?.type === 'feature-list' ? features.items[0]?.duration : 'x', undefined);

  for (const hero of [blockWithout('hero', 'actions'), block('hero', { actions: [] })]) {
    const [section] = schema.parse([hero]);
    assert.deepEqual(section?.type === 'hero' ? section.actions : undefined, []);
  }
  const [nullActions] = schema.parse([block('hero', { actions: null })]);
  assert.deepEqual(nullActions?.type === 'hero' ? nullActions.actions : undefined, []);
});

test('feature-list rejects 0 and 9 items', () => {
  const item = { title: 'T', body: 'B' };
  const items = (length: number) => Array.from({ length }, () => item);
  assert.equal(parse(block('feature-list', { items: [] })).success, false);
  assert.equal(parse(block('feature-list', { items: items(9) })).success, false);
  assert.equal(parse(block('feature-list', { items: items(8) })).success, true);
});

test('rejects protocol-relative hrefs and accepts site-relative ones', () => {
  const withHref = (href: string) => parse(block('hero', { actions: [{ label: 'Go', href }] }));
  assert.equal(withHref('//evil.com').success, false);
  assert.equal(withHref('/\\evil.com').success, false);
  assert.equal(withHref('/about/').success, true);
});

test('rejects an unknown key on a section', () => {
  assert.equal(parse(block('statement', { extra: 'typo' })).success, false);
});

test('feature-list item duration is optional HH:MM:SS display timecode', () => {
  const withDuration = (duration: unknown) =>
    parse(block('feature-list', { items: [{ title: 'T', body: 'B', duration }] })).success;
  assert.equal(parse(block('feature-list')).success, true);
  for (const ok of ['00:00:30', '01:59:59', '99:00:00']) assert.equal(withDuration(ok), true, ok);
  for (const bad of ['0:30', '00:30', '00:60:00', '00:00:60', '00:00:30:00', 'x'])
    assert.equal(withDuration(bad), false, bad);
});

test('a blank duration (cleared in the CMS) parses as no duration', () => {
  for (const blank of ['', '  ', null]) {
    const items = [{ title: 'T', body: 'B', duration: blank }];
    const result = parse(block('feature-list', { items }));
    assert.equal(result.success, true, String(blank));
    const [section] = result.success ? result.data : [];
    assert.equal(section?.type === 'feature-list' ? section.items[0]?.duration : 'x', undefined);
  }
});

test('a blank cta text (cleared in the CMS) parses as no text', () => {
  for (const blank of ['', ' ', null]) {
    const result = parse(block('cta', { text: blank }));
    assert.equal(result.success, true, String(blank));
    const [section] = result.success ? result.data : [];
    assert.equal(section?.type === 'cta' ? section.text : 'x', undefined);
  }
});

test('DURATION_PATTERN is anchored', () => {
  assert.equal(DURATION_PATTERN.test(' 00:00:30'), false);
  assert.equal(DURATION_PATTERN.test('00:00:30 '), false);
});

const issueMessages = (sections: unknown[]) => {
  const result = schema.safeParse(sections);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

test('Markdoc tag syntax in rich-text body or faq answer fails, naming the section', () => {
  assert.deepEqual(
    issueMessages([block('statement'), block('rich-text', { body: 'Hi {% x %}' })]),
    ['Markdoc tag syntax "{%" is not allowed (section 2)'],
  );
  assert.deepEqual(issueMessages([block('faq', { items: [{ q: 'Q', a: 'A {% /x %}' }] })]), [
    'Markdoc tag syntax "{%" is not allowed (section 1)',
  ]);
  assert.deepEqual(issueMessages([block('rich-text', { body: 'Braces { and % alone pass' })]), []);
});

test('accepts a page without a hero and a page whose hero comes first', () => {
  assert.deepEqual(issueMessages([block('statement')]), []);
  assert.deepEqual(issueMessages([block('hero'), block('statement')]), []);
});

test('rejects a hero that is not the first section', () => {
  assert.deepEqual(issueMessages([block('statement'), block('hero')]), [
    'A hero section must be the first section (found at position 2)',
  ]);
});

test('rejects a second hero', () => {
  assert.deepEqual(issueMessages([block('hero'), block('statement'), block('hero')]), [
    'Only one hero section is allowed (another one at position 3)',
  ]);
});

test('application sections reject a hero (the application page owns the h1)', () => {
  const applicationSchema = applicationSectionsSchema(context);
  const result = applicationSchema.safeParse([block('hero')]);
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error?.issues.map((issue) => issue.message),
    [
      'An application page cannot have a hero section (found at position 1): the page header holds the h1',
    ],
  );
  assert.equal(applicationSchema.safeParse([block('statement')]).success, true);
});
