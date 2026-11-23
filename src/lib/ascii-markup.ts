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
 * One row's runs, without the row wrapper. Trailing blanks are dropped: the font size follows the
 * column count, not the line length. Shared with the client motion script, which rewrites rows.
 */
export function runsHtml(line: readonly AsciiRun[]): string {
  return line.map(runHtml).join('').trimEnd();
}

/**
 * Every row is its own span (an inline-block in AsciiImage), so a row can move on its own and the
 * motion script can rewrite it; a blank row is an empty span and keeps its line.
 */
export function asciiMarkup(grid: AsciiGrid): string {
  return grid.lines.map((line) => `<span>${runsHtml(line)}</span>`).join('\n');
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
