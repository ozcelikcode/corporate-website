/**
 * Keystatic singletons: site settings, navigation and UI strings per locale, stored as YAML in the
 * existing content paths. Keystatic refuses to open a file with a key it does not model, so these
 * fields mirror the Zod schemas key for key (`parity.test.ts`); Zod stays the build authority.
 */
import { fields, singleton } from '@keystatic/core';
import { HEX_PATTERN } from '../lib/color.ts';
import { type Locale, UI_KEYS } from '../lib/i18n.ts';
import { LINK_HINT } from './link-hints.ts';
import { LOCALE_NAMES } from './locale-names.ts';

/**
 * Mirrors `NAV_CHILDREN_MAX` (`lib/navigation-schema.ts`), which is not imported because that
 * module would pull Zod into the admin bundle; `parity.test.ts` checks the two agree.
 */
export const NAV_CHILDREN_LIMIT = 6;
const UPLOADS_DIRECTORY = 'src/assets/uploads';
/** Upload folder as seen from `src/content/settings/site.yaml` (what Astro `image()` resolves). */
const SETTINGS_UPLOADS_PUBLIC_PATH = '../../assets/uploads/';

const required = { isRequired: true } as const;

/** A labelled link; `hint` explains what the link may point at. */
const linkFields = (hint: string) =>
  fields.object({
    label: fields.text({ label: 'Label', validation: required }),
    href: fields.text({ label: 'Link', description: hint, validation: required }),
  });

const settingsImage = (label: string) =>
  fields.image({
    label,
    directory: UPLOADS_DIRECTORY,
    publicPath: SETTINGS_UPLOADS_PUBLIC_PATH,
    validation: required,
  });

const settings = singleton({
  label: 'Site settings',
  path: 'src/content/settings/site',
  format: 'yaml',
  schema: {
    brandName: fields.text({ label: 'Brand name', validation: required }),
    logo: settingsImage('Logo'),
    logoAlt: fields.text({ label: 'Logo alt text', validation: required }),
    accent: fields.text({
      label: 'Accent colour',
      description: 'Six-digit hex such as #ffb000; needs 3:1 contrast on the dark canvas.',
      validation: { pattern: { regex: HEX_PATTERN, message: 'Use a hex colour such as #ffb000' } },
    }),
    contacts: fields.array(
      fields.object({
        kind: fields.select({
          label: 'Kind',
          options: [
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
            { label: 'Address', value: 'address' },
          ],
          defaultValue: 'email',
        }),
        value: fields.text({ label: 'Shown text', validation: required }),
        href: fields.text({
          label: 'Link',
          description: 'mailto:, tel: or https://',
          validation: required,
        }),
      }),
      {
        label: 'Contacts',
        description: 'At least one email contact.',
        itemLabel: (props) => props.fields.value.value,
        validation: { length: { min: 1 } },
      },
    ),
    socials: fields.array(linkFields('An https:// address.'), {
      label: 'Social links',
      itemLabel: (props) => props.fields.label.value,
    }),
    ogImage: settingsImage('Default social image (PNG, JPEG or WebP)'),
    organization: fields.object(
      {
        legalName: fields.text({ label: 'Legal name', validation: required }),
        url: fields.text({ label: 'Website (https)', validation: required }),
        address: fields.text({ label: 'Address' }),
      },
      { label: 'Organization' },
    ),
  },
});

const navigationSingleton = (locale: Locale) =>
  singleton({
    label: `Navigation (${LOCALE_NAMES[locale]})`,
    path: `src/content/navigation/${locale}/main`,
    format: 'yaml',
    schema: {
      header: fields.array(
        fields.object({
          label: fields.text({ label: 'Label', validation: required }),
          href: fields.text({
            label: 'Link',
            description: `${LINK_HINT} Leave empty for a menu-only parent (needs children or a source).`,
          }),
          source: fields.select({
            label: 'Submenu source',
            options: [
              { label: 'Children below (or none)', value: '' },
              { label: 'All applications', value: 'applications' },
            ],
            defaultValue: '',
          }),
          children: fields.array(
            fields.object({
              label: fields.text({ label: 'Label', validation: required }),
              href: fields.text({
                label: 'Link',
                description: LINK_HINT,
                validation: required,
              }),
              description: fields.text({ label: 'Description' }),
            }),
            {
              label: 'Children',
              description: 'Not together with the applications source.',
              itemLabel: (props) => props.fields.label.value,
              validation: { length: { max: NAV_CHILDREN_LIMIT } },
            },
          ),
          feature: fields.object(
            {
              heading: fields.text({ label: 'Heading' }),
              text: fields.text({ label: 'Text', multiline: true }),
              action: fields.object(
                {
                  label: fields.text({ label: 'Button label' }),
                  href: fields.text({ label: 'Button link', description: LINK_HINT }),
                },
                { label: 'Button' },
              ),
            },
            {
              label: 'Feature card',
              description: 'Optional; leave every field empty for none. Needs a submenu.',
            },
          ),
        }),
        {
          label: 'Header',
          itemLabel: (props) => props.fields.label.value,
          validation: { length: { min: 1 } },
        },
      ),
      footer: fields.array(linkFields(LINK_HINT), {
        label: 'Footer',
        itemLabel: (props) => props.fields.label.value,
      }),
    },
  });

/** EN must define every key; TR may leave any key empty to fall back to EN. */
const uiSingleton = (locale: Locale) =>
  singleton({
    label: `Interface strings (${LOCALE_NAMES[locale]})`,
    path: `src/content/ui/${locale}/strings`,
    format: 'yaml',
    schema: Object.fromEntries(
      UI_KEYS.map((key) => [
        key,
        fields.text({ label: key, validation: { isRequired: locale === 'en' } }),
      ]),
    ),
  });

export const singletons = {
  settings,
  navigationEn: navigationSingleton('en'),
  navigationTr: navigationSingleton('tr'),
  uiEn: uiSingleton('en'),
  uiTr: uiSingleton('tr'),
};
