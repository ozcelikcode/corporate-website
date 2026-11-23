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

## Design tokens
- All tokens in `src/styles/tokens.css` under `@theme`: OKLCH colour (`canvas`, `surface`, `ink`, `ink-muted`, `line`, `line-strong`, `critical`, `accent`), type scale (fluid `clamp`), 4px spacing base, hairline border, z-index, motion (120ms/240ms, `--ease-signal`), layout.
- `accent` is the only value injected from settings (`--accent-seed` on `<html>`); `accent-dim`/`accent-wash` derive via `color-mix`.
- Radius and shadow namespaces are reset (`initial`): those utilities do not exist.

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
