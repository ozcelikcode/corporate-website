import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { optionalField } from './blank.ts';

export const SECTION_TYPES = [
  'hero',
  'statement',
  'app-grid',
  'feature-list',
  'rich-text',
  'cta',
  'faq',
] as const;

const MAX_ACTIONS = 2;
const MAX_ITEMS = 8;
export const LABEL_MAX = 32;
const label = z.string().max(LABEL_MAX); // mono tally label, e.g. "MISSION"
export const actionSchema = z.strictObject({
  label,
  href: z.string().regex(/^(\/(?![/\\])|https:\/\/)/),
});
const md = z.string(); // Markdown, rendered by lib/markdown.ts
/** Rundown slot length `HH:MM:SS`, display only (never summed or parsed as time). */
export const DURATION_PATTERN = /^\d{2}:[0-5]\d:[0-5]\d$/;

export type Action = z.infer<typeof actionSchema>;

export const sectionsSchema = ({ image }: SchemaContext) =>
  z
    .array(
      z.discriminatedUnion('type', [
        z.strictObject({
          type: z.literal('hero'),
          label,
          headline: z.string(),
          headlineAccent: z.string(),
          lede: z.string(),
          actions: z.array(actionSchema).max(MAX_ACTIONS).default([]),
          image: image(),
          imageAlt: z.string(),
        }),
        z.strictObject({ type: z.literal('statement'), label, text: z.string() }),
        z.strictObject({
          type: z.literal('app-grid'),
          label,
          heading: z.string(),
          apps: z.array(z.string()).default([]), // slugs; empty = all, by `order`
        }),
        z.strictObject({
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
        z.strictObject({ type: z.literal('rich-text'), body: md }),
        z.strictObject({
          type: z.literal('cta'),
          heading: z.string(),
          text: optionalField(z.string()),
          action: actionSchema,
        }),
        z.strictObject({
          type: z.literal('faq'),
          label,
          items: z.array(z.strictObject({ q: z.string(), a: md })).min(1),
        }),
      ]),
    )
    .superRefine((sections, ctx) => {
      // The hero carries the page's h1, so there is at most one and it opens the page.
      sections.forEach((section, i) => {
        if (section.type !== 'hero' || i === 0) return;
        const position = i + 1;
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
