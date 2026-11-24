/**
 * Page band rhythm shared by SectionRenderer and the bands a page adds after its sections (the
 * quote form). A band is full-bleed with the page container inside; every band after the first
 * opens with the one divider rule (border budget).
 */
import type { SectionLayout } from '../../lib/sections-schema.ts';

export const CONTAINER = 'mx-auto max-w-page px-4 md:px-8';
/** A section's vertical padding (`layout.spacing`); `regular` is the usual band rhythm. */
const SPACING = {
  compact: 'py-10 md:py-16',
  regular: 'py-16 md:py-24',
  spacious: 'py-24 md:py-32',
} as const satisfies Record<SectionLayout['spacing'], string>;
/**
 * A section's background (`layout.background`): the `band-*` utilities in `global.css` tint the
 * band and remap the colour tokens inside it, so every block keeps its contrast pairs there.
 */
const BACKGROUND = {
  default: '',
  subtle: 'band-subtle',
  contrast: 'band-contrast',
} as const satisfies Record<SectionLayout['background'], string>;
/** The last plain band ends flush: the footer's own top margin follows it. */
const LAST_FLUSH = 'last:pb-0';
/** Generous band rhythm; the footer's own top margin follows the last band. */
export const BAND = `${SPACING.regular} ${LAST_FLUSH}`;
/** The first band sits closer to the tally strip. */
export const FIRST_BAND = 'pt-12 md:pt-16';
/**
 * The hero band (always the first band): from `lg` it fills the first screen below the masthead
 * (`--first-screen`) and centres its container vertically, lifted 5% above the true centre
 * (`--hero-pad`, `--hero-pad-end`); the container keeps its full width (`*:w-full`, a flex item
 * with auto margins would shrink to its content). Below `lg` it stacks and scrolls with the
 * FIRST_BAND top and a closer bottom.
 */
export const HERO_BAND =
  'flex flex-col justify-center pt-12 pb-16 *:w-full lg:min-h-(--first-screen) lg:pt-(--hero-pad) lg:pb-(--hero-pad-end)';
export const DIVIDER = 'border-t border-line';

/** Where a section band sits: first on the page, or right after a tinted band. */
export type BandPlace = { first: boolean; afterTint: boolean };

/** Whether a band with `layout` is tinted (a subtle or contrast background). */
export const bandTinted = (layout: SectionLayout) => layout.background !== 'default';

/**
 * The band classes of a section with `layout`. The default layout gives exactly the usual band
 * (`BAND`, then `FIRST_BAND` or `DIVIDER`). A tinted band needs no divider (its edge is one) and
 * keeps its bottom padding when last, so the tint closes around its content; the band right
 * after a tinted one skips the divider too.
 */
export function sectionBand(layout: SectionLayout, place: BandPlace): string {
  const tinted = bandTinted(layout);
  const edge = place.first ? FIRST_BAND : tinted || place.afterTint ? '' : DIVIDER;
  return [SPACING[layout.spacing], tinted ? BACKGROUND[layout.background] : LAST_FLUSH, edge]
    .filter((part) => part !== '')
    .join(' ');
}
