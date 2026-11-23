import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';

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
export const actionSchema = z.object({ label, href: z.string().regex(/^(\/|https:\/\/)/) });
const md = z.string(); // Markdown, rendered by lib/markdown.ts

export type Action = z.infer<typeof actionSchema>;

export const sectionsSchema = ({ image }: SchemaContext) =>
  z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('hero'),
        label,
        headline: z.string(),
        headlineAccent: z.string(),
        lede: z.string(),
        actions: z.array(actionSchema).max(MAX_ACTIONS),
        image: image(),
        imageAlt: z.string(),
      }),
      z.object({ type: z.literal('statement'), label, text: z.string() }),
      z.object({
        type: z.literal('app-grid'),
        label,
        heading: z.string(),
        apps: z.array(z.string()).default([]), // slugs; empty = all, by `order`
      }),
      z.object({
        type: z.literal('feature-list'),
        label,
        heading: z.string(),
        items: z
          .array(z.object({ title: z.string(), body: z.string() }))
          .min(1)
          .max(MAX_ITEMS),
      }),
      z.object({ type: z.literal('rich-text'), body: md }),
      z.object({
        type: z.literal('cta'),
        heading: z.string(),
        text: z.string().optional(),
        action: actionSchema,
      }),
      z.object({
        type: z.literal('faq'),
        label,
        items: z.array(z.object({ q: z.string(), a: md })).min(1),
      }),
    ]),
  );

export type Section = z.infer<ReturnType<typeof sectionsSchema>>[number];
export type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>;
