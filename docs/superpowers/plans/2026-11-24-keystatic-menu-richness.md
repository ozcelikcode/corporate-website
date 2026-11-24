# Keystatic, Softer Type, Mega Menu and Richer Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sveltia with Keystatic (static admin page plus an OAuth broker in the existing Worker), move labels to the sans face, add a no-JS mega menu with mobile accordions, a fuller footer and four new section blocks, as the approved design describes.

**Architecture:** The site stays Astro 7 `output: 'static'` with no adapter. Keystatic runs as one client-only page at `/keystatic/` (bundled by Vite, React only on that page); in `pnpm dev` a dev-only integration serves its local-mode API, in production the existing Worker serves `/api/keystatic/*` in GitHub mode and the SPA fallback for `/keystatic/*`. Content stays YAML; stored blocks (`{discriminant, value}`) are turned back into today's flat `{type, ...}` sections inside the Zod schema, so section components do not change. Menu and blocks are plain Astro and CSS (Popover API, `<details>`), no new public JS.

**Tech Stack:** Node 26.13.1, pnpm 12.23.0, Astro 7.4.13, Tailwind 4.3.5, @keystatic/core 0.6.10, react and react-dom 19.3.1 (admin page only), Wrangler 4.166.0, Cloudflare Workers Static Assets, TypeScript 6.0.3, Biome 2.6.8, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-24-keystatic-menu-richness-design.md` (binding; its §8 rulings win over everything below). It extends `docs/superpowers/specs/2026-11-23-corporate-site-design.md`, still binding where the new design is silent. Research: `.superpowers/sdd/keystatic-research.md` (local, git-ignored).

## Global Constraints

- Base branch `feat/keystatic-menu` (cut from the tip of `fix/hero-type-admin`, PR #2). If PR #2 merges first, the manager rebases it on `main`. Never commit to `main`, never push from a task.
- New dependencies are a closed list, exact pins: `@keystatic/core` `0.6.10`, `react` `19.3.1`, `react-dom` `19.3.1`. `@astrojs/react` is **not** added (S1: the plain `createElement` mount works). Pre-approved only on evidence: `@types/react` and `@types/react-dom` pinned at the newest `19.x` (devDependencies) if `pnpm check` fails without them. `@keystatic/astro` is **not** used. No YAML library, Playwright or Lighthouse package is added.
- Astro: `output: 'static'`, no adapter, `trailingSlash: 'always'`. `nodejs_compat` only if the spike proves it is needed.
- Code rules (CLAUDE.md): no `any`; no swallowed errors; no `console.log` (Worker: only `console.error({ code, step })`, PII-free); no magic numbers, raw hex or raw px in components (tokens in `src/styles/tokens.css`, named constants at the top of the owning file); no hardcoded copy; one responsibility per file; PascalCase components, kebab-case everything else; no dead code or unused deps.
- TypeScript: `astro/tsconfigs/strictest` + `erasableSyntaxOnly`; relative imports end in `.ts`; no JSX outside `.astro` (the admin mount uses `createElement`); tested modules never import `astro:*` at runtime.
- Tests: `node --test` only; `*.test.ts` next to its unit.
- Brand-agnostic: never name a company or tenant. Seed brand `Brand`, domain `example.com`. Placeholder logos and portraits are abstract marks, no real brands.
- Copy: every visitor-facing string comes from content. Exceptions: Keystatic field labels and hints in `src/keystatic/*` (editor-facing configuration, English), and the temporary block preview page and its fixtures (Tasks C1/C2, deleted in Task I1).
- Client JS on public pages is unchanged: the ASCII module on pages with `AsciiImage`, Turnstile on the quote pages, nothing else. `/keystatic/` loads one Vite-bundled module (the admin, S1: about 3.0 MB raw, 912 KB gzip) and is never linked from public pages; no public JS chunk may contain React.
- Keystatic rejects unknown keys at every level (S1): every key in every content YAML file must be modelled in the Keystatic schema, and the parity test loads every seed file through it.
- Mono face only in `AsciiImage`, `Timecode`, the rundown duration column and the PGM/PVW tallies (design §5.1). Prose `code` keeps mono (machine text, plan ruling).
- Border budget (old spec §8) unchanged: the mega panel draws no border of its own; it sits under the header rule.
- Security: strict CSP on public pages unchanged; the relaxed CSP applies to `/keystatic/*` only, set by the Worker. Secrets via `wrangler secret put` only: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (≥ 32 characters). Build var `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`. Free tier only.
- Git: `git add <explicit paths>` only; never add the stale `* 2.*` files or `src/pages 2/`; Conventional Commits; every message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Keystatic write round-trip.** An editor opens an unchanged entry, clears an optional field (cta `text`, feature-list `duration`, hero `actions`, a nav `feature`, a media-split `action`) and saves. Keystatic omits empty text but writes an empty optional nested object as `{}` (S1); that, blank strings, `null` and `[]` must all build with the field treated as absent. Pinned in B2 (`optionalObjectField`, nav blanks), A2 (`toFlatSection` and blank tests) and I1 (media-split `action: {}`); confirmed by the A2 local save check. Related: typing `{% … %}` in a Markdoc field saves a tag that makes the entry unopenable (S1), so Markdown fields reject Markdoc tag syntax at build (A2).
2. **Menu on touch and keyboard.** A tap on a parent link navigates; the chevron button opens the panel; Escape closes it and focus returns to the button; opening a second panel closes the first; moving the pointer from the item into the panel never closes it. Pinned in B3 (dist id check, manual walk) and F1.
3. **Invalid navigation fails loudly.** An item with both `children` and `source`, more than 6 children, no `href` and no submenu, or a `feature` without a submenu fails the build, and the message names the item. Pinned in B2.
4. **TR menu with untranslated applications.** The auto list on a TR page shows the EN title and summary as fallback and links the EN URL, never a missing `/tr/...` page. Pinned in B2 (`resolveNavItems` with a localizer) and the existing `findCrossLocaleLinks` build guard.
5. **Same-named uploads.** Keystatic writes collection images into per-entry folders, so two entries can each own `image.png`, and EN and TR `home` share a slug. One upload must never overwrite another locale's file, and the ASCII hero must still find its source. Pinned in A2 (per-locale image directories, `resolveUploadPath` test).

---

## Execution notes

### Streams, ownership and dispatch

Every parallel implementer works in its own git worktree off `feat/keystatic-menu`, runs `pnpm install --frozen-lockfile` first (after A1: plain `pnpm install` once in A1 only), commits only its task's Files list, and does not edit `memory-bank/` (it reports its memory-bank delta; the manager has one Haiku agent apply deltas after each merge). The manager merges worktree branches with `git merge --no-ff` in task order.

| Group | Tasks (suggested model) | Needs |
|---|---|---|
| P0 (now) | B1 Type (Opus) ∥ B2 Nav schema (Sonnet) ∥ C1 Stats + Logos (Opus) (S1 done) | — |
| P1 | B3 Desktop mega menu (Opus) ∥ C2 Testimonial + MediaSplit (Opus) ∥ S2 GitHub-mode spike (manager) | B3: B1, B2 · C2: C1 · S2: owner's GitHub App |
| P2 | B4 Mobile accordions (Sonnet) ∥ A1 Keystatic core (Opus) | B4: B3 · A1: S1 + S2 pass, B2 merged |
| P3 | B5 Footer (Opus) ∥ A2 Blocks + collections (Opus) ∥ A3 Worker route (Sonnet; Opus review) | B5: B4 · A2, A3: A1 |
| P4 | A4 Sveltia removal, runbook (Sonnet) | A2, A3 |
| P5 | I1 Integration (Opus) | A4, C2 |
| P6 | F1 Final review and browser check (Opus) | I1, B5 |

File ownership (disjoint between streams):
- **Stream B:** `src/styles/*`; `src/components/layout/*` (including `SiteFooter.astro`: the footer stays in B because it needs B's navigation data and BaseLayout wiring); `src/components/ui/{Label,Button,Field,Tally,Timecode,Glyph}.astro`; the label-class edits in `src/components/sections/{Faq,FeatureList}.astro`, `src/components/quote/QuoteForm.astro` and `src/layouts/BaseLayout.astro`; `src/lib/navigation-schema.ts`, `src/lib/nav-items.ts` (+ tests); `optionalObjectField` in `src/lib/blank.ts` (+ test; B2 adds it, A and I1 only consume it); `src/content/navigation/**`; `src/content/ui/**` and `UI_KEYS` in `src/lib/i18n.ts`; B2 also edits `src/lib/content-schemas.ts` (removes the nav schema), its test and the import in `src/content.config.ts`, once, before A starts.
- **Stream C:** new files only: `src/components/sections/{Stats,Logos,Testimonial,MediaSplit}.astro`, temporary `src/components/sections/{block-content,block-fixtures}.ts`, temporary `src/pages/blocks-preview.astro`.
- **Stream A:** `package.json`, `pnpm-lock.yaml`, `astro.config.ts`, `keystatic.config.ts`, `src/keystatic/**`, `src/pages/keystatic/**`, `src/integrations/keystatic-dev*.ts`, `src/lib/{build-mode,sections-schema,content-schemas,stored-block,ascii-source,page-slugs,localize-href,seo}.ts` (+ tests), `src/content.config.ts`, `src/content/{pages,applications,settings}/**`, `worker/*`, `wrangler.jsonc`, `public/_headers`, `public/_redirects`, `public/admin/`, `src/pages/admin/`, `src/lib/admin-config.test.ts`, `docs/runbook.md`, `README.md`, `memory-bank/*` (A4 only). A may change `navigation-schema.ts` only on its input side (preprocess) to fit Keystatic's stored shape, never its output type.
- **Integration (I1):** `src/components/sections/SectionRenderer.astro` plus files of A and C, after both are done.

### Shared checks

**Gate** (end of every task): `pnpm build && pnpm check && pnpm lint && pnpm test`, all exit 0.

**Guard greps** (old plan's set, still in force, plus these; each prints nothing):
```bash
grep -rn 'label-mono' src                                                              # retired in B1
grep -rEn 'label-signal|font-mono' src/components src/layouts | grep -vE 'ui/(AsciiImage|Timecode|Tally)\.astro|sections/FeatureList\.astro'   # mono only on signal cues
grep -rEn 'transition[^"]*filter|filter[^"]*transition' src/components                 # no animated filters (Logos colour swap is instant)
find src/assets/uploads -name '*.webp' -size +30k                                       # placeholder budget (I1)
```

**Dist script guard** (after `pnpm build`): the old plan's five lines, with `--exclude-dir=admin --exclude-dir=keystatic` (and `-not -path 'dist/keystatic/*'` in the HOLD loop) until A4, `--exclude-dir=keystatic` after. The no-inline-script line runs over all of `dist`, `keystatic` included. Plus:
```bash
test "$(grep -oE '<script type="module" src="/_astro/' dist/keystatic/index.html | wc -l)" -eq 1 || echo KEYSTATIC   # from A1: exactly one admin module
```

**VA checklist:** the old plan's VA1–VA8, with VA3 amended: labels are `label` (sans, medium, sentence case, slight tracking, `[NN]` index in ink); mono appears only on the signal cues listed in Global Constraints. Run at 360, 768, 1024 and 1440 CSS px.

---

### Task S1: Local-mode spike (done)

Manager-run; report `.superpowers/sdd/keystatic-spike-local.md` (local), spike code on `spike/keystatic-local` (reference only, never merged). Findings folded into A1–A3: static admin page plus a plain `.ts` mount outside `src/pages` (`createRoot` + `createElement`), no `@astrojs/react`; the dev API needs a Vite plugin with an unshifted middleware and static imports (`astro:server:setup` is too late; lazy imports fail under Vite 8); unknown keys make an entry unopenable; an empty optional nested object is written as `{}`, empty text is omitted; typed `{% … %}` in a Markdoc field breaks the entry; the admin CSP below had zero violations locally; admin bundle 3.0 MB raw / 912 KB gzip. **Not covered by S1** (A1/A2 probe them first): `createReader` under `node --test`, and how image fields store paths.

### Task S2: GitHub-mode spike (gate, needs the owner's GitHub App)

Manager · Group P1 · Spec §4.4, §8 "Branch fallback pass criterion"

- [ ] **Step 1:** Owner creates the GitHub App (runbook draft: Contents read/write, Pull requests read/write, Metadata read; callback `http://127.0.0.1:8787/api/keystatic/github/oauth/callback` for the spike) and gives the three values to `.dev.vars` (never committed).
- [ ] **Step 2:** On a throwaway branch, under `wrangler dev`, run: login; read an entry; save to a new branch; save to protected `main` as an editor **without** bypass (must be rejected by GitHub and fall back to a branch by whatever flow Keystatic offers); logout.
- [ ] **Step 3:** Record: whether `process.env.NODE_ENV` needs `nodejs_compat` (or a wrangler `define`); whether the token exchange or logout needs a `User-Agent` and the fix used; admin bundle size (raw and gzip); every CSP violation seen under the §4.2 policy; the observed branch and PR flow (for the runbook).
- [ ] **Pass criteria:** all five actions succeed as described; the direct save to `main` is rejected server-side. **Fail** on anything with no fix: stop, bring the SSR-adapter fallback (design §3, row 2) to the owner. B and C are unaffected either way.

---

### Task B1: `label` utility in sans

Model: Opus 5.5 · Group P0 · Spec §5.1

**Files:**
- Modify: `src/styles/global.css` (utilities, prose), `src/styles/tokens.css`, `src/components/ui/{Label,Button,Field,Tally,Timecode}.astro`, `src/components/layout/{SiteHeader,MobileNav,SiteFooter,LanguageToggle,TallyStrip}.astro`, `src/components/sections/{Faq,FeatureList}.astro`, `src/components/quote/QuoteForm.astro`, `src/layouts/BaseLayout.astro`

**Interfaces:**
- Produces: utility `label` (sans via `--font-sans`, `--text-label` size and line height, `--font-weight-medium`, `letter-spacing: var(--tracking-label-sans)`, no `text-transform`, `font-variant-numeric: tabular-nums`); utility `label-signal` (the old `label-mono` declarations: mono, label size, `--tracking-label`, uppercase); token `--tracking-label-sans` (a slight positive value, builder's pick ≤ 0.04em); `Tally` gains `signal?: boolean` (default `false`; `true` uses `label-signal`).

- [ ] **Step 1: Run the first two new guard greps.** Expected: hits (fails), listing every current `label-mono`/`font-mono` use.
- [ ] **Step 2: Add `label` and `label-signal`, delete `label-mono`.** Prose `h3`–`h6` `@apply label` (sentence case now); `li::marker` drops mono; prose `code` keeps mono.
- [ ] **Step 3: Swap every use.** `label-mono` → `label` everywhere except: `Timecode` → `label-signal`; FeatureList duration → `label-signal` (row number → `label`); TallyStrip passes `signal` to the PGM and PVW tallies. `font-mono text-label` hints (Field, QuoteForm) → `text-label`; Faq `+`/`−` sign → sans.
- [ ] **Step 4: Font payload.** Mono is still needed in four places, so the "single mono weight" condition (§5.1) is not met: no font change. Say so in the report.
- [ ] **Step 5: Verify.** Guard greps print nothing; gate; VA walk at 360/768/1024/1440 (nav, buttons, form labels, section labels, footer, toggle, FAQ, prose h6 in sans; timecode, durations, PGM/PVW in mono).
- [ ] **Step 6: Commit.** `feat(type): set labels in the sans face`.

### Task B2: Navigation schema with submenus

Model: Sonnet 5.5 · Group P0 (∥ B1, disjoint files) · Spec §5.2, §8 "Navigation children"

**Files:**
- Create: `src/lib/navigation-schema.ts`, `src/lib/navigation-schema.test.ts`, `src/lib/nav-items.ts`, `src/lib/nav-items.test.ts`
- Modify: `src/lib/blank.ts`, `src/lib/blank.test.ts`, `src/lib/content-schemas.ts` (remove `navigationSchema`, `link`, `LINK_HREF_PATTERN`), `src/lib/content-schemas.test.ts` (move the nav test out), `src/content.config.ts` (import path only), `src/content/navigation/{en,tr}/main.yaml`

**Interfaces:**
- Consumes: `listField`, `optionalField` (`blank.ts`); `actionSchema` (`sections-schema.ts`); `isCurrentPage`, `isSectionActive` (`nav-state.ts`); `applicationPath`, `Locale` (`i18n.ts`).
- Produces (`blank.ts`): `optionalObjectField<T extends z.ZodType>(schema: T)`: `undefined`, `null`, `{}` and an object whose leaf values are all blank (`''`, whitespace, `null`, `{}`) parse as absent; anything else must pass `schema` (Keystatic writes an empty optional nested object as `{}`, S1). Used for the nav `feature` here and the media-split `action` in I1.
- Produces (`navigation-schema.ts`): `NAV_CHILDREN_MAX = 6`; `navigationSchema` (`z.strictObject({ header: z.array(navEntry).min(1), footer: listField(z.array(link)) })`); `type NavEntry = { label: string; href?: string; children: NavChildEntry[]; source?: 'applications'; feature?: NavFeature }`; `type NavChildEntry = { label: string; href: string; description?: string }`; `type NavFeature = { heading: string; text: string; action: Action }`.
- Produces (`nav-items.ts`): `NAV_APPLICATIONS_MAX = 8`; `type NavApplication = { slug: string; name: string; summary: string; order: number }`; `type NavChild = NavChildEntry & { current: boolean }`; `type NavItem = { label: string; href?: string | undefined; current: boolean; active: boolean; children: readonly NavChild[]; feature?: NavFeature | undefined }`; `applicationLinks(apps: readonly NavApplication[], locale: Locale): NavChildEntry[]` (by `order`, then `name` with `localeCompare(…, locale)`, at most 8; label `name`, description `summary`, href `applicationPath(slug)`); `resolveNavItems(input: { entries: readonly NavEntry[]; applications: readonly NavApplication[]; locale: Locale; localize: (href: string) => string; currentPath: string }): NavItem[]` (expands `source`, localizes every href including the feature action, sets `current`/`active`; a parent is `active` when its own href is, or any child is current or section-active).

- [ ] **Step 1: Write the failing tests.**
```ts
// navigation-schema.test.ts
test('children and source together fail, naming the item', () =>
  assert.match(issues({ header: [{ label: 'Apps', href: '/a/', source: 'applications', children: [child] }] }), /Apps/));
test('more than 6 children fail', ...);                         // 7 × child
test('an item without href needs a submenu', ...);              // { label: 'Company' } fails, message names it
test('a feature needs a submenu', ...);                          // plain link + feature fails
test('an empty or all-blank feature parses as absent; a half-filled one fails', () => {
  assert.equal(parse(item({ feature: {} })).feature, undefined);
  assert.equal(parse(item({ feature: { heading: '', text: ' ', action: {} } })).feature, undefined);
  assert.equal(safe(item({ feature: { heading: 'H', text: '', action } })).success, false);
});
// blank.test.ts
test('optionalObjectField: undefined, null, {} and all-blank leaves are absent; a set object validates', ...);
test('blank source and null children parse as absent and []', ...);
test('footer: missing or null parses as [] (moved from content-schemas.test.ts)', ...);
// nav-items.test.ts
test('source applications lists by order, then name, capped at 8', ...);           // 9 apps in, 8 out, order ties broken by name
test('every href is localized, feature action included', ...);                     // localize = (h) => `/tr${h}`
test('a current child marks the parent active, not current', ...);
test('an href-less parent is active only through its children', ...);
```
- [ ] **Step 2: Run them.** `node --test src/lib/blank.test.ts src/lib/navigation-schema.test.ts src/lib/nav-items.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `optionalObjectField` and both modules.** `feature` uses `optionalObjectField`; the cross-field rules are one `superRefine` on the entry whose messages start with `Navigation item "<label>"`.
- [ ] **Step 4: Seeds.** EN header: `Applications` (`href: /applications/`, `source: applications`, `feature` with a short heading, text and action `/quote/`); `Company` (no `href`, children `About` `/about/` and `Privacy` `/privacy/`, each with a one-line description); `Contact` (`/contact/`). TR mirrors it (`Uygulamalar`, `Kurumsal`, `İletişim`, `Hakkımızda`, `Gizlilik`), EN paths. Footer lists unchanged.
- [ ] **Step 5: Run tests, then the gate.** Expected: PASS. The header still renders top-level links (B3 wires submenus).
- [ ] **Step 6: Commit.** `feat(nav): add submenu schema and nav item resolver` (with `blank.ts` and its test).

### Task B3: Desktop mega panel and header height

Model: Opus 5.5 · Group P1 · Spec §5.2 "Desktop", §2 anti-goals

**Files:**
- Create: `src/components/layout/DesktopNav.astro`, `src/components/layout/MegaPanel.astro`
- Modify: `src/components/layout/SiteHeader.astro`, `src/components/layout/MobileNav.astro` (props type only), `src/layouts/BaseLayout.astro`, `src/components/ui/Glyph.astro`, `src/styles/tokens.css`, `src/lib/i18n.ts`, `src/content/ui/{en,tr}/strings.yaml`

**Interfaces:**
- Consumes: `resolveNavItems`, `applicationLinks`, `NavItem` (B2); `listApplications` (`content.ts`).
- Produces: `--header-bar: calc(var(--spacing) * 18)` (was 16; `--masthead` and `--first-screen` follow); `--menu-intent-open` (≤ 150ms) and `--menu-intent-close` (200–400ms) on `:root`; `Glyph` name `'⌄'` (chevron SVG); ui key `navSubmenu` (EN `submenu`, TR `alt menüsü`; accessible name `${label} ${navSubmenu}`); `SiteHeader` and `MobileNav` take `items: readonly NavItem[]` instead of `links`; panel ids `nav-panel-<n>` (1-based item position).

- [ ] **Step 1: Wire data.** BaseLayout builds `NavItem[]` once with `resolveNavItems` (applications from `listApplications(locale)`) and passes it to SiteHeader and MobileNav; SiteHeader drops its own nav-state code. MobileNav keeps rendering top-level rows only until B4.
- [ ] **Step 2: Build `DesktopNav` and `MegaPanel` (from lg).** Each `<li>` stays `position: static` and spans the full bar height, so the panel (a descendant) keeps `:hover` with no gap. A parent with `href` stays a link plus a separate chevron `<button popovertarget>`. A parent without `href` is one button (label + chevron). The panel is `<div id="nav-panel-N" popover>`:
  - Placement and look: `position: fixed`, `inset-inline: 0`, `top: calc(var(--header-bar) + var(--border-hairline))`, `margin: 0`, `bg-surface`, no border. Inside: the page container with a link column (label, description, `aria-current` on the current child) and, when set, a feature tile (`bg-canvas`, heading, text, `Button size="sm"`), 8/4 from lg.
  - Opening: shown when `:popover-open` (touch, keyboard: Escape and light dismiss come free; a second auto popover closes the first), on `li:hover` inside `@media (hover: hover) and (pointer: fine)`, and while focus is inside the panel (`:focus-within`). The hover rule overrides the UA `display: none`.
  - Intent delay: a `visibility` transition delayed by `--menu-intent-open` in and `--menu-intent-close` out. Under reduced motion the global rule zeroes the delays, which is fine: the item-to-panel path has no gap.
  - Chevron: rotates 180° when open (transform only).
- [ ] **Step 3: Header room.** Logo `h-7` (was `h-6`); quote key unchanged.
- [ ] **Step 4: Dist checks.**
```bash
for f in dist/index.html dist/tr/index.html; do for id in $(grep -oE 'popovertarget="nav-panel-[0-9]+"' "$f" | cut -d'"' -f2 | sort -u); do test "$(grep -oE "id=\"$id\"" "$f" | wc -l)" -eq 1 || echo "$f $id"; done; done   # prints nothing
grep -c 'popovertarget="nav-panel-' dist/about/index.html     # ≥ 2 (Applications, Company)
```
- [ ] **Step 5: Manual walk** (`pnpm dev`, Chromium, 1024 and 1440): hover opens after the delay and stays open while crossing into the panel; Tab reaches each chevron, Enter opens, Tab enters the panel, Escape closes and returns focus; DevTools touch emulation: tapping a parent link navigates, tapping the chevron opens; hero still fills the first screen at 1280×720 and 1440×900 (hero bottom = viewport height).
- [ ] **Step 6: Gate, guard greps, dist script guard.** Expected: clean, no new script on any public page.
- [ ] **Step 7: Commit.** `feat(nav): add desktop mega panel`.

### Task B4: Mobile accordions

Model: Sonnet 5.5 · Group P2 · Spec §5.2 "Mobile"

**Files:**
- Modify: `src/components/layout/MobileNav.astro`, `src/lib/i18n.ts`, `src/content/ui/{en,tr}/strings.yaml`

**Interfaces:**
- Consumes: `NavItem` (B2), `Glyph '⌄'` (B3).
- Produces: ui key `navOverview` (EN `Overview`, TR `Genel bakış`).

- [ ] **Step 1: Accordions.** An item with children renders `<details name="site-menu-groups">` (one open at a time) whose `<summary>` is the indexed `Label` plus a chevron (rotates when open, transform only). Inside: an `navOverview` row linking the parent when it has `href`, then one row per child (label, muted description, `aria-current`). Rows keep the sheet's inset focus ring, `min-h-11` or taller, no dividers. Plain items stay as today; no feature tile on mobile; the quote button stays last.
- [ ] **Step 2: Verify** at 360 and 768: keyboard (Tab to summary, Enter/Space toggles), touch emulation, no horizontal scroll, `[NN]` numbering unchanged for top rows; reduced motion: nothing animates.
- [ ] **Step 3: Gate, guards.**
- [ ] **Step 4: Commit.** `feat(nav): add mobile menu accordions`.

### Task B5: Fuller footer

Model: Opus 5.5 · Group P3 · Spec §6 "Footer"

**Files:**
- Modify: `src/components/layout/SiteFooter.astro`, `src/layouts/BaseLayout.astro`, `src/lib/i18n.ts`, `src/content/ui/{en,tr}/strings.yaml`

**Interfaces:**
- Consumes: `applicationLinks` (B2), `listApplications`.
- Produces: ui key `footerApplications` (EN `Applications`, TR `Uygulamalar`); SiteFooter props gain `applications: readonly { label: string; href: string }[]` (localized by BaseLayout) and `labels.applications`.

- [ ] **Step 1: Columns.** Four columns (three without socials): (1) logo, legal name, address and the contacts from settings in `<address>`; (2) the footer navigation (`navigation.footer`, read as the "navigation groups"); (3) the applications list (same order and cap as the menu); (4) socials. One running `[NN]` sequence over the column labels; first rows share one line as today.
- [ ] **Step 2: Bottom.** The bars strip moves from the top rule to just above the legal row (design: "below them, the bars strip and the legal row"); the top rule stays.
- [ ] **Step 3: Verify** at 360/768/1024/1440; `socials: []` temp edit gives three columns (revert).
- [ ] **Step 4: Gate, guards.**
- [ ] **Step 5: Commit.** `feat(footer): add applications column and contact block`.

---

### Task C1: Stats and Logos blocks with a preview page

Model: Opus 5.5 · Group P0 · Spec §6 table

**Files:**
- Create: `src/components/sections/{Stats,Logos}.astro`, `src/components/sections/block-content.ts` (temporary), `src/components/sections/block-fixtures.ts` (temporary), `src/pages/blocks-preview.astro` (temporary, `noindex`)

**Interfaces:**
- Consumes: `Label`, `LowerThird`, `Glyph`, `GridFrame`, `CONTAINER`/`BAND`/`DIVIDER` (`band-class.ts`), `BaseLayout`, existing uploads as fixture images. Never the `label`/`label-mono` utilities directly (B1 changes them in parallel); only atoms.
- Produces (`block-content.ts`, shaped exactly like the future `SectionOf<…>` so I1 can swap in `BlockProps`):
```ts
type StatsContent = { type: 'stats'; label: string; items: { value: string; label: string; note?: string | undefined }[] };   // 3–4 items
type LogosContent = { type: 'logos'; label: string; heading: string; items: { image: ImageMetadata; alt: string; href?: string | undefined }[] };   // 4–12, href https only
type BlockPreviewProps<T> = { section: T; index: number; locale: Locale; headingLevel: 2; localize: (href: string) => string };
```
  (`label` on stats and logos is a plan addition for the `[NN]` gutter label every block carries.)

- [ ] **Step 1: Preview page.** Renders each block from `block-fixtures.ts` inside the same band, divider and container classes as SectionRenderer, `noindex`, EN.
- [ ] **Step 2: `Stats`.** Gutter `Label` (`lg:col-span-3`), then 3–4 figures set like an on-air stat bar on one `surface` strip: value large (figure size the builder's pick within existing tokens, never `text-display`), `tabular-nums`, label below, optional muted note. ≤ 60 lines.
- [ ] **Step 3: `Logos`.** `LowerThird` h2, then a spaced grid (2 → 3 → 4/6 columns) of raster logos via `<Image>`, muted greyscale, full colour on hover and focus with no transition (filters never animate). With `href`, the tile is one outbound link named by `alt`. ≤ 60 lines.
- [ ] **Step 4: Verify** on `/blocks-preview/` at 360/768/1024/1440: VA1–VA8, 3 and 4 stats, 4 and 12 logos.
- [ ] **Step 5: Gate, guards.**
- [ ] **Step 6: Commit.** `feat(blocks): add stats and logos blocks`.

### Task C2: Testimonial and MediaSplit blocks

Model: Opus 5.5 · Group P1 · Spec §6 table

**Files:**
- Create: `src/components/sections/{Testimonial,MediaSplit}.astro`
- Modify: `block-content.ts`, `block-fixtures.ts`, `src/pages/blocks-preview.astro` (all C1's)

**Interfaces:**
- Consumes: `renderMarkdown`, `sectionIdPrefix`, `Prose`, `Heading`, `Label`, `Button`, `DuotoneCover`, `GridFrame`.
- Produces:
```ts
type TestimonialContent = { type: 'testimonial'; quote: string; name: string; role: string; organization: string; portrait?: ImageMetadata | undefined };
type MediaSplitContent = { type: 'media-split'; label: string; heading: string; text: string; image: ImageMetadata; imageAlt: string; action?: Action | undefined; reverse: boolean };
```
  (`imageAlt` is a plan addition; the portrait is decorative, `alt=""`, because the name strap beside it carries the person.)

- [ ] **Step 1: `Testimonial`.** `<figure>`: `<blockquote>` pull-quote (`text-quote`, `max-w-quote`), `<figcaption>` with a lower-third name strap (`Label strap`: name, role, organization) and the optional small duotone portrait. ≤ 60 lines.
- [ ] **Step 2: `MediaSplit`.** GridFrame 12, image and text 6/6 from lg. `reverse` swaps the sides **in DOM order** (no CSS `order`), so reading order matches what is seen. Text side: `Label`, `Heading` h2, `Prose` from `renderMarkdown(text, sectionIdPrefix(index), localize)`, optional `Button` with `localize(action.href)`. Image side: `DuotoneCover`. ≤ 60 lines.
- [ ] **Step 3: Verify** on the preview page (both `reverse` values, with and without action and portrait) at the four widths.
- [ ] **Step 4: Gate, guards.**
- [ ] **Step 5: Commit.** `feat(blocks): add testimonial and media-split blocks`.

---

### Task A1: Keystatic core, admin page and local mode

Model: Opus 5.5 · Group P2 · Spec §4.1, §4.3 (singletons), §8 "Local editing"

**Files:**
- Create: `keystatic.config.ts`, `src/keystatic/{repo,singletons,storage}.ts`, `src/keystatic/mount.ts`, `src/keystatic/parity.test.ts`, `src/pages/keystatic/index.astro`, `src/integrations/keystatic-dev.ts`, `src/integrations/keystatic-dev-route.ts`, `src/integrations/keystatic-dev-route.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`, `astro.config.ts`, `src/lib/build-mode.ts`, `src/lib/build-mode.test.ts`

**Interfaces:**
- Consumes: the S1 report (and S2's); `UI_KEYS`, `HEX_PATTERN`, `navigationSchema` (B2), `settingsSchema`, `uiSchema`. S1's spike code is a reference for the mount and the dev middleware; do not merge its branch.
- Produces:
  - `repo.ts`: `KEYSTATIC_REPO = { owner, name }` (values from `gh repo view --json owner,name`); shared by the client config and the Worker.
  - `singletons.ts`: `singletons` record: `settings` (`src/content/settings/site`), `navigationEn`/`navigationTr` (`src/content/navigation/<l>/main`), `uiEn`/`uiTr` (`src/content/ui/<l>/strings`, fields generated from `UI_KEYS`, EN required, TR optional), all `format: 'yaml'`, `ui.navigation` groups for the sidebar.
  - `storage.ts`: `LOCAL_STORAGE = { kind: 'local' }`, `GITHUB_STORAGE = { kind: 'github', repo: KEYSTATIC_REPO }`.
  - `keystatic.config.ts`: `config({ storage: import.meta.env.DEV ? LOCAL_STORAGE : GITHUB_STORAGE, singletons, collections })` (collections empty until A2).
  - `mount.ts` (outside `src/pages`, plain `.ts`, no JSX): `createRoot(root).render(createElement(Keystatic, { config, appSlug: { envName: 'PUBLIC_KEYSTATIC_GITHUB_APP_SLUG', value } }))`, `Keystatic` from `@keystatic/core/ui`, `createRoot` from `react-dom/client`.
  - `keystatic-dev-route.ts` (pure, tested): `keystaticDevRoute(pathname: string): 'api' | 'shell' | 'pass'` (`/api/keystatic/…` → `api`; `/keystatic/<path without a dot>` → `shell`, served as `/keystatic/`; everything else, `/keystatic/` assets included → `pass`).
  - `keystatic-dev.ts`: `keystaticDev(): AstroIntegration`. In `astro:config:setup`, only when `command === 'dev'`, it adds a Vite plugin (`apply: 'serve'`) whose `configureServer` returns a post hook that **unshifts** one middleware onto `server.middlewares.stack`, so it runs before Astro's trailing-slash and route-guard middleware (`astro:server:setup` is too late, S1). The middleware routes by `keystaticDevRoute`: `api` → the Node build of `makeGenericAPIRouteHandler({ config: config({ storage: LOCAL_STORAGE, singletons, collections }) })` (converts `IncomingMessage` to `Request`; local-mode headers come back as a plain object, GitHub-mode as pairs; body string or `Uint8Array`); `shell` → rewrite to `/keystatic/`. `@keystatic/core/api/generic` and the config pieces are imported **statically** at the top (a request-time `import()` fails: "Vite module runner has been closed"). The file header names this coupling to Astro 7 / Vite 8 internals; `techContext.md` records it as an upgrade check. Nothing from it reaches `dist/`.
  - `build-mode.ts`: `BuildEnv` gains `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`; a production build without it throws naming it (plan ruling: same rule as the Turnstile key). `astro.config.ts` declares it in `env.schema` (client, public, optional).

- [ ] **Step 1: Install and probe.** `pnpm add @keystatic/core@0.6.10 react@19.3.1 react-dom@19.3.1 --save-exact` (the `@types/*` extras only if `pnpm check` demands them). Probe whether `createReader` from `@keystatic/core/reader` loads and reads one seed under `node --test` (S1 did not try it). If it cannot, stop and report to the manager before writing the parity test: the design requires that Keystatic accepts every seed file.
- [ ] **Step 2: Write the failing tests.**
```ts
// keystatic-dev-route.test.ts
test('routes api, deep links and passes the rest', () => {
  assert.equal(keystaticDevRoute('/api/keystatic/tree'), 'api');
  assert.equal(keystaticDevRoute('/keystatic/collection/pagesEn'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/'), 'shell');
  assert.equal(keystaticDevRoute('/keystatic/x.js'), 'pass');
  assert.equal(keystaticDevRoute('/about/'), 'pass');
});
// build-mode.test.ts
test('main without the Keystatic app slug throws', () =>
  assert.throws(() => resolveBuildMode({ ...productionEnv, PUBLIC_KEYSTATIC_GITHUB_APP_SLUG: '' }), /PUBLIC_KEYSTATIC_GITHUB_APP_SLUG/));
// parity.test.ts (singletons part; A2 adds collections)
test('every singleton path is a file on disk', ...);           // `${path}.yaml` exists
test('every ui field is a UI key and every UI key a field', ...);
test('settings and navigation field keys equal the Zod schema keys', ...);   // object fields, recursively
test('Keystatic reads every singleton seed', ...);              // createReader(process.cwd(), localConfig).singletons.X.read() resolves, non-null
```
- [ ] **Step 3: Run them.** Expected: FAIL.
- [ ] **Step 4: Implement** the files above. The admin page has no BaseLayout, `<meta name="robots" content="noindex">`, a root element and one `<script>` importing `mount.ts`. Add `keystaticDev()` to `integrations`.
- [ ] **Step 5: Run tests.** Expected: PASS.
- [ ] **Step 6: Local check (Safari and Chromium).** `pnpm dev`, open `/keystatic/` and reload a deep link (`/keystatic/singleton/settings`): every singleton opens without validation errors; edit one ui string, save, `git diff` shows only that line, `pnpm build` passes; revert.
- [ ] **Step 7: Gate, dist script guard** (`dist/keystatic/index.html` has exactly one module; no public page gained a script; `grep -l 'react' dist/_astro/*.js` lists only chunks referenced from `dist/keystatic/index.html`). Record the admin bundle size (S1 baseline 912 KB gzip).
- [ ] **Step 8: Commit.** `feat(cms): add keystatic admin page and local mode`.

### Task A2: Block-shape migration and collections

Model: Opus 5.5 · Group P3 (∥ A3) · Spec §4.3, §8 "Block migration scope"

**Files:**
- Create: `src/lib/stored-block.ts`, `src/lib/stored-block.test.ts`, `src/keystatic/{sections,collections}.ts`
- Modify: `src/lib/sections-schema.ts`, `src/lib/sections-schema.test.ts`, `src/lib/content-schemas.ts` (only if a field shape needs it), `src/lib/ascii-source.ts`, `src/lib/ascii-source.test.ts`, `keystatic.config.ts`, `src/integrations/keystatic-dev.ts`, `src/keystatic/parity.test.ts`, `src/content/pages/**`, `src/content/applications/**`

**Interfaces:**
- Consumes: A1's config pieces; `optionalObjectField` (B2); S1's blank-write findings (empty text omitted, empty optional nested object written as `{}`).
- Produces:
  - `stored-block.ts`: `toFlatSection(value: unknown): unknown` (`{ discriminant: string, value: object }` → `{ type: discriminant, ...value }`; anything else is returned unchanged, so the union rejects it).
  - `sections-schema.ts`: each array element is `z.preprocess(toFlatSection, <today's discriminated union>)`; the output type `Section`/`SectionOf` is unchanged; `SECTION_SCHEMAS: Record<SectionType, ZodObject>` exported for the parity test. `md` gains `MARKDOC_TAG_PATTERN = /\{%/`: a Markdown field containing Markdoc tag syntax fails the build with `Markdoc tag syntax "{%" is not allowed (section N)` (S1: a typed `{% … %}` saves a tag that makes the entry unopenable; the runbook tells editors). Any optional nested object in a block uses `optionalObjectField`.
  - `sections.ts`: `sectionBlocks` (`fields.blocks`, one entry per `SECTION_TYPES` member, hero field names kept, same limits as Zod; rich text `fields.markdoc.inline` with tables, images, code blocks and dividers off).
  - `collections.ts`: `pagesEn`, `pagesTr` (`src/content/pages/<l>/*`, `slugField: 'title'`), `applicationsEn`, `applicationsTr` (`src/content/applications/<l>/*`, `slugField: 'name'`, the stored `slug` key kept as a text field, so `assertSlugMatches` still guards it); images `fields.image` with a per-locale `directory` (`src/assets/uploads/<collection>/<locale>`) and matching relative `publicPath`, rasters only.

- [ ] **Step 0: Image probe** (S1 did not cover images). In local mode, on a scratch collection with `fields.image({ directory, publicPath })`, upload one image into a collection entry and one into a block inside it; record the written file path and the stored string, and whether Keystatic opens an entry whose stored path has no per-entry subfolder (today's seeds). Decide the per-locale `directory`/`publicPath` pairs from this and note the result in the report.
- [ ] **Step 1: Write the failing tests.**
```ts
// stored-block.test.ts
test('stored block becomes a flat section', () =>
  assert.deepEqual(toFlatSection({ discriminant: 'cta', value: { heading: 'H', action } }), { type: 'cta', heading: 'H', action }));
test('non-stored values pass through unchanged', ...);
// sections-schema.test.ts: fixtures move to the stored shape, plus
test('the old flat shape is rejected', ...);
test('blank optionals in a stored block parse as absent', ...);   // cta text missing or '', duration missing, actions [] / null
test('Markdoc tag syntax in rich-text body or faq answer fails, naming the section', ...);   // body: 'Hi {% x %}'
// ascii-source.test.ts
test('two uploads with the same file name in different folders resolve to the referenced one', ...);   // or a loud, named error if the referenced file cannot be told apart; the Step 0 probe decides which
// parity.test.ts
test('every collection path matches the seed files on disk', ...);
test('every block field key equals its SECTION_SCHEMAS key', ...);
test('Keystatic reads every page and application seed', ...);
test('every seed image path resolves to a file', ...);
```
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Migrate the seed YAML** to `{discriminant, value}` (by hand or with a scratch script kept out of the repo; no YAML dependency). If the Step 0 probe showed Keystatic needs per-entry image folders, move the seed images and rewrite their paths in the same change.
- [ ] **Step 4: Implement** the modules; add `collections` to both configs.
- [ ] **Step 5: Run tests.** Expected: PASS. Build: same 13 public pages, unchanged HTML for an unchanged page (diff `dist/about/index.html` before and after, ignoring asset hashes).
- [ ] **Step 6: Local save check** (Review Focus 1): in `/keystatic/`, open each collection entry, save unchanged, then clear one optional field per block type and save; `pnpm build` passes after each; record what Keystatic wrote; revert.
- [ ] **Step 7: Gate.**
- [ ] **Step 8: Commit.** `feat(cms): migrate blocks to keystatic stored shape`.

### Task A3: Worker route, wrangler and admin headers

Model: Sonnet 5.5 (review: Opus 5.5, security path) · Group P3 (∥ A2) · Spec §4.1 Worker, §4.2

**Files:**
- Create: `worker/keystatic.ts`, `worker/keystatic.test.ts`
- Modify: `worker/index.ts`, `worker/headers.ts`, `worker/tsconfig.json` (include `../src/keystatic/repo.ts`), `wrangler.jsonc`

**Interfaces:**
- Consumes: `KEYSTATIC_REPO` (A1); S2 findings (`nodejs_compat`, `User-Agent`).
- Produces:
  - `type KeystaticEnv = { KEYSTATIC_GITHUB_CLIENT_ID?: string; KEYSTATIC_GITHUB_CLIENT_SECRET?: string; KEYSTATIC_SECRET?: string }`.
  - `type KeystaticDeps = { assets: Fetcher; api: (request: Request) => Promise<{ body: BodyInit | null; status: number; headers: [string, string][] }> }`.
  - `handleKeystatic(request: Request, env: KeystaticEnv, deps: KeystaticDeps): Promise<Response>`: `/api/keystatic/*` → `deps.api` (built in `index.ts` from `makeGenericAPIRouteHandler` with a plain GitHub-only config object, `import type` for its type, so no schema or UI code enters the Worker bundle); any other `/keystatic/*` path → `deps.assets.fetch` of `<origin>/keystatic/`.
  - `ADMIN_CSP` (`headers.ts`; S1's zero-violation policy plus the GitHub-mode hosts): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.github.com https://raw.githubusercontent.com; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` (amend only for violations S2 recorded, e.g. `raw.githubusercontent.com` in `img-src`; `'unsafe-inline'` styles are required, S1; the injected Google Fonts link stays blocked on purpose). Admin responses also get `X-Frame-Options: DENY`, `X-Robots-Tag: noindex, nofollow` and `WORKER_HEADERS`.
  - `wrangler.jsonc`: `run_worker_first: ["/api/*", "/keystatic/*"]`; secrets listed in the comment block; `nodejs_compat` only per S2.

- [ ] **Step 1: Write the failing tests.**
```ts
test('a deep admin path serves the /keystatic/ page with the admin CSP', ...);   // /keystatic/branch/main/collection/pagesEn → assets got '/keystatic/', one CSP header equal to ADMIN_CSP
test('api paths go to the handler and keep both Set-Cookie headers', ...);
test('missing secrets answer 503 and log { code: "config", step: "keystatic" }', ...);
test('a handler that throws answers 500 and logs { code: "keystatic", step: "api" }, no PII', ...);
test('/api/quote still reaches handleQuote', ...);
```
- [ ] **Step 2: Run them.** `node --test worker/keystatic.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Apply the S2 `User-Agent` fix (a wrapper around the outbound `fetch`), only if S2 needed it.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: `wrangler dev` checks:** `curl -sI` on `/`, `/keystatic/`, `/keystatic/branch/main/` and `/api/keystatic/github/login`: public CSP unchanged on `/`; one admin CSP on both admin paths; login answers a redirect to `github.com`. `wrangler deploy --dry-run`: report upload size (must stay ≤ 1.5 MiB gzip, half the free limit).
- [ ] **Step 6: Gate.**
- [ ] **Step 7: Commit.** `feat(worker): serve keystatic api and admin fallback`.

### Task A4: Sveltia removal, redirect, runbook and memory bank

Model: Sonnet 5.5 · Group P4 · Spec §4.1 "/admin/", §4.2 branch flow, §7 owner tasks

**Files:**
- Delete: `public/admin/config.yml`, `src/pages/admin/index.astro`, `src/lib/admin-config.test.ts`
- Create: `public/_redirects` (`/admin /keystatic/ 301`, `/admin/* /keystatic/ 301`)
- Modify: `public/_headers` (drop the `/admin/*` block), `astro.config.ts` (sitemap excludes `/keystatic/`, not `/admin/`), `src/lib/seo.ts` + test (robots `Disallow: /keystatic/`), `src/lib/page-slugs.ts` + test (`keystatic` forbidden), `src/lib/localize-href.ts` + test (`/keystatic/` left unchanged), `docs/runbook.md`, `README.md`, `memory-bank/*`

- [ ] **Step 1: Write the failing tests:** `robotsTxt` disallows `/keystatic/`; `assertPageSlug('en/keystatic')` throws; `localizeHref('/keystatic/', 'tr', set)` returns it unchanged.
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3:** implement and delete the Sveltia files. **Step 4:** tests PASS.
- [ ] **Step 5: Leftovers.** `grep -rniE 'sveltia|/admin' src worker public astro.config.ts README.md docs/runbook.md` lists only the redirect, the forbidden slug and history notes. `wrangler dev`: `/admin/` answers 301 to `/keystatic/` (`pnpm dev` does not read `_redirects`; the runbook says so).
- [ ] **Step 6: Runbook.** Rewrite the CMS sections for Keystatic: create the GitHub App (exact permissions: Contents read/write, Pull requests read/write, Metadata read; callback `https://<domain>/api/keystatic/github/oauth/callback`, plus the local one); set the three secrets and the slug build var; the editor flow S2 observed (save, branch, the "new pull request" link, code-owner approval; admins on the bypass list); TR slugs must equal the EN twin's slug; never type `{% … %}` in a rich-text field (it fails the build); retire the `sveltia-cms-auth` Worker and its OAuth app. Editor-facing note: no editorial status board.
- [ ] **Step 7: Memory bank and README.** `techContext.md` (pins, Keystatic, Worker route, CSP, S1/S2 findings, the dev integration's Astro 7 / Vite 8 coupling as an upgrade check), `systemPatterns.md` (label utilities, nav model, stored blocks, Keystatic layout), `activeContext.md`, `progress.md`; README admin section.
- [ ] **Step 8: Gate, dist script guard** (now `--exclude-dir=keystatic` only).
- [ ] **Step 9: Commit.** `feat(cms): remove sveltia and document keystatic`.

---

### Task I1: Block schemas, CMS blocks, seeds and composition

Model: Opus 5.5 · Group P5 · Spec §6 (home, about, application composition, seed assets)

**Files:**
- Modify: `src/lib/sections-schema.ts` (+ test), `src/keystatic/sections.ts`, `src/components/sections/{SectionRenderer,Stats,Logos,Testimonial,MediaSplit}.astro`, `src/content/pages/{en,tr}/home.yaml`, `src/content/pages/en/about.yaml`, `src/content/applications/en/*.yaml`
- Create: placeholder rasters in `src/assets/uploads/` (`logo-mark-01…06.webp`, `portrait-01.webp`, `media-01.webp`, `media-02.webp`; abstract, neutral, < 30 KB each, generated once with `sharp` from a scratch script that is not committed)
- Delete: `src/components/sections/{block-content,block-fixtures}.ts`, `src/pages/blocks-preview.astro`

**Interfaces:**
- Consumes: C's content types (the Zod output must equal them), A2's `toFlatSection` and `SECTION_SCHEMAS`.
- Produces: `SECTION_TYPES` gains `stats`, `logos`, `testimonial`, `media-split`; limits `STATS_MIN = 3`, `STATS_MAX = 4`, `LOGOS_MIN = 4`, `LOGOS_MAX = 12`; `reverse` defaults to `false`; optional `note`, `href` (https only) and `portrait` through `optionalField`, the media-split `action` through `optionalObjectField`; media-split `text` uses the A2 `md` (Markdoc tags rejected).

- [ ] **Step 1: Write the failing tests** (stored-shape fixtures): each new block parses; 2 and 5 stats fail; 3 and 13 logos fail; an `http://` logo href fails; a missing or blank `portrait`/`note` and an `action: {}` parse as absent; `reverse` missing → `false`. Parity test covers the four new Keystatic blocks.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Zod schemas and Keystatic blocks; the four components take `BlockProps<'…'>`; SectionRenderer gets the four cases (exhaustive switch); delete the temporary files.
- [ ] **Step 4: Seeds.** Home (EN and TR): hero, statement, stats, app-grid, media-split, media-split (`reverse: true`), feature-list, logos, testimonial, cta. About: add one media-split and one stats. Each application: add one media-split and one stats. Copy is calm and generic; every name in the testimonial is fictional and brand-free.
- [ ] **Step 5: Run tests.** Expected: PASS. `find src/assets/uploads -name '*.webp' -size +30k` prints nothing; `test ! -e dist/blocks-preview`.
- [ ] **Step 6: Verify** home, about and one application at 360/768/1024/1440 (VA1–VA8, one h1 per page, dividers between all bands) and in `/keystatic/` (each new block can be added, saved and built locally; revert).
- [ ] **Step 7: Gate, guards, dist script guard.**
- [ ] **Step 8: Commit.** `feat(blocks): wire new blocks into schema, cms and seeds`.

### Task F1: Final review and browser check

Model: Opus 5.5 · Group P6 · Spec §5.2 last line, §7 item 6

- [ ] **Step 1: Gate, all guard greps, dist script guard,** one h1 per page, the internal link scan (old plan Task 12 method), `wrangler deploy --dry-run` size.
- [ ] **Step 2: No new public JS.** The set of `/_astro/*.js` referenced by public pages equals the ASCII module alone (Turnstile is external); compare gzip size with the pre-branch build.
- [ ] **Step 3: Browsers** at 360/768/1024/1440: Chromium (the agent's built-in browser or Chrome), WebKit (Safari on this Mac, run by the owner or the manager), Firefox (not installed here: an owner check). Playwright is not installed and is not added. For each: the menu walk from B3 Step 5 and B4 Step 2, footer columns, the four new blocks, HOLD key, reduced motion (nothing moves, menu still opens), no horizontal scroll at 360.
- [ ] **Step 4: Lighthouse ≥ 95** in every category on the home page, mobile and desktop, from Chrome DevTools' Lighthouse panel (manual; record the scores in `progress.md`).
- [ ] **Step 5: Keystatic in Safari,** local mode: open every singleton and collection, save one change, build, revert.
- [ ] **Step 6: Whole-branch review** (`superpowers:requesting-code-review`, Opus 5.5) against both specs and this plan; one fix wave.
- [ ] **Step 7: Memory bank** (`activeContext.md`, `progress.md`), then commit `docs: record keystatic and menu acceptance`.

---

## Spec coverage map

| Design section | Tasks |
|---|---|
| §4.1 architecture, packages, page, Worker, wrangler, `/admin/` | A1, A3, A4 |
| §4.2 security, CSP, cookies, branch flow, GitHub App | A3, A4, S2 |
| §4.3 content model, blocks, rich text, images, parity test | A1, A2, I1 |
| §4.4 spike gate | S1, S2 |
| §5.1 type | B1 |
| §5.2 menu (schema, desktop, mobile, header height, browsers) | B2, B3, B4, F1 |
| §6 blocks, footer, composition, seed assets | C1, C2, B5, I1 |
| §7 delivery, owner tasks | Execution notes, A4 runbook |
| §8 rulings | B2 (nav children), A1 (local editing), S2 (branch fallback), A2 (block migration), A4 (roles), Global Constraints (base branch) |
| §9 left to the builder | B1 (tracking), B3 (intent delays, glyph), C1 (stat size), I1 (placeholder method) |
