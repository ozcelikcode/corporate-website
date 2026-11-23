import type { QuoteInput } from '../src/lib/quote-schema.ts';

/** Operator-facing text (sent to the operator's own inbox), exempt from the content rule. */
export const QUOTE_SUBJECT_PREFIX = 'Quote request';
export const QUOTE_LABELS = {
  name: 'Name',
  email: 'Email',
  company: 'Company',
  role: 'Role',
  country: 'Country',
  solutions: 'Solutions',
  timeline: 'Timeline',
  locale: 'Locale',
  message: 'Message',
} as const;

export type QuoteEmail = {
  from: string;
  to: string;
  quote: QuoteInput;
  date: Date;
  messageId: string;
};

const CRLF = '\r\n';
const HEADER_BREAK = /[\r\n]/;
const BARE_NEWLINE = /\r\n|\r|\n/g;
const NON_ASCII = /[^\x20-\x7e]/;
const BASE64_LINE = 76;
/** Source bytes per RFC 2047 encoded word: 36 bytes -> 48 base64 chars, so each header line stays short. */
const ENCODED_WORD_BYTES = 36;
const CONTINUATION_BITS = 0xc0;
const CONTINUATION_MARK = 0x80;
const SOLUTIONS_SEPARATOR = ', ';

const encoder = new TextEncoder();

/** `btoa` over a binary string: Workers have no `Buffer` without `nodejs_compat`. */
function base64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (let start = 0; start < text.length; start += width)
    lines.push(text.slice(start, start + width));
  return lines;
}

/** Splits UTF-8 bytes into chunks of at most `size` that never cut a code point. */
function utf8Chunks(text: string, size: number): Uint8Array[] {
  const bytes = encoder.encode(text);
  const chunks: Uint8Array[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + size, bytes.length);
    while (end < bytes.length && ((bytes[end] ?? 0) & CONTINUATION_BITS) === CONTINUATION_MARK) {
      end -= 1;
    }
    chunks.push(bytes.slice(start, end));
    start = end;
  }
  return chunks;
}

function encodeSubject(subject: string): string {
  if (!NON_ASCII.test(subject)) return subject;
  return utf8Chunks(subject, ENCODED_WORD_BYTES)
    .map((chunk) => `=?UTF-8?B?${base64(chunk)}?=`)
    .join(`${CRLF} `);
}

function assertHeaderValue(name: string, value: string): string {
  if (HEADER_BREAK.test(value)) throw new Error(`Line break in ${name} header`);
  return value;
}

function domainOf(address: string): string {
  return address.slice(address.lastIndexOf('@') + 1);
}

function bodyText(quote: QuoteInput): string {
  const lines = [
    `${QUOTE_LABELS.name}: ${quote.name}`,
    `${QUOTE_LABELS.email}: ${quote.email}`,
    `${QUOTE_LABELS.company}: ${quote.company}`,
    `${QUOTE_LABELS.role}: ${quote.role}`,
    `${QUOTE_LABELS.country}: ${quote.country}`,
    `${QUOTE_LABELS.solutions}: ${quote.solutions.join(SOLUTIONS_SEPARATOR)}`,
    `${QUOTE_LABELS.timeline}: ${quote.timeline}`,
    `${QUOTE_LABELS.locale}: ${quote.locale}`,
    '',
    `${QUOTE_LABELS.message}:`,
    quote.message,
  ];
  return lines.join(CRLF).replace(BARE_NEWLINE, CRLF);
}

/** RFC 5322 plain-text UTF-8 message, base64 body. Throws if a header value holds CR or LF. */
export function buildQuoteEmail(mail: QuoteEmail): string {
  const subject = assertHeaderValue('Subject', `${QUOTE_SUBJECT_PREFIX}: ${mail.quote.company}`);
  const headers = [
    `From: ${assertHeaderValue('From', mail.from)}`,
    `To: ${assertHeaderValue('To', mail.to)}`,
    `Reply-To: ${assertHeaderValue('Reply-To', mail.quote.email)}`,
    `Subject: ${encodeSubject(subject)}`,
    `Date: ${mail.date.toUTCString()}`,
    `Message-ID: <${assertHeaderValue('Message-ID', mail.messageId)}@${domainOf(mail.from)}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  const body = wrap(base64(encoder.encode(bodyText(mail.quote))), BASE64_LINE);
  return [...headers, '', ...body, ''].join(CRLF);
}
