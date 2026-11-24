/**
 * One-line labels for list rows in the admin, so two blocks of one type can be told apart:
 * "<Type> · <first meaningful text>", cut to `ITEM_LABEL_MAX` characters.
 */
export const ITEM_LABEL_MAX = 60;
const SEPARATOR = ' · ';
const ELLIPSIS = '…';

/** The type name alone when `text` is empty; text is collapsed to one line and cut to fit. */
export function itemLabel(type: string, text: string | null | undefined): string {
  const line = (text ?? '').replace(/\s+/g, ' ').trim();
  if (line === '') return type;
  const label = `${type}${SEPARATOR}${line}`;
  return label.length <= ITEM_LABEL_MAX
    ? label
    : `${label.slice(0, ITEM_LABEL_MAX - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}
