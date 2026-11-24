import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routeFor } from './route.ts';

test('routeFor sends each path to its handler', () => {
  const cases: [string, ReturnType<typeof routeFor>][] = [
    ['/api/quote', 'quote'],
    ['/api/keystatic/x', 'keystatic'],
    ['/api/keystatic/github/login', 'keystatic'],
    ['/api/keystaticx', 'assets'],
    ['/api/keystatic', 'assets'],
    ['/keystatic', 'assets'],
    ['/keystatic/', 'keystatic'],
    ['/keystatic/branch/main/', 'keystatic'],
    ['/keystaticx/', 'assets'],
    ['/api/other', 'assets'],
    ['/api/quote/', 'assets'],
    ['/', 'assets'],
  ];
  for (const [pathname, expected] of cases) assert.equal(routeFor(pathname), expected, pathname);
});
