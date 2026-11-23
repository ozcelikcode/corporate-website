# Corporate Site — Design Spec

Date: 2026-11-23 · Status: decisions recorded, ready for planning

## 1. Intent & principles

This is a static, brand-agnostic corporate showcase. The first tenant builds software applications for the press, but no code, doc or plan names it. Brand name, logo, accent, contacts and socials come from CMS site settings. The site presents identity, mission, applications and quote/contact channels in a calm, trustworthy way.

Principles:

1. **Small beats feature-rich.** Every file, dependency and block must earn its place.
2. **Hand-crafted, not templated.** The look of a control-room monitor wall: calm editorial spacing with hairlines in moderation, sharp corners, a few broadcast details, mono tally labels, one two-tone headline, one ASCII hero image.
3. **Platform first.** Use forms, `<dialog>`, Popover API and `<details>` before any JS.
4. **Content is data.** Every user-facing string lives in typed content.

## 2. Goals / non-goals / anti-goals

- **Goals:** Lighthouse ~100 across the board; near-zero client JS (Turnstile on `/quote`, plus one ≤ 2 KB self-hosted ASCII motion module on pages with the ASCII hero); WCAG 2.2 AA; mobile-first; zero hosting cost; near-zero maintenance; typed content separate from code; EN at `/`, optional TR at `/tr/`.
- **Non-goals (forbidden):** visitor auth/accounts, payments, cart, servers/VPS/databases, paid services.
- **Anti-goals:** `any`; swallowed errors; leftover `console.log`; magic numbers, raw hex or px in components; hardcoded copy; repeated style blocks; dead code; unused deps.

## 3. Constraints

- Static asset requests are free and never invoke the Worker. The Worker runs for `/api/*` only (free tier: 100k requests/day).
- `send_email` reaches only **verified** destinations, from a sender on a zone with Email Routing enabled.
- The owner already owns the apex domain and manages it in Cloudflare (zone on the same account). Email Routing and the verified destination can therefore be set up from day one, even while the site is served on `*.workers.dev`; the quote flow works at v1 launch. Attaching the domain to the Worker is optional and later.
- Cost: the domain is already owned; everything else stays on free tiers. R2 stays (the owner explicitly asked for an R2 assets subdomain), but R2 requires a payment method on file even though expected usage stays inside the free tier.
- The repo is public (decided 2026-11-23), so branch protection on main enforces 1 CODEOWNERS approval for free.
- Sveltia is pre-1.0, so pin it exactly.
- Turkish needs `latin-ext` font subsets.

## 4. Approaches considered

**(a) UI.**
- *shadcn React islands:* ships a React runtime for components that need no JS, and carries the exact AI-template look we avoid.
- *Starwind / Basecoat:* no React, but inherits shadcn's radius/shadow/spacing DNA. Overriding it costs more than writing our own.
- **Chosen: own kit** of about 12 Astro primitives, using `class-variance-authority` for variants. Tokens empty the radius and shadow namespaces, so those styles cannot creep in.

**(b) CMS.**
- *Decap:* R2/S3 media is paid only.
- *Keystatic / TinaCMS:* need a server runtime or DB, or a paid review workflow.
- *Pages CMS:* self-hosting needs Postgres.
- **Chosen: Sveltia.** MIT, git-based, Decap-compatible, Lexical editor, editorial workflow. It is one static page, with auth on a free Worker.

**(c) Edge.**
- *Astro Cloudflare adapter:* puts an SSR Worker in front of pages that never change, and couples deploys to adapter releases.
- **Chosen: `output: 'static'` + one hand-written Worker** with `run_worker_first: ["/api/*"]`. Pages stay free, cacheable files. The Worker is about 150 lines and survives Astro upgrades.

## 5. Architecture overview

```
VISITOR ──► Cloudflare edge
              ├─ GET /*            ──► Workers Static Assets (dist/)  + public/_headers
              └─ POST /api/quote   ──► worker/index.ts
                                         ├─ validate (src/lib/quote-schema.ts)
                                         ├─ POST challenges.cloudflare.com/turnstile/v0/siteverify
                                         ├─ env.QUOTE_MAILER.send(EmailMessage) ──► verified inbox
                                         └─ 303 → /[tr/]quote/#sent | #error-<code>

EDITOR ──► /admin (Sveltia, static) ──► sveltia-cms-auth Worker (GitHub App OAuth;
              separate Worker from the official repo, deployed by hand, not vendored here)
              └─ editorial_workflow: branch + PR per entry
                    └─ ADMIN (CODEOWNER) reviews preview build, merges to main
                          └─ Cloudflare Workers Builds: pnpm build → wrangler deploy
```

## 6. Folder architecture

```
.
├─ CLAUDE.md                         # ≤20 lines: read memory-bank/ first, use team-delegation skill
├─ .claude/skills/team-delegation/SKILL.md  # manager delegates: Opus 5.5 high (standard/design),
│                                    #   Sonnet 5.5 (well-specified impl/research), Haiku 5.5 (mechanical);
│                                    #   1–5 background agents; commit+push always done by an agent
├─ memory-bank/                      # projectbrief, techContext, systemPatterns, activeContext, progress (.md)
│                                    #   read before every task, update after every meaningful change
├─ docs/superpowers/specs/           # this spec; plans live beside it
├─ .github/CODEOWNERS                # * @<admin-handle>
├─ astro.config.ts  wrangler.jsonc  biome.json  tsconfig.json  package.json  .nvmrc
├─ public/
│  ├─ _headers                       # security + cache headers (static responses only)
│  ├─ favicon.svg                    # neutral; brand logo comes from settings
│  └─ admin/
│     ├─ index.html                  # loads pinned Sveltia bundle with SRI
│     └─ config.yml                  # backend (base_url = auth Worker URL, edited once by hand),
│                                    #   i18n, collections, media folders
├─ src/
│  ├─ content.config.ts              # all collections: glob loader + schemas from lib/content-schemas.ts
│  ├─ content/
│  │  ├─ settings/site.yaml          # singleton, shared across locales
│  │  ├─ ui/{en,tr}/strings.yaml
│  │  ├─ navigation/{en,tr}/main.yaml
│  │  ├─ pages/{en,tr}/<slug>.yaml   # home, about, contact, privacy, applications, quote, not-found
│  │  └─ applications/{en,tr}/<slug>.yaml
│  ├─ assets/
│  │  ├─ fonts/                      # 2 variable woff2 families (consumed by the fonts API)
│  │  └─ uploads/                    # CMS image uploads → AVIF/WebP at build;
│  │                                 #   seed: transmitter-mast hero (ASCII source; transmitter.png)
│  ├─ styles/
│  │  ├─ tokens.css                  # @theme: every design token
│  │  └─ global.css                  # base, prose, grid, lower-third, scanline, reduced-motion
│  ├─ lib/
│  │  ├─ i18n.ts                     # locales, localizePath, alternates, t() with en fallback
│  │  ├─ content.ts                  # getPage/getApplications/getSettings with locale fallback
│  │  ├─ content-schemas.ts          # entry schemas of every collection (tested)
│  │  ├─ sections-schema.ts          # block union (shared by pages + applications)
│  │  ├─ blank.ts                    # optionalField: a blank CMS value counts as absent
│  │  ├─ page-slugs.ts               # own-route and forbidden page slugs
│  │  ├─ markdown.ts                 # memoized Astro markdown processor
│  │  ├─ seo.ts                      # meta, canonical, hreflang, Organization JSON-LD
│  │  ├─ ascii.ts                    # sharp → glyph grid + quantized tone runs
│  │  ├─ color.ts                    # hex validation + contrast check for accent
│  │  └─ quote-schema.ts             # form schema, enums, limits (site + Worker)
│  ├─ integrations/build-outputs.ts  # astro:build:done: writes worker/generated/solutions.json;
│  │                                 #   on non-production builds appends X-Robots-Tag: noindex to dist/_headers
│  │                                 #   fails on a locale page linking the EN URL of its own translation
│  ├─ layouts/BaseLayout.astro       # <html>, head, fonts, accent var, skip link, header/footer
│  ├─ components/
│  │  ├─ ui/                         # Button, Label, Heading, Tally, Timecode, GridFrame,
│  │  │                              #   Field, Input, Textarea, Select, Checkbox, AsciiImage, Prose,
│  │  │                              #   DuotoneCover
│  │  ├─ sections/                   # Hero, Statement, AppGrid, FeatureList, RichText, Cta, Faq,
│  │  │                              #   SectionRenderer (exhaustive switch on `type`)
│  │  ├─ layout/                     # SiteHeader, SiteFooter, MobileNav (popover),
│  │  │                              #   LanguageToggle, TallyStrip, SeoHead
│  │  └─ pages/                      # GenericPage, ApplicationPage, QuotePage, NotFoundPage
│  └─ pages/
│     ├─ [...slug].astro             # EN generic route: maps sections[] → components
│     ├─ applications/[slug].astro   # EN application detail
│     ├─ quote.astro                 # EN quote form
│     ├─ 404.astro
│     ├─ robots.txt.ts               # disallow /admin, absolute sitemap URL
│     └─ tr/                         # thin wrappers (≤5 lines each) passing locale="tr"
│        ├─ [...slug].astro  applications/[slug].astro  quote.astro  404.astro
└─ worker/
   ├─ index.ts                       # router: POST /api/quote; other /api/* → 404 via ASSETS
   ├─ quote.ts                       # handler: checks → parse (+ solutions allow-list) → Turnstile → mail → 303
   ├─ turnstile.ts                   # siteverify call
   ├─ mail.ts                        # minimal RFC 5322 text/plain builder (no deps)
   ├─ headers.ts                     # security headers for Worker responses
   ├─ generated/solutions.json       # build output, gitignored: valid application slugs + "general"
   └─ tsconfig.json                  # workers-types, strict
```

**Conventions:**
- Component files are PascalCase (`AppGrid.astro`); everything else is kebab-case.
- One component per file, one responsibility per file.
- Route files only delegate to `components/pages/`.
- Constants are named, at the top of the file that owns them.

## 7. Content model

- Content is YAML, with one folder per locale (Sveltia `multiple_folders`). Entry ids are `<locale>/<slug>`, and the `home` slug maps to `/`.
- **settings** (singleton):
  - `brandName`
  - `logo` + `logoAlt`
  - `accent`: CMS field restricted to a 6-digit hex pattern (`^#[0-9a-fA-F]{6}$`) with a hint about contrast. The build validates ≥3:1 contrast against the canvas and fails loudly, with a message naming the field (no silent adjustment)
  - `contacts[]`: {kind, value, href}
  - `socials[]`
  - `ogImage`
  - `organization`: {legalName, url, address?}
- **ui:** keyed strings. TR may be partial and falls back to EN; a blank TR string counts as missing (EN fallback), never a build failure.
- **navigation:** `header[]`, `footer[]` of {label, href}.
- **pages:** `title`, `description`, `ogImage?`, `sections[]`. Slugs `admin`, `api` and every locale code are forbidden (they would shadow `/admin/`, `/api/` or a locale root); the build fails naming the slug.
- **Blank optional values:** every optional field (`ogImage`, `organization.address`, `links`, `brochure`, feature-list `duration`, cta `text`) reads a blank value (`""`, whitespace-only or `null`) as absent, so a field cleared in the CMS never fails the build (`optionalField`, `lib/blank.ts`). The CMS also leaves empty optional fields out (`output.omit_empty_optional_fields`) and starts new entries in EN only (`i18n.initial_locales: default`).
- **applications:**
  - `name`, `slug`, `tagline`, `summary`, `category`
  - `cover` + `coverAlt` (the cover is also the page's og:image)
  - `status` (short tally label)
  - `order`
  - `links[]?`
  - `brochure?` (R2 URL)
  - `sections[]`

```ts
// src/lib/sections-schema.ts
import { z } from 'astro/zod';
import type { SchemaContext } from 'astro:content';

const MAX_ACTIONS = 2;
const MAX_ITEMS = 8;
const label = z.string().max(32);                      // mono tally label, e.g. "MISSION"
const action = z.object({ label, href: z.string().regex(/^(\/|https:\/\/)/) });
const md = z.string();                                 // Markdown, rendered by lib/markdown.ts

export const sectionsSchema = ({ image }: SchemaContext) =>
  z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('hero'), label, headline: z.string(), headlineAccent: z.string(),
               lede: z.string(), actions: z.array(action).max(MAX_ACTIONS),
               image: image(), imageAlt: z.string() }),
    z.object({ type: z.literal('statement'), label, text: z.string() }),
    z.object({ type: z.literal('app-grid'), label, heading: z.string(),
               apps: z.array(z.string()).default([]) }),           // slugs; empty = all, by `order`
    z.object({ type: z.literal('feature-list'), label, heading: z.string(),
               items: z.array(z.object({ title: z.string(), body: z.string() })).min(1).max(MAX_ITEMS) }),
    z.object({ type: z.literal('rich-text'), body: md }),
    z.object({ type: z.literal('cta'), heading: z.string(), text: z.string().optional(), action }),
    z.object({ type: z.literal('faq'), label, items: z.array(z.object({ q: z.string(), a: md })).min(1) }),
  ]));

export type Section = z.infer<ReturnType<typeof sectionsSchema>>[number];
```

- Markdown is rendered by `@astrojs/markdown-remark`, Astro's own pipeline.
- The Applications index is a `pages` entry with an `app-grid` block.
- TR routes build only translated entries. The toggle links to the TR twin, or to `/tr/` if there is none.
- Content hrefs (navigation, actions, Markdown links) are written as EN site paths in every locale and localized at render time (`lib/localize-href.ts`): a TR page links `/tr/<path>` when TR builds that page or application, else the EN URL. Translating a page needs no navigation edit.
- `hreflang` lists only existing translations, plus `x-default` pointing to EN.

**v1 seed content.** The repo ships brand-neutral, realistic placeholder content:
- EN: `settings`, `ui`, `navigation`, all pages, and 3 sample applications.
- TR: `ui`, `navigation` and the home page only, to prove the plumbing and the EN fallback.
- A bold broadcast motif is included as the ASCII source: a transmitter mast with signal waves radiating from its top (`src/assets/uploads/transmitter.png`; owner direction 2026-11-23: the look must evoke broadcasting to anyone).
- Real tenant content is entered later by admins through the CMS.

## 8. Design system

**Tokens** (`src/styles/tokens.css`, `@theme`):

| Group | Tokens |
|---|---|
| Color (OKLCH) | `canvas`, `surface`, `ink`, `ink-muted`, `line`, `line-strong`, `critical`; `accent` = `var(--accent-seed)` (the only value injected from settings, on `<html>`); `accent-dim` and `accent-wash` derived via `color-mix(in oklab, …)` (oklab: oklch hue path runs through green) |
| Bars | `bars-white … bars-blue`: the seven SMPTE 75% bars (`rgb(75% 75% 75%)` …). A fixed broadcast standard, not brand colour: the documented exception to the accent-only rule, used only by `BarsStrip` and `NoSignal` (decorative, `aria-hidden` / one `role="img"`) |
| Type | `--font-sans`, `--font-mono`; `--text-label`, `-body`, `-lede`, `-h2`, `-display` (fluid `clamp`); `--tracking-label` |
| Space | `--spacing: 0.25rem` (4px base) |
| Line | `--border-hairline: 1px` |
| Radius / shadow | `--radius-*: initial; --shadow-*: initial` (no such utilities exist) |
| Z-index | `--z-header`, `--z-popover` |
| Motion | `--duration-fast` 120ms, `--duration-base` 240ms, `--ease-signal` |
| Layout | `--container-page`, 12-column grid |

**Typography:**
- **Schibsted Grotesk** (display/body): a variable grotesk drawn for a newspaper group, so it has press heritage, sharp, and is unused by templates.
- **Martian Mono** (labels/data): its wide, instrument-like forms read like broadcast hardware labelling.
- Both are OFL and loaded via `fontProviders.local()`. Swappable, but never for Inter, Geist, Space Grotesk, Poppins or Montserrat.

**Border budget (binding, owner feedback 2026-11-23):** borders in moderation. 1px hairlines appear only on:
1. the header's bottom edge and the footer's top edge;
2. section dividers (one rule between major sections; it may carry a label);
3. form controls (inputs, selects, textareas, buttons, the menu key);
4. the `TitleSafe` media frame, used only on the hero media and the ApplicationPage cover.

Everything else (content grids, cards, feature lists, FAQ, CTA, rich-text block quotes) gets its hierarchy from spacing, `surface` vs `canvas` tone and type: no boxed cells. `GridFrame` is spaced only. The "+" crosshairs are retired.

**Broadcast details (CSS only, no client JS, static under reduced motion), used sparingly:**

| Detail | Where | Notes |
|---|---|---|
| Tally + PGM/PVW | `TallyStrip` | `surface` band under the header, segments split by spacing. LIVE and PGM lamps accent, PVW muted; labels from `ui` (`tallyProgram`, `tallyPreview`) |
| Title-safe corner brackets | exactly two media frames: the hero ASCII and the ApplicationPage cover (app-grid tile covers stay frameless) | `TitleSafe`: hairline frame; the picture is inset by the title-safe margin (`--title-safe-inset`, 5% of the frame width), and four L-shaped marks sit inside that margin, so they never cross the media |
| Lower third | section headings (`app-grid`, `feature-list`) and application card titles | `LowerThird`: heading above, mono label strap below (translucent ink band, accent key on its leading edge), in an `<hgroup>` |
| Rundown rows | `feature-list` | numbered rows, title, body and a mono duration column `HH:MM:SS` from the item's optional `duration` (display only) |
| SMPTE colour-bar micro strip | one signature divider: laid on the footer's top rule at the content edge | `BarsStrip`, `bars-*` tokens, `aria-hidden` |
| "NO SIGNAL" test pattern | 404 page | `NoSignal`: bars filling a 16:9 frame, canvas slate with a muted tally and `ui.noSignal` |

A VU meter was considered and dropped: a second perpetual animation beside the running timecode added clutter.

**Do:**
- Hairlines only within the border budget above, never doubled.
- Uppercase tracked mono labels with an index, e.g. `[02] APPLICATIONS`.
- One two-tone headline per page.
- Typographic glyphs (→ ↗ + ●) instead of icons.
- Motion on opacity/transform only, ≤240ms. Exceptions: the Timecode counter and the AsciiImage live signal (ambient, static under reduced motion).
- Scanlines on the hero only.
- Accent for large text and graphics only.

**Don't:** radius, shadows, gradients (except the ASCII hum bar and the hero scanlines), blur/glass, purple (the SMPTE magenta bar is the standard's own, not decoration), boxed content grids, emoji, icon packs, stock photos, centered three-icon feature rows.

| Block | Visual |
|---|---|
| `hero` | Spaced split (no cell borders): label, two-tone headline, lede, ≤2 actions left; ASCII render right in `TitleSafe` with scanlines. The image must be a PNG, JPEG or WebP raster (the CMS field accepts only those; any other type fails the build naming the file) |
| `statement` | Full-width mission sentence in display type, mono label in the gutter |
| `app-grid` | Spaced `surface` tiles (no borders): index, status tally, lower-third name, tagline, frameless duotone cover, → (internal link) |
| `feature-list` | Rundown: numbered rows, title, body, mono `HH:MM:SS` duration column; spacing between rows, no rules |
| `rich-text` | `Prose` column ≤68ch, mono h3+ |
| `cta` | One `surface` band (no border): heading, single action, accent "ON AIR" tally |
| `faq` | Native `<details>` rows, "+" ↔ "−"; spacing between rows, no rules |

**Signature components:**

- **`AsciiImage`:**
  - At build, `sharp` resizes the CMS image to N columns.
  - Luminance picks a glyph from a ramp; each glyph gets one of 6 accent/ink tones.
  - Same-tone runs merge into one `<span>`.
  - Output is a `<pre aria-hidden>` inside a `<figure role="img" aria-label>`, sized with container query units.
  - **Signature moment: a live broadcast signal** (Task 7b; owner: "ASCII effects must be animated", and the effect must evoke broadcasting to anyone). Only under `prefers-reduced-motion: no-preference`; the build-time render is the no-JS and reduced-motion picture. Zero layout shift: rows are full-width inline-blocks, motion is transform, opacity and same-width glyphs only. Each effect maps to a broadcast idea:
    - *Tuning in* (module): when the figure first scrolls into view, the frame is static noise that resolves glyph by glyph into the picture over about 1.2 s (random order, rolling roughly top-down; tones settle with their glyphs). On a cold load, a figure already in view whose first report comes more than 300 ms after navigation start has already painted the still picture, so it skips the tune-in and goes straight to live.
    - *Transmission* (module): a ring of brightness leaves the transmitter every 2.5 s (`WAVE_CADENCE_MS`) and travels outward from `WAVE_ORIGIN` (top centre, the seed's mast top). Glyphs under a ring step up in tone, a dotted front crosses empty sky, and the signal fades with distance. A little glyph grain (rare ramp-neighbour flicker) rides on top.
    - *Hum bar* (CSS): a soft colour-dodge band rolls slowly down the picture, like mains hum on a monitor.
    - *Sync slip* (CSS): both slip bands share one 36 s cycle with slips at 4 s (rows 5–6), 13 s (rows 10–12) and 26 s (rows 5–6), so the gaps are 9, 13 and 14 s (never under 8 s). Each slip tears a band sideways by a fraction of a glyph and dips it for about two frames (a dropout).
    - *Breath* (CSS, no-JS picture only): the brightest tone dims and recovers in coarse steps.
  - **HOLD key** (WCAG 2.2.2 pause, no extra JS): a native checkbox styled as a broadcast key at the end of `TallyStrip`, on every page and breakpoint, outside the strip's `aria-hidden` status segments, 44px tall, labelled by `ui.motionHold` (EN "Hold", TR "Beklet") and described by `ui.motionHoldHint`. Off by default (the site moves). Checked, `global.css` sets `animation-play-state: paused` on everything (timecode, hum bar, slips, breath), its lamp lights, and the ASCII module stops and restores the static markup.
  - The module (`lib/ascii-motion.ts` pure logic, thin glue in the component) is one Astro-bundled `/_astro/*.js` file (≤ 2 KB gzipped, CSP `script-src 'self'`). It runs only on the visible grid, pauses offscreen and in hidden tabs, never runs under reduced motion (and follows changes to it) or while HOLD is checked, and restores the build-time markup whenever it stops. It caches each row's last markup, so frames never read `innerHTML`.
- **`TallyStrip`:** `■ LIVE` plus SMPTE timecode `HH:MM:SS:FF`, made with a CSS `@property` counter (no JS), channel, `■ PGM ■ PVW` and the format. Static under reduced motion.

```
 [LOGO]                 APPLICATIONS   ABOUT   CONTACT     EN / TR  [QUOTE →]
──────────────────────────────────────────────────────────────────────────────  header rule
 ■ LIVE  TC 00:14:07:12  CH 01  ■ PGM ■ PVW                            1080i50   surface band

 [01] MISSION                   ┌──────────────────────────────────────────────┐
                                │   ┌─                                    ─┐   │
 Software that keeps            │    ..::--==++**##%%@@@@%%##**++==--::..      │
 every newsroom on air.         │    :=*#%@@@@%#*+=-::::-=+*#%@@@@%#*=:        │
 ^ ink        ^ accent line     │    -+#@@@%*=:.   ASCII render   .:=*%@@@     │
                                │    :=*#%@@@@%#*+=-::::-=+*#%@@@@%#*=:        │
 Lede, max 60ch, ink-muted.     │   └─                                    ─┘   │
                                └──────────────────────────────────────────────┘
 [ EXPLORE APPLICATIONS → ]       ^ TitleSafe: hairline frame, title-safe marks, scanlines
 [ REQUEST A QUOTE → ]
──────────────────────────────────────────────────────────────────────────────  section divider
 ...
▀▀▀▀▀▀▀────────────────────────────────────────────────────────────────────────  footer rule + bars strip
```

Internal links (the quote key included) use →, outbound links ↗, both drawn by `Glyph`.

## 9. `wrangler.jsonc` (draft)

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "corporate-site",
  "main": "worker/index.ts",
  "compatibility_date": "2026-11-23",
  "workers_dev": true,
  "preview_urls": true,
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"],
    "not_found_handling": "404-page",       // serves nearest 404.html, so /tr/* gets tr/404.html
    "html_handling": "auto-trailing-slash"
  },
  // No destination_address: the recipient is a secret, keeping tenant data out of the repo.
  "send_email": [{ "name": "QUOTE_MAILER" }],
  "observability": { "enabled": true },
  "vars": { "MAX_BODY_BYTES": "16384" }
  // Secrets (wrangler secret put / dashboard), never committed:
  //   TURNSTILE_SECRET_KEY  – Turnstile widget secret
  //   QUOTE_TO              – verified Email Routing destination
  //   QUOTE_FROM            – sender on the Email Routing-enabled zone (the owner's existing zone;
  //                           works from day one while the site is served on *.workers.dev)
  // Optional, later, when the owner attaches the apex/hostname:
  //   "routes": [{ "pattern": "<domain>", "custom_domain": true }]
}
```

Build order is `astro build` (its `astro:build:done` hook writes `worker/generated/solutions.json`) → Worker bundle (`wrangler`), which imports that JSON.

Workers Builds build variables, set in the dashboard: `SITE_URL` (feeds `site`) and `PUBLIC_TURNSTILE_SITE_KEY` (read via `astro:env`). These hold production values and are used only on `main`. On any other branch (detected via `WORKERS_CI_BRANCH`), the build ignores them: it uses Turnstile's official always-pass test site key, `SITE_URL` falls back to the preview host, and `robots.txt` disallows everything. The auth Worker URL is not a build variable (see §13).

## 10. `package.json` (draft)

```json
{
  "name": "corporate-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=26.13.1" },
  "packageManager": "pnpm@12.23.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro build && wrangler dev",
    "check": "astro check && tsc -p worker --noEmit",
    "lint": "biome check .",
    "format": "biome check --write .",
    "deploy": "astro build && wrangler deploy"
  },
  "dependencies": {
    "astro": "7.4.13",
    "@astrojs/sitemap": "3.7.6",
    "@astrojs/markdown-remark": "7.3.10",
    "tailwindcss": "4.3.5",
    "@tailwindcss/vite": "4.3.5",
    "class-variance-authority": "0.7.1",
    "sharp": "0.35.5"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.12",
    "typescript": "6.0.3",
    "@biomejs/biome": "2.6.8",
    "wrangler": "4.166.0",
    "@cloudflare/workers-types": "5.20261123.1"
  }
}
```

`.nvmrc`: `26.13.1`.

| Dependency | Reason |
|---|---|
| astro | SSG, content layer, i18n, fonts, `astro:assets` |
| @astrojs/sitemap | i18n sitemap |
| @astrojs/markdown-remark | Astro's own Markdown pipeline; an optional peer in Astro 7 |
| tailwindcss, @tailwindcss/vite | Token-driven utilities via `@theme` |
| class-variance-authority | Typed variants |
| sharp | Build-time ASCII. Astro's optional dep (`^0.35.4`); a direct dep for pnpm strict |
| @astrojs/check | `astro check` |
| typescript | 6.x: `@astrojs/check@0.9.12` peers `^5 \|\| ^6` |
| @biomejs/biome | Lint + format |
| wrangler, @cloudflare/workers-types | Worker dev, deploy, types |

## 11. Security headers — `public/_headers`

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/admin/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.githubusercontent.com; media-src blob:; connect-src 'self' https://api.github.com https://*.githubusercontent.com https://<auth-worker>.workers.dev; frame-ancestors 'none'; base-uri 'self'; object-src 'none'

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

- `'unsafe-inline'` is allowed for styles only.
- `<auth-worker>` in the `/admin/*` policy is edited once by hand to the real auth Worker URL (§13 step 6), together with `base_url` in `config.yml`.
- Non-production (preview) builds additionally get `X-Robots-Tag: noindex` appended to `dist/_headers` by `src/integrations/build-outputs.ts`.
- The Worker sets its own `nosniff`, `Referrer-Policy`, HSTS and `Cache-Control: no-store` in `worker/headers.ts`.

## 12. Quote flow

The form is a plain `<form method="post" action="/api/quote">`:
- **Fields:** name, work email, company, role, country (text, `autocomplete="country-name"`), solutions (checkboxes: applications + `general`), timeline (keys `asap|quarter|half-year|exploring`), message, consent (links to privacy).
- **Hidden fields:** `locale` and `cf-turnstile-response`.
- **Limits:** all limits and enums live in `src/lib/quote-schema.ts` and drive both the HTML attributes and the Worker validation.
- **Solutions allow-list:** the Astro build emits `worker/generated/solutions.json` (every application slug, deduplicated across locales, plus the literal `general`) through `src/integrations/build-outputs.ts` (`astro:build:done`). The Worker imports it and rejects unknown slugs. It is generated, gitignored and has no runtime lookup.
- **Availability:** the flow works at v1 launch on `*.workers.dev`, because Email Routing lives on the owner's existing zone (§3, §13).
- **JS:** Turnstile (`data-action="quote"`) loads on the quote pages only (`/quote/`, `/tr/quote/`). The only other client JS outside `/admin/` is the ASCII motion module, on pages that render the ASCII hero (§8).

Worker steps:
1. Accept only `POST /api/quote`; anything else returns 405.
2. Require same `Origin`, a form content type, and body size ≤ `MAX_BODY_BYTES`.
3. `formData()` → `safeParse`. Single-line fields reject CR/LF, which blocks header injection. Every `solutions` value must be in the generated allow-list; otherwise the request fails as `#error-invalid`.
4. Call siteverify with `secret`, `response` and `remoteip`. Require `success`, the expected `hostname` and `action`. Tokens are single-use and expire after 300s.
5. Build a `text/plain` UTF-8 MIME message (`Reply-To` = visitor) and `send()` it via `QUOTE_MAILER`.
6. Respond `303` to `/[tr/]quote/#sent` or `#error-invalid|verify|send`. The status panels are `:target` panels with `tabindex="-1"`.

Error handling:
- Failures are logged with `console.error({ code, step })` (no PII) and never swallowed.
- A no-JS POST fails verification and lands on `#error-verify`, which shows the direct email from settings.

## 13. Deployment & admin setup checklist

Deploy order: **auth Worker → GitHub App callback → site.**

1. **Repo:** public (decided 2026-11-23), so branch protection on main enforces 1 CODEOWNERS approval for free. Add `.github/CODEOWNERS`.
2. **Roles:** Admin = Maintain/Admin + CODEOWNER. Editor = Write.
3. **Ruleset on `main`:** PR required, 1 CODEOWNERS approval, no force-push. Bypass list: the Repository admin and Maintain roles only, so admins can merge their own changes (otherwise nothing the owner writes could ever be published); editors (Write) are not on it and always need 1 Code Owner approval (runbook 3.4).
4. **Auth Worker (first, by hand):**
   - Deploy the official `sveltia/sveltia-cms-auth` repo as its own Worker. It is not vendored in this repo.
   - Record its URL.
   - Set `ALLOWED_DOMAINS` to the production site host(s). The `<worker-name>.<account-subdomain>.workers.dev` host is known before the first site deploy.
5. **GitHub App:** callback `https://<auth-worker>/callback`; contents and PR read/write. Then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as secrets on the auth Worker.
6. **One-time repo edit, committed before the first site deploy:** put the auth Worker URL in `config.yml` `base_url` and in the `/admin/*` `connect-src` in `_headers`.
7. **`config.yml`:**
   - `backend: github`, `publish_mode: editorial_workflow`.
   - i18n `multiple_folders` en/tr, default en.
   - Settings as a singleton.
   - `media_folder: src/assets/uploads`, with a relative `public_folder` per collection.
   - `accent` field: 6-digit hex pattern plus a contrast hint.
8. **Workers Builds (the site):**
   - Production branch `main`; build with `pnpm build`, deploy with `npx wrangler deploy`.
   - Build vars (production values, used on `main` only): `SITE_URL`, `PUBLIC_TURNSTILE_SITE_KEY`.
   - Preview builds on for PR branches. They are for visual review only: Turnstile test keys, `SITE_URL` = preview host, `noindex`, and CMS auth not expected to work.
9. **Turnstile:** production Managed widget with hostnames set. `TURNSTILE_SECRET_KEY` as a secret. Production keys live on `main` only.
10. **Email Routing (day one, no custom hostname needed):** the zone is on the account. Enable Email Routing, verify the destination inbox, then set `QUOTE_TO` and `QUOTE_FROM`.
11. **R2:**
    - Bucket on `assets.<domain>`, with `r2.dev` disabled.
    - Cache Everything rule.
    - CORS `GET` from the site origin.
    - A payment method must be on file for R2, even inside the free tier.
12. **Custom hostname (optional, later):** attach it to the Worker, then update `SITE_URL`, the Turnstile hostnames and `ALLOWED_DOMAINS`.
13. **Verify:**
    - Lighthouse.
    - Headers scan.
    - Quote with JS, without JS, and with a bad token.
    - axe on every template.

## 14. Left to the builder

- **TypeScript:** `@astrojs/check@0.9.12` peers `typescript ^5 || ^6`, so 7.0.2 is unsupported. Bump the 6.0.3 pin to the newest 6.x.
- **Fonts:** confirm the Astro 7 `fontProviders.local()` option shape.
- **i18n fallback:** confirm how Astro i18n `fallback` behaves for dynamic routes in static output.
- **Sveltia (0.271.2):** confirm support for `editorial_workflow`, `type`-keyed variable lists, singletons, per-collection media folders and R2. Without R2 support, store R2 URLs as plain fields.
- **Worker zod:** confirm wrangler bundles `astro/zod` cleanly. If not, add `zod` matching `^4.6.7`.
- **Build image:** confirm Workers Builds supports Node 26.13.1 + pnpm 12; fall back to Node 24 LTS.
- **Email:** confirm `send_email` without `destination_address` works on the free plan, or prefer Cloudflare's structured send API if it is GA.
- **CSP:** confirm `dist/` has no inline `<script>`. If it does, externalize them or adopt Astro CSP hashing.
- **ASCII hero:** tune the columns, ramp and tones. Keep the hero HTML under ~30 KB.
- **Turkish glyphs:** confirm both font subsets include them.
- **Previews:** confirm how Workers Builds exposes the preview host (for the `SITE_URL` fallback) and how to give preview Worker versions the Turnstile test secret (for example `--var` on the non-production upload command). Quote submission is not exercised on previews.
- **Generated JSON and type-check:** `tsc -p worker` needs `worker/generated/solutions.json`, so `check` must run after a build (or CI builds first).
- **Auth Worker:** confirm the official repo's current deploy steps and variable names at deploy time.
- Resolved 2026-11-23: repo is public; enforce CODEOWNERS review via branch protection on main.

## 15. Calls made by the architect

1. Fonts: Schibsted Grotesk + Martian Mono.
2. Fonts live in `src/assets/fonts/` (fonts API), not `public/fonts/`.
3. `robots.txt` is an Astro endpoint, because it needs an absolute sitemap URL.
4. `SITE_URL` and the Turnstile site key are build vars, not CMS settings.
5. The quote sender and recipient are Worker secrets, and `send_email` has no `destination_address`, so no tenant data is in the repo.
6. A no-JS quote POST is rejected at Turnstile and shown an email fallback. Status uses CSS `:target` panels, with no extra pages.
7. Abuse control is Turnstile + same-origin check + body cap. No honeypot or rate-limit binding.
8. Colored ASCII uses 6 quantized accent/ink tones with run-length spans, not truecolor.
9. The timecode is a CSS counter (no JS). The LIVE tally uses the accent; there is no red.
10. The radius and shadow token namespaces are reset, so those utilities cannot be used.
11. The accent must reach ≥3:1 on the canvas (enforced by the build, see 26) and is never used for body text. `critical` is the only other semantic color.
12. The Applications index is a `pages` entry with `app-grid`. An empty list means all applications, sorted by `order`.
13. TR routes are thin wrappers. TR builds only translated entries, and the toggle falls back to `/tr/`.
14. Per-locale 404s come from `404-page` handling. `auto-trailing-slash` is paired with `trailingSlash: 'always'`.
15. `@astrojs/markdown-remark` is added explicitly, because it is an optional peer in Astro 7.
16. R2 files are linked, not embedded, in v1, so the CSP does not name the assets host.
17. Workers Builds preview builds run for PR branches, so admins can review before merging (visual review only, see 24).
18. Component files are PascalCase; all other files are kebab-case.
19. Structured, PII-free `console.error` in the Worker is the only console use allowed.
20. TypeScript is pinned to 6.0.3, not 7.0.2, because of the `@astrojs/check` peer range.
21. The repo is public (decided 2026-11-23), so branch protection on main enforces 1 CODEOWNERS approval for free.
22. `sveltia-cms-auth` is not vendored. It is deployed once, by hand, from the official repo as its own Worker before the site. Its URL is set by a one-time manual edit of `config.yml` `base_url` and the `/admin/*` CSP in `_headers`, not a build variable: a generator step for two static values that change at most once would be over-engineering. Deploy order: auth Worker → GitHub App callback → site.
23. Quote `solutions` are validated against a generated allow-list. A small Astro integration (`astro:build:done`) writes `worker/generated/solutions.json` (application slugs + `general`), and the Worker imports it. Build order is `astro build` → Worker bundle. Unknown slugs are rejected.
24. PR preview builds are for visual review only. They use Turnstile's official always-pass test keys, `SITE_URL` falls back to the preview host, previews are `noindex` (`X-Robots-Tag` + disallow-all `robots.txt`), and CMS auth is not expected to work on them. Production keys are used only on `main`.
25. v1 ships brand-neutral, realistic placeholder seed content: EN for settings, ui, navigation, all pages and 3 sample applications; TR for ui, navigation and home only, to prove the plumbing and fallback. A transmitter-mast hero image (signal waves from its top) is the ASCII source. Real content is entered later by admins via the CMS.
26. The accent is validated, never adjusted. The CMS field is restricted to a 6-digit hex pattern with a contrast hint, and the build fails loudly, naming the field, when contrast against the canvas is below 3:1. Admins see the failure on the PR preview before merging.
