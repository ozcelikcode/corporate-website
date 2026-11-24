/**
 * Link patterns shared by the Zod schemas (the build authority) and the Keystatic fields (the
 * admin), so an editor cannot save a link the build then refuses. Zod-free on purpose: the admin
 * bundle imports this module.
 */

/** A site path (never protocol-relative) or an https address: buttons and actions. */
export const ACTION_HREF_PATTERN = /^(\/(?![/\\])|https:\/\/)/;
/** Navigation links: a site path, an https address or a mailto: link. */
export const LINK_HREF_PATTERN = /^(\/(?![/\\])|https:\/\/|mailto:)/;
/** Contact links: mailto:, tel: or https. */
export const CONTACT_HREF_PATTERN = /^(mailto:|tel:|https:\/\/)/;
/** Social profile links: https. */
export const SOCIAL_HREF_PATTERN = /^https:\/\//;
/** Outbound links that leave the site (a logo's partner page, a brochure, the website): https. */
export const HTTPS_HREF_PATTERN = /^https:\/\/\S+$/;

/** `pattern` that also takes `''`: Keystatic checks a pattern on empty text, even when optional. */
export const optionalPattern = (pattern: RegExp) => new RegExp(`^$|${pattern.source}`);
