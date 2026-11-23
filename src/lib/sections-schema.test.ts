import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'astro/zod';
import {
  applicationSectionsSchema,
  DURATION_PATTERN,
  LABEL_MAX,
  SECTION_TYPES,
  sectionsSchema,
} from './sections-schema.ts';

// The real `image()` helper needs the Astro content runtime; a string stands in for it.
const schema = sectionsSchema({ image: () => z.string() } as never);
const action = { label: 'Go', href: '/quote/' };
const fixtures: Record<(typeof SECTION_TYPES)[number], Record<string, unknown>> = {
  hero: {
    type: 'hero',
    label: 'Intro',
    headline: 'One',
    headlineAccent: 'Two',
    lede: 'Lede',
    actions: [action],
    image: 'x.png',
    imageAlt: 'Alt',
  },
  statement: { type: 'statement', label: 'Mission', text: 'Text' },
  'app-grid': { type: 'app-grid', label: 'Apps', heading: 'Apps' },
  'feature-list': {
    type: 'feature-list',
    label: 'Why',
    heading: 'Why',
    items: [{ title: 'T', body: 'B' }],
  },
  'rich-text': { type: 'rich-text', body: '# Hi' },
  cta: { type: 'cta', heading: 'Talk', action },
  faq: { type: 'faq', label: 'FAQ', items: [{ q: 'Q', a: 'A' }] },
};
const parse = (section: unknown) => schema.safeParse([section]);

test('accepts all seven section types', () => {
  const parsed = schema.parse(SECTION_TYPES.map((type) => fixtures[type]));
  assert.deepEqual(
    parsed.map((s) => s.type),
    [...SECTION_TYPES],
  );
});

test('rejects an unknown type', () => {
  assert.equal(parse({ type: 'video' }).success, false);
});

test('rejects three hero actions', () => {
  assert.equal(parse({ ...fixtures.hero, actions: [action, action, action] }).success, false);
});

test('rejects javascript: and http: hrefs', () => {
  for (const href of ['javascript:alert(1)', 'http://example.com']) {
    assert.equal(
      parse({ ...fixtures.hero, actions: [{ label: 'Go', href }] }).success,
      false,
      href,
    );
  }
});

test('rejects a label over the maximum length', () => {
  assert.equal(parse({ ...fixtures.statement, label: 'x'.repeat(LABEL_MAX + 1) }).success, false);
  assert.equal(parse({ ...fixtures.statement, label: 'x'.repeat(LABEL_MAX) }).success, true);
});

test('app-grid apps defaults to an empty list', () => {
  const [section] = schema.parse([fixtures['app-grid']]);
  assert.deepEqual(section?.type === 'app-grid' ? section.apps : undefined, []);
});

test('hero without an actions key parses to an empty list', () => {
  const { actions: _omitted, ...withoutActions } = fixtures.hero;
  const [section] = schema.parse([withoutActions]);
  assert.deepEqual(section?.type === 'hero' ? section.actions : undefined, []);
});

test('feature-list rejects 0 and 9 items', () => {
  const item = { title: 'T', body: 'B' };
  const list = fixtures['feature-list'];
  assert.equal(parse({ ...list, items: [] }).success, false);
  assert.equal(parse({ ...list, items: Array.from({ length: 9 }, () => item) }).success, false);
  assert.equal(parse({ ...list, items: Array.from({ length: 8 }, () => item) }).success, true);
});

test('rejects protocol-relative hrefs and accepts site-relative ones', () => {
  const withHref = (href: string) => parse({ ...fixtures.hero, actions: [{ label: 'Go', href }] });
  assert.equal(withHref('//evil.com').success, false);
  assert.equal(withHref('/\\evil.com').success, false);
  assert.equal(withHref('/about/').success, true);
});

test('rejects an unknown key on a section', () => {
  assert.equal(parse({ ...fixtures.statement, extra: 'typo' }).success, false);
});

test('feature-list item duration is optional HH:MM:SS display timecode', () => {
  const list = fixtures['feature-list'];
  const withDuration = (duration: unknown) =>
    parse({ ...list, items: [{ title: 'T', body: 'B', duration }] }).success;
  assert.equal(parse(list).success, true);
  for (const ok of ['00:00:30', '01:59:59', '99:00:00']) assert.equal(withDuration(ok), true, ok);
  for (const bad of ['0:30', '00:30', '00:60:00', '00:00:60', '00:00:30:00', 'x', ''])
    assert.equal(withDuration(bad), false, bad);
});

test('DURATION_PATTERN is anchored', () => {
  assert.equal(DURATION_PATTERN.test(' 00:00:30'), false);
  assert.equal(DURATION_PATTERN.test('00:00:30 '), false);
});

const issueMessages = (sections: unknown[]) => {
  const result = schema.safeParse(sections);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

test('accepts a page without a hero and a page whose hero comes first', () => {
  assert.deepEqual(issueMessages([fixtures.statement]), []);
  assert.deepEqual(issueMessages([fixtures.hero, fixtures.statement]), []);
});

test('rejects a hero that is not the first section', () => {
  assert.deepEqual(issueMessages([fixtures.statement, fixtures.hero]), [
    'A hero section must be the first section (found at position 2)',
  ]);
});

test('rejects a second hero', () => {
  assert.deepEqual(issueMessages([fixtures.hero, fixtures.statement, fixtures.hero]), [
    'Only one hero section is allowed (another one at position 3)',
  ]);
});

test('application sections reject a hero (the application page owns the h1)', () => {
  const applicationSchema = applicationSectionsSchema({ image: () => z.string() } as never);
  const result = applicationSchema.safeParse([fixtures.hero]);
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error?.issues.map((issue) => issue.message),
    [
      'An application page cannot have a hero section (found at position 1): the page header holds the h1',
    ],
  );
  assert.equal(applicationSchema.safeParse([fixtures.statement]).success, true);
});
