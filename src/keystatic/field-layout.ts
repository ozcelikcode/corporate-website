/**
 * Column spans for `fields.object` `layout` (Keystatic's grid has 12 columns; below tablet width
 * every field goes full width). A layout needs one span per field, in field order, adding up to
 * a multiple of `GRID_COLUMNS`; `parity.test.ts` checks every object in the admin.
 */
export const GRID_COLUMNS = 12;
export const SPAN = {
  full: GRID_COLUMNS,
  half: GRID_COLUMNS / 2,
  third: GRID_COLUMNS / 3,
  twoThirds: (GRID_COLUMNS / 3) * 2,
} as const;
