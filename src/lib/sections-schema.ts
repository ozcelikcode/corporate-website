import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { listField, optionalField } from './blank.ts';
import { isStoredBlock, type StoredBlock, toFlatSection } from './stored-block.ts';

export const SECTION_TYPES = [
  'hero',
  'statement',
  'app-grid',
  'feature-list',
  'rich-text',
  'cta',
  'faq',
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export const MAX_ACTIONS = 2;
export const MAX_ITEMS = 8;
export const LABEL_MAX = 32;
/** Site-relative (never protocol-relative) or https. */
export const ACTION_HREF_PATTERN = /^(\/(?![/\\])|https:\/\/)/;
/**
 * Markdoc tag syntax. Keystatic's rich-text editor saves a typed `{% x %}` as a tag and the entry
 * then no longer opens in the editor, so the build refuses it in every Markdown field.
 */
const MARKDOC_TAG_PATTERN = /\{%/;
const label = z.string().max(LABEL_MAX); // tally label, e.g. "Mission"
export const actionSchema = z.strictObject({
  label,
  href: z.string().regex(ACTION_HREF_PATTERN),
});
const md = z.string(); // Markdown, rendered by lib/markdown.ts; checked for MARKDOC_TAG_PATTERN
/** Rundown slot length `HH:MM:SS`, display only (never summed or parsed as time). */
export const DURATION_PATTERN = /^\d{2}:[0-5]\d:[0-5]\d$/;

export type Action = z.infer<typeof actionSchema>;

/** One strict schema per section type, keyed by type (the Keystatic parity test reads them). */
export const sectionSchemas = ({ image }: SchemaContext) =>
  ({
    hero: z.strictObject({
      type: z.literal('hero'),
      label,
      headline: z.string(),
      headlineAccent: z.string(),
      lede: z.string(),
      actions: listField(z.array(actionSchema).max(MAX_ACTIONS)),
      image: image(),
      imageAlt: z.string(),
    }),
    statement: z.strictObject({ type: z.literal('statement'), label, text: z.string() }),
    'app-grid': z.strictObject({
      type: z.literal('app-grid'),
      label,
      heading: z.string(),
      apps: listField(z.array(z.string())), // slugs; empty = all, by `order`
    }),
    'feature-list': z.strictObject({
      type: z.literal('feature-list'),
      label,
      heading: z.string(),
      items: z
        .array(
          z.strictObject({
            title: z.string(),
            body: z.string(),
            duration: optionalField(z.string().regex(DURATION_PATTERN)),
          }),
        )
        .min(1)
        .max(MAX_ITEMS),
    }),
    'rich-text': z.strictObject({ type: z.literal('rich-text'), body: md }),
    cta: z.strictObject({
      type: z.literal('cta'),
      heading: z.string(),
      text: optionalField(z.string()),
      action: actionSchema,
    }),
    faq: z.strictObject({
      type: z.literal('faq'),
      label,
      items: z.array(z.strictObject({ q: z.string(), a: md })).min(1),
    }),
  }) satisfies Record<SectionType, z.ZodObject>;

const flatSection = (context: SchemaContext) => {
  const schemas = sectionSchemas(context);
  return z.discriminatedUnion('type', [
    schemas.hero,
    schemas.statement,
    schemas['app-grid'],
    schemas['feature-list'],
    schemas['rich-text'],
    schemas.cta,
    schemas.faq,
  ]);
};
type FlatSection = z.infer<ReturnType<typeof flatSection>>;

/** Keystatic's stored `{ discriminant, value }` only; the flat shape is refused. */
const storedBlock = z.custom<StoredBlock>(isStoredBlock, {
  message: 'A section must be stored as { discriminant, value } (a Keystatic block)',
});

/** The Markdown texts of a section, for the Markdoc tag check. */
function markdownOf(section: FlatSection): string[] {
  if (section.type === 'rich-text') return [section.body];
  if (section.type === 'faq') return section.items.map((item) => item.a);
  return [];
}

export const sectionsSchema = (context: SchemaContext) =>
  z
    .array(storedBlock.transform(toFlatSection).pipe(flatSection(context)))
    .superRefine((sections, ctx) => {
      sections.forEach((section, i) => {
        const position = i + 1;
        if (markdownOf(section).some((text) => MARKDOC_TAG_PATTERN.test(text))) {
          ctx.addIssue({
            code: 'custom',
            path: [i],
            message: `Markdoc tag syntax "{%" is not allowed (section ${position})`,
          });
        }
        // The hero carries the page's h1, so there is at most one and it opens the page.
        if (section.type !== 'hero' || i === 0) return;
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message:
            sections[0]?.type === 'hero'
              ? `Only one hero section is allowed (another one at position ${position})`
              : `A hero section must be the first section (found at position ${position})`,
        });
      });
    });

/** Application pages render their own h1 above the sections, so a hero (the other h1) is invalid. */
export const applicationSectionsSchema = (context: SchemaContext) =>
  sectionsSchema(context).superRefine((sections, ctx) => {
    sections.forEach((section, i) => {
      if (section.type !== 'hero') return;
      ctx.addIssue({
        code: 'custom',
        path: [i],
        message: `An application page cannot have a hero section (found at position ${i + 1}): the page header holds the h1`,
      });
    });
  });

export type Section = z.infer<ReturnType<typeof sectionsSchema>>[number];
export type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>;
