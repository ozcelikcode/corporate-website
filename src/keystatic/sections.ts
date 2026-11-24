/**
 * Keystatic section blocks (`fields.blocks`, stored as `{ discriminant, value }`), one per section
 * type, with the field names and limits of `lib/sections-schema.ts`. That module is not imported:
 * it would pull Zod into the admin bundle, so its limits are mirrored here and pinned by
 * `parity.test.ts`. Zod stays the build authority (it also turns the stored shape back into flat
 * sections).
 */
import { fields } from '@keystatic/core';

/** Mirrors `LABEL_MAX`, `MAX_ACTIONS` and `MAX_ITEMS` of `lib/sections-schema.ts`. */
export const SECTION_LIMITS = { label: 32, actions: 2, items: 8 } as const;
/** Mirrors `ACTION_HREF_PATTERN`. */
export const HREF_REGEX = /^(\/(?![/\\])|https:\/\/)/;
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
        description: 'A site path such as /quote/, or an https:// address.',
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

/** Every block but the hero; none of them stores an image. */
const contentBlocks = () => ({
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
});

/** Page sections: every block type; a hero must come first (the build checks it). */
export const pageSections = (images: ImageLocation) =>
  fields.blocks(
    { hero: hero(images), ...contentBlocks() },
    { label: SECTIONS_LABEL, description: 'At most one hero, and only as the first section.' },
  );

/** Application sections: no hero, since the application header holds the h1 (the build checks it). */
export const applicationSections = () => fields.blocks(contentBlocks(), { label: SECTIONS_LABEL });
