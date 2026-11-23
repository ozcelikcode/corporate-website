/**
 * Turns an ASCII grid into the inner markup of a `<pre>` and guards its size.
 * Safe as raw HTML: the ramp holds no HTML-special characters and classes are fixed.
 */
import type { AsciiGrid, AsciiRun } from './ascii.ts';

/** Max bytes of ASCII markup per figure (all its grids together). */
export const ASCII_HTML_BUDGET = 30 * 1024;

/** A run of spaces needs no colour, so it stays bare text. */
const BLANK_RUN = /^ +$/;

function runHtml({ tone, text }: AsciiRun): string {
  return BLANK_RUN.test(text) ? text : `<span class="t${tone}">${text}</span>`;
}

/**
 * Trailing blanks are dropped: the font size follows the column count, not the line length.
 * The leading newline is eaten by the HTML parser, so a blank first row survives.
 */
export function asciiMarkup(grid: AsciiGrid): string {
  return `\n${grid.lines.map((line) => line.map(runHtml).join('').trimEnd()).join('\n')}`;
}

/** Fails the build when one figure's markup outgrows the budget. */
export function assertAsciiBudget(markups: readonly string[], source: string): void {
  const encoder = new TextEncoder();
  const bytes = markups.reduce((sum, markup) => sum + encoder.encode(markup).length, 0);
  if (bytes > ASCII_HTML_BUDGET) {
    throw new Error(
      `ASCII render of ${source} is ${bytes} bytes, over the ${ASCII_HTML_BUDGET}-byte budget: ` +
        'use a simpler image (fewer tone changes) or fewer columns',
    );
  }
}
