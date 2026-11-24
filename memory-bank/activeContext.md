# Active Context

## Current state (2026-11-23)
- Design spec: `docs/superpowers/specs/2026-11-23-corporate-site-design.md`. Owner APPROVED it on 2026-11-23.
- Finished on `feat/site-v1`: all 12 plan tasks plus 7a and 7b (toolchain, tokens/fonts, content + i18n, UI atoms, layout shell + SEO head, ASCII pipeline + live signal, Sveltia admin (since replaced by Keystatic), design refinement, section blocks, routes/SEO, quote page, quote Worker, runbook). Whole-branch review done ("Ready after fixes"); its single fix wave is applied (TR quote links + cross-locale link guard, blank CMS values, reserved slugs, hero raster check, dead code and duplicates, docs sync). 13 pages, 196 tests, gate and guards green. I1 fix on top (render-time href localization, M1–M3): 214 tests.
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
- CMS: Keystatic (git-based, GitHub App sign-in through the site Worker; replaced Sveltia on 2026-11-24).
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
- Keystatic first real login (owner): create the GitHub App, set the secrets and the slug build var, set the `main` ruleset, then run the runbook check (a) incl. the parity checks; record results in `techContext.md`. `main` is unprotected today.
- Font preload: 4 upright files, accepted.
- Unoptimized imported images (any image imported without `<Image>`/`getImage`) ship the original, EXIF included, to `dist/_astro`. Task 8 resolved the dist side (`pruneUnreferencedImages` removes unoptimized originals from `dist/_astro`). EXIF on uploads is still open: strip on upload, or route all images through the optimizer.
- Resolved in Task 8: `applicationSectionsSchema` rejects any hero in an application.
- `.superpowers/` is git-ignored (SDD reports and review diffs stay local).

## Left to the builder (verify during implementation)
i18n fallback in static dynamic routes, `astro/zod` bundling in the Worker, Workers Builds Node/pnpm support, `send_email` on free plan, CSP vs inline scripts.

## Keystatic and menu branch (2026-11-24)
- Branch `feat/keystatic-menu` implements `docs/superpowers/plans/2026-11-24-keystatic-menu-richness.md`. Sveltia to Keystatic decided by the owner 2026-11-24 (Payload rejected: needs a database and a paid Workers plan).
- Done on the branch: B1 (sans labels), B2 (nav schema), B3 (desktop mega panel), C1 (`Stats`, `Logos`), C2 (`Testimonial`, `MediaSplit`), B4 (mobile accordions, merge `e00a8c0`), B5 (fuller footer, merge `069086b`); 239 tests. Streams B and C are complete.
- A1 done (merge `ca34116`): Keystatic core, admin page, local mode. Open for the manager: (1) a settings save renames `og-default.png` to `ogImage.png` and deletes the old file, which breaks the build via `block-fixtures.ts` until C's fixtures go; (2) first save reflows long YAML and requotes `#hex` (seed normalisation suggested). Next: A2 (collections). S2 (GitHub-mode spike) waits for the owner's GitHub App. Blocks use temporary preview props until I1 wires the schema and removes `/blocks-preview/`. Touch at lg and up and Firefox/WebKit checks of the mega panel are left to F1.
- A2 done (merge `bd53387`, branch `worktree-agent-a6f60832bb0c6a6de`, commits `c40b948` and fix round `96f6f17`): blocks stored as Keystatic blocks, `pagesEn/Tr` and `applicationsEn/Tr` collections, seeds and images moved to Keystatic's paths and normalised. Gate: build 16 pages, check 0/0/0, lint clean, test 266/266. Public HTML unchanged apart from asset names.
- Open items (A2 follow-ups):
  - (a) Resolved by I1: `ascii-source` resolves the hero source deterministically from the stored `imagePath` (no byte matching in `dist/_astro`).
  - (b) Resolved by A4: Sveltia is removed.
- A3 merged (`68893ca`): the Worker serves `/api/keystatic/*` and the `/keystatic/*` shell through `routeFor`; the secrets, callback URL and admin CSP are in `techContext.md` ("Keystatic worker secrets (A3)").

- A4 done: Sveltia removed (`public/admin/config.yml`, `src/pages/admin`, `admin-config.test.ts`); `/admin` and `/admin/*` 301 to `/keystatic/` (`public/_redirects`); `/keystatic/` out of the sitemap and `Disallow`ed in robots, `keystatic` a forbidden slug; `_headers` admin block dropped. Runbook sections 1 to 4 rewritten for Keystatic, README updated. Owner tasks: GitHub App (runbook 3.1), secrets and slug (3.2), ruleset (3.4), retire the old `sveltia-cms-auth` Worker and its OAuth app (3.3), first real login check (5a).

- I1 done (merge `c3a6926`; commits `aa5a180`, `bead0c4`, fix round `9cdb9aa`): stats, logos, testimonial and media-split in schema, Keystatic blocks, seeds and components; `/blocks-preview/` removed (14 pages); gate green, 273 tests. Next: F1 final review.
