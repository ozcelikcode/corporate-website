/** Width of a running index (`01`, `[02]`): label indexes and rundown row numbers share it. */
const INDEX_DIGITS = 2;

export function padIndex(index: number): string {
  return String(index).padStart(INDEX_DIGITS, '0');
}
