# System Patterns

## Folder architecture (condensed)
```
.
├─ CLAUDE.md  memory-bank/  .claude/skills/team-delegation/SKILL.md
├─ docs/superpowers/specs/        # spec + plans
├─ .github/CODEOWNERS
├─ astro.config.ts wrangler.jsonc biome.json tsconfig.json package.json .nvmrc
├─ public/  _headers  favicon.svg  admin/config.yml  (admin page: src/pages/admin/index.astro)
├─ src/
│  ├─ content.config.ts           # all collections (glob loader + lib/content-schemas.ts)
│  ├─ content/  settings/ ui/{en,tr}/ navigation/{en,tr}/ pages/{en,tr}/ applications/{en,tr}/
│  ├─ assets/   fonts/ uploads/
│  ├─ styles/   tokens.css (@theme) global.css
│  ├─ lib/      i18n localize-href content content-schemas sections-schema blank page-slugs markdown seo ascii color quote-schema
│  ├─ layouts/  BaseLayout.astro
│  ├─ components/ ui/ sections/ layout/ pages/
│  └─ pages/    [...slug] applications/[slug] quote 404 robots.txt.ts tr/ (thin wrappers)
└─ worker/      index quote turnstile mail headers (+ tsconfig.json)
```

## Naming and structure
- Component files PascalCase (`AppGrid.astro`); everything else kebab-case.
- One component per file, one responsibility per file.
- Route files only delegate to `components/pages/`; TR routes are wrappers of at most 5 lines passing `locale="tr"`.
- Constants are named and sit at the top of the owning file.

## Content model
- YAML, one folder per locale; entry ids `<locale>/<slug>`; `home` maps to `/`.
- `settings` singleton: brandName, logo+logoAlt, accent (`#rrggbb`, contrast >= 3:1), contacts[], socials[], ogImage, organization.
- `ui`: keyed strings (TR may be partial, falls back to EN). `navigation`: schema in `lib/navigation-schema.ts`; header[] items take `children` (max 6, limit error names the item), `source: applications` (auto list, max 8, tagline as description) and an optional `feature`; footer[] (default `[]`) of {label, href}. `optionalObjectField` (`lib/blank.ts`) handles Keystatic `{}`. Hero `actions` defaults to `[]` (max 2). Lists that may be left out (`settings.socials`, `navigation.footer`, hero `actions`, app-grid `apps`) go through `listField` (`lib/blank.ts`, I1 fix M2): missing, `null` or blank parse as `[]`, a set list still validates.
- `pages`: title, description, ogImage?, sections[]. `applications`: name, slug, tagline, summary, category, cover+coverAlt, status, order, links[]?, brochure? (R2 URL), sections[].
- Section block union in `src/lib/sections-schema.ts` (discriminated on `type`): `hero`, `statement`, `app-grid`, `feature-list`, `rich-text`, `cta`, `faq`. Shared by pages and applications. `SectionRenderer` uses an exhaustive switch.
- All schemas are `z.strictObject` (unknown keys fail the build). Entry schemas live in `lib/content-schemas.ts` (tested, no Astro runtime); `content.config.ts` only wires loaders.
- Blank CMS values (final fix wave): every optional field goes through `optionalField` (`lib/blank.ts`): `""`, whitespace-only and `null` parse as absent (`ogImage`, `organization.address`, `links`, `brochure`, feature-list `duration`, cta `text`). `uiSchema` drops blank strings before validation (`withoutBlankValues`), so a cleared TR string falls back to EN; a cleared EN string is reported as missing by `getUiDictionary`.
- Page slugs (`lib/page-slugs.ts`): `QUOTE_SLUG`, `NOT_FOUND_SLUG` (shared by QuotePage, NotFoundPage, BaseLayout, `localize-href`); `RESERVED_PAGE_SLUGS` (`quote`, `not-found`: valid pages with their own route, `isOwnRoutePage`) and `FORBIDDEN_PAGE_SLUGS` (`admin`, `api`, every locale code: `assertPageSlug` fails the build naming the slug, called from `listTranslatedPages`). Two lists because the first are legal entries and the second never are.
- Hero image: `resolveUploadPath` throws on anything but PNG/JPEG/WebP, naming the file; the CMS hero field has `accept: "image/png,image/jpeg,image/webp"`.
- Entry ids come from the file path via `generateId`: `<locale>/<slug>` (settings `site`, ui `<locale>/strings`, navigation `<locale>/main`). An application's `slug` field never sets the id; `assertSlugMatches` fails the build on mismatch.
- Internal href pattern `^\/(?![\/\\])`: rejects protocol-relative `//host` and a backslash after the leading slash. Used by `actionSchema` and `LINK_HREF_PATTERN`.
- Fallback: `resolveLocalized` returns TR if present, else EN. `mergeByLocale` yields one entry per EN slug (sorted by `order`, then slug) and throws on a TR entry with no EN twin (`assertEnglishTwins`). `getPage` throws if EN is missing. Untranslated TR links point to EN URLs.
- Content hrefs (I1 fix): written once as EN site paths in every locale (TR seeds too: `/quote/`, `/`) and localized at render time. `localizeHref(href, locale, localized)` (`lib/localize-href.ts`, pure, tested): default locale unchanged; a site path whose trailing-slash form is in `localized` becomes `/<locale><path>/` keeping `?query#hash`; external, `mailto:`, `tel:`, fragment-only, `//host`, `/api/`, `/admin/`, `/_astro/` and locale-prefixed paths unchanged; untranslated targets keep the EN URL (Review Focus 2). `localizedPathSet(pageSlugs, applicationSlugs)`: translated pages (not `not-found`) and applications plus `/quote/` (every locale builds it). `hrefLocalizer(locale)` (`content.ts`) builds the set from `listTranslatedPages` + `listTranslatedApplications` and returns `(href) => string`; cheap (`getCollection` is cached), so BaseLayout (logo `homeHref`, quote key, header, menu and footer nav; the language toggle keeps `toggleTarget`), SectionRenderer (passed to blocks as `localize`) and ApplicationPage (its `links`) each build one per render. Button stays content-free (callers pass localized hrefs). Translating a page needs no navigation edit.
- `UI_KEYS` (50 since the final fix wave) lives in `lib/i18n.ts`: EN ui must be exhaustive, TR may be partial. `i18n.test.ts` checks the seed files: EN keys equal `UI_KEYS`, TR keys are a subset.
- `durationToIso` (`lib/duration.ts`, tested): `00:01:30` → `PT1M30S` for `<time datetime>`.
- `feature-list` items take an optional `duration` (`DURATION_PATTERN` `^\d{2}:[0-5]\d:[0-5]\d$`, display only, quoted in YAML so it never parses as a sexagesimal number); the CMS field carries the same pattern (checked by `admin-config.test.ts`).
- `settings.accent` is checked by `accentContrast` (`lib/color.ts`): >= 3:1 against canvas.
- Seed slugs: EN pages `home about contact privacy applications quote not-found`; TR page `home`; applications `newsroom-desk playout-control archive-search`.
- Markdown is sanitized in `lib/markdown.ts` (remark plugin `remarkSafeContent`): raw HTML nodes are dropped; link/image/definition URLs must be `/…` (not `//` or `/\`), `https:`, `mailto:`, `tel:` or `#…`, else the build fails with `Unsafe URL in Markdown (section …)`. Checked after removing tab/newline/edge control chars, case-insensitively.
- Markdown rendered by `@astrojs/markdown-remark` via `lib/markdown.ts`: `renderMarkdown(source, idPrefix, rewriteHref)` (every anchor href in the output, Markdown and raw `<a>`, goes through `rewriteHref`, the block's `localize`; done on the serialized HTML because raw HTML is parsed after user rehype plugins, and the serializer double-quotes every value), one memoized processor, `syntaxHighlight: false`, one inline rehype plugin: h1 → h2 (ATX, setext and raw `<h1>`; raw tags are rewritten in the raw node text because user rehype plugins run before `rehype-raw`), heading ids `<idPrefix>-<n>` (Astro's slug ids cannot be turned off but keep a preset id). The prefix travels in the render `frontmatter` slot. Blocks pass `sectionIdPrefix(index)` (`section-N`, FAQ `section-N-<item>`).
- `sectionsSchema` refines the list: a hero only at position 1 and at most one (messages name the position).
- `app-grid` with empty `apps` lists all applications by `order`.

## Design tokens (Task 2, `src/styles/tokens.css` + `global.css`)
- Single dark theme (`color-scheme: dark`), like a monitor wall. `global.css` does `@import "tailwindcss" source("../")` (scans `src/` only) then `tokens.css`.
- Reset to `initial` first: `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--font-*`, `--text-*`, plus `--text-shadow-*` (not covered by `--text-*`) and `--animate-*`. Radius/elevation utilities do not exist, except Tailwind's static `rounded-full`/`rounded-none` (guard grep catches any `rounded`).
- Colours (OKLCH): canvas `0.17 0.008 255`, surface `0.21 0.008 255`, ink `0.95 0.005 255`, ink-muted `0.74 0.01 255`, line `0.32 0.01 255` (decorative grid only), line-strong `0.52 0.012 255` (control borders), critical `0.70 0.17 30`.
- `accent` = `var(--accent-seed)` (default `oklch(0.80 0.16 75)` on `:root`; BaseLayout overrides on `<html>`). `accent-dim` = 55 %, `accent-wash` = 12 % accent on canvas, mixed **in oklab** (oklch mixing swings the hue toward canvas hue 255: amber turned green).
- `tone-0…5` (ASCII, Task 7): duotone ramp canvas → accent → ink, luminance rising every step: accent 25 % on canvas, accent-dim, accent 80 % on canvas, accent, accent 50 % on ink, ink (oklab). Default accent on canvas: 1.56 / 3.46 / 6.57 / 10.4 / 13.2 / 16.5 (at the 78 % shimmer floor 1.37 / 2.51 / 4.35 / 6.57 / 8.24 / 10.2). The old ramp put accent-dim (3.5) above ink (16.5), so light greys rendered darker than mid greys.
- `bars-white … bars-blue`: SMPTE 75% bars as `rgb(75% …)`; documented exception to the accent-only rule, used only by `BarsStrip`/`NoSignal` (via `ui/bar-tones.ts`; guard grep).
- Measured on canvas (default accent): ink 16.5, ink-muted 8.3, line-strong 3.45 (3.19 on surface), accent 10.0, accent-dim 3.35, critical 6.6, line 1.5.
- `tracking-display` -0.02em (display headings); `tracking-label` 0.12em (signal face only); `tracking-label-sans` 0.02em.
- Type (refined 2026-11-23, owner: headings too big): `text-label` 0.75rem/1.4, `text-body` clamp(1rem…1.125rem)/1.55, `text-lede` clamp(1.125…1.375rem)/1.45, `text-h3` clamp(1.25…1.5rem)/1.2, `text-h2` clamp(1.5…1.875rem)/1.15, `text-quote` clamp(1.375…2rem)/1.3 (statement pull-quote, `max-w-quote` = `--container-quote` 32ch), `text-display` clamp(2.25rem, min(1.6rem + 2.8vw, 2rem + 3.5svh), 4rem)/1.02 (the height cap keeps the hero inside short laptop screens; its rem part keeps text zoom working: 57.2px → 87px at 200% text zoom, 1280×720; was 2.5…5.5rem/0.98). Heading sizes follow the level (`LEVEL_SIZE`: h1 display, h2 h2, h3 h3; FeatureList h3 uses `text-h3` too); `tracking-label` 0.12em; `font-sans`/`font-mono` via `@theme inline` → `--font-grotesk`/`--font-martian`. Fluid body size sits on `body` (not `html`) so rem stays 16px.
- Other: `--spacing` 0.25rem, `max-w-page` (`--container-page` 90rem), `max-w-measure` (`--container-measure` 60ch: ledes and rundown bodies). Plain vars on `:root` (no utilities): `--border-hairline` 1px, `--border-focus` 0.125rem, `--ink-band` (6 % ink, translucent: lower thirds and prose quotes), `--header-bar` (spacing×16, SiteHeader and MobileNav bar), `--tally-bar` (spacing×11, TallyStrip), `--masthead` (both + hairline), `--first-screen` (`100svh - --masthead`, hero band), `--hero-pad` (spacing×6), `--hero-lift` (5% of the first screen), `--hero-pad-end` (pad + 2×lift: optical centring), `--hero-bleed` (`clamp(0, (100vw - container-page)/2, 10rem)`); breakpoint `wide` 90rem (`--breakpoint-wide`, = `--container-page`), `--z-header/popover` 10/20, `--duration-fast/base` 120/240ms, `--ease-signal` cubic-bezier(0.2, 0, 0, 1).
- Base: canvas bg, ink text; `:focus-visible` = `--border-focus` solid accent, offset `--border-focus`; `::selection` accent-wash; global reduced-motion block zeroes animation/transition durations and delays (`!important` in base layer, Biome-ignored with reason).
- Utilities (`@utility` in `global.css`): `lower-third` (inline-flex strap: 6 % ink wash band, works on canvas and surface; `::before` accent key, full height, `--spacing(1)` wide), `label` (sans, `--text-label`, medium, `--tracking-label-sans`, sentence case, tabular figures; nav, buttons, form labels, section labels, footer, toggle, FAQ, tally strip, prose h3+), `label-signal` (mono, label size, `--tracking-label`, uppercase, normal weight 400; only Timecode, the rundown duration column and the PGM/PVW tallies), `scanlines` (hero only), `prose` (≤ 68ch, h3+ use `label`, list markers not mono, `code` stays mono, first child flush). `grid-hairline`/`cell` were removed in Task 7 with GridFrame's hairline variant (no content grid uses a cell matrix).
- `scanlines` goes on the ASCII media cell only, never over text.
- Motion defaults: `--animate-*` reset (no `animate-*` utilities); bare `transition*` utilities default to `--duration-fast` + `--ease-signal`. `ring-*`/`inset-ring-*` still emit `box-shadow` (bare-number widths, no theme namespace to reset): never use them; focus uses `outline`.
- The `crosshair` utility was removed in Task 7a. `prose` h3+ `@apply label`; weights use `--font-weight-semibold`.
- Exceptions to "no gradients": `scanlines` (hard-stop `repeating-linear-gradient` overlay, static) and the AsciiImage hum bar band (Task 7b; replaced the Task 6 shimmer mask).
- Biome parses Tailwind CSS via `css.parser.tailwindDirectives: true`.
- Font glyph gaps: the Fontsource latin/latin-ext subsets lack `→ ↗ ●` in both families. Arrows are drawn by the `Glyph` SVG atom and the `●` is replaced by a CSS square lamp in `Tally`. Turkish `ÇĞİıÖŞÜ çğıöşü` is fully covered.

## Visual language
Do:
- Hairlines only within the border budget ("Design direction" below).
- Sans medium sentence-case labels with index, e.g. `[02] Applications`; mono only on signal cues (timecode, rundown durations, PGM/PVW).
- One two-tone headline per page.
- Typographic glyphs (→ ↗ + ●) instead of icons.
- Motion on opacity/transform only, at most 240ms; scanlines on hero only. Exceptions: Timecode and the AsciiImage live signal (Task 7b), both static under reduced motion.
- Accent for large text and graphics only, never body text.

Don't:
- Radius, shadows, gradients (except the ASCII hum bar and hero scanlines), blur/glass, purple, emoji, icon packs, stock photos, centred three-icon rows.
- Inter, Geist, Space Grotesk, Poppins, Montserrat.

## UI atoms (`src/components/ui/`)
- `Button {href?, type?, intent?: primary|secondary, size?: md|sm, glyph?: '→'|'↗'|null}`: `<a>` when `href` is set (then `type` is ignored), else `<button type>`. Default glyph ↗ for `https://`, → otherwise. `min-h-11`. Named group `group/button`. Label text always ink. md puts the arrow in a square end segment (accent fill on primary); sm inline.
- `Label {text?, index?, as?, strap?}`: `[NN] Text`, `label` (sans), index in ink; no `text` prints `[NN]` alone (app tile). Index width via `padIndex` (`ui/pad-index.ts`, tested), shared with rundown row numbers.
- `Heading {level: 1|2|3, text, accent?, size?: display|h2}`: `size` defaults to display for h1, h2 otherwise. `accent` is a second block line in accent.
- `Tally {text, tone?: accent|muted|critical, signal?}`: `signal` (default false) sets `label-signal` (PGM/PVW in TallyStrip), else `label`; Field and QuoteForm hints are plain `text-label` (sans); the FAQ sign is sans. Lamp (always shown) is a CSS square (`size-2`), never a `●` character.
- `Timecode {prefix}`: `@property` integer counters with `steps()`. Constants reach CSS as `--tc-*` custom properties via one root `style` object. Animates only under `prefers-reduced-motion: no-preference`; `aria-hidden`.
- `GridFrame {as?, columns?: 1|2|3|4|12}`: spaced only (`grid-cols-1 gap-x-8 gap-y-12 lg:gap-x-12`), no lines, free children (tone cards set `bg-surface p-6`). Every track is `minmax(0, 1fr)` (base `grid-cols-1`), so the container-sized ASCII figure or a long word never widens it. For 12 columns the children's `lg:col-span-*` must sum to 12 per row. The hairline variant was removed in Task 7 (unused).
- `Label` `strap` → `lower-third` utility; content is wrapped in one inner span so the flex gap never splits `[NN]` from the text. `index?: number | undefined`.
- `LowerThird {level: 2|3, text, label, index?}`: `<hgroup>` (`gap-2`, one lockup) with `Heading` above and the strap `Label` below. Section headings (`app-grid`, `feature-list`) and app card titles only.
- `TitleSafe {scanlines?}`: media frame, only for the hero media and the ApplicationPage cover (app-grid tile covers are frameless). `container-type: inline-size`; the slot sits in `.title-safe-picture` padded by `--title-safe-inset: 5cqi` (title-safe margin, one length for both axes); four `aria-hidden` corner spans (`data-corner` = block-inline, logical props) at `--title-safe-mark-inset` (half the margin), so the marks never cross the media. Arm `--spacing * 5`, hairline stroke in `ink-muted`, `z-index: 1` over the scanlines.
- `BarsStrip {class?}`: `h-1 w-42` flex row of the 7 bars, `aria-hidden`. Footer only.
- `NoSignal {text}`: `role="img" aria-label={text}`, 16:9 7-column bars, centred canvas slate with a muted `Tally`. For the 404 (Task 8).
- Tailwind v4 does not order stacked arbitrary variants by breakpoint: keep breakpoint rules disjoint (`md:max-lg:`).
- `Field {id, label, hint?, optionalLabel?}`: hint id via `hintId(id)` (`hint-id.ts`, tested), used for `aria-describedby`.
- `Input`, `Textarea`, `Select` share `CONTROL_CLASS` (`control-class.ts`): line-strong border, surface fill, `min-h-11`, `user-invalid:border-critical`.
- `Checkbox`: native input, `accent-accent`, label in slot.
- `Prose {html}`.
- `Glyph {name: '→'|'↗', class?}`: inline SVG at label size, `aria-hidden`. Always use it, never arrow text.
- `DuotoneCover {src, alt, widths, sizes, loading?}` (final fix wave): `<Picture>` avif/webp, `grayscale contrast-150` under a `bg-accent mix-blend-multiply` layer on canvas. AppGrid tiles and the ApplicationPage cover.
- Shared constants: `EXTERNAL_PREFIX`, `MAILTO` (`lib/link-schemes.ts`); `HOME_SLUG`, `withTrailingSlash` (`lib/i18n.ts`, reused by `routes.ts`, `GenericPage`, `nav-state.ts`).
- Never `ring-*` or `animate-*`; focus uses `outline`.
- cva variant maps are named constants typed against Props (`Record<NonNullable<Props['x']>, ...>`), so a missing variant fails `astro check`.

## Section blocks (Task 7, `src/components/sections/`)
- Props: `BlockProps<T>` (`block-props.ts`) = `{ section: SectionOf<T>; index; locale; headingLevel; localize }` (`localize`: the page's `hrefLocalizer`, applied by Hero/Cta actions, AppGrid tiles and RichText/Faq Markdown); `headingLevel` is `1 | 2` for `hero`, the literal `2` for every other block (only a hero can be h1).
- `SectionRenderer {sections, locale, pageTitle?}`: full-bleed bands (`py-16 md:py-24 last:pb-0`, first band `pt-12 md:pt-16`) with the page container inside; every band after the first opens with `border-t border-line` (the only section rule; blocks draw no outer borders). Index = position + 1. Exhaustive `switch` in an IIFE ending in `assertNever` (verified: a probe type fails `astro check`).
- h1 rule: hero at position 0 → h1. Else `pageTitle` → a title band with `Heading level={1}` (display) before the sections, counted as the first band (so section 1 gets a divider). No `pageTitle` → no h1 (ApplicationPage renders its own). Section headings h2, item titles h3.
- Grid: labels sit in a `lg:col-span-3` gutter and text starts at column 4 (statement, FAQ; rich-text `lg:col-start-4`).
- `Hero`: band `HERO_BAND` (`band-class.ts`, SectionRenderer picks it for the hero): from lg `min-h-(--first-screen)`, flex column centred, `pt-(--hero-pad) pb-(--hero-pad-end)` (content 5% above centre), `*:w-full` (keeps the auto-margin container full width); below lg it stacks and scrolls. GridFrame 12: 6/6 from lg (both actions on one row at 1280), 5/7 from `wide` with the media column `-me-(--hero-bleed)` into the outer margin (owner 2026-11-23: ASCII bigger, first screen must fit; review: 1920 felt floaty); media `min-w-0` in `<TitleSafe scanlines>`; both columns `lg:self-center`; text column `gap-6` (`md:max-lg:gap-8`). Measured hero bottom = viewport height at 1280×720, 1440×900, 1536×864, 1920×1080 (EN and TR). Figure: 1280 524×295 (7.8px glyphs), 1440 703×395 (10.5px), 1536 746×420 (11.1px), 1920 847×476 (12.6px; was 596×335, 8.9px).
- `Statement`: `text-quote` pull-quote, regular weight, ink, `max-w-quote` (was display size).
- `AppGrid`: LowerThird h2 + `GridFrame as="ul" columns={3}` of `bg-surface` tiles; whole tile one `<a class="group">`: `[NN]` + status Tally, `DuotoneCover` (widths 480/960, `alt=""` inside the link), LowerThird h3 (strap = category), tagline, → nudge (transform). href `localize(applicationPath(slug))` (same result: TR URL only when the application is translated).
- `FeatureList` (rundown, duration in `<time datetime="PT…">`, body `max-w-measure`): `<ol>` whose rows share columns via `subgrid` (md: number | title over body | duration; lg: number | title 2fr | body 3fr | duration); below md each row is its own 2-col grid (number + duration line, then title, body). Number `aria-hidden` (the `<ol>` numbers). No rules.
- `RichText`: `Prose` from `renderMarkdown`. `Cta`: `bg-surface` band, accent `Tally` (`tallyOnAir`), Heading h2, text, one primary Button end-aligned from lg. `Faq`: label h2 in the gutter, `<details class="group bg-surface">` rows with `gap-2`; mono "+" / "−" (`group-open:`), sign turns accent when open; answers via `renderMarkdown`.

## Layout (Task 5, fix rounds 1–2)
- `BaseLayout {locale, contentLocale, neutralPath, title, description, ogImage?, availableLocales, noindex?, jsonLd?}`. `locale` = UI language, `contentLocale` = entry language. Named slot `head`; default slot inside `<main id="main" tabindex="-1">`.
- Fallback (`contentLocale !== locale`): slot wrapped in `<div lang={contentLocale}>`, canonical = EN URL, `robots noindex`, no hreflang. The `noindex` prop gives `robots noindex` and no hreflang too.
- Title = `formatTitle(title, brandName)` (`Page · Brand`). og:image = `getImage` 1200×630 png, absolute via `Astro.site` (build throws if `site` is unset). `OG_LOCALE` lives in `SeoHead`.
- `lib/seo.ts`: `hreflangLinks` in `LOCALES` order, then `x-default` (EN). `organizationJsonLd` escapes `<` as `<`; callers pass the result as `jsonLd` (`application/ld+json`, a data block).
- Header: sticky `z-(--z-header)`. The logo is a wordmark only; `settings.logoAlt` names the home link and no brand text is printed beside it. Inline nav ≥ lg. Quote key ≥ md in the bar (before Menu); below md it sits in the sheet. MobileNav (`popover` `#site-menu`) below lg, opacity fade only. Nav hrefs come from `navigation` as EN site paths and are localized in BaseLayout (`hrefLocalizer`) before SiteHeader, MobileNav and SiteFooter see them, so `aria-current`/`data-active` compare the localized URL.
- Nav state lives in `lib/nav-state.ts` (pure): `isCurrentPage` → `aria-current="page"`; `isSectionActive` → visual-only `data-active` (whole path segments, never the root, locale prefix included). SiteHeader computes `navItems` once and passes `current`/`active` to MobileNav.
- Menu rows use an inset focus ring (negative `--border-focus` offset).
- TallyStrip: `surface` band, no rules (segments split by `gap-6 md:gap-8`), `px-4 md:px-8` to align with the header. The status segments sit in an `aria-hidden` flex child (`min-w-0 flex-1 overflow-x-clip`, h-11): `■ LIVE`, timecode; channel ≥ sm; `■ PGM` (accent) `■ PVW` (muted) and format ≥ md. Props `program`/`preview` from `tallyProgram`/`tallyPreview`.
- HOLD key (Task 7b fix round 1, WCAG 2.2.2): last in TallyStrip, outside the hidden segments, every breakpoint. A `<label>` key (`border-line-strong`, `min-h-11`, lamp + `ui.motionHold`) wrapping a visually hidden native checkbox `[data-motion-hold]` (`aria-describedby` → sr-only `ui.motionHoldHint`). Inset accent focus ring via `:has(:focus-visible)`; lamp accent via `:has(:checked)`. `global.css` (base layer, `!important`): `html:has([data-motion-hold]:checked) *, ::before, ::after { animation-play-state: paused }`. The AsciiImage module listens to its `change`. Off by default. The band grew from h-10 to h-11 (44px target).
- MobileNav sheet: top bar keeps the header rule; rows have no dividers (height and hover/active `surface` tone).
- Footer: full-bleed `border-t border-line`; `BarsStrip` at the content edge pulled up by `-mt-(--border-hairline)` so it lies on the rule; then spaced `GridFrame` with 4 columns when there are socials, else 3 (I1 fix M1); every column's first row is a `min-h-11 flex items-center` box (logo link, nav row, Contact/Follow label wrappers), so the first rows share one line; indexed nav; Contact and Follow continue the numbering (`[05]`, `[06]`); contacts in `<address>`; ↗ on https links via Glyph; the Follow column renders only when `socials` is non-empty; rights line `© BUILD_YEAR legalName footerRights`.

## ASCII (Task 6, fix round 1)
- Constants: `lib/ascii-glyphs.ts` (sharp-free, shared with the client module, Task 7b) holds `ASCII_RAMP = ' .:-=+*#%@'`, `TONE_COUNT = 6`, `CHAR_ASPECT = 0.5`; `lib/ascii.ts` holds `ASCII_COLUMNS = 96`, `ASCII_COLUMNS_COMPACT = 48`. Never import `ascii.ts` values into client code (it imports `sharp`); `import type` is fine.
- Tones: glyph `min(9, floor(l*10/256))`, tone `min(5, floor(l*6/256))` → `--color-tone-0…5`. Bright = dense glyph. Same-tone runs become one `<span class="tN">`; all-space runs are bare text; trailing blanks are trimmed (`runsHtml`). Every row is wrapped in a bare `<span>` (Task 7b), rows joined by `\n` (no leading newline); a blank row is `<span></span>`. CSS makes rows `inline-block` at `inline-size: 100%` (same line box as text; full width so a row whose text length changes never moves the line break after it: that was measured as CLS).
- Pipeline (sharp): `autoOrient` → `resize fill` → `flatten` on black → `normalise` → `toColourspace('b-w')` → `raw`. Flatten is for correct translucency: sharp 0.35.5's `b-w` already drops alpha silently. Memoized per `file@cols`; a rejected render is evicted.
- Two grids per figure: 96 columns and 48 compact. `@container (inline-size < 30rem)` on the figure swaps them (container queries cannot use `var()`, so 30rem is a literal). Both `<pre>` are aria-hidden; the figure keeps `role="img"` and `aria-label`.
- `AsciiImage` (`ui/`): `--ascii-advance: 0.7` (Martian Mono, measured), font size `100cqi / cols / advance`, line height `advance / CHAR_ASPECT`. Markup comes from `lib/ascii-markup.ts` (`asciiMarkup`) via `set:html`, so spans carry no scoped attributes.
- Budget: `ASCII_HTML_BUDGET = 30 * 1024` per figure; `assertAsciiBudget` fails the build. Seed figure is 16.5 KB.
- Upload source: `resolveUploadPath` lists `src/assets/uploads` on disk and matches the emitted file name (build `<stem>.<hash>.<ext>`, dev `<stem>.<ext>?…`). Never `import.meta.glob` (importing ships the original) and never `fsPath`. Upload names must be unique across subfolders; ambiguity throws.
- Live signal (Task 7b, owner: "ASCII effects must be animated" and must evoke broadcasting to anyone). Only under `prefers-reduced-motion: no-preference`; the build-time render is the no-JS and reduced-motion picture. Named custom properties at the top of `AsciiImage`:
  - Hum bar: figure `::after`, a `linear-gradient` band (`--ascii-roll-band` 0.45 of the height), `mix-blend-mode: color-dodge` with a dim opaque glow (`color-mix(ink 28%, black)`; a bright translucent glow clipped the canvas to grey), translateY only, 9 s, travelling `--ascii-roll-travel` 2 figure heights so it rests between passes. The figure has a canvas background because TitleSafe's `isolation: isolate` would otherwise give the dodge a transparent backdrop.
  - Sync slip: one shared 36 s cycle (`--ascii-slip-cycle`): `ascii-slip-upper` (rows 5–6) at 11.1% and 72.2% (4 s, 26 s), `ascii-slip-lower` (rows 10–12, torn the other way) at 36.1% (13 s); gaps 9/13/14 s. Each slip: `0.45ch` tear plus opacity dip for 0.3% of the cycle, half kick back for 0.2%, step-end. Keyframe percentages must change together with the cycle.
  - Breath: `.t5` opacity to 0.8, `steps(8)` alternate 2.6 s, only on `[data-ascii]:not([data-live])` (the no-JS picture).
  - Module (`<script>` in AsciiImage, pure logic in `lib/ascii-motion.ts`, 20 tests): per figure, IntersectionObserver on both `<pre>`; the intersecting one is the visible grid (respects the container swap). First time: tune-in, 1.2 s of 25 fps frames where each cell (random threshold, 35% row bias) shows `NOISE_TONE` static until it locks. Then live frames at 12.5 fps (`LIVE_FRAME_MS` 80): `liveRuns` adds `waveBoost` tones under rings from `WAVE_ORIGIN` {0.5, 1/3} (the `waveOrigin` prop, `data-wave-origin` and `parseOrigin` were removed as unused in the final fix wave; `ringDistance` in picture widths, a row = 2 columns), speed 0.16, a ring every `WAVE_CADENCE_MS` 2500 (spacing = speed × cadence = 0.4), trail 0.07, gain 2, reach 0.9; a dotted front (`.`, depth 0.012) crosses blank sky; flicker 0.4% per glyph per frame to a ramp neighbour. Stops (and restores the saved row markup byte for byte) offscreen, on `document.hidden`, under reduced motion (`change` listened) and while the HOLD key is checked (`canAnimate`). Cold load: if the first IntersectionObserver report finds the figure in view after `TUNE_IN_WINDOW_MS` 300 (`skipsTuneIn`, `performance.now()` from navigation start), it goes straight to live. Rows are written through a per-row cache of the last markup (`written`), never read back. Sets `data-live` while it drives the figure.
  - Cost: about 0.23 ms compute plus about 0.8 ms of row `innerHTML` writes per 80 ms tick (no reads since fix round 1); JS 3.6 KB raw, 1.8 KB gzipped.
- Hero media cell: give the figure a definite track (`minmax(0, 1fr)` / `min-w-0`); wrap it in `<TitleSafe scanlines>` (no AsciiImage change needed).
- Seed `transmitter.png` (was `test-card.png`; renamed in Task 7b fix round 1) is a generated transmitter mast: a lattice tower, a bright emitter disc at (640, 240) of 1280×720 (= `WAVE_ORIGIN`), four pairs of arcs fading outward, a ground bar. Reads at 96 and 48 columns. `imageAlt` EN/TR describe it.

## Design direction (owner feedback 2026-11-23, implemented in Task 7a)
- Border budget: hairlines only on (1) header bottom / footer top edges, (2) section dividers (`SectionRenderer` owns one `border-t border-line` rule per section after the first), (3) form controls (incl. buttons and the menu key), (4) the `TitleSafe` media frame. Content grids, cards, feature lists, FAQ, CTA: spacing + `surface` vs `canvas` tone, no boxed cells. Crosshairs retired.
- Broadcast details, used sparingly: TallyStrip PGM/PVW; title-safe marks only on the hero media and the ApplicationPage cover; lower thirds on section headings and app card titles only; rundown `feature-list` with `duration`; one SMPTE bars strip (footer rule); `NoSignal` on the 404. VU meter dropped (clutter, a second perpetual animation next to the timecode).
- Scaffold page (Task 7 on): EN home + about (`pageTitle`) + contact through `SectionRenderer` (all 7 blocks, both h1 paths, so 2 h1s by construction); the atom showcase and its swatch/hairline exceptions are gone. Prose keeps its `hr` (a thematic break, read as a section divider inside rich text). The blockquote rule was replaced in the final fix wave by an indent plus the `--ink-band` tone (no border), so the four-place border budget holds.
- Seed image: the test card was replaced by the transmitter mast in Task 7b (owner: the look must evoke broadcasting to anyone).

## Coding standards
- No `any`; strict TypeScript.
- No swallowed errors; handle or surface every failure.
- No `console.log`. Only allowed: structured, PII-free `console.error({ code, step })` in the Worker.
- No magic numbers, raw hex or raw px in components; use tokens and named constants.
- No hardcoded copy; all strings come from content.
- Single responsibility per file and function.
- No dead code, no unused dependencies, no repeated style blocks.
- Platform first: native HTML before JS.

## i18n rules
- Locales and helpers in `lib/i18n.ts`; `t()` falls back to EN.
- EN at `/`, TR at `/tr/`; TR builds only translated entries.
- Language toggle links to the TR twin, or `/tr/` if none.
- `hreflang` lists only existing translations plus `x-default` (EN).
- Per-locale 404 via `404-page` handling.

## Routes, SEO and build outputs (Task 8, `src/lib/routes.ts`)
- Routes: `/[...slug]` = EN pages; `/tr/[...slug]` = TR translated pages only; `applications/[slug]` and `tr/applications/[slug]`; `404` and `tr/404`; `robots.txt.ts` (`robotsTxt` in `seo.ts`). `src/pages/index.astro` is gone (home comes from `[...slug]`).
- `RESERVED_PAGE_SLUGS` (`quote`, `not-found`, `lib/page-slugs.ts`) are excluded from the generic route; `src/pages/quote.astro` owns `/quote/`. `FORBIDDEN_PAGE_SLUGS` fail the build (see Content model).
- Sitemap (`astro.config.ts`): i18n map; filters `/404/`, `/tr/404/`, `/admin/`, and `/tr/quote/` unless the TR quote entry exists.
- `src/integrations/build-outputs.ts` (`buildOutputs`, `astro:build:done`): `relocateLocale404` moves Astro's `tr/404/index.html` to `dist/tr/404.html`; `findCrossLocaleLinks` (final fix wave; a safety net since the I1 fix localizes content hrefs) fails the build when a page under `dist/<locale>/` links the unprefixed EN URL of a page that exists in that locale (toggle links carry `hreflang` and are exempt; it reads double-quoted `href` only, as Astro serializes); a hit means a renderer skipped the href localizer, and each line names the files where the link text lives (`contentSources`: the page entry, `applications/<l>/<slug>.yaml` only for `applications/<slug>/index.html` (the index is `pages/<l>/applications.yaml`), the EN twin for quote/404, the locale's navigation; `NAVIGATION_SLUG` comes from `entries.ts`); `pruneUnreferencedImages` deletes raster files in `dist/_astro` that no built html/css/xml/txt/json/js mentions (optimized derivatives are always referenced, unoptimized originals never are). Task 10 EXTENDS this integration; it must not create a new one. Keep both steps and their tests.
- Applications: `applicationSectionsSchema` rejects any hero. ApplicationPage renders its own plain display h1 (category Label, Tally, lede, brochure/links as Buttons, `DuotoneCover` in TitleSafe without scanlines, the cover also passed to BaseLayout as `ogImage`), then its sections under one `border-t` divider.
- GenericPage: Organization JSON-LD on `home` only. NotFoundPage: noindex, `NoSignal`, `max-w-3xl`.
- `SectionRenderer` has a default `<slot />` between the title band and the sections (404 NoSignal).
- noindex pages (404s, EN fallbacks) emit no canonical and no og:url (BaseLayout omits canonical when `noindex`).

## Quote (Task 9, `src/lib/quote-schema.ts`, `QuoteForm`, `QuoteStatus`, `QuotePage`)
- Limits: `QUOTE_LIMITS` name 100, email 254, company 120, role 80, country 80, message 2000, token 2048 (Worker only). `MAX_SOLUTIONS` 16: QuotePage throws at build when applications + `general` exceed it. `TIMELINES` asap|quarter|half-year|exploring. `GENERAL_SOLUTION` `general`, pre-checked. `QUOTE_STATES` sent|error-invalid|error-verify|error-send. `TURNSTILE_FIELD` `cf-turnstile-response`. `EMAIL_INPUT_PATTERN` mirrors `z.email()` (dot in domain; tested).
- Single-line fields are trimmed and reject CR/LF. Message: CRLF becomes LF before the 2000 check. `z.object` strips unknown keys. `formDataToInput` uses `getAll` for solutions, drops the token, and is `__proto__`-safe. Worker: `formDataToInput` then `quoteSchema.safeParse`; a missing, empty or over-2048 token is a verify failure (the schema never sees the token).
- Form posts `multipart/form-data` (a urlencoded Turkish max-length body exceeds 16 KB; multipart is about 9 KB). Timeline select has a `value=""` placeholder labelled by `quoteTimelinePlaceholder`.
- Status: four `<section id={state} tabindex="-1" aria-labelledby>` panels shown only as `:target` (`not-target:hidden scroll-mt-24`); tally critical on errors, accent on sent; email fallback on error-verify and error-send.
- Layout: gutter `[NN]` label plus noscript text; three surface panels (cols 4-12) hold the controls; consent, Turnstile and submit sit on the canvas (Turnstile needs 300 px).
- `components/sections/band-class.ts` exports `CONTAINER`, `BAND`, `FIRST_BAND`, `DIVIDER`, shared by SectionRenderer, QuotePage and QuoteStatus. `Checkbox` has `checked?`; `Input` has `pattern?`.
- QuotePage loads the Turnstile script (`is:inline`, async defer) through the `head` slot. Outside `/admin/` the only other client JS is the ASCII motion module on pages with `AsciiImage` (Task 7b).
- UI_KEYS was 52 here (`quote*` keys, `footerRights` in TR; `motionHold`, `motionHoldHint` from Task 7b fix round 1, EN "Hold" / TR "Beklet").

## Quote Worker (Task 10, `worker/`)
- `index.ts`: `/api/quote` (exact path) -> `handleQuote`; everything else -> `env.ASSETS.fetch`. `wrangler.jsonc` `run_worker_first: ["/api/*"]`. Allow-list = `worker/generated/solutions.json` (written by `build-outputs` on `astro:build:done`, gitignored).
- `quote.ts` flow: non-POST 405 (`Allow: POST`) -> Origin must equal request origin -> content type urlencoded/multipart -> bad `MAX_BODY_BYTES` = `error-send` -> `Content-Length` over cap -> body read as a stream, capped at `MAX_BODY_BYTES` even when chunked -> `formData()` -> `quoteSchema` + allow-list (`error-invalid`) -> empty/over-limit/missing token `error-verify` (no siteverify, covers no-JS) -> missing secret/`QUOTE_TO`/`QUOTE_FROM` `error-send` -> `verifyTurnstile` (hostname, action `quote`, 5 s timeout) `error-verify` -> `send` rejects `error-send` -> `sent`. Every POST answer is a 303 to `<origin>[/tr]/quote/#<state>` with `WORKER_HEADERS`.
- Logging: only `console.error({ code, step })`, `code` in guard|invalid|verify|send|config. Guard failures before the form is parsed take the locale from the Referer's first path segment via `isLocale` only (else EN); a body stream error is `error-invalid` (`guard`/`body`).
- `mail.ts`: CRLF, base64 body (76 cols), RFC 2047 subject split into short encoded words, throws on CR/LF in any header value. `Reply-To` is the visitor.
- `public/_headers` is spec §11 verbatim (`<auth-worker>` placeholder stays until the owner fills it). Worker responses set their own headers (`headers.ts`).
