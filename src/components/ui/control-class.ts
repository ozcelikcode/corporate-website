/**
 * The one border style shared by Input, Textarea and Select. `line-strong` reaches 3:1 against
 * both canvas and surface (WCAG 1.4.11); focus uses the global outline. `critical` marks a
 * control only after the visitor has interacted with it (`:user-invalid`).
 */
export const CONTROL_CLASS =
  'block min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-ink-muted user-invalid:border-critical';
