/**
 * The quote form contract, shared by the page (HTML `maxlength`, option values, panel ids) and the
 * Worker (validation, redirect targets). Imports only `astro/zod` and `i18n.ts`, so the Worker can
 * bundle it.
 */
import { z } from 'astro/zod';
import { LOCALES } from './i18n.ts';

/** Max length per field, in UTF-16 code units (what `maxlength` counts). */
export const QUOTE_LIMITS = {
  name: 100,
  email: 254,
  company: 120,
  role: 80,
  country: 80,
  message: 2000,
  /** Turnstile response token; checked by the Worker, never part of `quoteSchema`. */
  token: 2048,
} as const;

/** Upper bound on checked solutions: every application plus `general`, with headroom. */
export const MAX_SOLUTIONS = 16;

export const TIMELINES = ['asap', 'quarter', 'half-year', 'exploring'] as const;
export type Timeline = (typeof TIMELINES)[number];

/** Solution value for a general enquiry; reserved, so no application may use it as its slug. */
export const GENERAL_SOLUTION = 'general';

/** Outcomes of a submission; each is a `:target` panel id on the quote page. */
export const QUOTE_STATES = ['sent', 'error-invalid', 'error-verify', 'error-send'] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];

/** Hidden field the Turnstile widget adds to the form. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

const SOLUTIONS_FIELD = 'solutions';
const LINE_BREAK = /[\r\n]/;
const CRLF = /\r\n?/g;
const LF = '\n';
const REQUIRED = 1;

/** Trimmed, single line (CR/LF would allow mail header injection). */
function singleLine(max: number, min = 0) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !LINE_BREAK.test(value), { message: 'Must be a single line' });
}

export const quoteSchema = z.object({
  name: singleLine(QUOTE_LIMITS.name, REQUIRED),
  email: z.string().trim().pipe(z.email().max(QUOTE_LIMITS.email)),
  company: singleLine(QUOTE_LIMITS.company, REQUIRED),
  role: singleLine(QUOTE_LIMITS.role),
  country: singleLine(QUOTE_LIMITS.country),
  solutions: z.array(z.string()).min(REQUIRED).max(MAX_SOLUTIONS),
  timeline: z.enum(TIMELINES),
  // Browsers submit textarea line breaks as CRLF but `maxlength` counts each as one character.
  message: z
    .string()
    .overwrite((value) => value.replace(CRLF, LF))
    .trim()
    .min(REQUIRED)
    .max(QUOTE_LIMITS.message),
  consent: z.literal('on'),
  locale: z.enum(LOCALES),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

/**
 * Plain object for `quoteSchema.safeParse`: `solutions` keeps every value, any other field its
 * first one. The Turnstile token is left out (the Worker reads it separately). `Object.fromEntries`
 * defines own properties, so a field named `__proto__` cannot reach the prototype.
 */
export function formDataToInput(form: FormData): Record<string, unknown> {
  const fields = [...new Set(form.keys())].filter(
    (key) => key !== SOLUTIONS_FIELD && key !== TURNSTILE_FIELD,
  );
  return Object.fromEntries([
    [SOLUTIONS_FIELD, form.getAll(SOLUTIONS_FIELD)],
    ...fields.map((key) => [key, form.get(key)]),
  ]);
}
