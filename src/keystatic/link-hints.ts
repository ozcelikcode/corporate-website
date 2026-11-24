/**
 * Editor guidance and checks for link fields (Keystatic drops YAML comments on save, so guidance
 * lives here). Links are written once as English site paths; `localizeHref` points Turkish pages
 * at the `/tr/` URL of every page or application that has one. The patterns are the ones Zod
 * enforces at build (`lib/link-patterns.ts`), so the admin refuses what the build would.
 */
import {
  ACTION_HREF_PATTERN,
  CONTACT_HREF_PATTERN,
  HTTPS_HREF_PATTERN,
  LINK_HREF_PATTERN,
  optionalPattern,
  SOCIAL_HREF_PATTERN,
} from '../lib/link-patterns.ts';

export const LINK_HINT =
  'An English site path such as /about/, even in Turkish content (Turkish pages link the /tr/ version wherever one exists), or an https:// address.';

/** Shown under an optional group whose fields only make sense together. */
export const ALL_OR_NONE_HINT = 'Fill all fields or leave all empty.';

const HTTPS_MESSAGE = 'Use an https:// address';

const LINK_RULES = {
  action: {
    regex: ACTION_HREF_PATTERN,
    message: 'Use a site path such as /about/ or an https:// address',
  },
  nav: {
    regex: LINK_HREF_PATTERN,
    message: 'Use a site path such as /about/, an https:// address or a mailto: link',
  },
  contact: { regex: CONTACT_HREF_PATTERN, message: 'Use a mailto:, tel: or https:// link' },
  social: { regex: SOCIAL_HREF_PATTERN, message: HTTPS_MESSAGE },
  https: { regex: HTTPS_HREF_PATTERN, message: HTTPS_MESSAGE },
} as const;

export type LinkRule = keyof typeof LINK_RULES;

/** The `validation.pattern` of a link field; an optional field also takes `''`. */
export function linkPattern(rule: LinkRule, optional = false) {
  const { regex, message } = LINK_RULES[rule];
  return { regex: optional ? optionalPattern(regex) : regex, message };
}
