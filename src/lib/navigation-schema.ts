/**
 * Navigation entry schema: header items are plain links or parents with a submenu (hand-written
 * `children`, or the auto list of applications through `source`), with an optional `feature`
 * card. Cross-field rules fail the build with a message naming the item.
 */
import { z } from 'astro/zod';
import { listField, optionalField, optionalObjectField } from './blank.ts';
import { LINK_HREF_PATTERN } from './link-patterns.ts';
import { actionSchema } from './sections-schema.ts';

export const NAV_CHILDREN_MAX = 6;
/** Top-level items: more than four overflow the desktop header bar at `lg` (1024). */
export const NAV_HEADER_MAX = 4;
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
    children: listField(z.array(navChild)),
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
    if (entry.children.length > NAV_CHILDREN_MAX) {
      fail(`${name} has ${entry.children.length} children; the limit is ${NAV_CHILDREN_MAX}`);
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

const header = z
  .array(navEntry)
  .min(1)
  .superRefine((entries, ctx) => {
    for (const entry of entries.slice(NAV_HEADER_MAX)) {
      ctx.addIssue({
        code: 'custom',
        message: `Navigation item "${entry.label}" is past the header limit of ${NAV_HEADER_MAX} items`,
      });
    }
  });

export const navigationSchema = z.strictObject({
  header,
  footer: listField(z.array(link)),
});
