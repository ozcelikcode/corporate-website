import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { accentContrast, HEX_PATTERN, MIN_ACCENT_CONTRAST } from './lib/color.ts';
import { UI_KEYS } from './lib/i18n.ts';
import { actionSchema, LABEL_MAX, sectionsSchema } from './lib/sections-schema.ts';

const DESCRIPTION_MAX = 160;
const TAGLINE_MAX = 120;
const CONTRAST_DECIMALS = 2;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTACT_HREF_PATTERN = /^(mailto:|tel:|https:\/\/)/;
const LINK_HREF_PATTERN = /^(\/|https:\/\/|mailto:)/;

// Ids come from the file path (`<locale>/<slug>`), never from a `slug` field: slugs repeat across locales.
const fromYaml = (base: string) =>
  glob({
    pattern: '**/*.yaml',
    base,
    generateId: ({ entry }) => entry.replace(/\.yaml$/, ''),
  });

const accent = z
  .string()
  .regex(HEX_PATTERN, 'settings.accent must be a 6-digit hex colour such as #ffb000')
  .superRefine((hex, ctx) => {
    if (!HEX_PATTERN.test(hex)) return;
    const ratio = accentContrast(hex);
    if (ratio < MIN_ACCENT_CONTRAST) {
      ctx.addIssue({
        code: 'custom',
        message: `settings.accent ${hex} has ${ratio.toFixed(CONTRAST_DECIMALS)}:1 contrast against canvas; minimum is ${MIN_ACCENT_CONTRAST}:1`,
      });
    }
  });

const contact = z.object({
  kind: z.enum(['email', 'phone', 'address']),
  value: z.string(),
  href: z.string().regex(CONTACT_HREF_PATTERN),
});

const link = z.object({ label: z.string(), href: z.string().regex(LINK_HREF_PATTERN) });

const settings = defineCollection({
  loader: fromYaml('./src/content/settings'),
  schema: ({ image }) =>
    z.object({
      brandName: z.string(),
      logo: image(),
      logoAlt: z.string(),
      accent,
      contacts: z
        .array(contact)
        .min(1)
        .refine((items) => items.some((item) => item.kind === 'email'), {
          message: 'settings.contacts needs at least one entry with kind "email"',
        }),
      socials: z
        .array(z.object({ label: z.string(), href: z.string().regex(/^https:\/\//) }))
        .default([]),
      ogImage: image(),
      organization: z.object({
        legalName: z.string(),
        url: z.url(),
        address: z.string().optional(),
      }),
    }),
});

const ui = defineCollection({
  loader: fromYaml('./src/content/ui'),
  schema: z.partialRecord(z.enum(UI_KEYS), z.string().min(1)),
});

const navigation = defineCollection({
  loader: fromYaml('./src/content/navigation'),
  schema: z.object({ header: z.array(link).min(1), footer: z.array(link) }),
});

const pages = defineCollection({
  loader: fromYaml('./src/content/pages'),
  schema: (context) =>
    z.object({
      title: z.string(),
      description: z.string().min(1).max(DESCRIPTION_MAX),
      ogImage: context.image().optional(),
      sections: sectionsSchema(context),
    }),
});

const applications = defineCollection({
  loader: fromYaml('./src/content/applications'),
  schema: (context) =>
    z.object({
      name: z.string(),
      slug: z.string().regex(SLUG_PATTERN),
      tagline: z.string().max(TAGLINE_MAX),
      summary: z.string(),
      category: z.string(),
      cover: context.image(),
      coverAlt: z.string(),
      status: z.string().max(LABEL_MAX),
      order: z.number().int().min(0),
      links: z.array(actionSchema).optional(),
      brochure: z.url({ protocol: /^https$/ }).optional(),
      sections: sectionsSchema(context),
    }),
});

export const collections = { settings, ui, navigation, pages, applications };
