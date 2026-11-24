/**
 * Navigation entry schema: header items are plain links or parents with a submenu (hand-written
 * `children`, or the auto list of applications through `source`), with an optional `feature`
 * card. Cross-field rules fail the build with a message naming the item.
 */
import { z } from 'astro/zod';
import { listField, optionalField, optionalObjectField } from './blank.ts';
import { LINK_HREF_PATTERN } from './link-patterns.ts';
import { labelWidthPerMille } from './nav-label-width.ts';
import { actionSchema } from './sections-schema.ts';

export const NAV_CHILDREN_MAX = 6;
/** Top-level items: more than four overflow the desktop header bar at `lg` (1024). */
export const NAV_HEADER_MAX = 4;
/**
 * Characters per top-level label: eighteen of the widest glyph (`W`, 0.982em) still fit the
 * budget below on their own. Mirrored as the admin field's length limit.
 */
export const NAV_HEADER_LABEL_MAX = 18;
/**
 * Total width of all top-level labels, in thousandths of an em of the nav type
 * (`labelWidthPerMille`, an upper bound). Measured in Chromium at 1024×768, the narrowest
 * desktop bar, on 2026-11-24: four parents, each a link plus its chevron button (the widest item
 * shape), with the seed logo, the EN/TR toggle and the body-caption quote key; the space left for
 * labels was 18.424em in EN ("Request a quote") and 21.601em in TR ("Teklif iste"). The budget
 * takes the EN figure, rounded down. A wider logo or a longer quote label in `ui` uses up the
 * same bar: re-measure after changing them.
 */
export const NAV_HEADER_LABELS_BUDGET = 18_400;
const PER_MILLE = 1000;
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
    if ([...entry.label].length > NAV_HEADER_LABEL_MAX) {
      fail(
        `${name} has a label of ${[...entry.label].length} characters; the limit is ${NAV_HEADER_LABEL_MAX}`,
      );
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
    const width = entries.reduce((sum, entry) => sum + labelWidthPerMille(entry.label), 0);
    if (width > NAV_HEADER_LABELS_BUDGET) {
      const em = (value: number) => (value / PER_MILLE).toFixed(2);
      ctx.addIssue({
        code: 'custom',
        message: `The header bar is full: the top-level labels need ${em(width)}em and ${em(NAV_HEADER_LABELS_BUDGET)}em fit at the narrowest desktop width; shorten the labels`,
      });
    }
  });

export const navigationSchema = z.strictObject({
  header,
  footer: listField(z.array(link)),
});
