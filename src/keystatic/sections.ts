/**
 * Keystatic section blocks (`fields.blocks`, stored as `{ discriminant, value }`), one per section
 * type, with the field names and limits of `lib/sections-schema.ts`. That module is not imported:
 * it would pull Zod into the admin bundle, so its limits are mirrored here and pinned by
 * `parity.test.ts`. Zod stays the build authority (it also turns the stored shape back into flat
 * sections).
 */
import { fields } from '@keystatic/core';
import { ALL_OR_NONE_HINT, LINK_HINT, linkPattern } from './link-hints.ts';

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
export const RASTER_HINT = 'PNG, JPEG or WebP.';
/** Mirrors `DURATION_PATTERN`. */
export const DURATION_REGEX = /^\d{2}:[0-5]\d:[0-5]\d$/;
/** Keystatic checks a pattern on empty text too, so the optional duration also takes `''`. */
const OPTIONAL_DURATION_REGEX = new RegExp(`^$|${DURATION_REGEX.source}`);
const SECTIONS_LABEL = 'Sections';

/** Where a collection's images go (`directory`) and how its YAML refers to them (`publicPath`). */
export type ImageLocation = { directory: string; publicPath: string };

const required = { isRequired: true } as const;

/**
 * Mirrors `SECTION_BACKGROUNDS`, `SECTION_SPACINGS`, `APP_GRID_COLUMNS` and `STATS_ALIGNS` (option
 * values in order, the first one the default except where `LAYOUT_DEFAULTS` says otherwise).
 */
export const LAYOUT_OPTIONS = {
  background: [
    { label: 'Default', value: 'default' },
    { label: 'Subtle', value: 'subtle' },
    { label: 'Contrast', value: 'contrast' },
  ],
  spacing: [
    { label: 'Compact', value: 'compact' },
    { label: 'Regular', value: 'regular' },
    { label: 'Spacious', value: 'spacious' },
  ],
  columns: [
    { label: 'Two', value: '2' },
    { label: 'Three', value: '3' },
  ],
  align: [
    { label: 'Start', value: 'start' },
    { label: 'Centre', value: 'center' },
  ],
} as const;
/** The values a block renders with when the field is left out (mirrors the Zod defaults). */
export const LAYOUT_DEFAULTS = {
  background: 'default',
  spacing: 'regular',
  columns: '3',
  align: 'start',
} as const;

/** The shared band layout of every block but the hero (`layoutSchema`). */
const layout = () =>
  fields.object(
    {
      background: fields.select({
        label: 'Background',
        description: 'Subtle tints the band; Contrast inverts it (light band, dark text).',
        options: LAYOUT_OPTIONS.background,
        defaultValue: LAYOUT_DEFAULTS.background,
      }),
      spacing: fields.select({
        label: 'Spacing',
        description: 'Space above and below the section. Regular matches the rest of the page.',
        options: LAYOUT_OPTIONS.spacing,
        defaultValue: LAYOUT_DEFAULTS.spacing,
      }),
    },
    {
      label: 'Layout',
      description: 'Optional. The defaults render the section like every other band.',
    },
  );

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
        validation: { isRequired: true, pattern: linkPattern('action') },
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

/** An optional button: both fields or none (stored as `{}`, read as absent). */
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
        validation: { pattern: linkPattern('action', true) },
      }),
    },
    {
      label: 'Button',
      description: `Optional. ${ALL_OR_NONE_HINT} Button label and button link go together.`,
    },
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
      align: fields.select({
        label: 'Alignment',
        description: 'Where each figure sits in its column: Start (left) or Centre.',
        options: LAYOUT_OPTIONS.align,
        defaultValue: LAYOUT_DEFAULTS.align,
      }),
      layout: layout(),
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
            description:
              'Names the organization; screen readers read it. Spaces alone are refused at build.',
            validation: { isRequired: true, length: { min: 1 } },
          }),
          href: fields.text({
            label: 'Link',
            description: 'Optional https:// address of their site.',
            validation: { pattern: linkPattern('https', true) },
          }),
        }),
        {
          label: 'Logos',
          itemLabel: (props) => props.fields.alt.value,
          validation: { length: SECTION_LIMITS.logos },
        },
      ),
      layout: layout(),
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
      layout: layout(),
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
      layout: layout(),
    }),
  },
});

/** Every block but the hero. */
const contentBlocks = (images: ImageLocation) => ({
  statement: {
    label: 'Statement',
    schema: fields.object({ label: label(), text: requiredText('Text', true), layout: layout() }),
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
      columns: fields.select({
        label: 'Columns',
        description: 'Tiles per row on wide screens. Phones always show one, tablets two.',
        options: LAYOUT_OPTIONS.columns,
        defaultValue: LAYOUT_DEFAULTS.columns,
      }),
      layout: layout(),
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
      layout: layout(),
    }),
  },
  'rich-text': {
    label: 'Rich text',
    schema: fields.object({ body: markdown('Body'), layout: layout() }),
  },
  cta: {
    label: 'Call to action',
    schema: fields.object({
      heading: requiredText('Heading'),
      text: fields.text({ label: 'Text', multiline: true }),
      action: action(),
      layout: layout(),
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
      layout: layout(),
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
