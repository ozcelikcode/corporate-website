import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField, fontProviders } from 'astro/config';
import { resolveBuildMode } from './src/lib/build-mode.ts';

// unicode-range values copied from Fontsource 5.3.0 CSS (@fontsource-variable/*), per subset.
const UNICODE_RANGE_LATIN: [string, ...string[]] = [
  'U+0000-00FF',
  'U+0131',
  'U+0152-0153',
  'U+02BB-02BC',
  'U+02C6',
  'U+02DA',
  'U+02DC',
  'U+0304',
  'U+0308',
  'U+0329',
  'U+2000-206F',
  'U+20AC',
  'U+2122',
  'U+2191',
  'U+2193',
  'U+2212',
  'U+2215',
  'U+FEFF',
  'U+FFFD',
];
const UNICODE_RANGE_LATIN_EXT: [string, ...string[]] = [
  'U+0100-02BA',
  'U+02BD-02C5',
  'U+02C7-02CC',
  'U+02CE-02D7',
  'U+02DD-02FF',
  'U+0304',
  'U+0308',
  'U+0329',
  'U+1D00-1DBF',
  'U+1E00-1E9F',
  'U+1EF2-1EFF',
  'U+2020',
  'U+20A0-20AB',
  'U+20AD-20C0',
  'U+2113',
  'U+2C60-2C7F',
  'U+A720-A7FF',
];
const GROTESK_DIR = './src/assets/fonts/schibsted-grotesk';
const GROTESK_WEIGHT = '400 900';
const MARTIAN_DIR = './src/assets/fonts/martian-mono';
const MARTIAN_WEIGHT = '100 800';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  site: resolveBuildMode(process.env).siteUrl,
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Schibsted Grotesk',
      cssVariable: '--font-grotesk',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            src: [`${GROTESK_DIR}/latin-wght-normal.woff2`],
            weight: GROTESK_WEIGHT,
            style: 'normal',
            unicodeRange: UNICODE_RANGE_LATIN,
          },
          {
            src: [`${GROTESK_DIR}/latin-ext-wght-normal.woff2`],
            weight: GROTESK_WEIGHT,
            style: 'normal',
            unicodeRange: UNICODE_RANGE_LATIN_EXT,
          },
          {
            src: [`${GROTESK_DIR}/latin-wght-italic.woff2`],
            weight: GROTESK_WEIGHT,
            style: 'italic',
            unicodeRange: UNICODE_RANGE_LATIN,
          },
          {
            src: [`${GROTESK_DIR}/latin-ext-wght-italic.woff2`],
            weight: GROTESK_WEIGHT,
            style: 'italic',
            unicodeRange: UNICODE_RANGE_LATIN_EXT,
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Martian Mono',
      cssVariable: '--font-martian',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          {
            src: [`${MARTIAN_DIR}/latin-wght-normal.woff2`],
            weight: MARTIAN_WEIGHT,
            style: 'normal',
            unicodeRange: UNICODE_RANGE_LATIN,
          },
          {
            src: [`${MARTIAN_DIR}/latin-ext-wght-normal.woff2`],
            weight: MARTIAN_WEIGHT,
            style: 'normal',
            unicodeRange: UNICODE_RANGE_LATIN_EXT,
          },
        ],
      },
    },
  ],
  env: {
    schema: {
      WORKERS_CI_BRANCH: envField.string({ context: 'server', access: 'public', optional: true }),
      SITE_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
  vite: { plugins: [tailwindcss()] },
});
