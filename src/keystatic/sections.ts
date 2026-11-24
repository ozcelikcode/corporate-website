/**
 * Keystatic section blocks (`fields.blocks`, stored as `{ discriminant, value }`), one per section
 * type, with the field names and limits of `lib/sections-schema.ts`. That module is not imported:
 * it would pull Zod into the admin bundle, so its limits are mirrored here and pinned by
 * `parity.test.ts`. Zod stays the build authority (it also turns the stored shape back into flat
 * sections).
 */
import { fields } from '@keystatic/core';
import { LINK_HINT } from './link-hints.ts';

/**
 * Mirrors `LABEL_MAX`, `MAX_ACTIONS`, `MAX_ITEMS`, `STATS_MIN/MAX` and `LOGOS_MIN/MAX` of
 * `lib/sections-schema.ts`.
 */
export const SECTION_LIMITS = {
  label: 32,
  actions: 2,
  items: 8,
  stats: { min: 3, max: 4 },
  logos: { min: 4, max: 12 },
} as const;
/** Mirrors `ACTION_HREF_PATTERN`. */
export const HREF_REGEX = /^(\/(?![/\\])|https:\/\/)/;
/** Keystatic checks a pattern on empty text too: an optional link also takes `''`. */
export const OPTIONAL_HREF_REGEX = new RegExp(`^$|${HREF_REGEX.source}`);
/** Mirrors `HTTPS_HREF_PATTERN` (outbound logo links). */
export const HTTPS_HREF_REGEX = /^https:\/\/\S+$/;
const OPTIONAL_HTTPS_HREF_REGEX = new RegExp(`^$|${HTTPS_HREF_REGEX.source}`);
export const RASTER_HINT = 'PNG, JPEG or WebP.';
/** Mirrors `DURATION_PATTERN`. */
export const DURATION_REGEX = /^\d{2}:[0-5]\d:[0-5]\d$/;
/** Keystatic checks a pattern on empty text too, so the optional duration also takes `''`. */
const OPTIONAL_DURATION_REGEX = new RegExp(`^$|${DURATION_REGEX.source}`);
const SECTIONS_LABEL = 'Sections';

/** Where a collection's images go (`directory`) and how its YAML refers to them (`publicPath`). */
export type ImageLocation = { directory: string; publicPath: string };

const required = { isRequired: true } as const;

const label = () =>
  fields.text({
    label: 'Label',
    description: 'Short tally label above the section.',
    validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
  });

const requiredText = (fieldLabel: string, multiline = false) =>
  fields.text({ label: fieldLabel, multiline, validation: required });

/** Markdown with headings, lists, links and inline marks; stored as a string in the YAML. */
const markdown = (fieldLabel: string) =>
  fields.markdoc.inline({
    label: fieldLabel,
    description: 'Never type "{%": it would lock the entry, so the build refuses it.',
    options: { table: false, image: false, codeBlock: false, divider: false },
  });

/** A link button (`actionSchema`): label and a site path or https address. */
export const action = () =>
  fields.object(
    {
      label: fields.text({
        label: 'Label',
        validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
      }),
      href: fields.text({
        label: 'Link',
        description: LINK_HINT,
        validation: {
          isRequired: true,
          pattern: { regex: HREF_REGEX, message: 'Use a site path (/…) or an https:// address' },
        },
      }),
    },
    { label: 'Action' },
  );

const hero = (images: ImageLocation) => ({
  label: 'Hero',
  schema: fields.object({
    label: label(),
    headline: requiredText('Headline'),
    headlineAccent: requiredText('Headline accent (second line)'),
    lede: requiredText('Lede', true),
    actions: fields.array(action(), {
      label: 'Actions',
      itemLabel: (props) => props.fields.label.value,
      validation: { length: { max: SECTION_LIMITS.actions } },
    }),
    image: fields.image({
      label: 'Image (PNG, JPEG or WebP)',
      description: 'Rendered as the ASCII signal picture.',
      ...images,
      validation: required,
    }),
    imageAlt: requiredText('Image alt text'),
  }),
});

/** An image field stored in the entry's own uploads folder; rasters only (the build checks). */
const rasterImage = (images: ImageLocation, fieldLabel: string, isRequired: boolean) =>
  fields.image({
    label: fieldLabel,
    description: RASTER_HINT,
    ...images,
    validation: { isRequired },
  });

/** An optional button: leave both fields empty for none (stored as `{}`, read as absent). */
const optionalAction = () =>
  fields.object(
    {
      label: fields.text({
        label: 'Button label',
        validation: { length: { max: SECTION_LIMITS.label } },
      }),
      href: fields.text({
        label: 'Button link',
        description: LINK_HINT,
        validation: {
          pattern: {
            regex: OPTIONAL_HREF_REGEX,
            message: 'Use a site path (/…) or an https:// address',
          },
        },
      }),
    },
    { label: 'Button', description: 'Optional; leave both fields empty for none.' },
  );

/** The four richer blocks; each may store images in the entry's uploads folder. */
const richBlocks = (images: ImageLocation) => ({
  stats: {
    label: 'Stats',
    schema: fields.object({
      label: label(),
      items: fields.array(
        fields.object({
          value: requiredText('Value'),
          label: fields.text({
            label: 'Label',
            validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
          }),
          note: fields.text({ label: 'Note', description: 'Optional, one short line.' }),
        }),
        {
          label: 'Figures',
          itemLabel: (props) => props.fields.value.value,
          validation: { length: SECTION_LIMITS.stats },
        },
      ),
    }),
  },
  logos: {
    label: 'Logos',
    schema: fields.object({
      label: label(),
      heading: requiredText('Heading'),
      items: fields.array(
        fields.object({
          image: rasterImage(images, 'Logo', true),
          alt: fields.text({
            label: 'Name (alt text)',
            description: 'Names the organization; screen readers read it.',
            validation: { isRequired: true, length: { min: 1 } },
          }),
          href: fields.text({
            label: 'Link',
            description: 'Optional https:// address of their site.',
            validation: {
              pattern: { regex: OPTIONAL_HTTPS_HREF_REGEX, message: 'Use an https:// address' },
            },
          }),
        }),
        {
          label: 'Logos',
          itemLabel: (props) => props.fields.alt.value,
          validation: { length: SECTION_LIMITS.logos },
        },
      ),
    }),
  },
  testimonial: {
    label: 'Testimonial',
    schema: fields.object({
      quote: requiredText('Quote', true),
      name: requiredText('Name'),
      role: requiredText('Role'),
      organization: requiredText('Organization'),
      portrait: rasterImage(images, 'Portrait (optional)', false),
    }),
  },
  'media-split': {
    label: 'Media and text',
    schema: fields.object({
      label: label(),
      heading: requiredText('Heading'),
      text: markdown('Text'),
      image: rasterImage(images, 'Image', true),
      imageAlt: requiredText('Image alt text'),
      action: optionalAction(),
      reverse: fields.checkbox({
        label: 'Image first',
        description: 'Puts the image before the text; alternate it on consecutive splits.',
      }),
    }),
  },
});

/** Every block but the hero. */
const contentBlocks = (images: ImageLocation) => ({
  statement: {
    label: 'Statement',
    schema: fields.object({ label: label(), text: requiredText('Text', true) }),
  },
  'app-grid': {
    label: 'Application grid',
    schema: fields.object({
      label: label(),
      heading: requiredText('Heading'),
      apps: fields.array(
        fields.relationship({
          label: 'Application',
          collection: 'applicationsEn',
          validation: required,
        }),
        {
          label: 'Applications',
          description: 'Leave empty to show every application, by order.',
          itemLabel: (props) => props.value ?? '',
        },
      ),
    }),
  },
  'feature-list': {
    label: 'Feature list',
    schema: fields.object({
      label: label(),
      heading: requiredText('Heading'),
      items: fields.array(
        fields.object({
          title: requiredText('Title'),
          body: requiredText('Body', true),
          duration: fields.text({
            label: 'Duration (HH:MM:SS)',
            description: 'Optional rundown timecode, display only.',
            validation: {
              pattern: { regex: OPTIONAL_DURATION_REGEX, message: 'Use HH:MM:SS, e.g. 00:01:30' },
            },
          }),
        }),
        {
          label: 'Items',
          itemLabel: (props) => props.fields.title.value,
          validation: { length: { min: 1, max: SECTION_LIMITS.items } },
        },
      ),
    }),
  },
  'rich-text': {
    label: 'Rich text',
    schema: fields.object({ body: markdown('Body') }),
  },
  cta: {
    label: 'Call to action',
    schema: fields.object({
      heading: requiredText('Heading'),
      text: fields.text({ label: 'Text', multiline: true }),
      action: action(),
    }),
  },
  faq: {
    label: 'Questions',
    schema: fields.object({
      label: label(),
      items: fields.array(fields.object({ q: requiredText('Question'), a: markdown('Answer') }), {
        label: 'Questions',
        itemLabel: (props) => props.fields.q.value,
        validation: { length: { min: 1 } },
      }),
    }),
  },
  ...richBlocks(images),
});

/** Page sections: every block type; a hero must come first (the build checks it). */
export const pageSections = (images: ImageLocation) =>
  fields.blocks(
    { hero: hero(images), ...contentBlocks(images) },
    { label: SECTIONS_LABEL, description: 'At most one hero, and only as the first section.' },
  );

/** Application sections: no hero, since the application header holds the h1 (the build checks it). */
export const applicationSections = (images: ImageLocation) =>
  fields.blocks(contentBlocks(images), { label: SECTIONS_LABEL });
