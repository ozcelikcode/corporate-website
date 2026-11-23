# Corporate Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static, brand-agnostic corporate showcase (EN at `/`, optional TR at `/tr/`), its single quote Worker (`POST /api/quote`) and the Sveltia admin, exactly as the approved spec describes.

**Architecture:** Astro 7 `output: 'static'` renders typed YAML content (content layer + `astro/zod`) through a hand-made UI kit and 7 section blocks into `dist/`, served by Workers Static Assets. One hand-written Worker handles `/api/*` only, validating with the same schema module the site uses. Pure logic lives in small `src/lib/*` and `worker/*` modules tested with `node --test`; Astro glue stays thin and is verified through `pnpm build` and assertions on `dist/`.

**Tech Stack:** Node 26.13.1, pnpm 12.23.0, Astro 7.4.13, Tailwind 4.3.5, class-variance-authority 0.7.1, sharp 0.35.5, @astrojs/markdown-remark 7.3.10, @astrojs/sitemap 3.7.6, TypeScript 6.x, Biome 2.6.8, Wrangler 4.166.0, Cloudflare Workers (Static Assets, `send_email`, Turnstile), Sveltia CMS 0.271.2.

**Spec:** `docs/superpowers/specs/2026-11-23-corporate-site-design.md`

## Global Constraints

- Node `26.13.1` (`.nvmrc`, `engines.node: ">=26.13.1"`); `packageManager: "pnpm@12.23.0"`.
- Dependencies are the closed list in spec §10, exact pins, no ranges. TypeScript: newest `6.x` (not 7). The only pre-approved fallback is `zod` pinned exactly at the newest `4.x` ≥ 4.6.7, if wrangler cannot bundle `astro/zod`. Also pre-approved: `@types/node` pinned exactly at the newest `26.x` as a devDependency, only if `pnpm check` fails on Node globals (see Task 1 Step 1). Anything else needs the manager's approval first.
- Astro: `output: 'static'`, `trailingSlash: 'always'`, `build.format: 'directory'`, no adapter, no Astro `i18n` routing config (locale routing and fallback are done by hand in `src/lib`).
- Code rules (CLAUDE.md): no `any`; no swallowed errors; no `console.log` (Worker may only call `console.error({ code, step })`, no PII); no magic numbers, raw hex or raw px in components/layouts (tokens and named constants at the top of the owning file); no hardcoded copy; one responsibility per file; PascalCase components, kebab-case everything else; no dead code or unused deps.
- TypeScript: `astro/tsconfigs/strictest` + `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`. Relative imports end in `.ts`. No enums, namespaces or parameter properties (Node type stripping must run every tested file).
- Tests: `node --test` only (`pnpm test`); `*.test.ts` sits next to its unit; tested modules never import `astro:*` at runtime (`import type` is fine). Test files are excluded from both tsconfigs; Biome still lints them. The root tsconfig gets `"types": ["node"]` only if the `@types/node` fallback is used; the worker tsconfig keeps `@cloudflare/workers-types`.
- Brand-agnostic: never name a tenant. Seed uses brand `Brand`, legal name `Brand Ltd.`, domain `example.com`, email `hello@example.com`.
- Client JS: none, except the Turnstile script on `/quote/` and `/tr/quote/`, the pinned Sveltia bundle on `/admin/`, and (amended in Task 7b, owner request "ASCII effects must be animated") the ASCII motion module: one self-hosted, Astro-bundled `<script type="module" src="/_astro/….js">` on exactly the pages that render `AsciiImage` (≤ 2 KB gzipped, no dependencies, inert under reduced motion). `astro.config.ts` sets `vite.build.assetsInlineLimit` so script chunks are never inlined (CSP `script-src 'self'`). `<script type="application/ld+json">` data blocks are allowed. No inline executable `<script>` anywhere in `dist/`.
- Every user-facing string comes from content (`settings`, `ui`, `navigation`, `pages`, `applications`). The only exceptions are the temporary scaffold page `src/pages/index.astro` (Tasks 1–7), deleted in Task 8, and the Worker's quote email subject and body labels (operator-facing, sent to the operator's own inbox), which are named constants at the top of `worker/mail.ts`.
- Design: spec §8 rules, tokens from Task 2 only. Every UI task passes the **VA checklist** and the **guard greps** below.
- Security headers: spec §11 verbatim in `public/_headers`. Secrets only via `wrangler secret put`: `TURNSTILE_SECRET_KEY`, `QUOTE_TO`, `QUOTE_FROM`. Free tier only.
- Git: `git add <explicit paths>` only (never `-A` or `.`); Conventional Commits; every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A no-JS quote POST (no `cf-turnstile-response` field, otherwise valid) must land on `#error-verify` (which shows the email fallback), never on `#error-invalid`, and must not call siteverify. Pinned in Task 10.
2. A TR page linking to content with no TR translation (application cards, nav, toggle) must link to the existing EN URL and never to a missing `/tr/...` page. Pinned in Task 3 (`resolveLocalized`, `mergeByLocale`) and Task 8 (broken-link scan over `dist/`).
3. A production build (`WORKERS_CI_BRANCH=main`) with a missing or non-https `SITE_URL`, or a missing `PUBLIC_TURNSTILE_SITE_KEY`, must fail the build. It must never quietly ship the test key, `localhost` canonicals or `noindex`. Pinned in Task 1, re-checked by the production build in Task 10.
4. A POST without `Content-Length` (chunked) must still be capped at `MAX_BODY_BYTES`, while a valid form with every field at its maximum length (including non-ASCII text) must fit under the cap. Pinned in Task 10.
5. The glob loader uses an application's `slug` field as the entry id, which collides across locales. Ids must stay `<locale>/<slug>` and come from the file path. A `slug` that differs from the filename, or the reserved slug `general`, must fail the build. Pinned in Task 3 (`generateId`, `assertSlugMatches`) and Task 10 (`solutionSlugs`).

---

## Execution notes

Pre-flight rulings 1–21 (2026-11-23) are integrated below.

### Dispatch groups (max 5 agents at once; groups run in order)

| Group | Tasks (suggested model) | Needs | Notes |
|---|---|---|---|
| G1 | T1 Toolchain (Sonnet 5.5) | — | |
| G2 | T2 Tokens & fonts (Opus 5.5) | G1 | |
| G3 | T3 Content (Sonnet 5.5) ∥ T4 UI atoms (Opus 5.5) | G2 | T4 alone owns the scaffold page |
| G4 | T5 Layout (Opus 5.5) ∥ T6 ASCII (Opus 5.5) ∥ T11 Sveltia (Sonnet 5.5) | G3 | T6 needs T3's seed image (now `transmitter.png`); T5 alone owns the scaffold page |
| G5 | T7 Sections (Opus 5.5) | G4 | |
| G6 | T8 Routes & SEO (Sonnet 5.5) ∥ T9 Quote page (Opus 5.5) | G5 | T8 alone owns `astro.config.ts` and `seo.ts` |
| G7 | T10 Worker & outputs (Sonnet 5.5) | G6 | reviewer: Opus 5.5 (security path) |
| G8 | T12 Runbook & acceptance (Sonnet 5.5) | G7 | |

Commit and memory-bank steps: a Haiku 5.5 agent. Task numbers follow the manager's order. T6 and T11 run in G4 because they need T3's output.

**Parallel groups:** every parallel implementer runs in its own git worktree (`isolation: "worktree"`), because `pnpm build` reads the whole tree. Parallel implementers do **not** edit `memory-bank/`; each puts its memory-bank delta in its report. Each runs `pnpm install --frozen-lockfile` first in its worktree, and at the end commits only its task's Files list with explicit `git add <paths>` (no memory-bank, never `-A`) on its worktree branch, using the task's commit message. `.claude/worktrees/` is ignored by git (`.gitignore`) and by Biome (`files.includes` excludes `.claude`). After the group, the manager runs `git merge --no-ff` for each worktree branch in task-number order; then one Haiku agent makes the memory-bank commits, one task at a time. After merging G6, the manager re-runs T8 Step 5 and T9 Step 4 unfiltered (no `quote` filter) on the merged tree before dispatching G7. Sequential tasks run their own last two steps.

**Every brief** tells the agent to read `memory-bank/` (all 5 files), `CLAUDE.md`, this plan's header and its own task, plus the spec sections its task names.

### Shared checks

**Gate** (end of every task, in this order): `pnpm build && pnpm check && pnpm lint && pnpm test`, all exit 0. (`check` runs after `build`: from Task 10 on, `tsc -p worker` needs `worker/generated/solutions.json`.)

**Guard greps** (UI tasks; each must print nothing unless noted):
```bash
grep -rEn '#[0-9a-fA-F]{3,8}\b' src/components src/layouts         # raw hex
grep -rEn '[0-9]px\b' src/components src/layouts                   # raw px
grep -rEn '\b(rounded|shadow|blur|backdrop|purple|violet|emoji)' src/components src/layouts src/styles | grep -vE -- '--[a-z-]+-\*:\s*initial'   # the `tokens.css` reset lines are allowed
grep -rEn 'gradient' src/components src/layouts src/styles         # allowed: only the `scanlines` utility and the AsciiImage hum bar (Task 7b; replaced the shimmer mask)
grep -rEn 'console\.log|:\s*any\b|as any\b|<any>' src worker
grep -rEn 'bars-' src/components src/layouts src/pages | grep -vE 'ui/(BarsStrip|NoSignal)\.astro|ui/bar-tones\.ts'   # SMPTE bar tokens only in the bars components
grep -rEn 'crosshair' src                                          # retired in Task 7a
```

**Dist script guard** (after `pnpm build`; Task 7b):
```bash
grep -rhoE '<script[^>]*>' dist --include='*.html' --exclude-dir=admin | grep -v 'application/ld+json' | grep -v 'challenges.cloudflare.com/turnstile' | grep -vE '^<script type="module" src="/_astro/[^"]+\.js">$'   # prints nothing
grep -rhoE '<script(\s[^>]*)?>[^<]' dist --include='*.html' --exclude-dir=admin | grep -v 'application/ld+json'   # prints nothing: no inline executable script
diff <(grep -rlE '<script type="module" src="/_astro/' dist --include='*.html' | sort) <(grep -rl 'data-ascii' dist --include='*.html' | sort)   # prints nothing: the module ships exactly where AsciiImage renders
for f in $(grep -rlE 'data-ascii' dist --include='*.html'); do test "$(grep -oE '<script type="module" src="/_astro/' "$f" | wc -l)" -eq 1 || echo "MODULES $f"; done   # prints nothing: one module per such page
for f in $(find dist -name '*.html' -not -path 'dist/admin/*'); do test "$(grep -o 'data-motion-hold' "$f" | wc -l)" -eq 1 || echo "HOLD $f"; done   # prints nothing: the HOLD key (motion pause) is on every page (Task 7b fix round 1)
```

**VA checklist** (spec §8; run in `pnpm dev` at 360, 768 and 1440 CSS px):
- VA1 0 radius, no shadows, no blur/glass, no gradients except hero scanlines and the ASCII hum bar.
- VA2 Border budget (spec §8): 1px hairlines only on the header bottom / footer top edges, section dividers, form controls and the `TitleSafe` media frame; never doubled. Content grids, cards, feature lists, FAQ and the CTA use spacing and `surface` vs `canvas` tone, no boxed cells; no "+" crosshairs. Broadcast details used sparingly: TallyStrip PGM/PVW, title-safe marks on media only, lower thirds on section headings and card titles only, one bars strip (footer).
- VA3 Labels are uppercase tracked Martian Mono with an index, e.g. `[02] APPLICATIONS`; at most one two-tone headline per page.
- VA4 Accent comes only through `accent` / `accent-dim` / `accent-wash` / `tone-*` tokens, only on large text, graphics, tallies and the lower-third key, never on body text; `critical` only for errors. The `bars-*` tokens (SMPTE standard) appear only in `BarsStrip` and `NoSignal`.
- VA5 Typographic glyphs (→ ↗ + ● −), no icons, no emoji.
- VA6 Motion only on opacity/transform, ≤ 240ms, except the Timecode counter and the AsciiImage live signal (Task 7b: hum bar, sync slips, breath, and the module's tune-in, rings and grain; all fully static under reduced motion, no layout shift); with DevTools `prefers-reduced-motion: reduce` nothing moves (timecode static, ASCII shows the build-time render). The TallyStrip HOLD key (every page, every breakpoint, keyboard-reachable) pauses all of it and restores the static ASCII (WCAG 2.2.2).
- VA7 At 360px: `document.documentElement.scrollWidth <= 360` (no horizontal scroll); tap targets ≥ 24×24 CSS px.
- VA8 AA contrast: body ≥ 4.5:1, large text/UI ≥ 3:1; a visible focus ring on every interactive element during a Tab walk; DOM order matches visual order.

### Files beyond the spec §6 tree

`src/lib/{build-mode,env,entries,routes,assert-never,ascii-source,ascii-glyphs,ascii-motion}.ts` (the last two from Task 7b); `src/components/ui/{TitleSafe,LowerThird,BarsStrip,NoSignal}.astro` and `bar-tones.ts` (Task 7a); `src/components/quote/{QuoteForm,QuoteStatus}.astro`; colocated `*.test.ts`; `src/lib/admin-config.test.ts`; `docs/runbook.md`; the temporary `src/pages/index.astro` (deleted in Task 8).

---

### Task 1: Toolchain scaffold

Model: Sonnet 5.5 · Group G1 · Spec §6, §9, §10, §14

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `astro.config.ts`, `tsconfig.json`, `worker/tsconfig.json`, `biome.json`, `wrangler.jsonc`, `.github/CODEOWNERS`, `public/favicon.svg`, `src/lib/build-mode.ts`, `src/lib/env.ts`, `worker/index.ts` (stub; replaced in Task 10), `src/pages/index.astro` (scaffold page)
- Test: `src/lib/build-mode.test.ts`

**Interfaces:**
- Produces:
  - `build-mode.ts`: `PRODUCTION_BRANCH = 'main'`, `TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'`, `PREVIEW_SITE_URL = 'http://localhost:4321'` (interim: previews are noindex and visual-review only, so localhost canonicals do no harm; open §14 "Previews" item, recorded in `techContext.md` and the runbook); `type BuildEnv = Readonly<Partial<Record<'WORKERS_CI_BRANCH' | 'SITE_URL' | 'PUBLIC_TURNSTILE_SITE_KEY', string | undefined>>>` (required by `exactOptionalPropertyTypes`); `type BuildMode = { isProduction: boolean; siteUrl: string; turnstileSiteKey: string }`; `resolveBuildMode(env: BuildEnv): BuildMode` (empty strings count as missing; throws an error naming the bad variable).
  - `env.ts` (Astro glue, not unit-tested): `export const BUILD: BuildMode`, built from `astro:env/server` (`WORKERS_CI_BRANCH`, `SITE_URL`) and `astro:env/client` (`PUBLIC_TURNSTILE_SITE_KEY`).
  - `astro.config.ts`: `site: resolveBuildMode(process.env).siteUrl`; `env.schema` declares the three variables as optional public strings (`WORKERS_CI_BRANCH` and `SITE_URL` with context server, the site key with context client).
  - Scripts: spec §10 verbatim, plus `"test": "node --test \"src/**/*.test.ts\" \"worker/**/*.test.ts\""`.

- [ ] **Step 1: Write the config files**
  - `package.json`: spec §10 plus `test`. Run `pnpm view typescript versions --json` and pin the newest `6.x`.
  - `wrangler.jsonc`: spec §9 verbatim. `.nvmrc`: `26.13.1`.
  - `tsconfig.json`: extends `astro/tsconfigs/strictest`; adds `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`; include `.astro/types.d.ts`, `**/*`; exclude `dist`, `worker`, `.claude`, `**/*.test.ts`. Probe `pnpm check` after the scaffold: if it fails on Node globals (`process`, `node:fs`, `node:path` in `astro.config.ts`, `ascii-source.ts`, `build-outputs.ts`), add `@types/node` pinned exactly to the newest `26.x` as a devDependency and `"types": ["node"]` to this root tsconfig only (pre-approved; no `@ts-ignore` or `any`).
  - `worker/tsconfig.json`: `strict`, `target`/`lib` `es2024`, `module: esnext`, `moduleResolution: bundler`, `types: ["@cloudflare/workers-types"]`, `resolveJsonModule`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noEmit`; include `./**/*.ts`, `../src/lib/quote-schema.ts`; exclude `**/*.test.ts`.
  - `biome.json` (Biome 2 shape; there is no `ignore` key): recommended rules; `suspicious.noExplicitAny: error`; `suspicious.noConsole: error`, with an override (`overrides[].includes: ["worker/**"]`) setting `noConsole` to `{ "level": "error", "options": { "allow": ["error"] } }`; 2 spaces, lineWidth 100, single quotes; `files.includes: ["**", "!dist", "!.astro", "!.wrangler", "!worker/generated", "!.claude"]`; a `**/*.astro` override turning off `noUnusedImports`, `noUnusedVariables` and `useImportType` (frontmatter imports used only in the template give false positives), unless Biome 2.6's full Astro support is enabled and verified here.
  - `.gitignore`: `node_modules/ dist/ .astro/ .wrangler/ .claude/worktrees/ worker/generated/ .dev.vars .env* .DS_Store`.
  - `.github/CODEOWNERS`: `* @<owner-login>`, where the login comes from `gh repo view --json owner -q .owner.login`.
  - `public/favicon.svg`: neutral geometric mark (square + "+"), no text.
  - `astro.config.ts`: static, `trailingSlash: 'always'`, `build.format: 'directory'`, `vite.plugins: [tailwindcss()]`, `site` and `env.schema` as above.
  - `worker/index.ts` stub: `export default { fetch: (request, env) => env.ASSETS.fetch(request) } satisfies ExportedHandler<{ ASSETS: Fetcher }>`.
  - `src/pages/index.astro`: a minimal valid document (`<html lang="en">`, empty `<main>`).

- [ ] **Step 2: Write the failing test** `src/lib/build-mode.test.ts`
```ts
test('main with production vars is production', () => assert.deepEqual(
  resolveBuildMode({ WORKERS_CI_BRANCH: 'main', SITE_URL: 'https://example.com/', PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAA' }),
  { isProduction: true, siteUrl: 'https://example.com', turnstileSiteKey: '0x4AAAAAAA' }));
test('non-main branch ignores production vars', () => assert.deepEqual(
  resolveBuildMode({ WORKERS_CI_BRANCH: 'feature/x', SITE_URL: 'https://example.com', PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAA' }),
  { isProduction: false, siteUrl: PREVIEW_SITE_URL, turnstileSiteKey: TURNSTILE_TEST_SITE_KEY }));
test('local build without a branch is non-production', () => assert.equal(resolveBuildMode({}).isProduction, false));
test('main without SITE_URL throws', () => assert.throws(() => resolveBuildMode({ WORKERS_CI_BRANCH: 'main', PUBLIC_TURNSTILE_SITE_KEY: 'k' }), /SITE_URL/));
test('main with non-https SITE_URL throws', () => assert.throws(() => resolveBuildMode({ WORKERS_CI_BRANCH: 'main', SITE_URL: 'http://example.com', PUBLIC_TURNSTILE_SITE_KEY: 'k' }), /SITE_URL/));
test('main without site key throws', () => assert.throws(() => resolveBuildMode({ WORKERS_CI_BRANCH: 'main', SITE_URL: 'https://example.com' }), /PUBLIC_TURNSTILE_SITE_KEY/));
```
- [ ] **Step 3: Run it to make sure it fails.** `pnpm install && node --test src/lib/build-mode.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement `resolveBuildMode(env: BuildEnv): BuildMode`** in `src/lib/build-mode.ts`, then `env.ts`. The site URL loses its trailing slash.
- [ ] **Step 5: Run the test.** Expected: 6 pass.
- [ ] **Step 6: Gate.** All exit 0 and `test -f dist/index.html`.
- [ ] **Step 7: Memory bank.** `techContext.md`: TS pin, `test` script, test conventions, build-mode rules. `progress.md`: Done + Log. `activeContext.md`: current state.
- [ ] **Step 8: Commit.** `chore: scaffold astro, worker stub and tooling` (all files above + `pnpm-lock.yaml` + memory-bank).

---

### Task 2: Design tokens, global styles, fonts

Model: Opus 5.5 · Group G2 · Spec §8 (tokens, typography, Do/Don't), §14 (fonts, Turkish glyphs)

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/assets/fonts/schibsted-grotesk/{latin,latin-ext}-wght-{normal,italic}.woff2` + `OFL.txt`, `src/assets/fonts/martian-mono/{latin,latin-ext}-wght-normal.woff2` + `OFL.txt`
- Modify: `astro.config.ts` (fonts), `src/pages/index.astro` (temporary token swatch)

**Interfaces:**
- Produces (exact names; later tasks use only these):
  - Colour utilities from `--color-*`: `canvas surface ink ink-muted line line-strong critical accent accent-dim accent-wash tone-0 … tone-5` (e.g. `bg-canvas`, `text-ink-muted`, `border-line`).
  - Text sizes: `text-label text-body text-lede text-h2 text-display`; `tracking-label`; `font-sans font-mono`; `max-w-page`.
  - Plain vars: `--accent-seed` (default on `:root`, overridden per page by BaseLayout), `--z-header --z-popover --z-dialog`, `--duration-fast --duration-base --ease-signal`, `--border-hairline --border-focus`.
  - `@utility` in `global.css`: `grid-hairline` (grid with `gap: var(--border-hairline)`, `background: line`, outer hairline), `cell` (canvas background + padding), `crosshair` ("+" pseudo-element with `content: "+" / ""`, hidden from AT), `label-mono`, `scanlines` (hero only), `prose` (≤ 68ch, mono h3+).
  - Font variables `--font-grotesk`, `--font-martian` (Astro fonts API); `--font-sans`/`--font-mono` map to them in `@theme inline`.

Token values (pinned; `color.ts` in Task 3 mirrors the canvas value):

| Token | Value |
|---|---|
| `--color-canvas` | `oklch(0.17 0.008 255)` |
| `--color-surface` | `oklch(0.21 0.008 255)` |
| `--color-ink` / `--color-ink-muted` | `oklch(0.95 0.005 255)` / `oklch(0.74 0.01 255)` |
| `--color-line` / `--color-line-strong` | `oklch(0.32 0.01 255)` / `oklch(0.52 0.012 255)` (about 3.5:1 on canvas; `line` is decorative grid only, `line-strong` is for control borders) |
| `--color-critical` | `oklch(0.70 0.17 30)` |
| `--accent-seed` (default) | `oklch(0.80 0.16 75)` |
| `--color-accent` / `-dim` / `-wash` | `var(--accent-seed)` / `color-mix(in oklab, var(--accent-seed) 55%, var(--color-canvas))` / `… 12% …` (oklab: oklch hue path runs through green) |
| `--color-tone-0…5` | ink-muted 30% on canvas, ink-muted 60% on canvas, ink-muted, ink, accent-dim, accent |
| Type | label `0.75rem`/1.4 · body `clamp(1rem, 0.96rem + 0.2vw, 1.125rem)`/1.55 · lede `clamp(1.125rem, 1.02rem + 0.5vw, 1.375rem)`/1.45 · h2 `clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem)`/1.1 · display `clamp(2.5rem, 1.5rem + 5vw, 5.5rem)`/0.98 · `--tracking-label: 0.12em` |
| Other | `--spacing: 0.25rem` · `--border-hairline: 1px` · `--border-focus: 0.125rem` · `--container-page: 90rem` · z 10/20/30 · `120ms`/`240ms` · `--ease-signal: cubic-bezier(0.2, 0, 0, 1)` |
| Resets | `--color-*`, `--radius-*`, `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*`, `--font-*`, `--text-*`: `initial` (then define ours); guard grep #3 allows exactly these `--*-*: initial` lines |

The theme is a single dark theme (`color-scheme: dark`), like a monitor wall.

- [ ] **Step 1: Fetch the fonts.** Get the variable woff2 subsets from the Fontsource CDN (`cdn.jsdelivr.net/fontsource/fonts/<family>:vf@<pinned version>/…`) and `OFL.txt` from the google/fonts repo. Record the source and version in `techContext.md`.
- [ ] **Step 2: Add `fonts` to `astro.config.ts`.** Use `fontProviders.local()`. Weights: Schibsted `400 900` (normal + italic); Martian Mono `100 800`. Copy each subset's `unicode-range` from Fontsource CSS. System fallbacks. Confirm the Astro 7 option shape in the docs (§14) and record it.
- [ ] **Step 3: Write `tokens.css` and `global.css`.**
  - Base: `html` uses canvas, ink, `font-sans`, `text-body`, `color-scheme: dark`.
  - `:focus-visible`: outline `var(--border-focus) solid var(--color-accent)` with an offset; `::selection` uses accent-wash.
  - A global `prefers-reduced-motion: reduce` block zeroes animation and transition durations.
  - `scanlines` is a hard-stop `repeating-linear-gradient` (documented exception, hero only).
- [ ] **Step 4: Scaffold page.** Import `global.css`, render `<Font cssVariable="--font-grotesk" preload />` and the martian one, and show a swatch of every colour token, the text scale, a TR sample `ÇĞİıÖŞÜ çğıöşü` and the glyphs `→ ↗ + ● − × ·` in both families.
- [ ] **Step 5: Verify.** Gate passes. `grep -l -- '--color-canvas' dist/_astro/*.css` finds a file. `grep -ohE 'border-radius:[^;}]+' dist/_astro/*.css | grep -vE 'border-radius:0(px)?$'` prints nothing. `find dist -name '*.woff2' | wc -l` ≥ 2. Guard greps clean.
- [ ] **Step 6: Visual acceptance.** VA4, VA6, VA8 on the swatch: measure ink and ink-muted on canvas (≥ 4.5:1) and line-strong on canvas (≥ 3:1) in DevTools. Turkish glyphs render from both fonts. Record any glyph that falls back to a system font.
- [ ] **Step 7: Memory bank.** `systemPatterns.md`: token values, utility names, scanlines/shimmer exceptions, dark theme. `techContext.md`: fonts. `progress.md`.
- [ ] **Step 8: Commit.** `feat: add design tokens, global styles and local fonts`.

---

### Task 3: Content schemas, seed content, content & i18n libs

Model: Sonnet 5.5 · Group G3 · Spec §6 (content tree), §7, §15 items 11–13, 25–26

**Files:**
- Create: `src/content.config.ts`, `src/lib/{i18n,entries,content,sections-schema,color,assert-never}.ts`
- Create seed: `src/content/settings/site.yaml`; `src/content/ui/{en,tr}/strings.yaml`; `src/content/navigation/{en,tr}/main.yaml`; `src/content/pages/en/{home,about,contact,privacy,applications,quote,not-found}.yaml`; `src/content/pages/tr/home.yaml`; `src/content/applications/en/{newsroom-desk,playout-control,archive-search}.yaml`; `src/assets/uploads/{test-card.png (renamed `transmitter.png` and redrawn in Task 7b),cover-newsroom-desk.png,cover-playout-control.png,cover-archive-search.png,og-default.png,logo.svg}`
- Test: `src/lib/{i18n,entries,sections-schema,color}.test.ts`

**Interfaces:**
- Consumes: `tokens.css` canvas value (Task 2).
- Produces:
  - `i18n.ts`: `LOCALES = ['en', 'tr'] as const`, `type Locale`, `DEFAULT_LOCALE = 'en'`, `isLocale(value: unknown): value is Locale`, `localizePath(neutralPath: string, locale: Locale): string`, `pagePath(slug: string): string` (`home` → `/`), `applicationPath(slug: string): string` → `/applications/<slug>/`, `toggleTarget(neutralPath: string, current: Locale, available: readonly Locale[]): string`, `UI_KEYS` (below), `type UiKey`, `type UiDictionary = { en: Readonly<Record<UiKey, string>>; tr: Readonly<Partial<Record<UiKey, string>>> }`, `t(dict: UiDictionary, locale: Locale, key: UiKey): string`.
  - `UI_KEYS`: `skipToContent menuOpen menuClose navPrimaryLabel navFooterLabel languageLabel navQuote tallyLive tallyTimecode tallyChannel tallyFormat tallyOnAir appOpen appBrochure appLinks footerContact footerSocial footerRights quoteName quoteEmail quoteCompany quoteRole quoteCountry quoteSolutions quoteSolutionsGeneral quoteSolutionsHint quoteTimeline quoteTimelineAsap quoteTimelineQuarter quoteTimelineHalfYear quoteTimelineExploring quoteMessage quoteConsent quoteConsentLink quoteSubmit quoteOptional quoteNoScript quoteSentTitle quoteSentBody quoteErrorInvalidTitle quoteErrorInvalidBody quoteErrorVerifyTitle quoteErrorVerifyBody quoteErrorSendTitle quoteErrorSendBody`.
  - `entries.ts` (pure): `type Entry<T> = { id: string; data: T }`, `type Resolved<T> = { data: T; locale: Locale; slug: string }`, `parseEntryId(id: string): { locale: Locale; slug: string }`, `resolveLocalized<T>(entries: readonly Entry<T>[], locale: Locale, slug: string): Resolved<T> | undefined` (TR, else EN), `localesFor<T>(entries: readonly Entry<T>[], slug: string): Locale[]`, `mergeByLocale<T extends { order: number }>(entries: readonly Entry<T>[], locale: Locale): Resolved<T>[]` (one per EN slug, sorted by `order` then slug; throws on a TR entry with no EN twin), `selectApps<T>(all: readonly Resolved<T>[], slugs: readonly string[]): Resolved<T>[]` (empty → all; else that order; throws naming an unknown slug), `assertSlugMatches(id: string, slug: string): void`.
  - `sections-schema.ts`: spec §7 code, plus `SECTION_TYPES = ['hero', 'statement', 'app-grid', 'feature-list', 'rich-text', 'cta', 'faq'] as const`, `LABEL_MAX = 32`, `actionSchema`, `type Action`, `type SectionOf<T extends Section['type']> = Extract<Section, { type: T }>`.
  - `color.ts`: `type Rgb = { r: number; g: number; b: number }` (0–255), `HEX_PATTERN = /^#[0-9a-fA-F]{6}$/`, `MIN_ACCENT_CONTRAST = 3`, `CANVAS_OKLCH = [0.17, 0.008, 255] as const`, `parseHex(hex: string): Rgb` (throws), `oklchToSrgb(l: number, c: number, h: number): Rgb` (Ottosson OKLab matrices, gamut-clamped), `contrastRatio(a: Rgb, b: Rgb): number` (WCAG), `accentContrast(hex: string): number` (against the canvas).
  - `assert-never.ts`: `assertNever(value: never): never`.
  - `content.config.ts`: collections `settings`, `ui`, `navigation`, `pages`, `applications`. Each uses `glob({ pattern: '**/*.yaml', base, generateId: ({ entry }) => entry.replace(/\.yaml$/, '') })`, so ids are `<locale>/<slug>` (settings: `site`). Schemas:
    - settings: `brandName`; `logo: image()`; `logoAlt`; `accent` = HEX_PATTERN + `superRefine` failing with `settings.accent <hex> has <ratio>:1 contrast against canvas; minimum is 3:1`; `contacts[]` (min 1, ≥ 1 `kind: 'email'`) of `{ kind: 'email' | 'phone' | 'address', value, href: /^(mailto:|tel:|https:\/\/)/ }`; `socials[]` `{ label, href: https }` (default `[]`); `ogImage: image()`; `organization: { legalName, url: z.url(), address?: string }`.
    - ui: `z.partialRecord(z.enum(UI_KEYS), z.string().min(1))`.
    - navigation: `{ header: link[] (min 1), footer: link[] }`, where `link = { label, href: /^(\/|https:\/\/|mailto:)/ }`.
    - pages: `{ title, description (1–160), ogImage?: image(), sections }`.
    - applications: `{ name, slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, tagline (≤ 120), summary, category, cover: image(), coverAlt, status (≤ LABEL_MAX), order: int ≥ 0, links?: Action[], brochure?: https URL, sections }`.
  - `content.ts` (glue; types are `CollectionEntry<…>['data']` aliases `SiteSettings`, `PageData`, `ApplicationData`, `NavigationData`): `getSettings(): Promise<SiteSettings>`, `getUiDictionary(): Promise<UiDictionary>` (EN checked with the exhaustive `z.record(z.enum(UI_KEYS), …)`; the error lists missing keys), `getNavigation(locale): Promise<Resolved<NavigationData>>`, `getPage(locale, slug): Promise<Resolved<PageData>>` (throws when EN is missing), `listTranslatedPages(locale): Promise<Resolved<PageData>[]>`, `listApplications(locale): Promise<Resolved<ApplicationData>[]>` (merged, with `assertSlugMatches`), `listTranslatedApplications(locale)`, `availableLocales(collection: 'pages' | 'applications', slug: string): Promise<Locale[]>`.

- [ ] **Step 1: Write the failing tests** (abbreviated; every bullet is one `test()`):
```ts
// i18n.test.ts
assert.equal(localizePath('/', 'en'), '/'); assert.equal(localizePath('/', 'tr'), '/tr/');
assert.equal(localizePath('/about/', 'tr'), '/tr/about/'); assert.equal(localizePath('/about', 'en'), '/about/');
assert.equal(pagePath('home'), '/'); assert.equal(applicationPath('x'), '/applications/x/');
assert.equal(toggleTarget('/about/', 'en', ['en']), '/tr/'); assert.equal(toggleTarget('/', 'en', ['en', 'tr']), '/tr/');
assert.equal(toggleTarget('/quote/', 'tr', ['en']), '/quote/');
assert.equal(t(dict, 'tr', 'menuOpen'), 'Menü'); assert.equal(t(dict, 'tr', 'tallyFormat'), dict.en.tallyFormat); // fixture dict; TR lacks tallyFormat
assert.equal(isLocale('de'), false);
// entries.test.ts
assert.deepEqual(parseEntryId('tr/home'), { locale: 'tr', slug: 'home' }); assert.throws(() => parseEntryId('de/home')); assert.throws(() => parseEntryId('home'));
assert.equal(resolveLocalized([en('about')], 'tr', 'about')?.locale, 'en');
assert.equal(resolveLocalized([en('about'), tr('about')], 'tr', 'about')?.locale, 'tr');
assert.deepEqual(localesFor([en('home'), tr('home')], 'home'), ['en', 'tr']);
assert.deepEqual(mergeByLocale([en('b', 2), en('a', 1), tr('b', 2)], 'tr').map((r) => [r.slug, r.locale]), [['a', 'en'], ['b', 'tr']]);
assert.throws(() => mergeByLocale([en('a', 1), tr('orphan', 2)], 'tr'), /tr\/orphan/);
assert.deepEqual(selectApps(all, []).map((r) => r.slug), ['a', 'b']); assert.throws(() => selectApps(all, ['missing']), /missing/);
assert.throws(() => assertSlugMatches('en/newsroom-desk', 'newsroom'), /newsroom-desk/);
// sections-schema.test.ts — schema built with a fake `image: () => z.string()`
'accepts all seven section types' (one fixture per SECTION_TYPES entry; parsed types deepEqual SECTION_TYPES)
'rejects unknown type' ({ type: 'video' }); 'rejects three hero actions'; 'rejects javascript: and http: hrefs';
'rejects a 33-char label'; 'app-grid apps defaults to []'; 'feature-list rejects 0 and 9 items'
// color.test.ts
assert.deepEqual(parseHex('#FFB000'), { r: 255, g: 176, b: 0 }); for (const bad of ['#fff', 'ffb000', '#ggg000']) assert.throws(() => parseHex(bad));
assert.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 0.01);
assert.ok(accentContrast('#ffb000') >= MIN_ACCENT_CONTRAST); assert.ok(accentContrast('#1a1a1a') < MIN_ACCENT_CONTRAST);
assert.deepEqual(oklchToSrgb(1, 0, 0), { r: 255, g: 255, b: 255 });
assert.match(readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8'), /--color-canvas:\s*oklch\(0\.17 0\.008 255\)/); // drift guard
```
- [ ] **Step 2: Run them to make sure they fail.** `node --test src/lib/*.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `i18n.ts`, `entries.ts`, `sections-schema.ts`, `color.ts`, `assert-never.ts` with the signatures above.
- [ ] **Step 4: Run the tests.** Expected: all pass.
- [ ] **Step 5: Write `content.config.ts` and `content.ts`.**
- [ ] **Step 6: Generate the seed images.** Use a throwaway script in the scratchpad (not committed) that renders inline SVG to PNG with sharp. Each image ≤ 200 KB.
  - `test-card.png`, 1280×720 (RGBA, as sharp renders it; Task 6 must handle alpha): broadcast test card with 7 vertical bars of distinct luminance, a centred circle, a "+" grid and a greyscale step wedge. *(Task 7b replaced it with `transmitter.png`, a transmitter mast with signal arcs.)*
  - 3 covers, 1200×750: abstract hairline geometry.
  - `og-default.png`, 1200×630.
  - `logo.svg`: a geometric mark with the word `Brand`.
- [ ] **Step 7: Write the seed YAML.** Realistic, neutral copy for press software. Brand `Brand` on `example.com`. `accent: '#ffb000'`. The applications page holds one `app-grid` with `apps: []`. Home uses hero (image = the seed image, `transmitter.png` since Task 7b), statement, app-grid, feature-list and cta. TR `ui` deliberately omits `tallyFormat` and `footerRights` (proves the fallback). TR navigation, and the TR `home.yaml` hero and cta action hrefs, point to EN URLs for pages that have no TR version (no `/tr/applications/` or `/tr/about/` links, or the Task 8 broken-link scan fails). Seed image paths use the exact relative forms of the admin `public_folder` values (`../../assets/uploads/…` in settings, `../../../assets/uploads/…` in collections).
- [ ] **Step 8: Verify.**
  - Gate passes.
  - Set `accent: '#1a1a1a'` temporarily: `pnpm build` fails, and the output contains `settings.accent`. Revert.
- [ ] **Step 9: Memory bank.** `systemPatterns.md`: entry ids, `generateId`, fallback rules, `UI_KEYS`, seed slugs. `progress.md`.
- [ ] **Step 10: Commit.** `feat: add content schemas, seed content and i18n/content libs`.

---

### Task 4: UI atoms

Model: Opus 5.5 · Group G3 (∥ T3) · Spec §8 (Do/Don't, typography), §6 `components/ui`

**Files:**
- Create: `src/components/ui/{Button,Label,Heading,Tally,Timecode,GridFrame,Field,Input,Textarea,Select,Checkbox,Prose}.astro`
- Modify: `src/pages/index.astro` (atom showcase with temporary literal strings)

**Interfaces:**
- Consumes: Task 2 utilities and tokens only.
- Produces (props are exact):
  - `Button`: `{ href?: string; type?: 'button' | 'submit'; intent?: 'primary' | 'secondary'; size?: 'md' | 'sm'; glyph?: '→' | '↗' | null }`, with variants from `cva`. Renders `<a>` when `href` is set. The default glyph is `↗` for `https://` hrefs and `→` otherwise. The glyph is `aria-hidden`. Min height `h-11`.
  - `Label`: `{ text: string; index?: number; as?: 'p' | 'span' }` renders `[02] TEXT` (`LABEL_INDEX_DIGITS = 2`) with `label-mono`. *(Task 7a adds `strap?: boolean`, the lower-third strap.)*
  - `Heading`: `{ level: 1 | 2 | 3; text: string; accent?: string; size?: 'display' | 'h2' }`. `accent` renders as a second line in `text-accent` (the two-tone headline).
  - `Tally`: `{ text: string; tone?: 'accent' | 'muted' | 'critical'; dot?: boolean }` renders `● TEXT` in mono. Only the `●` glyph takes the tone colour (a graphic, 3:1 suffices); the text is always `ink`, so small tally text keeps 4.5:1 for any valid accent.
  - `Timecode`: `{ prefix: string }` renders `PREFIX HH:MM:SS:FF` at `FRAME_RATE = 25` (the 25, 24, 60, 3600 and 86400 values are named CSS custom properties or `define:vars` from `FRAME_RATE`, never literals in rules). It is built from four `@property` integers (`--tc-h/m/s/f`, `syntax: '<integer>'`) animated with `steps()` (1s/60s/3600s/86400s) and drawn with `counter()` with `decimal-leading-zero`. It is `aria-hidden="true"` and shows a static `00:00:00:00` under reduced motion.
  - `GridFrame`: `{ as?: 'div' | 'section' | 'ul'; columns?: 1 | 2 | 3 | 4 | 12; crosshairs?: boolean }`. Uses the `grid-hairline` utility. Fixed responsive ramp: `2` → 1 / `md`:2; `3` → 1 / `md`:2 / `lg`:3; `4` → 1 / `md`:2 / `lg`:4; `12` → 1 / `lg`:12. Children are `cell`s and may carry `lg:col-span-*`. Last-row span rules (`:last-child:nth-child(…)` per breakpoint) make the final cell fill the row, so the gap-as-hairline background never shows an empty `line`-coloured hole. *(Superseded in Task 7a: `variant?: 'spaced' | 'hairline'`, spaced by default; `crosshairs` and the `crosshair` utility removed.)*
  - `Field`: `{ id: string; label: string; hint?: string; optionalLabel?: string }` with the control in the default slot. The hint id is `${id}-hint`.
  - `Input`: `{ id: string; name: string; type?: 'text' | 'email'; required?: boolean; maxlength: number; autocomplete: string; describedBy?: string }`.
  - `Textarea`: `{ id; name; required?; maxlength: number; rows?: number; describedBy? }`.
  - `Select`: `{ id; name; required?; options: readonly { value: string; label: string }[]; describedBy? }`.
  - `Checkbox`: `{ id; name; value: string; required?: boolean }`. The label content goes in the slot (so it can hold a link). Uses native `accent-color: var(--color-accent)`.
  - `Prose`: `{ html: string }` renders `<div class="prose" set:html={html} />`.

- [ ] **Step 1: Implement the 12 atoms** with the props above. Controls share one border style (`border-line-strong`, `bg-surface`; the control boundary must reach 3:1, WCAG 1.4.11), and focus uses the global ring. Write glyphs (`→ ↗ + ● −`) as literal characters, not numeric entities (guard grep #1).
- [ ] **Step 2: Showcase.** Render every atom and variant on the scaffold page.
- [ ] **Step 3: Gate and guard greps.**
- [ ] **Step 4: Visual acceptance.** VA1–VA8, plus:
  - The timecode advances 25 frames a second and is static under reduced motion.
  - Form controls are ≥ 44px tall.
  - `GridFrame` at 1, 2, 3, 4 and 12 columns shows single hairlines, no empty gap cell in an incomplete last row, and crosshairs on the cell corners (the intersections). *(Task 7a retired the crosshairs.)*
  - The two-tone Heading wraps cleanly at 360px.
- [ ] **Step 5: Memory bank.** `systemPatterns.md`: the atom list and props summary. `progress.md`.
- [ ] **Step 6: Commit.** `feat: add ui primitives`.

---

### Task 5: Layout shell and SEO head

Model: Opus 5.5 · Group G4 · Spec §6 `components/layout`, §7 (hreflang, toggle), §8 (wireframe header + tally strip)

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/layout/{SeoHead,SiteHeader,MobileNav,LanguageToggle,TallyStrip,SiteFooter}.astro`, `src/lib/seo.ts`
- Modify: `src/pages/index.astro` (renders BaseLayout with EN `home` data)
- Test: `src/lib/seo.test.ts`

**Interfaces:**
- Consumes: Task 3 (`getSettings`, `getUiDictionary`, `getNavigation`, `t`, `localizePath`, `toggleTarget`, `Locale`), Task 4 (`Button`, `Label`, `Tally`, `Timecode`). Absolute URLs use `Astro.site`.
- Produces:
  - `seo.ts`: `TITLE_SEPARATOR = ' · '`, `formatTitle(page: string, brand: string): string`, `absoluteUrl(path: string, site: URL | string): string`, `type Alternate = { hreflang: Locale | 'x-default'; href: string }`, `hreflangLinks(neutralPath: string, available: readonly Locale[], site: URL | string): Alternate[]` (x-default = EN), `type OrganizationInput = { name: string; legalName: string; url: string; logoUrl: string; sameAs: readonly string[]; email?: string; telephone?: string; address?: string }`, `organizationJsonLd(org: OrganizationInput): string` (every `<` escaped as the six characters `\u003c`).
  - `BaseLayout` props: `{ locale: Locale; contentLocale: Locale; neutralPath: string; title: string; description: string; ogImage?: ImageMetadata; availableLocales: readonly Locale[]; noindex?: boolean; jsonLd?: string }`. It has a named slot `head` and a default slot inside `<main id="main" tabindex="-1">`.
  - `BaseLayout` behaviour:
    - `<html lang={locale} style="--accent-seed: <settings.accent>">` (the UI locale: header, nav, footer and form labels come from `locale`). Content-entry output (page header + SectionRenderer) is wrapped in an element with `lang={contentLocale}` when it differs from `locale`.
    - Canonical = `absoluteUrl(localizePath(neutralPath, contentLocale))`.
    - When `contentLocale !== locale` (fallback render): `<meta name="robots" content="noindex">` and no hreflang.
    - og:image = `getImage` 1200×630 png, as an absolute URL. `OG_LOCALE = { en: 'en_US', tr: 'tr_TR' }`.
    - Favicon link; skip link to `#main` as the first focusable element.

- [ ] **Step 1: Write the failing test** `seo.test.ts`
```ts
assert.equal(formatTitle('About', 'Brand'), 'About · Brand');
assert.deepEqual(hreflangLinks('/about/', ['en'], 'https://example.com'), [
  { hreflang: 'en', href: 'https://example.com/about/' }, { hreflang: 'x-default', href: 'https://example.com/about/' }]);
assert.deepEqual(hreflangLinks('/', ['en', 'tr'], 'https://example.com').map((a) => a.href),
  ['https://example.com/', 'https://example.com/tr/', 'https://example.com/']);
const out = organizationJsonLd({ ...org, legalName: 'A</script><script>x' });
assert.ok(!out.includes('<')); assert.equal(JSON.parse(out).legalName, 'A</script><script>x'); assert.equal(JSON.parse(out)['@type'], 'Organization');
```
- [ ] **Step 2: Run it to make sure it fails.** `node --test src/lib/seo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `seo.ts`.**
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Implement the layout components.**
  - `SiteHeader`: sticky, `--z-header`. Logo `<Image>` and brand link to the localized home. Desktop nav (≥ `md`) from `navigation.header`. `LanguageToggle`. Quote `Button` (`navQuote` → localized `/quote/`).
  - `MobileNav`: `<button popovertarget="site-menu">` plus `<nav id="site-menu" popover>` with a close button (`popovertargetaction="hide"`), no JS. No `::backdrop` styling (guard grep #3 bans the word `backdrop`).
  - `LanguageToggle`: the `LOCALES` entries uppercased (never literals), e.g. `EN / TR`. The current locale carries `aria-current="true"`; the other links to `toggleTarget(...)` with `hreflang` and `lang`.
  - `TallyStrip`: wireframe row (`tallyLive` accent tally, `Timecode` with `tallyTimecode`, `tallyChannel`, `tallyFormat`), `aria-hidden="true"`.
  - `SiteFooter`: footer nav, contacts (mailto/tel), socials with ↗, legal name and address, `© <build year>` with `footerRights`.
  - `SeoHead`: title, description, canonical, alternates, Open Graph/Twitter, optional JSON-LD.
- [ ] **Step 6: Gate and guard greps, plus `dist/index.html` checks.**
  - `grep -o '<link rel="alternate"[^>]*>' dist/index.html | wc -l` = 3 (`grep -c` counts lines, and compressed HTML is one line).
  - `og:image` content starts with `http://localhost:4321/_astro/`.
  - `grep -c '<script' dist/index.html` = 0. *(From Task 7b: 1, the ASCII motion module; see the dist script guard.)*
  - `grep -q 'popover' dist/index.html` succeeds.
- [ ] **Step 7: Visual acceptance.** VA1–VA8, plus:
  - The header matches the §8 wireframe at 1440px.
  - At 360px, the logo, menu button and tally strip fit with no overflow.
  - The popover opens and closes by keyboard, Esc closes it and focus returns to its button.
  - The skip link is visible on focus.
  - The ● LIVE tally is accent and is not announced by a screen reader (VoiceOver/NVDA spot check).
- [ ] **Step 8: Memory bank.** `systemPatterns.md`: BaseLayout contract and the fallback canonical/noindex rule. `progress.md`.
- [ ] **Step 9: Commit.** `feat: add base layout, header, footer and seo head`.

---

### Task 6: ASCII pipeline and AsciiImage

Model: Opus 5.5 · Group G4 (∥ T5, T11) · Spec §8 (AsciiImage), §14 (ASCII hero), §15 item 8

**Files:**
- Create: `src/lib/ascii.ts`, `src/lib/ascii-source.ts`, `src/components/ui/AsciiImage.astro`
- Test: `src/lib/ascii.test.ts`

**Interfaces:**
- Consumes: Task 2 `--color-tone-0…5`, `font-mono`; Task 3 `src/assets/uploads/test-card.png` (now `transmitter.png`, Task 7b).
- Produces:
  - `ascii.ts`: `ASCII_RAMP = ' .:-=+*#%@'`, `TONE_COUNT = 6`, `CHAR_ASPECT = 0.5`, `ASCII_COLUMNS = 96`; `type Tone = 0 | 1 | 2 | 3 | 4 | 5`; `type AsciiRun = { tone: Tone; text: string }`; `type AsciiGrid = { cols: number; rows: number; lines: AsciiRun[][] }`; `gridRows(cols: number, width: number, height: number): number` = `max(1, round(cols × height / width × CHAR_ASPECT))`; `toAsciiGrid(luma: Uint8Array, cols: number, rows: number): AsciiGrid`; `renderAscii(filePath: string, cols?: number): Promise<AsciiGrid>`.
  - `toAsciiGrid` mapping: glyph = `ASCII_RAMP[min(9, floor(l × 10 / 256))]`, tone = `min(5, floor(l × 6 / 256))`, neighbouring same-tone glyphs merge into one run. It throws when `luma.length !== cols × rows`. Bright pixels become dense glyphs (dark canvas).
  - `renderAscii` pipeline: sharp `metadata` → `resize(cols, rows, { fit: 'fill' })` → `flatten({ background: FLATTEN_BACKGROUND })` (a named black constant; drops alpha so `b-w` raw output has exactly 1 channel) → `toColourspace('b-w')` → `raw()`. Memoized per `${filePath}@${cols}`.
  - `ascii-source.ts` (glue; uses `process.cwd()` and `node:path`, so it relies on the Task 1 Node-types decision): `resolveUploadPath(image: ImageMetadata): string`. It matches `image.src` against `import.meta.glob('/src/assets/uploads/**/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })` and returns `join(process.cwd(), key)`. It throws naming `image.src` when nothing matches. Do not use the internal `fsPath`.
  - `AsciiImage`: `{ image: ImageMetadata; alt: string; cols?: number }` renders `<figure role="img" aria-label={alt} data-ascii style="--ascii-cols: N">`, which wraps `<pre aria-hidden="true">`. Runs render as `<span class="t0…t5">`; all-space runs render without a span. Font size: `calc(100cqi / var(--ascii-cols) / var(--ascii-advance))` on an `inline-size` container. The glyph advance of Martian Mono is a measured CSS constant (`--ascii-advance`, kept at the top of `AsciiImage.astro`, not in `tokens.css`). Optional shimmer: an animated `mask-image` sweep, only inside `@media (prefers-reduced-motion: no-preference)`.

- [ ] **Step 1: Write the failing test** `ascii.test.ts`
```ts
assert.deepEqual(toAsciiGrid(Uint8Array.from([0, 255]), 2, 1).lines[0], [{ tone: 0, text: ' ' }, { tone: 5, text: '@' }]);
assert.deepEqual(toAsciiGrid(Uint8Array.from([255, 255, 128, 0]), 4, 1).lines[0],
  [{ tone: 5, text: '@@' }, { tone: 3, text: '+' }, { tone: 0, text: ' ' }]);
const g = toAsciiGrid(new Uint8Array(18).map((_, i) => i * 14), 6, 3);
assert.equal(g.lines.length, 3); for (const line of g.lines) assert.equal(line.map((r) => r.text).join('').length, 6);
assert.throws(() => toAsciiGrid(new Uint8Array(5), 2, 2));
assert.equal(gridRows(96, 1280, 720), 27);
assert.ok(!/[<>&"']/.test(ASCII_RAMP));
// renderAscii on a 4×2 sharp-generated PNG in os.tmpdir(): white half → '@', black half → ' '
// renderAscii on an RGBA 4×2 PNG (channels: 4, alpha 255): same result, no throw
```
- [ ] **Step 2: Run it to make sure it fails.** `node --test src/lib/ascii.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `ascii.ts`, then `ascii-source.ts` and `AsciiImage.astro`.**
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Gate and guard greps.** The only `gradient` hits are the shimmer mask and the Task 2 `scanlines` utility.
- [ ] **Step 6: Visual acceptance.** Deferred to Task 7, which renders the hero. Record the measured `--ascii-advance` and the chosen columns in `systemPatterns.md`.
- [ ] **Step 7: Memory bank.** `systemPatterns.md`: ASCII constants, tone mapping and the source-path rule. `progress.md`.
- [ ] **Step 8: Commit.** `feat: add build-time ascii renderer and AsciiImage`.

---

### Task 7: Section blocks and SectionRenderer

Model: Opus 5.5 · Group G5 · Spec §7 (sections schema), §8 (block table, wireframe, Do/Don't)

**Files:**
- Create: `src/components/sections/{Hero,Statement,AppGrid,FeatureList,RichText,Cta,Faq,SectionRenderer}.astro`, `src/lib/markdown.ts`
- Modify: `src/pages/index.astro` (BaseLayout + SectionRenderer for EN `home`, then EN `about` below it)

**Interfaces:**
- Consumes: `BaseLayout` (Task 5, for the scaffold page); `Section`, `SectionOf`, `assertNever`, `listApplications`, `selectApps`, `localizePath`, `applicationPath`, `getUiDictionary`, `t` (Task 3); atoms (Task 4); `AsciiImage` (Task 6); `GridFrame` (spaced default), `TitleSafe`, `LowerThird` (Task 7a).
- Produces:
  - `markdown.ts`: `renderMarkdown(source: string): Promise<string>`. One memoized `createMarkdownProcessor({ syntaxHighlight: false })` promise from `@astrojs/markdown-remark`.
  - Block props: `{ section: SectionOf<'<type>'>; index: number; locale: Locale; headingLevel: 1 | 2 }`.
  - `SectionRenderer` props: `{ sections: readonly Section[]; locale: Locale; pageTitle?: string }`. Index = array position + 1. It owns the section dividers (border budget): every section after the first opens with one full-width `border-t border-line` rule and generous top padding; blocks never draw their own outer borders. An exhaustive `switch (section.type)` ends in `default: return assertNever(section)`. This is the single owner of the page h1: a hero at position 0 gets `headingLevel` 1; otherwise, when `pageTitle` is set, SectionRenderer first renders a title band with `pageTitle` as the h1 (display size); when `pageTitle` is absent there is no h1 (ApplicationPage renders its own). All other blocks use `headingLevel` 2.

Block specs (§8 table and border budget, made concrete; no block draws boxed cells):
- `Hero`: spaced `GridFrame` with `columns={12}` (stacked below `lg`; text `lg:col-span-7`, media `lg:col-span-5 min-w-0`).
  - Left: `Label`, two-tone `Heading` (`headline` + `headlineAccent`, display size), lede (≤ 60ch, ink-muted), ≤ 2 `Button`s (first primary).
  - Right: `<TitleSafe scanlines>` around `AsciiImage` (`image`, `imageAlt`). The hairline frame and title-safe marks are the hero's only lines; scanlines appear only here.
- `Statement`: spaced `GridFrame` with `columns={12}`: `Label` in a `lg:col-span-3` gutter, display text in ink in `lg:col-span-9`; stacked on mobile. Plain indexed label, no lower third.
- `AppGrid`: `LowerThird` section heading (`heading`, strap = `label` with the section index), then a spaced `GridFrame` with `columns={3}` (ramp 1 / md 2 / lg 3; spaced grids need no last-row fill) of `surface` tiles (padding, no border), showing `selectApps(listApplications(locale), apps)`. Each tile is one link: `[0N]` index, status `Tally`, the name as a `LowerThird` (level 3, strap = category), tagline, a frameless duotone cover (no `TitleSafe`: the frame is only for the hero media and the ApplicationPage cover) and `→` (internal link, via `Glyph`).
  - Cover: `<Picture formats={['avif','webp']}>`, greyscale, with an accent `mix-blend-mode` layer and no gradient.
  - Link href: `localizePath(applicationPath(slug), resolved.locale)`.
- `FeatureList` (rundown): `LowerThird` section heading, then an `<ol>` of rows: mono running number `01` …, title, body (ink-muted) and a mono `duration` column (`HH:MM:SS`, ink-muted, end-aligned; left out for a row without `duration`). Rows are set apart by spacing, never by rules; below `md` the number and duration share one line above the title.
- `RichText`: `Prose` with `renderMarkdown(body)`.
- `Cta`: one `surface` band (no border) with heading, optional text, a single `Button` and a `Tally` (`tallyOnAir`, accent).
- `Faq`: native `<details>` rows set apart by spacing (no rules). The summary shows "+" which becomes "−" via `details[open]`. The answer uses `renderMarkdown`.

- [ ] **Step 1: Implement `markdown.ts` and the 7 blocks.**
- [ ] **Step 2: Implement `SectionRenderer`.** Temporarily add a non-union `type` to a fixture cast and confirm `pnpm check` fails (exhaustiveness), then remove it.
- [ ] **Step 3: Render home and about** on the scaffold page.
- [ ] **Step 4: Gate and guard greps, plus hero size.** Expected: < 30000.
```bash
node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const m=h.match(/<figure[^>]*data-ascii[\s\S]*?<\/figure>/);process.stdout.write(String(m[0].length))"
```
- [ ] **Step 5: Visual acceptance.** VA1–VA8, plus:
  - The hero matches the §8 wireframe at 1440px, and the ASCII stays legible and scales with its container at 360/768/1440.
  - Scanlines appear on the hero only; title-safe marks only on the hero media (and, in Task 8, the ApplicationPage cover), sitting in the frame's margin, never over the ASCII.
  - Borders only within the budget. Border audit in the console: every element with a computed border width is a header/footer edge, a section divider, a control or a `TitleSafe` frame/mark.
  - App tiles are `surface` tone without borders, the whole tile is one link with a focus ring, and its name is a lower third.
  - Rundown rows show the mono duration column when `duration` is set.
  - FAQ "+"/"−" toggles by keyboard.
  - Prose stays ≤ 68ch with mono h3.
  - The CTA "ON AIR" tally is accent.
  - Tune the ASCII columns, ramp and tones against the seed image (`transmitter.png` since Task 7b) while staying < 30 KB.
- [ ] **Step 6: Memory bank.** `systemPatterns.md`: block props and the heading-level rule. `progress.md`.
- [ ] **Step 7: Commit.** `feat: add section blocks and renderer`.

---

### Task 8: Routes, TR wrappers, 404s, robots, sitemap, JSON-LD

Model: Sonnet 5.5 · Group G6 (∥ T9) · Spec §6 `pages/`, §7 (TR rules, hreflang), §9 (404-page, preview rules), §15 items 3, 13, 14, 24

**Files:**
- Delete: `src/pages/index.astro`
- Create: `src/pages/{[...slug].astro,applications/[slug].astro,404.astro,robots.txt.ts}`, `src/pages/tr/{[...slug].astro,applications/[slug].astro,404.astro}`, `src/lib/routes.ts`, `src/components/pages/{GenericPage,ApplicationPage,NotFoundPage}.astro`; `src/integrations/build-outputs.ts` and `build-outputs.test.ts` only if Step 6 needs them
- Modify: `src/lib/seo.ts`, `src/lib/seo.test.ts` (robots), `astro.config.ts` (sitemap)

**Interfaces:**
- Consumes: BaseLayout, `organizationJsonLd`, `hreflangLinks` (Task 5); SectionRenderer (Task 7); content and i18n libs (Task 3); `BUILD` (Task 1).
- Produces:
  - `routes.ts`: `RESERVED_PAGE_SLUGS = ['quote', 'not-found'] as const`, `pageStaticPaths(locale: Locale): Promise<{ params: { slug: string | undefined } }[]>` (`home` → `undefined`; reserved slugs excluded; only that locale's own entries), `applicationStaticPaths(locale: Locale): Promise<{ params: { slug: string } }[]>`.
  - `seo.ts` adds `robotsTxt(input: { isProduction: boolean; siteUrl: string }): string`. Production: `User-agent: *\nDisallow: /admin/\n\nSitemap: <siteUrl>/sitemap-index.xml\n`. Otherwise: `User-agent: *\nDisallow: /\n`.
  - Page component props: `GenericPage { locale: Locale; slug: string }`, `ApplicationPage { locale: Locale; slug: string }`, `NotFoundPage { locale: Locale }`. QuotePage is in Task 9.
  - TR wrapper shape (every TR route):
```astro
---
import GenericPage from '../../components/pages/GenericPage.astro';
import { pageStaticPaths } from '../../lib/routes.ts';
export const getStaticPaths = () => pageStaticPaths('tr');
---
<GenericPage locale="tr" slug={Astro.params.slug ?? 'home'} />
```
- Behaviour:
  - `GenericPage`: passes `pageTitle={title}` to `SectionRenderer`, which owns the h1 rule (Task 7). `jsonLd` is set only for `home`, from settings (logo via `getImage`, `sameAs` = socials, email/phone from contacts).
  - `ApplicationPage`: header with category `Label`, h1 `name`, status `Tally`, `summary` lede, duotone cover in `TitleSafe` (no scanlines), `links` and `brochure` as ↗ links (internal links →), then `SectionRenderer` with no `pageTitle` (the page header above already holds the h1). The h1 stays a plain display `Heading`: lower thirds are for section headings and card titles only.
  - `NotFoundPage`: `not-found` entry with EN fallback, `noindex`; passes `pageTitle` to `SectionRenderer` and shows the `NoSignal` test pattern (`text` = `t(dict, locale, 'noSignal')`, width capped around `max-w-3xl`) between the title band and the sections.
  - `tr/404.astro` always builds; with no TR entry it renders EN content under the fallback rule (Task 5).
  - Sitemap: `@astrojs/sitemap` with `i18n: { defaultLocale: 'en', locales: { en: 'en', tr: 'tr' } }`. The filter drops `/404/`, `/tr/404/`, `/admin/`, and `/tr/quote/` unless `existsSync('src/content/pages/tr/quote.yaml')`.

- [ ] **Step 1: Write the failing robots tests** in `seo.test.ts`
```ts
assert.equal(robotsTxt({ isProduction: true, siteUrl: 'https://example.com' }), 'User-agent: *\nDisallow: /admin/\n\nSitemap: https://example.com/sitemap-index.xml\n');
assert.equal(robotsTxt({ isProduction: false, siteUrl: 'http://localhost:4321' }), 'User-agent: *\nDisallow: /\n');
```
- [ ] **Step 2: Run it to make sure it fails, then implement `robotsTxt`, then run it to make sure it passes.**
- [ ] **Step 3: Implement** `routes.ts`, the page components, the route files (EN and TR wrappers, `robots.txt.ts` as a `GET` endpoint) and the sitemap config. Delete the scaffold page.
- [ ] **Step 4: Gate and guard greps.**
- [ ] **Step 5: `dist` assertions.** All must hold.
```bash
for f in about contact privacy applications applications/newsroom-desk applications/playout-control applications/archive-search tr; do test -f dist/$f/index.html || echo "MISSING $f"; done   # prints nothing
test -f dist/index.html && test -f dist/404.html && test -f dist/robots.txt && test -f dist/sitemap-index.xml && test ! -e dist/tr/about
grep -o '<link rel="alternate"[^>]*>' dist/index.html | wc -l          # 3 (en, tr, x-default)
grep -o '<link rel="alternate"[^>]*>' dist/about/index.html | wc -l    # 2 (en, x-default)
test ! -e dist/not-found                     # reserved slug excluded
grep -q 'application/ld+json' dist/index.html && ! grep -q 'application/ld+json' dist/about/index.html
grep -q '<html lang="tr"' dist/tr/index.html
grep -q 'href="/applications/' dist/tr/index.html && ! grep -q 'href="/tr/applications/' dist/tr/index.html   # EN fallback links
grep -q 'Disallow: /$' dist/robots.txt       # local build is non-production
grep -rhoE '<script[^>]*>' dist --include=*.html --exclude-dir=admin | grep -v 'application/ld+json' | grep -v 'challenges.cloudflare.com/turnstile'   # prints nothing (from Task 7b: use the dist script guard in the header, which also allows the ASCII motion module)
grep -rhoE 'href="/[^"#]*' dist --include=*.html | sed 's/href="//' | sort -u | while read p; do [ -f "dist${p}index.html" ] || [ -f "dist${p}" ] || echo "BROKEN $p"; done | grep -vE '^BROKEN /(tr/)?quote/$'   # prints nothing; the filter is for the G6 worktree only (T9's pages are not there yet); the manager re-runs this unfiltered on the merged tree
```
- [ ] **Step 6: TR 404 location.** `test -f dist/tr/404.html`. If Astro emitted `dist/tr/404/index.html` instead, create `src/integrations/build-outputs.ts` with `relocateLocale404(dist: URL): Promise<void>`, run on `astro:build:done`, and register it in `astro.config.ts`. Add `src/integrations/build-outputs.test.ts` with a case on a temp dir (`tr/404/index.html` → `tr/404.html`, idempotent). Task 10 extends that file and keeps `relocateLocale404` and its test.
- [ ] **Step 7: Visual acceptance.** VA1–VA8 on every template (home, about, contact, privacy, applications index, one application, 404, TR home). Each page has exactly one h1. The 404 shows the NO SIGNAL pattern (TR: `SİNYAL YOK`). The toggle on `/about/` goes to `/tr/`, and on `/tr/` it goes to `/`.
- [ ] **Step 8: Memory bank.** `systemPatterns.md`: route map, reserved slugs, sitemap filter, TR 404 handling. `techContext.md`: §14 i18n fallback resolved by manual routing. `progress.md`.
- [ ] **Step 9: Commit.** `feat: add page routes, tr wrappers, robots and sitemap`.

---

### Task 9: Quote page and shared quote schema

Model: Opus 5.5 · Group G6 (∥ T8) · Spec §12, §15 items 6–7

**Files:**
- Create: `src/lib/quote-schema.ts`, `src/components/quote/{QuoteForm,QuoteStatus}.astro`, `src/components/pages/QuotePage.astro`, `src/pages/quote.astro`, `src/pages/tr/quote.astro`
- Test: `src/lib/quote-schema.test.ts`

**Interfaces:**
- Consumes: `LOCALES`, `t`, `getPage`, `listApplications`, `getSettings` (Task 3); BaseLayout (Task 5); SectionRenderer (Task 7); `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Button`, `Tally` (Task 4); `BUILD.turnstileSiteKey` (Task 1).
- Produces (`quote-schema.ts` imports only `astro/zod` and `i18n.ts`; the Worker imports it):
  - Constants: `QUOTE_LIMITS = { name: 100, email: 254, company: 120, role: 80, country: 80, message: 2000, token: 2048 } as const` (`token` is consumed by the Worker, Task 10 step 4), `MAX_SOLUTIONS = 16`, `TIMELINES = ['asap', 'quarter', 'half-year', 'exploring'] as const`, `type Timeline`, `GENERAL_SOLUTION = 'general'`, `QUOTE_STATES = ['sent', 'error-invalid', 'error-verify', 'error-send'] as const`, `type QuoteState`, `TURNSTILE_FIELD = 'cf-turnstile-response'`.
  - `quoteSchema` fields:
    - Single-line fields (trimmed, reject `/[\r\n]/`): `name` 1–100, `email` (`z.email()` ≤ 254), `company` 1–120, `role` 0–80, `country` 0–80.
    - `solutions`: 1–`MAX_SOLUTIONS` strings.
    - `timeline`: `z.enum(TIMELINES)`.
    - `message`: 1–2000, multi-line.
    - `consent`: `z.literal('on')`.
    - `locale`: `z.enum(LOCALES)`.
  - `type QuoteInput`; `formDataToInput(form: FormData): Record<string, unknown>` (`solutions` via `getAll`; ignores `TURNSTILE_FIELD`).
  - `QuotePage { locale: Locale }` (passes `pageTitle` to `SectionRenderer`, which owns the h1 rule; computes `privacyHref = localizePath(pagePath('privacy'), resolved.locale)` from `getPage(locale, 'privacy')`, so TR falls back to EN `/privacy/`), `QuoteForm { locale: Locale; ui: UiDictionary; solutions: readonly { value: string; label: string }[]; privacyHref: string; siteKey: string }`, `QuoteStatus { locale: Locale; ui: UiDictionary; email: string }`.

- [ ] **Step 1: Write the failing test** `quote-schema.test.ts` (`valid` is a complete fixture):
```ts
assert.ok(quoteSchema.safeParse(valid).success);
assert.ok(!quoteSchema.safeParse({ ...valid, name: 'A\r\nBcc: x@example.com' }).success);
assert.ok(quoteSchema.safeParse({ ...valid, message: 'line 1\nline 2' }).success);
assert.ok(!quoteSchema.safeParse({ ...valid, message: 'x'.repeat(2001) }).success);
assert.ok(!quoteSchema.safeParse({ ...valid, timeline: 'soon' }).success);
assert.ok(!quoteSchema.safeParse({ ...valid, consent: undefined }).success);
assert.ok(!quoteSchema.safeParse({ ...valid, solutions: [] }).success);
assert.ok(quoteSchema.safeParse({ ...valid, role: '', country: '' }).success);
assert.ok(!quoteSchema.safeParse({ ...valid, email: 'not-an-email' }).success);
const fd = new FormData(); fd.append('solutions', 'a'); fd.append('solutions', 'b'); fd.append(TURNSTILE_FIELD, 't');
assert.deepEqual(formDataToInput(fd).solutions, ['a', 'b']); assert.ok(!(TURNSTILE_FIELD in formDataToInput(fd)));
```
- [ ] **Step 2: Run it to make sure it fails, implement `quote-schema.ts`, then run it to make sure it passes.**
- [ ] **Step 3: Implement the components.**
  - `QuoteForm`: `<form method="post" action="/api/quote" enctype="multipart/form-data">` with a hidden `locale` (multipart keeps a max-length non-ASCII form under `MAX_BODY_BYTES`; urlencoded would not). Every limit comes from `QUOTE_LIMITS` as `maxlength`. Autocomplete: `name`, `email`, `organization`, `organization-title`, `country-name`.
  - Solutions: checkboxes for each application name, plus `general` (`quoteSolutionsGeneral`), with the `quoteSolutionsHint` hint.
  - Timeline: `Select` labelled through `TIMELINE_LABEL_KEYS: Record<Timeline, UiKey>`.
  - Consent: `Checkbox` with a localized privacy link.
  - Turnstile: `<div class="cf-turnstile" data-sitekey data-action="quote" data-theme="dark" data-size="flexible" data-language={locale}>`.
  - `<noscript>` shows `quoteNoScript` plus the settings email.
  - Layout (border budget): fields sit in a spaced `GridFrame` (no hairline cells); only the controls carry borders.
  - `QuoteStatus`: four `<section id={state} tabindex="-1">` panels, hidden by `:not(:target)`, each a `surface` band (no border) with an h2 and body. Error panels use a `critical` `Tally`. `error-verify` adds a mailto link to the first `kind: 'email'` contact.
  - `QuotePage`: `getPage(locale, 'quote')` (EN fallback). The BaseLayout `head` slot carries `<script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`. Order: SectionRenderer, QuoteStatus, QuoteForm.
- [ ] **Step 4: Gate and guard greps, plus `dist` assertions.**
```bash
grep -q 'action="/api/quote"' dist/quote/index.html && grep -q 'enctype="multipart/form-data"' dist/quote/index.html && grep -q 'name="locale" value="en"' dist/quote/index.html
grep -q 'name="locale" value="tr"' dist/tr/quote/index.html && grep -q 'data-action="quote"' dist/quote/index.html
grep -q 'maxlength="2000"' dist/quote/index.html && grep -q '1x00000000000000000000AA' dist/quote/index.html
for id in sent error-invalid error-verify error-send; do grep -q "id=\"$id\"" dist/quote/index.html || echo "MISSING $id"; done   # prints nothing
grep -rl 'challenges.cloudflare.com/turnstile' dist --include=*.html   # exactly dist/quote/index.html and dist/tr/quote/index.html
```
- [ ] **Step 5: Visual acceptance.** VA1–VA8, plus:
  - Every control has a visible label tied to it with `for`/`id`; optional fields show `quoteOptional`.
  - The Turnstile widget fits at 360px.
  - `/quote/#sent` and each `#error-*` show only their panel, focus lands on it, and `critical` appears only on error panels.
  - The Tab order follows visual order.
  - With JS disabled, the noscript email shows.
- [ ] **Step 6: Memory bank.** `systemPatterns.md`: quote limits and states. `progress.md`.
- [ ] **Step 7: Commit.** `feat: add quote page, form and shared quote schema`.

---

### Task 10: Quote Worker, build outputs, security headers

Model: Sonnet 5.5 (Opus 5.5 reviewer) · Group G7 · Spec §5, §9, §11, §12, §14 (worker zod, email, previews)

**Files:**
- Create: `worker/{quote,turnstile,mail,headers}.ts`, `public/_headers` (spec §11 verbatim), `src/integrations/build-outputs.ts` (or extend Task 8's)
- Modify: `worker/index.ts`, `astro.config.ts` (register `buildOutputs({ isProduction })`)
- Test: `worker/{quote,turnstile,mail}.test.ts`, `src/integrations/build-outputs.test.ts`

**Interfaces:**
- Consumes: `quoteSchema`, `formDataToInput`, `QUOTE_LIMITS`, `TURNSTILE_FIELD`, `QuoteState`, `type QuoteInput` (Task 9); `isLocale` (Task 3); `resolveBuildMode` (Task 1).
- Produces:
  - `headers.ts`: `WORKER_HEADERS` (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Cache-Control: no-store`); `withWorkerHeaders(response: Response): Response`.
  - `turnstile.ts`:
    - Constants: `SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'`, `SITEVERIFY_TIMEOUT_MS = 5000`.
    - Types: `type TurnstileCheck = { token: string; secret: string; remoteip: string | null; hostname: string; action: string }`; `type TurnstileResult = { ok: true } | { ok: false; reason: 'network' | 'rejected' | 'hostname' | 'action' }`.
    - `verifyTurnstile(check: TurnstileCheck, fetchFn: typeof fetch): Promise<TurnstileResult>` never throws.
  - `mail.ts`:
    - `QUOTE_SUBJECT_PREFIX = 'Quote request'` and the body field labels are named constants at the top of `mail.ts` (operator-facing text, exempt from the content rule); `type QuoteEmail = { from: string; to: string; quote: QuoteInput; date: Date; messageId: string }`.
    - `buildQuoteEmail(mail: QuoteEmail): string` builds an RFC 5322 message with CRLF line endings and these headers: `From`, `To`, `Reply-To: <quote.email>`, `Subject` (RFC 2047 `=?UTF-8?B?…?=` when non-ASCII), `Date` (`toUTCString()`), `Message-ID: <id@from-domain>`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: base64`. The body is base64 wrapped at 76 characters.
    - It throws on CR/LF in any header value.
  - `quote.ts`:
    - Types: `type QuoteEnv = { TURNSTILE_SECRET_KEY?: string; QUOTE_TO?: string; QUOTE_FROM?: string; MAX_BODY_BYTES: string }`; `type OutgoingMail = { from: string; to: string; raw: string }`; `type QuoteDeps = { allowList: ReadonlySet<string>; fetch: typeof fetch; send: (mail: OutgoingMail) => Promise<void>; now: () => Date; messageId: () => string }`.
    - `handleQuote(request: Request, env: QuoteEnv, deps: QuoteDeps): Promise<Response>`.
    - Logging: `console.error({ code, step })` with `code ∈ 'guard' | 'invalid' | 'verify' | 'send' | 'config'`.
  - `handleQuote` flow (exact order):
    1. Not POST → 405 with `Allow: POST`.
    2. Guard: `Origin` must equal the request origin; content type must be `application/x-www-form-urlencoded` or `multipart/form-data`; `Content-Length` ≤ max; the body is read as a stream and capped at max bytes. Any failure → `error-invalid`.
    3. `formData()`; locale from the `locale` field (`isLocale`, else `en`); `quoteSchema.safeParse`; every solution must be in `allowList`. Any failure → `error-invalid`.
    4. Empty token, or one longer than `QUOTE_LIMITS.token` → `error-verify` (no fetch).
    5. Missing secret, `QUOTE_TO`, `QUOTE_FROM` or a bad `MAX_BODY_BYTES` → `error-send` (`config`).
    6. Siteverify (hostname = request host, action `quote`); failure → `error-verify`.
    7. `send` rejects → `error-send`.
    8. Success → `sent`.
    - Every POST response is a 303 with `Location: <origin>[/tr]/quote/#<state>` and the `WORKER_HEADERS`.
  - `index.ts`: `type Env = QuoteEnv & { ASSETS: Fetcher; QUOTE_MAILER: SendEmail }`. `/api/quote` goes to `handleQuote`, with `allowList` from `./generated/solutions.json` (`with { type: 'json' }`), `send` via `new EmailMessage(from, to, raw)` from `cloudflare:email`, and `crypto.randomUUID`. Any other path goes to `env.ASSETS.fetch(request)`.
  - `build-outputs.ts`: `GENERATED_SOLUTIONS_PATH = 'worker/generated/solutions.json'`; `solutionSlugs(pathnames: readonly string[]): string[]` (sorted unique slugs from `[/]?(tr/)?applications/<slug>/`, then `'general'`; throws if a slug is `general`); `appendNoindex(headers: string): string` (adds a `/*` block with `X-Robots-Tag: noindex`, idempotent); `buildOutputs(options: { isProduction: boolean }): AstroIntegration` (keeps `relocateLocale404` and its test from Task 8, if present). It reads the root in `astro:config:done`. In `astro:build:done({ dir, pages })` (verify Astro 7 still passes `pages`; if not, walk `dir` for `applications/<slug>/index.html`) it writes the JSON (mkdir recursive) and, when not in production, rewrites `dist/_headers`.

- [ ] **Step 1: Write the failing tests.** Shared fixtures: `ORIGIN = 'https://site.example'`, `env = { TURNSTILE_SECRET_KEY: 's', QUOTE_TO: 'inbox@example.com', QUOTE_FROM: 'quote@example.com', MAX_BODY_BYTES: '16384' }`, a fake siteverify (`{ success: true, hostname: 'site.example', action: 'quote' }`), a recording `send`, `now = () => new Date('2026-11-23T10:00:00Z')`, `messageId = () => 'id-1'`. Each line is one `test()`:
```text
quote.test.ts
  valid EN post → 303 https://site.example/quote/#sent; send called once; raw contains "Reply-To: visitor@example.org"
  locale=tr → /tr/quote/#sent;  locale=de → /quote/#…
  GET → 405, Allow: POST
  Origin https://evil.example → #error-invalid, fetch not called;  missing Origin → #error-invalid
  Content-Type application/json → #error-invalid
  Content-Length 20000 → #error-invalid without reading the body
  chunked ReadableStream body of 20000 bytes, no Content-Length → #error-invalid
  every field at max, multipart body, EVERY text field non-ASCII ('ş'.repeat(n) at each limit), token 2048 chars → #sent (well under 16384 bytes)
  the same all-max payload urlencoded → #error-invalid (negative case: documents why the form is multipart)
  token of 2049 chars → #error-verify, fetch not called
  unknown solution 'mystery' → #error-invalid;  CR/LF in name → #error-invalid
  no turnstile field (no-JS) → #error-verify, fetch not called
  siteverify success:false | hostname 'other.example' | action 'login' | fetch rejects → #error-verify
  send rejects → #error-send;  QUOTE_TO missing → #error-send, send not called
  every response has Cache-Control: no-store and X-Content-Type-Options: nosniff
  console.error (t.mock.method) args have exactly the keys code and step and never contain the visitor email
turnstile.test.ts
  POSTs secret, response, remoteip as a form body to SITEVERIFY_URL
  success + matching hostname/action → { ok: true }; success:false → rejected; hostname → hostname; action → action
  fetch throws → network; non-JSON body → network
mail.test.ts
  no bare LF (/(?<!\r)\n/ never matches); headers From/To/Reply-To/MIME-Version/Content-Type/Content-Transfer-Encoding present
  Date: Mon, 23 Nov 2026 10:00:00 GMT;  Message-ID: <id-1@example.com>
  company 'Şirket' → Subject is =?UTF-8?B?…?= and decodes to contain 'Şirket'
  decoded body contains the message, the solutions and the timeline key; every body line ≤ 76 chars
  header value containing \r\n throws
build-outputs.test.ts
  solutionSlugs(['/applications/b/', 'tr/applications/b/', 'applications/a/', '/about/', '/applications/']) → ['a', 'b', 'general']
  solutionSlugs(['applications/general/']) throws /general/
  appendNoindex adds one X-Robots-Tag: noindex under /*; applying it twice changes nothing
```
- [ ] **Step 2: Run them to make sure they fail.** `node --test worker/*.test.ts src/integrations/*.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `headers.ts`, `turnstile.ts`, `mail.ts`, `quote.ts`, then `index.ts`, `build-outputs.ts`, `public/_headers` and the config registration.
- [ ] **Step 4: Run the tests.** Expected: all pass.
- [ ] **Step 5: Gate**, then check the generated files.
  - `cat worker/generated/solutions.json` = `["archive-search","newsroom-desk","playout-control","general"]`.
  - `grep -c 'X-Robots-Tag: noindex' dist/_headers` = 1.
- [ ] **Step 6: Production build check.** `WORKERS_CI_BRANCH=main SITE_URL=https://example.com PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAplaceholder pnpm build`, then:
  - `! grep -q noindex dist/_headers`
  - `grep -q 'Sitemap: https://example.com/sitemap-index.xml' dist/robots.txt`
  - `grep -q 0x4AAAAAAAplaceholder dist/quote/index.html`
  - Then run `pnpm build` again with no variables.
- [ ] **Step 7: Bundle check.** `pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run` bundles without errors and stays under 3 MiB. This verifies `astro/zod`, the JSON import and `cloudflare:email` (§14). If `astro/zod` fails, stop and ask the manager about the pre-approved `zod` pin.
- [ ] **Step 8: Local smoke test.** Write a gitignored `.dev.vars` with `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` and example addresses. Run `pnpm preview`, then:
  - `curl -si localhost:8787/api/quote` → 405.
  - POST with `Origin: http://localhost:8787` and no token → `303 …/quote/#error-verify`.
  - POST with `Origin: https://evil.example` → `#error-invalid`.
  - `/api/nope` → 404 page.
  - `curl -sI localhost:8787/` shows the CSP.
- [ ] **Step 9: Memory bank.** `techContext.md`: §14 results (worker zod, `send_email`, dry-run size). `systemPatterns.md`: Worker flow and error codes. `progress.md`.
- [ ] **Step 10: Commit.** `feat: add quote worker, build outputs and security headers`.

---

### Task 11: Sveltia admin config

Model: Sonnet 5.5 · Group G4 (∥ T5, T6) · Spec §5, §13 steps 6–7, §14 (Sveltia), §15 item 22

**Files:**
- Create: `public/admin/index.html`, `public/admin/config.yml`
- Test: `src/lib/admin-config.test.ts`

**Interfaces:**
- Consumes: `UI_KEYS` (Task 3 `i18n.ts`), `SECTION_TYPES` and the field names (Task 3 `sections-schema.ts`, `content.config.ts`), `HEX_PATTERN` (Task 3).
- Produces: `backend.base_url: https://<auth-worker>.workers.dev`, a placeholder replaced by runbook §3 step 6.

- [ ] **Step 1: Write the failing test** `admin-config.test.ts` (reads both files with `readFileSync`; line-anchored regex and substring checks, no YAML dependency):
```ts
for (const type of SECTION_TYPES) assert.match(config, new RegExp(`name: ${type}$`, 'm'), type);   // line-anchored: longer keys must not satisfy shorter ones
for (const key of UI_KEYS) assert.match(config, new RegExp(`name: ${key}$`, 'm'), key);
for (const s of ['publish_mode: editorial_workflow', 'structure: multiple_folders', 'media_folder: src/assets/uploads', 'typeKey: type', HEX_PATTERN.source])
  assert.ok(config.includes(s), s);
assert.match(html, /@sveltia\/cms@0\.271\.2\/dist\/sveltia-cms\.js/); assert.match(html, /integrity="sha384-[A-Za-z0-9+/]{64}"/);
```
- [ ] **Step 2: Run it to make sure it fails.** `node --test src/lib/admin-config.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write `config.yml`.**
  - `backend: { name: github, repo: <owner>/<repo>, branch: main, base_url: <placeholder> }`, `publish_mode: editorial_workflow`, `media_folder: src/assets/uploads`, `i18n: { structure: multiple_folders, locales: [en, tr], default_locale: en }`.
  - Settings: a singleton (Sveltia `singletons`; if unsupported in 0.271.2, a `files` collection with one file), `i18n: false`, `public_folder: ../../assets/uploads`. The `accent` field uses `pattern` [HEX_PATTERN, hint] and a hint saying it needs ≥ 3:1 contrast on the dark canvas.
  - `ui` and `navigation`: folder collections, `create: false`. UI fields use `required: [en]`.
  - `pages`: `slug: '{{fields._slug}}'`.
  - `applications`: `slug: '{{slug}}'`, `identifier_field: name`, `sortable_fields: [order]`. `brochure` is a plain string with an https pattern, unless R2 media is confirmed (§14).
  - Per-collection `public_folder: ../../../assets/uploads`.
  - One YAML anchor `&sections` (a `list` with `types:` and `typeKey: type`, one entry per block with the same field names and limits as the Zod schema) is used by both pages and applications.
- [ ] **Step 4: Write `index.html`.** Doctype, charset, viewport, `<meta name="robots" content="noindex">`, and the pinned script with `crossorigin="anonymous"`. Compute the SRI hash with `curl -sL https://unpkg.com/@sveltia/cms@0.271.2/dist/sveltia-cms.js | openssl dgst -sha384 -binary | openssl base64 -A`.
- [ ] **Step 5: Run the test.** Expected: PASS.
- [ ] **Step 6: Manual check.** `pnpm dev`, then open `/admin/` in Chromium and use "Work with Local Repository". Every collection opens, every seed entry loads without validation errors, TR is shown as a locale, and nothing is saved. Record any §14 Sveltia findings. If the agent has no Chromium with File System Access, report this step as pending for the owner (human fallback) and continue.
- [ ] **Step 7: Gate.** `test -f dist/admin/config.yml`.
- [ ] **Step 8: Memory bank.** `techContext.md`: Sveltia verification results. `progress.md`.
- [ ] **Step 9: Commit.** `feat: add sveltia cms admin config`.

---

### Task 12: Deploy and setup runbook, final acceptance

Model: Sonnet 5.5 · Group G8 · Spec §2, §13, §14

**Files:**
- Create: `docs/runbook.md`

**Interfaces:**
- Consumes: every name above (variables, secrets, routes, states, test keys). The §14 results come from `memory-bank/techContext.md`.

- [ ] **Step 1: Write `docs/runbook.md`** (brand-agnostic, checkboxes, exact names and commands):
  1. **Overview:** deploy order auth Worker → GitHub App callback → site; what runs where.
  2. **Local development:**
     - `.dev.vars` keys (`TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`, `QUOTE_TO`, `QUOTE_FROM`).
     - `pnpm dev | build | check (after build) | lint | test | preview`.
  3. **One-time setup:** spec §13 steps 1–12 in order. Include `npx wrangler secret put TURNSTILE_SECRET_KEY|QUOTE_TO|QUOTE_FROM`.
     - Step 6 edits `config.yml` `base_url` and the `/admin/*` `connect-src` in `public/_headers`.
     - The CODEOWNERS handle check.
     - Workers Builds: build `pnpm build`, deploy `npx wrangler deploy`, production branch `main`, vars `SITE_URL` and `PUBLIC_TURNSTILE_SITE_KEY`, previews on.
     - The R2 payment-method note.
  4. **Editing flow:** editor → PR → preview (visual only: test keys, noindex, no CMS auth) → CODEOWNER merge → deploy.
  5. **Acceptance checks:**
     - Lighthouse (mobile, production URL): Performance ≥ 95 (target 100), Accessibility 100, Best Practices 100, SEO 100.
     - No `<script>` outside the quote pages and `/admin/` except the ASCII motion module on pages with `AsciiImage` (the header's dist script guard); hero ASCII figure < 30 KB.
     - `curl -sI` shows every §11 header on `/`, the admin CSP on `/admin/`, and an immutable cache on `/_astro/*`; securityheaders.com grade ≥ A.
     - Quote with JS → `#sent` and a mail with Reply-To; without JS → `#error-verify` with the email; bad token (`cf-turnstile-response=bad`) → `#error-verify`; cross-origin → `#error-invalid`; GET → 405.
     - axe (`npx @axe-core/cli@<pinned>` ad hoc, never a dependency) with 0 violations on `/`, `/about/`, `/applications/`, one application, `/contact/`, `/privacy/`, `/quote/` (and each `#state`), the 404 page, `/tr/`, `/tr/quote/`.
     - Keyboard-only walk; reflow at 320 CSS px and 200% zoom; reduced motion; TR glyphs in both fonts.
  6. **Builder verifications (§14):** a table of item → result → date, filled from techContext.
  7. **Troubleshooting:** the accent-contrast build error; `check` needing a build first; `#error-send` meaning Email Routing or secrets are not set; production build failing on missing vars; preview builds use `http://localhost:4321` canonicals (open §14 "Previews" item: revisit only if Workers Builds exposes a preview-host variable).
- [ ] **Step 2: Final local acceptance.**
  - `pnpm install --frozen-lockfile`, then the Gate, the guard greps, the Task 8 `dist` assertions, the Task 9 Turnstile grep, the Task 10 production build check and dry run.
  - VA1–VA8 spot check on every template at 360px.
  - Record the results (pass/fail per line) in `memory-bank/progress.md`.
- [ ] **Step 3: Memory bank.** `progress.md`: milestones 2–7 done, local acceptance results. `activeContext.md`: next step is the owner running runbook §3 and §5 on production.
- [ ] **Step 4: Commit.** `docs: add deploy and setup runbook`.

---

## Spec coverage map

| Spec | Task(s) |
|---|---|
| §1–2 principles, goals, anti-goals | Global Constraints, guard greps, T12 acceptance |
| §3 constraints (free tier, `send_email`, latin-ext) | T2 fonts, T10, T12 |
| §6 folder tree | T1–T11 (additions listed under Execution notes) |
| §7 content model, seed, TR rules | T3, T8 |
| §8 tokens, typography, blocks, signature components | T2, T4, T6, T7, VA checklist |
| §9 wrangler, build order, previews | T1, T10 |
| §10 package.json | T1 |
| §11 headers | T10, T12 |
| §12 quote flow | T9, T10 |
| §13 deployment checklist | T1 (CODEOWNERS), T11, T12 |
| §14 builder verifications | T1 (TS), T2 (fonts, glyphs), T7 (ASCII), T8 (i18n, CSP grep), T10 (zod, email), T11 (Sveltia), T12 (build image, auth Worker) |
| §15 architect calls | spread as cited per task |
