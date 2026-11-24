/**
 * Temporary content and prop types for the new blocks, until their schemas join the section
 * union (Task I1). Each content type has the shape `SectionOf<…>` will produce, and
 * `BlockPreviewProps` mirrors `BlockProps`, so I1 swaps the import and nothing else.
 */
import type { ImageMetadata } from 'astro';
import type { Locale } from '../../lib/i18n.ts';

/** On-air stat bar: 3–4 figures. */
export type StatsContent = {
  type: 'stats';
  label: string;
  items: { value: string; label: string; note?: string | undefined }[];
};

/** Logo wall: 4–12 raster logos; `href` is an https URL. */
export type LogosContent = {
  type: 'logos';
  label: string;
  heading: string;
  items: { image: ImageMetadata; alt: string; href?: string | undefined }[];
};

/** Every block the preview page renders. */
export type PreviewBlock = StatsContent | LogosContent;

export type BlockPreviewProps<T> = {
  section: T;
  index: number;
  locale: Locale;
  headingLevel: 2;
  localize: (href: string) => string;
};
