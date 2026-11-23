import type { Locale } from '../../lib/i18n.ts';
import type { Section, SectionOf } from '../../lib/sections-schema.ts';

/**
 * Props every section block takes from SectionRenderer. `index` is the block's 1-based position
 * on the page (its `[NN]` label). Only a hero can be the page's h1, so every other block's
 * heading level is fixed at 2. `localize` maps a content href to the URL this page's locale links
 * (`hrefLocalizer`); every block passes its hrefs, Markdown links included, through it.
 */
export type BlockProps<T extends Section['type']> = {
  section: SectionOf<T>;
  index: number;
  locale: Locale;
  headingLevel: T extends 'hero' ? 1 | 2 : 2;
  localize: (href: string) => string;
};

/** Id prefix for Markdown headings rendered inside the block at `index` (unique per page). */
export function sectionIdPrefix(index: number): string {
  return `section-${index}`;
}
