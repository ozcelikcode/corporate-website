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
- `ui`: keyed strings (TR may be partial, falls back to EN). `navigation`: header[], footer[] of {label, href}.
- `pages`: title, description, ogImage?, sections[]. `applications`: name, slug, tagline, summary, category, cover+coverAlt, status, order, links[]?, brochure? (R2 URL), sections[].
- Section block union in `src/lib/sections-schema.ts` (discriminated on `type`): `hero`, `statement`, `app-grid`, `feature-list`, `rich-text`, `cta`, `faq`. Shared by pages and applications. `SectionRenderer` uses an exhaustive switch.
- Markdown rendered by `@astrojs/markdown-remark` via `lib/markdown.ts`.
- `app-grid` with empty `apps` lists all applications by `order`.

## Design tokens (Task 2, `src/styles/tokens.css` + `global.css`)
- Single dark theme (`color-scheme: dark`), like a monitor wall. `global.css` does `@import "tailwindcss" source("../")` (scans `src/` only) then `tokens.css`.
- Reset to `initial` first: `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--font-*`, `--text-*`, plus `--text-shadow-*` (not covered by `--text-*`). Radius/elevation utilities do not exist, except Tailwind's static `rounded-full`/`rounded-none` (guard grep catches any `rounded`).
- Colours (OKLCH): canvas `0.17 0.008 255`, surface `0.21 0.008 255`, ink `0.95 0.005 255`, ink-muted `0.74 0.01 255`, line `0.32 0.01 255` (decorative grid only), line-strong `0.52 0.012 255` (control borders), critical `0.70 0.17 30`.
- `accent` = `var(--accent-seed)` (default `oklch(0.80 0.16 75)` on `:root`; BaseLayout overrides on `<html>`). `accent-dim` = 55 %, `accent-wash` = 12 % accent on canvas, mixed **in oklab** (oklch mixing swings the hue toward canvas hue 255: amber turned green).
- `tone-0…5` (ASCII): ink-muted 30 % / 60 % on canvas (oklab), ink-muted, ink, accent-dim, accent.
- Measured on canvas (default accent): ink 16.5, ink-muted 8.3, line-strong 3.45 (3.19 on surface), accent 10.0, accent-dim 3.35, critical 6.6, line 1.5.
- Type: `text-label` 0.75rem/1.4, `text-body` clamp(1rem…1.125rem)/1.55, `text-lede` clamp(1.125…1.375rem)/1.45, `text-h2` clamp(1.5…2.25rem)/1.1, `text-display` clamp(2.5…5.5rem)/0.98; `tracking-label` 0.12em; `font-sans`/`font-mono` via `@theme inline` → `--font-grotesk`/`--font-martian`. Fluid body size sits on `body` (not `html`) so rem stays 16px.
- Other: `--spacing` 0.25rem, `max-w-page` (`--container-page` 90rem). Plain vars on `:root` (no utilities): `--border-hairline` 1px, `--border-focus` 0.125rem, `--z-header/popover/dialog` 10/20/30, `--duration-fast/base` 120/240ms, `--ease-signal` cubic-bezier(0.2, 0, 0, 1).
- Base: canvas bg, ink text; `:focus-visible` = `--border-focus` solid accent, offset `--border-focus`; `::selection` accent-wash; global reduced-motion block zeroes animation/transition durations and delays (`!important` in base layer, Biome-ignored with reason).
- Utilities (`@utility` in `global.css`): `grid-hairline` (grid, gap = hairline, line bg, outer hairline border; children use `cell`), `cell` (canvas bg, padding `--spacing(6)`, relative), `crosshair` ("+" `::before` centred on the element's top-left intersection, `content: "+" / ""` so AT ignores it), `label-mono` (mono, label size, tracking, uppercase), `scanlines` (hero only), `prose` (≤ 68ch, mono uppercase h3+).
- Exceptions to "no gradients": `scanlines` (hard-stop `repeating-linear-gradient` overlay, static) and the AsciiImage shimmer mask (Task 6).
- Biome parses Tailwind CSS via `css.parser.tailwindDirectives: true`.
- Font glyph gaps: the Fontsource latin/latin-ext subsets lack `→ ↗ ●` in both families; they render from system fonts. Turkish `ÇĞİıÖŞÜ çğıöşü` is fully covered.

## Visual language
Do:
- One shared 1px hairline grid, never doubled; "+" crosshairs at intersections.
- Uppercase tracked mono labels with index, e.g. `[02] APPLICATIONS`.
- One two-tone headline per page.
- Typographic glyphs (→ ↗ + ●) instead of icons.
- Motion on opacity/transform only, at most 240ms; scanlines on hero only.
- Accent for large text and graphics only, never body text.

Don't:
- Radius, shadows, gradients (except ASCII shimmer mask), blur/glass, purple, emoji, icon packs, stock photos, centred three-icon rows.
- Inter, Geist, Space Grotesk, Poppins, Montserrat.

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
