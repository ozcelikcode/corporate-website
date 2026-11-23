export type Rgb = { r: number; g: number; b: number };

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const MIN_ACCENT_CONTRAST = 3;
/** Mirrors `--color-canvas` in styles/tokens.css (guarded by color.test.ts). */
export const CANVAS_OKLCH = [0.17, 0.008, 255] as const;

const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_CHANNEL = 2;
const DEGREES_PER_HALF_TURN = 180;
// sRGB transfer function and WCAG relative-luminance constants.
const SRGB_LINEAR_CUTOFF = 0.0031308;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA = 2.4;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_DECODE_CUTOFF = 0.04045;
const LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;
const FLARE = 0.05;

export function parseHex(hex: string): Rgb {
  if (!HEX_PATTERN.test(hex)) throw new Error(`Invalid hex colour "${hex}": expected #rrggbb`);
  const channel = (index: number) =>
    Number.parseInt(
      hex.slice(1 + index * HEX_DIGITS_PER_CHANNEL, 3 + index * HEX_DIGITS_PER_CHANNEL),
      HEX_RADIX,
    );
  return { r: channel(0), g: channel(1), b: channel(2) };
}

function encodeChannel(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const gamma =
    clamped <= SRGB_LINEAR_CUTOFF
      ? clamped * SRGB_LINEAR_SLOPE
      : SRGB_SCALE * clamped ** (1 / SRGB_GAMMA) - SRGB_OFFSET;
  return Math.round(gamma * CHANNEL_MAX);
}

/** OKLCH to gamut-clamped sRGB, using Björn Ottosson's OKLab matrices. */
export function oklchToSrgb(l: number, c: number, h: number): Rgb {
  const hue = (h * Math.PI) / DEGREES_PER_HALF_TURN;
  const a = c * Math.cos(hue);
  const b = c * Math.sin(hue);
  const lp = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mp = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sp = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: encodeChannel(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp),
    g: encodeChannel(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp),
    b: encodeChannel(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp),
  };
}

function decodeChannel(value: number): number {
  const unit = value / CHANNEL_MAX;
  return unit <= SRGB_DECODE_CUTOFF
    ? unit / SRGB_LINEAR_SLOPE
    : ((unit + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_GAMMA;
}

function luminance({ r, g, b }: Rgb): number {
  return LUMA.r * decodeChannel(r) + LUMA.g * decodeChannel(g) + LUMA.b * decodeChannel(b);
}

/** WCAG 2 contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + FLARE) / ((dark ?? 0) + FLARE);
}

export function accentContrast(hex: string): number {
  return contrastRatio(parseHex(hex), oklchToSrgb(...CANVAS_OKLCH));
}
