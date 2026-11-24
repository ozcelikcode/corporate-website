# Active Context

## Current state (2026-11-24)
- `main` holds the v1 site (PR #1 `feat/site-v1`, PR #2 `fix/hero-type-admin`: hero and type refinement, security audit fixes).
- Branch `feat/keystatic-menu` implements `docs/superpowers/plans/2026-11-24-keystatic-menu-richness.md` (design: `docs/superpowers/specs/2026-11-24-keystatic-menu-richness-design.md`). Every task is done: B1–B5 (sans labels, nav schema, desktop mega panel, mobile accordions, fuller footer), C1–C2 (stats, logos, testimonial, media-split), A1–A4 (Keystatic admin, collections, Worker route, Sveltia removed), I1 (new blocks wired in), F1 (whole-branch review "Ready after fixes", acceptance in Chromium) and the final fix wave.
- Final fix wave (2026-11-24): admin link fields carry the Zod patterns (shared zod-free `lib/link-patterns.ts`, pinned per field in `parity.test.ts`); optional groups (nav feature card, media-split button) say "Fill all fields or leave all empty"; `resolveNavItems` drops an applications menu with no applications and no link (both navs agree); the admin `<title>` lives in `src/keystatic/paths.ts`; `toApiResult` always normalises through `Headers`; AppGrid tiles of untranslated applications carry `lang="en"` on `/tr/` (`fallbackLang`); runbook lists the WCAG 1.4.13 hover limitation.
- Menu owner fixes (2026-11-24) on `fix/menu-hover-size`, cut from `feat/keystatic-menu` for PR #3: pointer cursor on buttons, no phantom hover zone (only visible controls are hit-tested), larger and stronger desktop menu. Details in `systemPatterns.md` (mega menu hit areas, menu type).
- Gate on the branch: build 14 pages, check 0/0/0, lint clean, 276 tests; guards clean.
- Content motion (2026-11-24) on `feat/motion-reveals`, cut from `feat/keystatic-menu` (132177f): CSS-only hero entrance and scroll-driven reveals (`systemPatterns.md`, "Content motion"). Not pushed; owner to review the feel in a browser.
- Layout controls (2026-11-24) on `feat/cms-editing`, cut from `main` (b90b6ac), pushed, no PR yet: shared optional `layout` (background default/subtle/contrast, spacing compact/regular/spacious) on every block but the hero, app-grid `columns` 2/3, stats `align` start/center; admin selects with descriptions, parity-tested; seeds use them on home (EN/TR) and about. Rulings (hero no layout, no feature-list columns, media-split keeps `reverse`) in spec §10 of `2026-11-24-keystatic-menu-richness-design.md`. Gate: 298 tests, lint, build 14 pages, check 0/0/0.
- Dev `/admin` (2026-11-24): `astro dev` ignores `public/_redirects`, so the dev-only middleware (`keystatic-dev.ts`, route `redirect` in `keystatic-dev-route.ts`) answers `/admin` and `/admin/*` with a 301 to `/keystatic/`. Production keeps `_redirects`.

## Next step
- Owner: review the band rhythm on `feat/cms-editing` (home, about) and decide on a PR.
- Open the PR from `feat/keystatic-menu` to `main`. The PR must state the hard precondition: no editor gets access before the owner's first real GitHub login (S2), the `main` ruleset (runbook 3.4) and runbook check 5(a).
- Owner checks still open: see `progress.md` ("Owner checks open").

## Open items and owner decisions
- Keystatic first real login (owner): create the GitHub App, set the secrets and the slug build var, set the `main` ruleset, then run runbook check (a) incl. the parity checks; record results in `techContext.md`. `main` is unprotected today. If the GitHub avatar is blocked by `ADMIN_CSP` (`img-src`) on that login, allow its exact host.
- The admin requests Inter from Google Fonts; the admin CSP blocks it on purpose (no third-party fonts), so the admin uses system fonts and logs one console error.
- WCAG 1.4.13: a hover-opened mega panel is not dismissible by Escape while the pointer rests on it (CSS-only menu); the chevron popover is the keyboard/touch path. Needs owner sign-off (runbook "Known limitations").
- Keystatic writer quirks (image rename on save, YAML reflow, `#hex` requoting) are documented in `techContext.md`; seeds are already normalised.
- EXIF on uploads is still open: strip on upload, or route all images through the optimizer (`pruneUnreferencedImages` already removes unoptimized originals from `dist/_astro`).
- `.superpowers/` is git-ignored (SDD reports and review diffs stay local).

## Key decisions so far
- Own UI kit of about 12 Astro primitives with `class-variance-authority`; no shadcn/React islands.
- CMS: Keystatic 0.6.10 (git-based, GitHub App sign-in through the site Worker; replaced Sveltia on 2026-11-24, Payload rejected: needs a database and a paid Workers plan). Zod stays the build authority; the admin mirrors its keys, limits and link patterns (`parity.test.ts`) and never imports Zod (admin bundle size).
- Edge: Astro `output: 'static'` + one hand-written Worker for `/api/*` and `/keystatic/*`; no Astro Cloudflare adapter.
- Navigation: header items with `children`, `source: applications` or a `feature` card; desktop mega panel (CSS only, Popover API), mobile exclusive `<details>` accordions.
- Labels in the sans face (`label`); mono only on signal cues (`label-signal`).
- Fonts: Schibsted Grotesk + Martian Mono, local via the Astro fonts API. TypeScript pinned at 6.0.3.
- Quote flow: plain HTML form, Turnstile, same-origin check, body cap; `send_email` with recipient/sender as Worker secrets; 303 redirect to `:target` status panels. No honeypot or rate-limit binding.
- ASCII hero rendered at build with `sharp`, animated as a live broadcast signal by one ≤ 2 KB self-hosted module; static under reduced motion, HOLD key, and without JS.
- Accent must reach >= 3:1 contrast on canvas; `critical` is the only other semantic colour.
- R2 files are linked, not embedded. `SITE_URL` and the Turnstile site key are build vars, not CMS settings.
- Content hrefs are written as EN paths and localized at render time; untranslated content on TR pages carries `lang="en"`.
- Brand-agnostic: no company or tenant name anywhere in code, docs or plans.
