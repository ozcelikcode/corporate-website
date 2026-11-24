# Active Context

## Current state (2026-11-23)
- Design spec: `docs/superpowers/specs/2026-11-23-corporate-site-design.md`. Owner APPROVED it on 2026-11-23.
- Finished on `feat/site-v1`: all 12 plan tasks plus 7a and 7b (toolchain, tokens/fonts, content + i18n, UI atoms, layout shell + SEO head, ASCII pipeline + live signal, Sveltia admin, design refinement, section blocks, routes/SEO, quote page, quote Worker, runbook). Whole-branch review done ("Ready after fixes"); its single fix wave is applied (TR quote links + cross-locale link guard, blank CMS values, reserved slugs, hero raster check, dead code and duplicates, docs sync). 13 pages, 196 tests, gate and guards green. I1 fix on top (render-time href localization, M1–M3): 214 tests.
- Repo decision (2026-11-23): GitHub repo is public, so CODEOWNERS-enforced branch protection on `main` is free.

## Hero and type refinement (2026-11-23, branch `fix/hero-type-admin`)
- Owner: hero must be one first screen, ASCII bigger and better placed, headings and mission text too big. Done: smaller editorial scale (display max 4rem and ≤ 7.5svh, h2 1.875rem, new h3 1.5rem, statement `text-quote` 2rem pull-quote), hero band fills `--first-screen` from lg with a 5% optical lift, 6/6 from lg and 5/7 plus a media bleed (≤ 10rem) from `wide` (90rem). A parallel agent fixes `/admin` in its own worktree.

## Security audit fixes (2026-11-24)
- Code and docs from `.superpowers/sdd/security-audit.md` applied on `fix/hero-type-admin`: Markdown sanitization (M1), https-only `organization.url` (I1), raster-only social/cover images (L2), `_headers` I3/I4. Runbook rewritten for H1 (no hosted previews), H2/H3 (full `main` ruleset before any editor), M2 (`ALLOWED_DOMAINS` mandatory, exact hosts), L3/L5/L6/I5/I6. Owner must do the GitHub/Cloudflare steps; not yet done. L1, L4, I2, I8, I9, I11 not addressed (optional).

## Next step
- Open the PR from `feat/site-v1` to `main`. After merge the owner runs `docs/runbook.md` section 3 (setup) and section 5 (production acceptance and manual checks, including the CMS parity checks in check (a); record outcomes in `techContext.md`).

## Current focus
- G6 done: Task 8 (routes, SEO, 404s, robots, sitemap, build outputs) and Task 9 (quote page, shared quote schema).
- G7 done: Task 10 (Worker `/api/quote`, Turnstile, mail, `_headers`, extended `build-outputs.ts`). Task 12 done (runbook, README, local acceptance).
- Final fix wave done (2026-11-23): see `progress.md` log.
- I1 fix (2026-11-23, owner-approved addition to PR #1): content hrefs are localized at render time (`localizeHref`, `hrefLocalizer`), so translating a page no longer trips the cross-locale guard and needs no navigation edit; M1 footer 3 columns without socials; M2 null lists parse as `[]` (`listField`); M3 guard comment. See `progress.md` log.
- Task 7b done (inserted after owner feedback "ASCII effects must be animated" and "the effect and look must evoke broadcasting to anyone"): the ASCII hero is a live broadcast signal (tune-in, transmission rings, hum bar, sync slips, grain); seed image is now a transmitter mast (`transmitter.png`). Client JS constraint amended (one ≤ 2 KB module on pages with `AsciiImage`). Fix round 1: shared 36 s slip cycle (gaps 9/13/14 s), HOLD key in TallyStrip pausing all motion (WCAG 2.2.2), cold-load tune-in skip, per-row write cache, rings every 2.5 s.
- Plan: `docs/superpowers/plans/2026-11-23-corporate-site.md` (12 tasks, dispatch groups G1–G8, subagent-driven execution).

## Design direction (owner feedback, 2026-11-23; implemented in Task 7a)
- Border budget and broadcast detail set: spec §8 and `systemPatterns.md` "Design direction". VU meter dropped.

## Key decisions so far
- Own UI kit of about 12 Astro primitives with `class-variance-authority`; no shadcn/React islands.
- CMS: Sveltia (git-based, editorial workflow), auth through `sveltia-cms-auth` on a free Worker.
- Edge: Astro `output: 'static'` + one hand-written Worker for `/api/*`; no Astro Cloudflare adapter.
- Fonts: Schibsted Grotesk + Martian Mono, local via the Astro fonts API.
- TypeScript pinned at 6.0.3 (`@astrojs/check` peer range excludes 7.x).
- Quote flow: plain HTML form, Turnstile, same-origin check, body cap; `send_email` with recipient/sender as Worker secrets; 303 redirect to `:target` status panels.
- No honeypot or rate-limit binding.
- ASCII hero rendered at build with `sharp`, 6 quantized tones, run-length spans, one span per row, 30 KB HTML budget per figure. Animated as a live broadcast signal (Task 7b): CSS hum bar and sync slips, plus one self-hosted module for tune-in and outward rings from `data-wave-origin`; static under reduced motion and without JS.
- TallyStrip timecode is a CSS `@property` counter (no JS).
- Accent must reach >= 3:1 contrast on canvas; `critical` is the only other semantic colour.
- R2 files are linked, not embedded, in v1.
- `SITE_URL` and the Turnstile site key are build vars, not CMS settings.
- Applications index is a `pages` entry with an `app-grid` block.
- Logo is a wordmark; inline nav from lg; quote CTA from md (in the bar), always in the menu sheet below md.
- Brand-agnostic: no company or tenant name anywhere in code, docs or plans.
- Arrows: internal links →, outbound ↗, both via `Glyph` (settled; the quote key is →).

## Open items and owner decisions
- Sveltia step 6 (manual check in Chromium with File System Access, "Work with Local Repository"): pending owner, see runbook. Also unverified: `sortable_fields`. Empty optional fields are now omitted (`output.omit_empty_optional_fields`) and blank values are absent in the schemas; the CMS parity checks in runbook check (a) confirm it on the real CMS.
- Font preload: 4 upright files, accepted.
- Unoptimized imported images (any image imported without `<Image>`/`getImage`) ship the original, EXIF included, to `dist/_astro`. Task 8 resolved the dist side (`pruneUnreferencedImages` removes unoptimized originals from `dist/_astro`). EXIF on uploads is still open: strip on upload, or route all images through the optimizer.
- Resolved in Task 8: `applicationSectionsSchema` rejects any hero in an application.
- `.superpowers/` is git-ignored (SDD reports and review diffs stay local).

## Left to the builder (verify during implementation)
i18n fallback in static dynamic routes, `astro/zod` bundling in the Worker, Workers Builds Node/pnpm support, `send_email` on free plan, CSP vs inline scripts. Sveltia open checks are listed in `techContext.md`.

## Keystatic and menu branch (2026-11-24)
- Branch `feat/keystatic-menu` implements `docs/superpowers/plans/2026-11-24-keystatic-menu-richness.md`. Sveltia to Keystatic decided by the owner 2026-11-24 (Payload rejected: needs a database and a paid Workers plan).
