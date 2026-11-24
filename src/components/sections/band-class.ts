/**
 * Page band rhythm shared by SectionRenderer and the bands a page adds after its sections (the
 * quote form). A band is full-bleed with the page container inside; every band after the first
 * opens with the one divider rule (border budget).
 */
import type { Section, SectionLayout } from '../../lib/sections-schema.ts';

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

/** A band without a layout of its own (the hero, a page's title band): never tinted. */
export const PLAIN_BAND = 'plain';

/** What sits right above a band: a layout, a plain band, or nothing (the band is first). */
export type PreviousBand = SectionLayout | typeof PLAIN_BAND | undefined;

/** The plain band rhythm, for a band a page adds without a section layout. */
export const DEFAULT_LAYOUT = {
  background: 'default',
  spacing: 'regular',
} as const satisfies SectionLayout;

const bandTinted = (layout: SectionLayout) => layout.background !== 'default';

/**
 * The band above section `index`: the previous section's layout (a hero is plain), or the
 * title band when `titleBand` and `index` is 0, or nothing when this is the page's first band.
 * `index` may equal `sections.length`: the band a page adds after its sections.
 */
export function bandBefore(
  sections: readonly Section[],
  index: number,
  titleBand: boolean,
): PreviousBand {
  const previous = sections[index - 1];
  if (previous === undefined) return titleBand ? PLAIN_BAND : undefined;
  return previous.type === 'hero' ? PLAIN_BAND : previous.layout;
}

/**
 * The divider rule a band opens with, if any (border budget). A tinted band is its own edge, and
 * so is the edge to a tinted neighbour of another fill, so those draw no rule. Two plain bands,
 * and two bands of the same tint (one fill, they would merge), get one.
 */
function edgeRule(layout: SectionLayout, previous: SectionLayout | typeof PLAIN_BAND): string {
  if (previous === PLAIN_BAND) return bandTinted(layout) ? '' : DIVIDER;
  return layout.background === previous.background ? DIVIDER : '';
}

/**
 * The band classes of a section with `layout` below `previous`. The default layout gives exactly
 * the usual band (`BAND`, then `FIRST_BAND` or `DIVIDER`). A tinted band keeps its bottom padding
 * when last, so the tint closes around its content.
 */
export function sectionBand(layout: SectionLayout, previous: PreviousBand): string {
  const edge = previous === undefined ? FIRST_BAND : edgeRule(layout, previous);
  return [
    SPACING[layout.spacing],
    bandTinted(layout) ? BACKGROUND[layout.background] : LAST_FLUSH,
    edge,
  ]
    .filter((part) => part !== '')
    .join(' ');
}
