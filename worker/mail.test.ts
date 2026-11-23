import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { QuoteInput } from '../src/lib/quote-schema.ts';
import { buildQuoteEmail, type QuoteEmail } from './mail.ts';

const QUOTE: QuoteInput = {
  name: 'Ada Visitor',
  email: 'visitor@example.org',
  company: 'Şirket',
  role: 'Engineer',
  country: 'Türkiye',
  solutions: ['archive-search', 'general'],
  timeline: 'half-year',
  message: `${'Mesaj çok uzun bir satır. '.repeat(20)}\nSecond line`,
  consent: 'on',
  locale: 'tr',
};

const MAIL: QuoteEmail = {
  from: 'quote@example.com',
  to: 'inbox@example.com',
  quote: QUOTE,
  date: new Date('2026-11-23T10:00:00Z'),
  messageId: 'id-1',
};

function split(raw: string): { head: string; body: string } {
  const [head = '', ...rest] = raw.split('\r\n\r\n');
  return { head, body: rest.join('\r\n\r\n') };
}

function decodeBody(raw: string): string {
  return Buffer.from(split(raw).body.replaceAll('\r\n', ''), 'base64').toString('utf8');
}

test('uses CRLF only and carries the required headers', () => {
  const raw = buildQuoteEmail(MAIL);
  assert.equal(/(?<!\r)\n/.test(raw), false);
  for (const header of [
    'From: quote@example.com',
    'To: inbox@example.com',
    'Reply-To: visitor@example.org',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ]) {
    assert.ok(split(raw).head.split('\r\n').includes(header), header);
  }
});

test('Date and Message-ID follow the inputs', () => {
  const lines = split(buildQuoteEmail(MAIL)).head.split('\r\n');
  assert.ok(lines.includes('Date: Mon, 23 Nov 2026 10:00:00 GMT'));
  assert.ok(lines.includes('Message-ID: <id-1@example.com>'));
});

test('a non-ASCII company is RFC 2047 encoded in the Subject', () => {
  const head = split(buildQuoteEmail(MAIL)).head.replaceAll('\r\n ', '');
  const subject = head.split('\r\n').find((line) => line.startsWith('Subject: ')) ?? '';
  const words = [...subject.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)];
  assert.ok(words.length > 0);
  const decoded = words.map((w) => Buffer.from(w[1] ?? '', 'base64').toString('utf8')).join('');
  assert.ok(decoded.includes('Şirket'));
});

test('a long non-ASCII subject stays within 76 characters per header line', () => {
  const long = { ...MAIL, quote: { ...QUOTE, company: 'ş'.repeat(120) } };
  for (const line of split(buildQuoteEmail(long)).head.split('\r\n')) {
    assert.ok(line.length <= 76, line);
  }
});

test('the decoded body holds the message, solutions and timeline; lines are at most 76', () => {
  const raw = buildQuoteEmail(MAIL);
  const decoded = decodeBody(raw);
  assert.ok(decoded.includes('Second line'));
  assert.ok(decoded.includes('archive-search, general'));
  assert.ok(decoded.includes('half-year'));
  for (const line of split(raw).body.split('\r\n')) assert.ok(line.length <= 76);
});

test('a header value containing CR or LF throws', () => {
  assert.throws(() => buildQuoteEmail({ ...MAIL, from: 'a@example.com\r\nBcc: x@y.z' }));
  assert.throws(() => buildQuoteEmail({ ...MAIL, quote: { ...QUOTE, email: 'a@b.co\nBcc: x' } }));
  assert.throws(() => buildQuoteEmail({ ...MAIL, messageId: 'x\r\ny' }));
});
