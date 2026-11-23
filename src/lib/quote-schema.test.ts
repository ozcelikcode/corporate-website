import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMAIL_INPUT_PATTERN,
  formDataToInput,
  QUOTE_LIMITS,
  QUOTE_STATES,
  quoteSchema,
  TIMELINES,
  TURNSTILE_FIELD,
} from './quote-schema.ts';

const valid = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  company: 'Example Broadcast',
  role: 'Chief engineer',
  country: 'United Kingdom',
  solutions: ['newsroom-desk', 'general'],
  timeline: 'quarter',
  message: 'We run two studios and need a new playout chain.',
  consent: 'on',
  locale: 'en',
};

test('accepts a complete submission', () => {
  assert.ok(quoteSchema.safeParse(valid).success);
});

test('single-line fields reject CR/LF (header injection)', () => {
  assert.ok(!quoteSchema.safeParse({ ...valid, name: 'A\r\nBcc: x@example.com' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, company: 'A\nB' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, role: 'A\rB' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, country: 'A\nB' }).success);
  assert.ok(
    !quoteSchema.safeParse({ ...valid, email: 'ada@example.com\r\nBcc: x@example.com' }).success,
  );
});

test('the message is multi-line and capped', () => {
  assert.ok(quoteSchema.safeParse({ ...valid, message: 'line 1\nline 2' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, message: 'x'.repeat(2001) }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, message: '   ' }).success);
});

test('browser CRLF line breaks count once against the message limit', () => {
  // `maxlength` counts a line break as one character; the submitted value carries CRLF.
  const lines = 'ş\r\n'.repeat(QUOTE_LIMITS.message / 2);
  const parsed = quoteSchema.safeParse({ ...valid, message: lines });
  assert.ok(parsed.success);
  assert.ok(!parsed.data.message.includes('\r'));
});

test('enums, consent and solutions are enforced', () => {
  assert.ok(!quoteSchema.safeParse({ ...valid, timeline: 'soon' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, consent: undefined }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, consent: 'yes' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, solutions: [] }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, solutions: Array(17).fill('general') }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, locale: 'de' }).success);
  for (const timeline of TIMELINES) {
    assert.ok(quoteSchema.safeParse({ ...valid, timeline }).success);
  }
});

test('role and country are optional, the rest is required', () => {
  assert.ok(quoteSchema.safeParse({ ...valid, role: '', country: '' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, name: '  ' }).success);
  assert.ok(!quoteSchema.safeParse({ ...valid, company: '' }).success);
});

test('email must be an address within the limit', () => {
  assert.ok(!quoteSchema.safeParse({ ...valid, email: 'not-an-email' }).success);
  assert.ok(quoteSchema.safeParse({ ...valid, email: ' ada@example.com ' }).success);
  const long = `${'a'.repeat(QUOTE_LIMITS.email)}@example.com`;
  assert.ok(!quoteSchema.safeParse({ ...valid, email: long }).success);
});

test('every single-line limit is enforced at its maximum', () => {
  const fields = ['name', 'company', 'role', 'country'] as const;
  for (const field of fields) {
    const max = QUOTE_LIMITS[field];
    assert.ok(quoteSchema.safeParse({ ...valid, [field]: 'ğ'.repeat(max) }).success, field);
    assert.ok(!quoteSchema.safeParse({ ...valid, [field]: 'ğ'.repeat(max + 1) }).success, field);
  }
});

test('formDataToInput collects solutions and drops the Turnstile token', () => {
  const fd = new FormData();
  fd.append('solutions', 'a');
  fd.append('solutions', 'b');
  fd.append(TURNSTILE_FIELD, 't');
  assert.deepEqual(formDataToInput(fd).solutions, ['a', 'b']);
  assert.ok(!(TURNSTILE_FIELD in formDataToInput(fd)));
});

test('formDataToInput output parses for a full form', () => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(valid)) {
    if (Array.isArray(value)) for (const item of value) fd.append(key, item);
    else fd.append(key, value);
  }
  assert.ok(quoteSchema.safeParse(formDataToInput(fd)).success);
  assert.deepEqual(formDataToInput(new FormData()).solutions, []);
});

test('status states are the four panel ids', () => {
  assert.deepEqual(QUOTE_STATES, ['sent', 'error-invalid', 'error-verify', 'error-send']);
});

test('formDataToInput keeps a `__proto__` field as an own property', () => {
  const fd = new FormData();
  fd.append('__proto__', 'x');
  const input = formDataToInput(fd);
  assert.equal(Object.getPrototypeOf(input), Object.prototype);
  assert.ok(Object.hasOwn(input, '__proto__'));
});

test('the email input pattern mirrors the schema on the dot in the domain', () => {
  // Browsers anchor `pattern` and compile it with the `v` flag.
  const pattern = new RegExp(`^(?:${EMAIL_INPUT_PATTERN})$`, 'v');
  for (const email of ['ada@example.com', 'a.b@mail.example.co.uk']) {
    assert.ok(pattern.test(email), email);
    assert.ok(quoteSchema.safeParse({ ...valid, email }).success, email);
  }
  for (const email of ['ada@localhost', 'ada@example']) {
    assert.ok(!pattern.test(email), email);
    assert.ok(!quoteSchema.safeParse({ ...valid, email }).success, email);
  }
});
