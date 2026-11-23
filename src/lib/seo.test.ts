import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  absoluteUrl,
  formatTitle,
  hreflangLinks,
  type OrganizationInput,
  organizationJsonLd,
  TITLE_SEPARATOR,
} from './seo.ts';

const SITE = 'https://example.com';

const org: OrganizationInput = {
  name: 'Brand',
  legalName: 'Brand Ltd.',
  url: 'https://example.com',
  logoUrl: 'https://example.com/_astro/logo.svg',
  sameAs: ['https://www.linkedin.com/company/example'],
  email: 'hello@example.com',
};

test('formatTitle joins page and brand with the separator', () => {
  assert.equal(TITLE_SEPARATOR, ' · ');
  assert.equal(formatTitle('About', 'Brand'), 'About · Brand');
});

test('absoluteUrl resolves a path against the site, with or without a URL object', () => {
  assert.equal(absoluteUrl('/about/', SITE), 'https://example.com/about/');
  assert.equal(
    absoluteUrl('/_astro/og.png', new URL('http://localhost:4321/')),
    'http://localhost:4321/_astro/og.png',
  );
});

test('hreflangLinks lists each available locale plus an EN x-default', () => {
  assert.deepEqual(hreflangLinks('/about/', ['en'], SITE), [
    { hreflang: 'en', href: 'https://example.com/about/' },
    { hreflang: 'x-default', href: 'https://example.com/about/' },
  ]);
  assert.deepEqual(
    hreflangLinks('/', ['en', 'tr'], SITE).map((a) => a.href),
    ['https://example.com/', 'https://example.com/tr/', 'https://example.com/'],
  );
});

test('hreflangLinks keeps locale order stable regardless of input order', () => {
  assert.deepEqual(
    hreflangLinks('/', ['tr', 'en'], SITE).map((a) => a.hreflang),
    ['en', 'tr', 'x-default'],
  );
});

test('organizationJsonLd escapes every < and round-trips the data', () => {
  const out = organizationJsonLd({ ...org, legalName: 'A</script><script>x' });
  assert.ok(!out.includes('<'));
  assert.ok(out.includes('\\u003c'));
  const parsed = JSON.parse(out);
  assert.equal(parsed.legalName, 'A</script><script>x');
  assert.equal(parsed['@type'], 'Organization');
  assert.equal(parsed['@context'], 'https://schema.org');
  assert.equal(parsed.logo, org.logoUrl);
  assert.deepEqual(parsed.sameAs, org.sameAs);
});

test('organizationJsonLd omits absent optional fields', () => {
  const parsed = JSON.parse(organizationJsonLd({ ...org, email: undefined }));
  assert.equal('email' in parsed, false);
  assert.equal('telephone' in parsed, false);
  assert.equal('address' in parsed, false);
});
