/**
 * Mounts the Keystatic admin on `/keystatic/` (client only, the page's single module). Plain
 * `createElement`, no JSX: the strictest tsconfig preserves JSX and React is not an Astro
 * integration here. It lives outside `src/pages`, where a `.ts` file would become an endpoint.
 */
import { PUBLIC_KEYSTATIC_GITHUB_APP_SLUG } from 'astro:env/client';
import { Keystatic } from '@keystatic/core/ui';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import config from '../../keystatic.config.ts';

/** The element `src/pages/keystatic/index.astro` renders for the admin. */
const KEYSTATIC_ROOT_ID = 'keystatic-root';

const root = document.getElementById(KEYSTATIC_ROOT_ID);
if (root === null) throw new Error(`Keystatic mount point #${KEYSTATIC_ROOT_ID} is missing`);

createRoot(root).render(
  createElement(Keystatic, {
    config,
    appSlug: {
      envName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG',
      value: PUBLIC_KEYSTATIC_GITHUB_APP_SLUG,
    },
  }),
);
