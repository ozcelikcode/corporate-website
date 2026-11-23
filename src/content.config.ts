import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  applicationSchema,
  navigationSchema,
  pageSchema,
  settingsSchema,
  uiSchema,
} from './lib/content-schemas.ts';

// Ids come from the file path (`<locale>/<slug>`), never from a `slug` field: slugs repeat across locales.
const fromYaml = (base: string) =>
  glob({
    pattern: '**/*.yaml',
    base,
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  });

const settings = defineCollection({
  loader: fromYaml('./src/content/settings'),
  schema: settingsSchema,
});

const ui = defineCollection({ loader: fromYaml('./src/content/ui'), schema: uiSchema });

const navigation = defineCollection({
  loader: fromYaml('./src/content/navigation'),
  schema: navigationSchema,
});

const pages = defineCollection({ loader: fromYaml('./src/content/pages'), schema: pageSchema });

const applications = defineCollection({
  loader: fromYaml('./src/content/applications'),
  schema: applicationSchema,
});

export const collections = { settings, ui, navigation, pages, applications };
