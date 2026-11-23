import { DURATION_PATTERN } from './sections-schema.ts';

const UNITS = ['H', 'M', 'S'] as const;
const ZERO_LENGTH = 'PT0S';

/**
 * Rundown slot `HH:MM:SS` → ISO 8601 duration for `<time datetime>` (`00:01:30` → `PT1M30S`).
 * Zero units are left out; an all-zero slot is `PT0S`.
 */
export function durationToIso(duration: string): string {
  if (!DURATION_PATTERN.test(duration)) {
    throw new Error(`Duration "${duration}" must be HH:MM:SS`);
  }
  const parts = duration
    .split(':')
    .map((part, i) => (Number(part) === 0 ? '' : `${Number(part)}${UNITS[i]}`))
    .join('');
  return parts === '' ? ZERO_LENGTH : `PT${parts}`;
}
