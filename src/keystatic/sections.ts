/**
 * Keystatic section blocks (`fields.blocks`, stored as `{ discriminant, value }`), one per section
 * type, with the field names and limits of `lib/sections-schema.ts`. That module is not imported:
 * it would pull Zod into the admin bundle, so its limits are mirrored here and pinned by
 * `parity.test.ts`. Zod stays the build authority (it also turns the stored shape back into flat
 * sections).
 */
import {
  type ComponentSchema,
  fields,
  type GenericPreviewProps,
  type ObjectField,
} from '@keystatic/core';
import { SPAN } from './field-layout.ts';
import { itemLabel } from './item-label.ts';
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
      layout: [SPAN.half, SPAN.half],
    },
  );

const label = () =>
  fields.text({
    label: 'Label',
    description: 'Small label above the section, a few words.',
    validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
  });

const requiredText = (fieldLabel: string, multiline = false, description?: string) =>
  fields.text({
    label: fieldLabel,
    ...(description === undefined ? {} : { description }),
    multiline,
    validation: required,
  });

/** Markdown with headings, lists, links and inline marks; stored as a string in the YAML. */
const markdown = (fieldLabel: string, description = '') =>
  fields.markdoc.inline({
    label: fieldLabel,
    description:
      `${description} Never type "{%": it would lock the entry, so the build refuses it.`.trim(),
    options: { table: false, image: false, codeBlock: false, divider: false },
  });

type Fields = Record<string, ComponentSchema>;
type BlockFields<F extends Fields> = {
  readonly [K in keyof F]: GenericPreviewProps<F[K], unknown>;
};

/**
 * One block type: its menu name, schema and the list row label ("<name> · <text>"). `summary`
 * picks the text that tells two blocks of one type apart; markdown fields cannot be read there.
 */
function block<F extends Fields>(
  name: string,
  schema: ObjectField<F>,
  summary: (values: BlockFields<F>) => string,
) {
  return {
    label: name,
    schema,
    itemLabel: (props: GenericPreviewProps<ObjectField<F>, unknown>) =>
      itemLabel(name, summary(props.fields)),
  };
}

/** A link button (`actionSchema`): label and a site path or https address. */
export const action = () =>
  fields.object(
    {
      label: fields.text({
        label: 'Label',
        description: 'Text on the button.',
        validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
      }),
      href: fields.text({
        label: 'Link',
        description: LINK_HINT,
        validation: { isRequired: true, pattern: linkPattern('action') },
      }),
    },
    { label: 'Action', layout: [SPAN.half, SPAN.half] },
  );

const hero = (images: ImageLocation) =>
  block(
    'Hero',
    fields.object(
      {
        label: label(),
        headline: requiredText('Headline', false, 'Large first line of the page.'),
        headlineAccent: requiredText(
          'Headline accent (second line)',
          false,
          'Second line, shown in the accent colour.',
        ),
        lede: requiredText('Lede', true, 'Short paragraph under the headline.'),
        actions: fields.array(action(), {
          label: 'Actions',
          description: 'Buttons under the lede, at most two.',
          itemLabel: (props) => itemLabel('Action', props.fields.label.value),
          validation: { length: { max: SECTION_LIMITS.actions } },
        }),
        image: fields.image({
          label: 'Image (PNG, JPEG or WebP)',
          description: 'Rendered as the animated ASCII picture beside the headline.',
          ...images,
          validation: required,
        }),
        imageAlt: requiredText(
          'Image alt text',
          false,
          'Describes the picture for screen readers.',
        ),
      },
      {
        layout: [SPAN.full, SPAN.half, SPAN.half, SPAN.full, SPAN.full, SPAN.full, SPAN.full],
      },
    ),
    (values) => values.headline.value,
  );

/** An image field stored in the entry's own uploads folder; rasters only (the build checks). */
const rasterImage = (
  images: ImageLocation,
  fieldLabel: string,
  isRequired: boolean,
  description = '',
) =>
  fields.image({
    label: fieldLabel,
    description: `${description} ${RASTER_HINT}`.trim(),
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
      layout: [SPAN.half, SPAN.half],
    },
  );

/** The four richer blocks; each may store images in the entry's uploads folder. */
const richBlocks = (images: ImageLocation) => ({
  stats: block(
    'Stats',
    fields.object({
      label: label(),
      items: fields.array(
        fields.object(
          {
            value: requiredText('Value', false, 'The big figure, e.g. 16 or 3,200.'),
            label: fields.text({
              label: 'Label',
              description: 'What the figure counts.',
              validation: { isRequired: true, length: { max: SECTION_LIMITS.label } },
            }),
            note: fields.text({ label: 'Note', description: 'Optional, one short line.' }),
          },
          { layout: [SPAN.third, SPAN.twoThirds, SPAN.full] },
        ),
        {
          label: 'Figures',
          description: 'Three or four figures shown side by side.',
          itemLabel: (props) =>
            itemLabel('Figure', `${props.fields.value.value} ${props.fields.label.value}`),
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
    (values) => values.label.value,
  ),
  logos: block(
    'Logos',
    fields.object({
      label: label(),
      heading: requiredText('Heading', false, 'Line above the row of logos.'),
      items: fields.array(
        fields.object(
          {
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
          },
          { layout: [SPAN.full, SPAN.half, SPAN.half] },
        ),
        {
          label: 'Logos',
          description: 'Shown in greyscale, in this order.',
          itemLabel: (props) => itemLabel('Logo', props.fields.alt.value),
          validation: { length: SECTION_LIMITS.logos },
        },
      ),
      layout: layout(),
    }),
    (values) => values.heading.value,
  ),
  testimonial: block(
    'Testimonial',
    fields.object(
      {
        quote: requiredText('Quote', true, 'The quotation, shown large.'),
        name: requiredText('Name', false, 'Who said it.'),
        role: requiredText('Role', false, 'Their job title.'),
        organization: requiredText('Organization'),
        portrait: rasterImage(images, 'Portrait (optional)', false, 'Small photo beside the name.'),
        layout: layout(),
      },
      {
        layout: [SPAN.full, SPAN.half, SPAN.half, SPAN.full, SPAN.full, SPAN.full],
      },
    ),
    (values) => values.name.value,
  ),
  'media-split': block(
    'Media and text',
    fields.object({
      label: label(),
      heading: requiredText('Heading'),
      text: markdown('Text', 'Paragraphs beside the image.'),
      image: rasterImage(images, 'Image', true),
      imageAlt: requiredText('Image alt text', false, 'Describes the picture for screen readers.'),
      action: optionalAction(),
      reverse: fields.checkbox({
        label: 'Image first',
        description: 'Puts the image before the text; alternate it on consecutive splits.',
      }),
      layout: layout(),
    }),
    (values) => values.heading.value,
  ),
});

/** Every block but the hero. */
const contentBlocks = (images: ImageLocation) => ({
  statement: block(
    'Statement',
    fields.object({
      label: label(),
      text: requiredText('Text', true, 'One large paragraph that states a position.'),
      layout: layout(),
    }),
    (values) => values.text.value,
  ),
  'app-grid': block(
    'Application grid',
    fields.object({
      label: label(),
      heading: requiredText('Heading', false, 'Line above the application tiles.'),
      apps: fields.array(
        fields.relationship({
          label: 'Application',
          collection: 'applicationsEn',
          validation: required,
        }),
        {
          label: 'Applications',
          description: 'Leave empty to show every application, by order.',
          itemLabel: (props) => itemLabel('Application', props.value),
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
    (values) => values.heading.value,
  ),
  'feature-list': block(
    'Feature list',
    fields.object({
      label: label(),
      heading: requiredText('Heading', false, 'Line above the list.'),
      items: fields.array(
        fields.object({
          title: requiredText('Title'),
          body: requiredText('Body', true, 'A sentence or two under the title.'),
          duration: fields.text({
            label: 'Duration (HH:MM:SS)',
            description: 'Optional rundown timecode, display only.',
            validation: {
              pattern: {
                regex: OPTIONAL_DURATION_REGEX,
                message: 'Use HH:MM:SS, e.g. 00:01:30',
              },
            },
          }),
        }),
        {
          label: 'Items',
          description: 'Up to eight rows, numbered in this order.',
          itemLabel: (props) => itemLabel('Item', props.fields.title.value),
          validation: { length: { min: 1, max: SECTION_LIMITS.items } },
        },
      ),
      layout: layout(),
    }),
    (values) => values.heading.value,
  ),
  'rich-text': block(
    'Rich text',
    fields.object({
      body: markdown('Body', 'Free text with headings, lists and links.'),
      layout: layout(),
    }),
    () => '',
  ),
  cta: block(
    'Call to action',
    fields.object({
      heading: requiredText('Heading', false, 'The invitation, shown large.'),
      text: fields.text({
        label: 'Text',
        description: 'Optional line under the heading.',
        multiline: true,
      }),
      action: action(),
      layout: layout(),
    }),
    (values) => values.heading.value,
  ),
  faq: block(
    'Questions',
    fields.object({
      label: label(),
      items: fields.array(fields.object({ q: requiredText('Question'), a: markdown('Answer') }), {
        label: 'Questions',
        description: 'Shown as an open list, in this order.',
        itemLabel: (props) => itemLabel('Question', props.fields.q.value),
        validation: { length: { min: 1 } },
      }),
      layout: layout(),
    }),
    (values) => values.label.value,
  ),
  ...richBlocks(images),
});

/** Page sections: every block type; a hero must come first (the build checks it). */
export const pageSections = (images: ImageLocation) =>
  fields.blocks(
    { hero: hero(images), ...contentBlocks(images) },
    {
      label: SECTIONS_LABEL,
      description:
        'The page, top to bottom. Drag the handle to reorder. At most one hero, and only first.',
    },
  );

/** Application sections: no hero, since the application header holds the h1 (the build checks it). */
export const applicationSections = (images: ImageLocation) =>
  fields.blocks(contentBlocks(images), {
    label: SECTIONS_LABEL,
    description:
      'The page below the application header, top to bottom. Drag the handle to reorder.',
  });
