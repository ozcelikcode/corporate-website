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
import { ENTRY_UPLOADS_PUBLIC_PATH, UPLOADS_DIRECTORY } from './paths.ts';
import {
  action,
  applicationSections,
  type ImageLocation,
  pageSections,
  RASTER_HINT,
  SECTION_LIMITS,
} from './sections.ts';

/** Mirror `DESCRIPTION_MAX` and `TAGLINE_MAX` of `lib/content-schemas.ts` (pinned by parity). */
export const DESCRIPTION_LIMIT = 160;
export const TAGLINE_LIMIT = 120;

type CollectionName = 'pages' | 'applications';

const required = { isRequired: true } as const;

function imageLocation(name: CollectionName, locale: Locale): ImageLocation {
  return {
    directory: `${UPLOADS_DIRECTORY}/${name}/${locale}`,
    publicPath: `${ENTRY_UPLOADS_PUBLIC_PATH}/${name}/${locale}/`,
  };
}

/** Mirrors the https-only rule of `brochure` in `lib/content-schemas.ts`; empty means none. */
export const OPTIONAL_HTTPS_REGEX = /^$|^https:\/\/\S+$/;
const ADDRESS_HINT = 'The address. Changing it moves the entry and its images.';
/** A Turkish entry translates the English entry with the same address. */
const addressHint = (locale: Locale) =>
  locale === 'en'
    ? ADDRESS_HINT
    : `${ADDRESS_HINT} Use the English entry's address to translate it; without one the English entry is shown.`;

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
        slug: { label: 'Address', description: addressHint(locale) },
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
        slug: { label: 'Address', description: addressHint(locale) },
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
      brochure: fields.text({
        label: 'Brochure',
        description: 'Optional https:// link to the PDF (large files live in R2).',
        validation: {
          pattern: { regex: OPTIONAL_HTTPS_REGEX, message: 'Use an https:// address' },
        },
      }),
      sections: applicationSections(imageLocation('applications', locale)),
    },
  });

export const collections = {
  pagesEn: pages('en'),
  pagesTr: pages('tr'),
  applicationsEn: applications('en'),
  applicationsTr: applications('tr'),
};
