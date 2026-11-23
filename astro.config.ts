import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { resolveBuildMode } from './src/lib/build-mode.ts';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  site: resolveBuildMode(process.env).siteUrl,
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
