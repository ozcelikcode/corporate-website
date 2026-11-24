import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { listField, optionalField } from './blank.ts';
import { toFlatSection } from './stored-block.ts';

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

/**
 * The fields of each section type (a stored block's `value`), keyed by type; the Keystatic
 * parity test reads them.
 */
export const sectionSchemas = ({ image }: SchemaContext) =>
  ({
    hero: z.strictObject({
      label,
      headline: z.string(),
      headlineAccent: z.string(),
      lede: z.string(),
      actions: listField(z.array(actionSchema).max(MAX_ACTIONS)),
      image: image(),
      imageAlt: z.string(),
    }),
    statement: z.strictObject({ label, text: z.string() }),
    'app-grid': z.strictObject({
      label,
      heading: z.string(),
      apps: listField(z.array(z.string())), // slugs; empty = all, by `order`
    }),
    'feature-list': z.strictObject({
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
    'rich-text': z.strictObject({ body: md }),
    cta: z.strictObject({
      heading: z.string(),
      text: optionalField(z.string()),
      action: actionSchema,
    }),
    faq: z.strictObject({
      label,
      items: z.array(z.strictObject({ q: z.string(), a: md })).min(1),
    }),
  }) satisfies Record<SectionType, z.ZodObject>;

/**
 * Keystatic's stored blocks, `{ discriminant, value }`, read as flat sections. The stored shape
 * is validated as is, so a build error names the YAML path (`sections.<n>.value.<field>`); the
 * flat shape is refused. (Written out per type: a generic helper loses the output types.)
 */
const section = (context: SchemaContext) => {
  const s = sectionSchemas(context);
  return z.discriminatedUnion('discriminant', [
    z.strictObject({ discriminant: z.literal('hero'), value: s.hero }).transform(toFlatSection),
    z
      .strictObject({ discriminant: z.literal('statement'), value: s.statement })
      .transform(toFlatSection),
    z
      .strictObject({ discriminant: z.literal('app-grid'), value: s['app-grid'] })
      .transform(toFlatSection),
    z
      .strictObject({ discriminant: z.literal('feature-list'), value: s['feature-list'] })
      .transform(toFlatSection),
    z
      .strictObject({ discriminant: z.literal('rich-text'), value: s['rich-text'] })
      .transform(toFlatSection),
    z.strictObject({ discriminant: z.literal('cta'), value: s.cta }).transform(toFlatSection),
    z.strictObject({ discriminant: z.literal('faq'), value: s.faq }).transform(toFlatSection),
  ]);
};
type FlatSection = z.output<ReturnType<typeof section>>;

/** The Markdown fields of a section (relative to its stored value), for the Markdoc tag check. */
function markdownOf(section: FlatSection): [(string | number)[], string][] {
  if (section.type === 'rich-text') return [[['body'], section.body]];
  if (section.type === 'faq') return section.items.map((item, i) => [['items', i, 'a'], item.a]);
  return [];
}

export const sectionsSchema = (context: SchemaContext) =>
  z.array(section(context)).superRefine((sections, ctx) => {
    sections.forEach((section, i) => {
      const position = i + 1;
      for (const [path, text] of markdownOf(section)) {
        if (!MARKDOC_TAG_PATTERN.test(text)) continue;
        ctx.addIssue({
          code: 'custom',
          path: [i, 'value', ...path],
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
