/**
 * Page band rhythm shared by SectionRenderer and the bands a page adds after its sections (the
 * quote form). A band is full-bleed with the page container inside; every band after the first
 * opens with the one divider rule (border budget).
 */
export const CONTAINER = 'mx-auto max-w-page px-4 md:px-8';
/** Generous band rhythm; the footer's own top margin follows the last band. */
export const BAND = 'py-16 md:py-24 last:pb-0';
/** The first band sits closer to the tally strip. */
export const FIRST_BAND = 'pt-12 md:pt-16';
/**
 * The hero band (always the first band): from `lg` it fills the first screen below the masthead
 * (`--first-screen`) and centres its container vertically; the container keeps its full width
 * (`*:w-full`, a flex item with auto margins would shrink to its content). Below `lg` it stacks
 * and scrolls with the FIRST_BAND top and a closer bottom.
 */
export const HERO_BAND =
  'flex flex-col justify-center pt-12 pb-16 *:w-full lg:min-h-(--first-screen) lg:py-8';
export const DIVIDER = 'border-t border-line';
