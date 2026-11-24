/**
 * Navigation entry schema: header items are plain links or parents with a submenu (hand-written
 * `children`, or the auto list of applications through `source`), with an optional `feature`
 * card. Cross-field rules fail the build with a message naming the item.
 */
import { z } from 'astro/zod';
import { listField, optionalField, optionalObjectField } from './blank.ts';
import { actionSchema } from './sections-schema.ts';

export const NAV_CHILDREN_MAX = 6;
const LINK_HREF_PATTERN = /^(\/(?![/\\])|https:\/\/|mailto:)/;
const NAV_SOURCES = ['applications'] as const;

const href = z.string().regex(LINK_HREF_PATTERN);
const link = z.strictObject({ label: z.string(), href });

const navChild = z.strictObject({
  label: z.string(),
  href,
  description: optionalField(z.string()),
});

const navFeature = z.strictObject({
  heading: z.string().min(1),
  text: z.string().min(1),
  action: actionSchema,
});

const navEntry = z
  .strictObject({
    label: z.string(),
    href: optionalField(href),
    children: listField(z.array(navChild).max(NAV_CHILDREN_MAX)),
    source: optionalField(z.enum(NAV_SOURCES)),
    feature: optionalObjectField(navFeature),
  })
  .superRefine((entry, ctx) => {
    const name = `Navigation item "${entry.label}"`;
    const hasChildren = entry.children.length > 0;
    const hasSubmenu = hasChildren || entry.source !== undefined;
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (hasChildren && entry.source !== undefined) {
      fail(`${name} sets both children and source; use one`);
    }
    if (entry.href === undefined && !hasSubmenu) {
      fail(`${name} needs an href or a submenu (children or source)`);
    }
    if (entry.feature !== undefined && !hasSubmenu) {
      fail(`${name} has a feature but no submenu to show it in`);
    }
  });

export type NavEntry = z.output<typeof navEntry>;
export type NavChildEntry = z.output<typeof navChild>;
export type NavFeature = z.output<typeof navFeature>;

export const navigationSchema = z.strictObject({
  header: z.array(navEntry).min(1),
  footer: listField(z.array(link)),
});
