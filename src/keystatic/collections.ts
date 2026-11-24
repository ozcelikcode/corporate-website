/**
 * Keystatic collections: pages and applications, one collection per locale, stored as YAML at
 * `src/content/<collection>/<locale>/<slug>.yaml`. Keystatic refuses to open a file with a key it
 * does not model, so the fields mirror `lib/content-schemas.ts` key for key (`parity.test.ts`).
 *
 * Images: Keystatic writes an entry's upload to `<directory>/<slug>/<field path>.<ext>` (a hero
 * image is `<slug>/sections/0/value/image.png`) and renames it on every save to match. The
 * directory is per collection and locale, so EN and TR entries with one slug never share a file.
 */
import { collection, fields } from '@keystatic/core';
import type { Locale } from '../lib/i18n.ts';
import { LOCALE_NAMES } from './locale-names.ts';
import {
  action,
  applicationSections,
  type ImageLocation,
  pageSections,
  SECTION_LIMITS,
} from './sections.ts';

/** Mirror `DESCRIPTION_MAX` and `TAGLINE_MAX` of `lib/content-schemas.ts` (pinned by parity). */
export const DESCRIPTION_LIMIT = 160;
export const TAGLINE_LIMIT = 120;
const UPLOADS_DIRECTORY = 'src/assets/uploads';
/** The uploads folder as seen from `src/content/<collection>/<locale>/<slug>.yaml`. */
const ENTRY_UPLOADS_PUBLIC_PATH = '../../../assets/uploads';
const RASTER_HINT = 'PNG, JPEG or WebP.';

type CollectionName = 'pages' | 'applications';

const required = { isRequired: true } as const;

function imageLocation(name: CollectionName, locale: Locale): ImageLocation {
  return {
    directory: `${UPLOADS_DIRECTORY}/${name}/${locale}`,
    publicPath: `${ENTRY_UPLOADS_PUBLIC_PATH}/${name}/${locale}/`,
  };
}

const slugDescription = 'The address. Changing it moves the page and its images.';

const pages = (locale: Locale) => {
  const images = imageLocation('pages', locale);
  return collection({
    label: `Pages (${LOCALE_NAMES[locale]})`,
    path: `src/content/pages/${locale}/*`,
    slugField: 'title',
    format: { data: 'yaml' },
    schema: {
      title: fields.slug({
        name: { label: 'Title', validation: required },
        slug: { label: 'Address', description: slugDescription },
      }),
      description: fields.text({
        label: 'Description',
        description: 'Search and social summary.',
        validation: { isRequired: true, length: { max: DESCRIPTION_LIMIT } },
      }),
      ogImage: fields.image({
        label: 'Social image',
        description: `Optional; the site default is used without one. ${RASTER_HINT}`,
        ...images,
      }),
      sections: pageSections(images),
    },
  });
};

const applications = (locale: Locale) =>
  collection({
    label: `Applications (${LOCALE_NAMES[locale]})`,
    path: `src/content/applications/${locale}/*`,
    slugField: 'name',
    format: { data: 'yaml' },
    schema: {
      name: fields.slug({
        name: { label: 'Name', validation: required },
        slug: { label: 'Address', description: slugDescription },
      }),
      slug: fields.text({
        label: 'Slug',
        description: 'Repeat the address exactly; the build checks that both match.',
        validation: required,
      }),
      tagline: fields.text({
        label: 'Tagline',
        validation: { isRequired: true, length: { max: TAGLINE_LIMIT } },
      }),
      summary: fields.text({ label: 'Summary', multiline: true, validation: required }),
      category: fields.text({ label: 'Category', validation: required }),
      cover: fields.image({
        label: 'Cover image',
        description: RASTER_HINT,
        ...imageLocation('applications', locale),
        validation: required,
      }),
      coverAlt: fields.text({ label: 'Cover alt text', validation: required }),
      status: fields.text({
        label: 'Status',
        validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
      }),
      order: fields.integer({
        label: 'Order',
        description: 'Lists and menus sort by this, lowest first.',
        validation: { isRequired: true, min: 0 },
      }),
      links: fields.array(action(), {
        label: 'Links',
        itemLabel: (props) => props.fields.label.value,
      }),
      brochure: fields.url({ label: 'Brochure', description: 'Optional https:// link.' }),
      sections: applicationSections(),
    },
  });

export const collections = {
  pagesEn: pages('en'),
  pagesTr: pages('tr'),
  applicationsEn: applications('en'),
  applicationsTr: applications('tr'),
};
