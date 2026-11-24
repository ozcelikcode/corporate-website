import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'astro/zod';
import { applicationSchema, pageSchema, settingsSchema, uiSchema } from './content-schemas.ts';
import { NAV_QUOTE_MAX } from './navigation-schema.ts';

// The real `image()` helper needs the Astro content runtime; a string stands in for it.
const context = { image: () => z.string() } as never;
const BLANKS = ['', '   ', null] as const;

const settings = {
  brandName: 'Brand',
  logo: 'logo.svg',
  logoAlt: 'Brand logo',
  accent: '#ffb000',
  contacts: [{ kind: 'email', value: 'hello@example.com', href: 'mailto:hello@example.com' }],
  ogImage: 'og.png',
  organization: { legalName: 'Brand Ltd.', url: 'https://example.com', address: 'Street 1' },
};

const page = { title: 'About', description: 'About us', sections: [] };

const application = {
  name: 'Desk',
  slug: 'desk',
  tagline: 'Tagline',
  summary: 'Summary',
  category: 'Newsroom',
  cover: 'cover.png',
  coverAlt: 'Cover',
  status: 'Stable',
  order: 1,
  links: [{ label: 'Demo', href: '/quote/' }],
  brochure: 'https://example.com/b.pdf',
  sections: [],
};

test('settings: a blank organization address parses as no address', () => {
  const schema = settingsSchema(context);
  assert.equal(schema.parse(settings).organization.address, 'Street 1');
  for (const address of BLANKS) {
    const parsed = schema.parse({
      ...settings,
      organization: { ...settings.organization, address },
    });
    assert.equal(parsed.organization.address, undefined, String(address));
  }
});

test('settings: socials default to an empty list', () => {
  assert.deepEqual(settingsSchema(context).parse(settings).socials, []);
});

test('settings: a null socials list (cleared in the CMS) parses as empty', () => {
  assert.deepEqual(settingsSchema(context).parse({ ...settings, socials: null }).socials, []);
});

test('pages: a blank social image parses as none', () => {
  const schema = pageSchema(context);
  assert.equal(schema.parse({ ...page, ogImage: 'og.png' }).ogImage, 'og.png');
  for (const ogImage of BLANKS) {
    assert.equal(schema.parse({ ...page, ogImage }).ogImage, undefined, String(ogImage));
  }
});

test('applications: a blank brochure or links value parses as absent', () => {
  const schema = applicationSchema(context);
  for (const blank of BLANKS) {
    const parsed = schema.parse({ ...application, brochure: blank, links: blank });
    assert.equal(parsed.brochure, undefined, String(blank));
    assert.equal(parsed.links, undefined, String(blank));
  }
});

test('applications: a brochure that is set must still be an https URL', () => {
  const schema = applicationSchema(context);
  assert.equal(schema.safeParse(application).success, true);
  assert.equal(
    schema.safeParse({ ...application, brochure: 'http://example.com/b.pdf' }).success,
    false,
  );
});

test('ui: blank strings are dropped (EN fallback), unknown keys still fail', () => {
  assert.deepEqual(uiSchema.parse({ menuOpen: 'Menü', menuClose: '', navQuote: '  ' }), {
    menuOpen: 'Menü',
  });
  assert.equal(uiSchema.safeParse({ notAKey: 'x' }).success, false);
});

test('settings: organization.url must be https', () => {
  const schema = settingsSchema(context);
  for (const url of ['javascript:alert(1)', 'http://example.com', 'example.com'])
    assert.throws(
      () => schema.parse({ ...settings, organization: { ...settings.organization, url } }),
      url,
    );
});

test('social and cover images refuse SVG, rasters pass', () => {
  const svgAware = { image: () => z.object({ format: z.string() }) } as never;
  const png = { format: 'png' };
  const svg = { format: 'svg' };
  assert.ok(settingsSchema(svgAware).safeParse({ ...settings, logo: svg, ogImage: png }).success);
  assert.ok(!settingsSchema(svgAware).safeParse({ ...settings, logo: svg, ogImage: svg }).success);
  assert.ok(!pageSchema(svgAware).safeParse({ ...page, ogImage: svg }).success);
  assert.ok(applicationSchema(svgAware).safeParse({ ...application, cover: png }).success);
  assert.ok(!applicationSchema(svgAware).safeParse({ ...application, cover: svg }).success);
});

test('the header quote caption may not outgrow the measured header budget', () => {
  assert.equal(uiSchema.safeParse({ navQuote: 'Request a quote' }).success, true);
  assert.equal(uiSchema.safeParse({ navQuote: 'x'.repeat(NAV_QUOTE_MAX + 1) }).success, false);
  const wide = uiSchema.safeParse({ navQuote: 'WWWWWWWWWW' });
  assert.equal(wide.success, false);
  assert.match(wide.error?.issues[0]?.message ?? '', /navQuote .* too long for the header bar/);
});
