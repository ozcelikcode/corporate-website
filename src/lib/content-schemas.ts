/**
 * Entry schemas of the content collections (`content.config.ts` only wires them to loaders), kept
 * free of the Astro runtime so they can be tested. Optional fields go through `optionalField`: a
 * value the CMS leaves blank counts as absent.
 */
import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { listField, optionalField, withoutBlankValues } from './blank.ts';
import { accentContrast, HEX_PATTERN, MIN_ACCENT_CONTRAST } from './color.ts';
import { UI_KEYS } from './i18n.ts';
import {
  actionSchema,
  applicationSectionsSchema,
  LABEL_MAX,
  sectionsSchema,
} from './sections-schema.ts';

const DESCRIPTION_MAX = 160;
const TAGLINE_MAX = 120;
const CONTRAST_DECIMALS = 2;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTACT_HREF_PATTERN = /^(mailto:|tel:|https:\/\/)/;
const LINK_HREF_PATTERN = /^(\/(?![/\\])|https:\/\/|mailto:)/;

/** Social and cover images are rasters only (the CMS field refuses SVG; the build does too). */
const rasterImage = (image: SchemaContext['image'], field: string) =>
  image().refine((metadata) => metadata.format !== 'svg', {
    message: `${field} must be a PNG, JPEG or WebP image, not an SVG`,
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

const contact = z.strictObject({
  kind: z.enum(['email', 'phone', 'address']),
  value: z.string(),
  href: z.string().regex(CONTACT_HREF_PATTERN),
});

const link = z.strictObject({ label: z.string(), href: z.string().regex(LINK_HREF_PATTERN) });

export const settingsSchema = ({ image }: SchemaContext) =>
  z.strictObject({
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
    socials: listField(
      z.array(z.strictObject({ label: z.string(), href: z.string().regex(/^https:\/\//) })),
    ),
    ogImage: rasterImage(image, 'settings.ogImage'),
    organization: z.strictObject({
      legalName: z.string(),
      url: z.url({ protocol: /^https$/ }),
      address: optionalField(z.string()),
    }),
  });

/** TR may be partial and a blank string counts as missing: both fall back to EN (`t()`). */
export const uiSchema = z.preprocess(
  withoutBlankValues,
  z.partialRecord(z.enum(UI_KEYS), z.string().min(1)),
);

export const navigationSchema = z.strictObject({
  header: z.array(link).min(1),
  footer: listField(z.array(link)),
});

export const pageSchema = (context: SchemaContext) =>
  z.strictObject({
    title: z.string(),
    description: z.string().min(1).max(DESCRIPTION_MAX),
    ogImage: optionalField(rasterImage(context.image, 'page.ogImage')),
    sections: sectionsSchema(context),
  });

export const applicationSchema = (context: SchemaContext) =>
  z.strictObject({
    name: z.string(),
    slug: z.string().regex(SLUG_PATTERN),
    tagline: z.string().max(TAGLINE_MAX),
    summary: z.string(),
    category: z.string(),
    cover: rasterImage(context.image, 'application.cover'),
    coverAlt: z.string(),
    status: z.string().max(LABEL_MAX),
    order: z.number().int().min(0),
    links: optionalField(z.array(actionSchema)),
    brochure: optionalField(z.url({ protocol: /^https$/ })),
    sections: applicationSectionsSchema(context),
  });
