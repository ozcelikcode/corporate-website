/**
 * Build-time ASCII renderer: an image becomes a grid of glyph runs in 6 quantized tones.
 * Bright pixels get dense glyphs (the canvas is dark). Runs share one tone, so each
 * becomes a single `<span>` in AsciiImage. Pure except `renderAscii`, which reads a file.
 */
import sharp from 'sharp';

/** Sparse to dense. No HTML-special characters, so runs can be inlined as markup. */
export const ASCII_RAMP = ' .:-=+*#%@';
/** Tones map to `--color-tone-0…5`. */
export const TONE_COUNT = 6;
/** Glyph cell width ÷ height. Rows are scaled by it so the image keeps its aspect. */
export const CHAR_ASPECT = 0.5;
export const ASCII_COLUMNS = 96;

/** Byte range of one luma sample. */
const LUMA_LEVELS = 256;
const MAX_GLYPH = ASCII_RAMP.length - 1;
const MAX_TONE = TONE_COUNT - 1;
/** Transparent pixels turn black (dark canvas); flattening also drops the alpha channel. */
const FLATTEN_BACKGROUND = { r: 0, g: 0, b: 0 } as const;
const LUMA_CHANNELS = 1;

export type Tone = 0 | 1 | 2 | 3 | 4 | 5;
export type AsciiRun = { tone: Tone; text: string };
export type AsciiGrid = { cols: number; rows: number; lines: AsciiRun[][] };

export function gridRows(cols: number, width: number, height: number): number {
  return Math.max(1, Math.round(((cols * height) / width) * CHAR_ASPECT));
}

function glyphFor(luma: number): string {
  return ASCII_RAMP.charAt(
    Math.min(MAX_GLYPH, Math.floor((luma * ASCII_RAMP.length) / LUMA_LEVELS)),
  );
}

function toneFor(luma: number): Tone {
  return Math.min(MAX_TONE, Math.floor((luma * TONE_COUNT) / LUMA_LEVELS)) as Tone;
}

export function toAsciiGrid(luma: Uint8Array, cols: number, rows: number): AsciiGrid {
  if (luma.length !== cols * rows) {
    throw new Error(`ASCII luma has ${luma.length} samples, expected ${cols} × ${rows}`);
  }
  const lines: AsciiRun[][] = [];
  for (let y = 0; y < rows; y++) {
    const line: AsciiRun[] = [];
    for (let x = 0; x < cols; x++) {
      const value = luma[y * cols + x] ?? 0;
      const tone = toneFor(value);
      const glyph = glyphFor(value);
      const last = line.at(-1);
      if (last?.tone === tone) last.text += glyph;
      else line.push({ tone, text: glyph });
    }
    lines.push(line);
  }
  return { cols, rows, lines };
}

async function readAscii(filePath: string, cols: number): Promise<AsciiGrid> {
  // Camera uploads carry EXIF orientation: size and pixels both follow the upright image.
  const { autoOrient } = await sharp(filePath).metadata();
  const rows = gridRows(cols, autoOrient.width, autoOrient.height);
  const { data, info } = await sharp(filePath)
    .autoOrient()
    .resize(cols, rows, { fit: 'fill' })
    .flatten({ background: FLATTEN_BACKGROUND })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== LUMA_CHANNELS) {
    throw new Error(`ASCII source ${filePath} decoded to ${info.channels} channels, expected 1`);
  }
  return toAsciiGrid(new Uint8Array(data), cols, rows);
}

const cache = new Map<string, Promise<AsciiGrid>>();

/** Renders once per file and column count; a failed render is not cached. */
export function renderAscii(filePath: string, cols: number = ASCII_COLUMNS): Promise<AsciiGrid> {
  const key = `${filePath}@${cols}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = readAscii(filePath, cols);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}
