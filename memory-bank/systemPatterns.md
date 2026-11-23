# System Patterns

## Folder architecture (condensed)
```
.
├─ CLAUDE.md  memory-bank/  .claude/skills/team-delegation/SKILL.md
├─ docs/superpowers/specs/        # spec + plans
├─ .github/CODEOWNERS
├─ astro.config.ts wrangler.jsonc biome.json tsconfig.json package.json .nvmrc
├─ public/  _headers  favicon.svg  admin/{index.html,config.yml}
├─ src/
│  ├─ content.config.ts           # all collections (glob loader + astro/zod)
│  ├─ content/  settings/ ui/{en,tr}/ navigation/{en,tr}/ pages/{en,tr}/ applications/{en,tr}/
│  ├─ assets/   fonts/ uploads/
│  ├─ styles/   tokens.css (@theme) global.css
│  ├─ lib/      i18n content sections-schema markdown seo ascii color quote-schema
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
- `ui`: keyed strings (TR may be partial, falls back to EN). `navigation`: header[], footer[] (default `[]`) of {label, href}. Hero `actions` defaults to `[]` (max 2).
- `pages`: title, description, ogImage?, sections[]. `applications`: name, slug, tagline, summary, category, cover+coverAlt, status, order, links[]?, brochure? (R2 URL), sections[].
- Section block union in `src/lib/sections-schema.ts` (discriminated on `type`): `hero`, `statement`, `app-grid`, `feature-list`, `rich-text`, `cta`, `faq`. Shared by pages and applications. `SectionRenderer` uses an exhaustive switch.
- All schemas are `z.strictObject` (unknown keys fail the build).
- Entry ids come from the file path via `generateId`: `<locale>/<slug>` (settings `site`, ui `<locale>/strings`, navigation `<locale>/main`). An application's `slug` field never sets the id; `assertSlugMatches` fails the build on mismatch.
- Internal href pattern `^\/(?![\/\\])`: rejects protocol-relative `//host` and a backslash after the leading slash. Used by `actionSchema` and `LINK_HREF_PATTERN`.
- Fallback: `resolveLocalized` returns TR if present, else EN. `mergeByLocale` yields one entry per EN slug (sorted by `order`, then slug) and throws on a TR entry with no EN twin (`assertEnglishTwins`). `getPage` throws if EN is missing. Untranslated TR links point to EN URLs.
- `UI_KEYS` (46) lives in `lib/i18n.ts`: EN ui must be exhaustive, TR may be partial.
- `settings.accent` is checked by `accentContrast` (`lib/color.ts`): >= 3:1 against canvas.
- Seed slugs: EN pages `home about contact privacy applications quote not-found`; TR page `home`; applications `newsroom-desk playout-control archive-search`.
- Markdown rendered by `@astrojs/markdown-remark` via `lib/markdown.ts`.
- `app-grid` with empty `apps` lists all applications by `order`.

## Design tokens (Task 2, `src/styles/tokens.css` + `global.css`)
- Single dark theme (`color-scheme: dark`), like a monitor wall. `global.css` does `@import "tailwindcss" source("../")` (scans `src/` only) then `tokens.css`.
- Reset to `initial` first: `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--font-*`, `--text-*`, plus `--text-shadow-*` (not covered by `--text-*`) and `--animate-*`. Radius/elevation utilities do not exist, except Tailwind's static `rounded-full`/`rounded-none` (guard grep catches any `rounded`).
- Colours (OKLCH): canvas `0.17 0.008 255`, surface `0.21 0.008 255`, ink `0.95 0.005 255`, ink-muted `0.74 0.01 255`, line `0.32 0.01 255` (decorative grid only), line-strong `0.52 0.012 255` (control borders), critical `0.70 0.17 30`.
- `accent` = `var(--accent-seed)` (default `oklch(0.80 0.16 75)` on `:root`; BaseLayout overrides on `<html>`). `accent-dim` = 55 %, `accent-wash` = 12 % accent on canvas, mixed **in oklab** (oklch mixing swings the hue toward canvas hue 255: amber turned green).
- `tone-0…5` (ASCII): ink-muted 30 % / 60 % on canvas (oklab), ink-muted, ink, accent-dim, accent.
- Measured on canvas (default accent): ink 16.5, ink-muted 8.3, line-strong 3.45 (3.19 on surface), accent 10.0, accent-dim 3.35, critical 6.6, line 1.5.
- `tracking-display` -0.02em (display headings); `tracking-label` 0.12em.
- Type: `text-label` 0.75rem/1.4, `text-body` clamp(1rem…1.125rem)/1.55, `text-lede` clamp(1.125…1.375rem)/1.45, `text-h2` clamp(1.5…2.25rem)/1.1, `text-display` clamp(2.5…5.5rem)/0.98; `tracking-label` 0.12em; `font-sans`/`font-mono` via `@theme inline` → `--font-grotesk`/`--font-martian`. Fluid body size sits on `body` (not `html`) so rem stays 16px.
- Other: `--spacing` 0.25rem, `max-w-page` (`--container-page` 90rem). Plain vars on `:root` (no utilities): `--border-hairline` 1px, `--border-focus` 0.125rem, `--z-header/popover/dialog` 10/20/30, `--duration-fast/base` 120/240ms, `--ease-signal` cubic-bezier(0.2, 0, 0, 1).
- Base: canvas bg, ink text; `:focus-visible` = `--border-focus` solid accent, offset `--border-focus`; `::selection` accent-wash; global reduced-motion block zeroes animation/transition durations and delays (`!important` in base layer, Biome-ignored with reason).
- Utilities (`@utility` in `global.css`): `grid-hairline` (grid, gap = hairline, line bg, outer hairline border; children use `cell`), `cell` (canvas bg, padding `--spacing(6)`, relative), `crosshair` ("+" `::before` centred on the element's top-left intersection, `content: "+" / ""` so AT ignores it), `label-mono` (mono, label size, tracking, uppercase), `scanlines` (hero only), `prose` (≤ 68ch, mono uppercase h3+).
- `grid-hairline` needs complete last rows: the line-coloured background shows through any empty track, so pad the last row with empty `cell`s or span the last item across the remaining columns (Task 7 relies on this).
- `scanlines` goes on the ASCII media cell only, never over text.
- Motion defaults: `--animate-*` reset (no `animate-*` utilities); bare `transition*` utilities default to `--duration-fast` + `--ease-signal`. `ring-*`/`inset-ring-*` still emit `box-shadow` (bare-number widths, no theme namespace to reset): never use them; focus uses `outline`.
- `crosshair` declares `content: "+"` then `content: "+" / ""`, so browsers without alt-text support still draw the mark. `prose` h3+ reuse `label-mono` via `@apply`; weights use `--font-weight-semibold`.
- Exceptions to "no gradients": `scanlines` (hard-stop `repeating-linear-gradient` overlay, static) and the AsciiImage shimmer mask (Task 6).
- Biome parses Tailwind CSS via `css.parser.tailwindDirectives: true`.
- Font glyph gaps: the Fontsource latin/latin-ext subsets lack `→ ↗ ●` in both families. Arrows are drawn by the `Glyph` SVG atom and the `●` is replaced by a CSS square lamp in `Tally`. Turkish `ÇĞİıÖŞÜ çğıöşü` is fully covered.

## Visual language
Do:
- Hairlines in moderation, as set out in "Design direction" below.
- Uppercase tracked mono labels with index, e.g. `[02] APPLICATIONS`.
- One two-tone headline per page.
- Typographic glyphs (→ ↗ + ●) instead of icons.
- Motion on opacity/transform only, at most 240ms; scanlines on hero only.
- Accent for large text and graphics only, never body text.

Don't:
- Radius, shadows, gradients (except ASCII shimmer mask), blur/glass, purple, emoji, icon packs, stock photos, centred three-icon rows.
- Inter, Geist, Space Grotesk, Poppins, Montserrat.

## UI atoms (`src/components/ui/`)
- `Button {href?, type?, intent?: primary|secondary, size?: md|sm, glyph?: '→'|'↗'|null}`: `<a>` when `href` is set (then `type` is ignored), else `<button type>`. Default glyph ↗ for `https://`, → otherwise. `min-h-11`. Named group `group/button`. Label text always ink. md puts the arrow in a square end segment (accent fill on primary); sm inline.
- `Label {text, index?, as?}`: `[NN] TEXT`, `label-mono`, index in ink.
- `Heading {level: 1|2|3, text, accent?, size?: display|h2}`: `size` defaults to display for h1, h2 otherwise. `accent` is a second block line in accent.
- `Tally {text, tone?: accent|muted|critical, dot?}`: lamp is a CSS square (`size-2`), never a `●` character.
- `Timecode {prefix}`: `@property` integer counters with `steps()`. Constants reach CSS as `--tc-*` custom properties via one root `style` object. Animates only under `prefers-reduced-motion: no-preference`; `aria-hidden`.
- `GridFrame {as?, columns?: 1|2|3|4|12, crosshairs?}`: children are `cell`s. For 2/3/4 columns the last cell fills its row. For 12 columns the children's `lg:col-span-*` must sum to 12 per row.
- Tailwind v4 does not order stacked arbitrary variants by breakpoint: keep breakpoint rules disjoint (`md:max-lg:`).
- `Field {id, label, hint?, optionalLabel?}`: hint id via `hintId(id)` (`hint-id.ts`, tested), used for `aria-describedby`.
- `Input`, `Textarea`, `Select` share `CONTROL_CLASS` (`control-class.ts`): line-strong border, surface fill, `min-h-11`, `user-invalid:border-critical`.
- `Checkbox`: native input, `accent-accent`, label in slot.
- `Prose {html}`.
- `Glyph {name: '→'|'↗', class?}`: inline SVG at label size, `aria-hidden`. Always use it, never arrow text.
- Never `ring-*` or `animate-*`; focus uses `outline`.
- cva variant maps are named constants typed against Props (`Record<NonNullable<Props['x']>, ...>`), so a missing variant fails `astro check`.

## Layout (Task 5, fix rounds 1–2)
- `BaseLayout {locale, contentLocale, neutralPath, title, description, ogImage?, availableLocales, noindex?, jsonLd?}`. `locale` = UI language, `contentLocale` = entry language. Named slot `head`; default slot inside `<main id="main" tabindex="-1">`.
- Fallback (`contentLocale !== locale`): slot wrapped in `<div lang={contentLocale}>`, canonical = EN URL, `robots noindex`, no hreflang. The `noindex` prop gives `robots noindex` and no hreflang too.
- Title = `formatTitle(title, brandName)` (`Page · Brand`). og:image = `getImage` 1200×630 png, absolute via `Astro.site` (build throws if `site` is unset). `OG_LOCALE` lives in `SeoHead`.
- `lib/seo.ts`: `hreflangLinks` in `LOCALES` order, then `x-default` (EN). `organizationJsonLd` escapes `<` as `<`; callers pass the result as `jsonLd` (`application/ld+json`, a data block).
- Header: sticky `z-(--z-header)`. The logo is a wordmark only; `settings.logoAlt` names the home link and no brand text is printed beside it. Inline nav ≥ lg. Quote key ≥ md in the bar (before Menu); below md it sits in the sheet. MobileNav (`popover` `#site-menu`) below lg, opacity fade only. Nav hrefs are used verbatim from `navigation`.
- Nav state lives in `lib/nav-state.ts` (pure): `isCurrentPage` → `aria-current="page"`; `isSectionActive` → visual-only `data-active` (whole path segments, never the root, locale prefix included). SiteHeader computes `navItems` once and passes `current`/`active` to MobileNav.
- Menu rows use an inset focus ring (negative `--border-focus` offset).
- TallyStrip: `aria-hidden`, hairline segments, no crosshairs (the sticky header would cover them); channel ≥ sm, format ≥ md.
- Footer: `GridFrame columns={4} crosshairs`; indexed nav; Contact and Follow continue the numbering (`[05]`, `[06]`); contacts in `<address>`; ↗ on https links via Glyph; rights line `© BUILD_YEAR legalName footerRights`.

## ASCII (Task 6, fix round 1)
- Constants in `lib/ascii.ts`: `ASCII_RAMP = ' .:-=+*#%@'`, `TONE_COUNT = 6`, `CHAR_ASPECT = 0.5`, `ASCII_COLUMNS = 96`, `ASCII_COLUMNS_COMPACT = 48`.
- Tones: glyph `min(9, floor(l*10/256))`, tone `min(5, floor(l*6/256))` → `--color-tone-0…5`. Bright = dense glyph. Same-tone runs become one `<span class="tN">`; all-space runs are bare text; trailing blanks are trimmed.
- Pipeline (sharp): `autoOrient` → `resize fill` → `flatten` on black → `normalise` → `toColourspace('b-w')` → `raw`. Flatten is for correct translucency: sharp 0.35.5's `b-w` already drops alpha silently. Memoized per `file@cols`; a rejected render is evicted.
- Two grids per figure: 96 columns and 48 compact. `@container (inline-size < 30rem)` on the figure swaps them (container queries cannot use `var()`, so 30rem is a literal). Both `<pre>` are aria-hidden; the figure keeps `role="img"` and `aria-label`.
- `AsciiImage` (`ui/`): `--ascii-advance: 0.7` (Martian Mono, measured), font size `100cqi / cols / advance`, line height `advance / CHAR_ASPECT`. Markup comes from `lib/ascii-markup.ts` (`asciiMarkup`) via `set:html`, so spans carry no scoped attributes.
- Budget: `ASCII_HTML_BUDGET = 30 * 1024` per figure; `assertAsciiBudget` fails the build. Seed figure is 16.5 KB.
- Upload source: `resolveUploadPath` lists `src/assets/uploads` on disk and matches the emitted file name (build `<stem>.<hash>.<ext>`, dev `<stem>.<ext>?…`). Never `import.meta.glob` (importing ships the original) and never `fsPath`. Upload names must be unique across subfolders; ambiguity throws.
- Shimmer: alpha-only mask band, 600% size, 45/50/55 band, 78% floor, 9 s linear. Declared only under `prefers-reduced-motion: no-preference`.
- Hero media cell: give the figure a definite track (`minmax(0, 1fr)` / `min-w-0`); `scanlines` goes on the media cell only.
- Seed `test-card.png` is a generated card (seven grey bars, ringed disc with crosshair, amber inner ring, 10-step wedge) that matches `imageAlt`.

## Design direction (owner feedback, 2026-11-23)
- Borders in moderation: hairlines only on header/footer edges, section dividers, form controls and the hero media frame. Content grids use spacing and surface tone, not boxed cells.
- Broadcast details, used sparingly:
  - Tally plus PGM/PVW labels.
  - Title-safe corner brackets on media, instead of crosshairs everywhere.
  - Lower-third headings and card titles.
  - Rundown-style feature list with timecode durations.
  - SMPTE colour-bar micro strip as a section divider (check it against the accent-only rule).
  - "NO SIGNAL" test-pattern 404.
  - Optional VU meter.
- This supersedes the earlier "one shared hairline grid, '+' crosshairs at intersections" rule. The footer's `crosshairs` and other crosshair use are reviewed in Task 7a.
- Build order: Task 7a (design refinement) before Task 7 (G5 section blocks).

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
