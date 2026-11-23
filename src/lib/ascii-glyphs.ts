/**
 * ASCII grid constants shared by the build-time renderer (`ascii.ts`) and the client motion
 * module (`ascii-motion.ts`). Kept apart from the renderer so the browser bundle never pulls in
 * `sharp`.
 */

/** Sparse to dense. No HTML-special characters, so runs can be inlined as markup. */
export const ASCII_RAMP = ' .:-=+*#%@';
/** Tones map to `--color-tone-0…5`. */
export const TONE_COUNT = 6;
/** Glyph cell width ÷ height. Rows are scaled by it so the image keeps its aspect. */
export const CHAR_ASPECT = 0.5;
