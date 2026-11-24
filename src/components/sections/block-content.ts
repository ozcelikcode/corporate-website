/**
 * Temporary content and prop types for the new blocks, until their schemas join the section
 * union (Task I1). Each content type has the shape `SectionOf<…>` will produce, and
 * `BlockPreviewProps` mirrors `BlockProps`, so I1 swaps the import and nothing else.
 */
import type { ImageMetadata } from 'astro';
import type { Locale } from '../../lib/i18n.ts';
import type { Action } from '../../lib/sections-schema.ts';

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

/** Pull-quote with a name strap; the portrait is decorative (the strap names the person). */
export type TestimonialContent = {
  type: 'testimonial';
  quote: string;
  name: string;
  role: string;
  organization: string;
  portrait?: ImageMetadata | undefined;
};

/** Image beside Markdown text; `reverse` puts the image first. */
export type MediaSplitContent = {
  type: 'media-split';
  label: string;
  heading: string;
  text: string;
  image: ImageMetadata;
  imageAlt: string;
  action?: Action | undefined;
  reverse: boolean;
};

/** Every block the preview page renders. */
export type PreviewBlock = StatsContent | LogosContent | TestimonialContent | MediaSplitContent;

export type BlockPreviewProps<T> = {
  section: T;
  index: number;
  locale: Locale;
  headingLevel: 2;
  localize: (href: string) => string;
};
