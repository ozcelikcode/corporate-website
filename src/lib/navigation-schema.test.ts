import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NAV_CHILDREN_MAX, NAV_HEADER_MAX, navigationSchema } from './navigation-schema.ts';

const child = { label: 'About', href: '/about/', description: 'Who we are' };
const action = { label: 'Quote', href: '/quote/' };
const item = (extra: Record<string, unknown>) => ({
  header: [{ label: 'Company', children: [child], ...extra }],
});
const safe = (input: unknown) => navigationSchema.safeParse(input);
const parse = (input: unknown) => navigationSchema.parse(input).header[0];
const issues = (input: unknown) => {
  const result = safe(input);
  return result.success ? '' : result.error.issues.map((issue) => issue.message).join('\n');
};

test('a plain link parses with no children', () => {
  const entry = parse({ header: [{ label: 'Contact', href: '/contact/' }] });
  assert.deepEqual(entry?.children, []);
  assert.equal(entry?.source, undefined);
});

test('children and source together fail, naming the item', () =>
  assert.match(
    issues({
      header: [{ label: 'Apps', href: '/a/', source: 'applications', children: [child] }],
    }),
    /Navigation item "Apps"/,
  ));

test(`more than ${NAV_CHILDREN_MAX} children fail`, () => {
  const children = Array.from({ length: NAV_CHILDREN_MAX + 1 }, () => child);
  assert.match(issues(item({ children })), /^Navigation item "Company"/);
  assert.equal(safe(item({ children: children.slice(1) })).success, true);
});

test(`more than ${NAV_HEADER_MAX} header items fail, naming the extra item`, () => {
  const header = Array.from({ length: NAV_HEADER_MAX + 1 }, (_, index) => ({
    label: `Item ${index + 1}`,
    href: `/item-${index + 1}/`,
  }));
  assert.match(issues({ header }), new RegExp(`^Navigation item "Item ${NAV_HEADER_MAX + 1}"`));
  assert.equal(safe({ header: header.slice(1) }).success, true);
});

test('an item without href needs a submenu', () => {
  assert.match(issues({ header: [{ label: 'Company' }] }), /Navigation item "Company"/);
  assert.equal(safe({ header: [{ label: 'Apps', source: 'applications' }] }).success, true);
});

test('a feature needs a submenu', () => {
  const feature = { heading: 'H', text: 'T', action };
  assert.match(
    issues({ header: [{ label: 'Plain', href: '/p/', feature }] }),
    /Navigation item "Plain"/,
  );
  assert.deepEqual(parse(item({ feature }))?.feature, feature);
});

test('an empty or all-blank feature parses as absent; a half-filled one fails', () => {
  assert.equal(parse(item({ feature: {} }))?.feature, undefined);
  assert.equal(
    parse(item({ feature: { heading: '', text: ' ', action: {} } }))?.feature,
    undefined,
  );
  assert.equal(safe(item({ feature: { heading: 'H', text: '', action } })).success, false);
});

test('blank source and null children parse as absent and []', () => {
  const entry = parse({ header: [{ label: 'C', href: '/c/', source: '', children: null }] });
  assert.equal(entry?.source, undefined);
  assert.deepEqual(entry?.children, []);
});

test('footer: missing or null parses as [], a bad link still fails', () => {
  const header = [{ label: 'About', href: '/about/' }];
  assert.deepEqual(navigationSchema.parse({ header }).footer, []);
  assert.deepEqual(navigationSchema.parse({ header, footer: null }).footer, []);
  assert.equal(safe({ header, footer: [{ label: 'X', href: 'x' }] }).success, false);
});
