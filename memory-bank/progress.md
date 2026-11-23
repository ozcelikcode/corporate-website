# Progress

## Done
- 2026-11-23: Design spec written (`docs/superpowers/specs/2026-11-23-corporate-site-design.md`): intent, constraints, approaches, architecture, folder tree, content model, design system, wrangler/package drafts, headers, quote flow, deployment checklist.
- 2026-11-23: Memory bank created (projectbrief, techContext, systemPatterns, activeContext, progress).
- 2026-11-23: Root `CLAUDE.md` and project skill `team-delegation` created.
- 2026-11-23: Owner approved the design spec. Repo made public (CODEOWNERS enforcement on `main` now possible).
- 2026-11-23: Implementation plan written (`docs/superpowers/plans/2026-11-23-corporate-site.md`, 12 tasks, groups G1–G8).
- 2026-11-23: Task 1 toolchain scaffold done (configs, build-mode + 6 tests, worker stub, scaffold page).
- 2026-11-23: Task 2 done: tokens, global styles and utilities, local Fontsource variable fonts, token swatch on the scaffold page.
- 2026-11-23: Task 3 done: content schemas, i18n/content libs, seed content and images.
- 2026-11-23: Task 4 done: 12 UI atoms + Glyph, atom showcase on the scaffold page.
- 2026-11-23: Tasks 5 (layout shell and SEO head), 6 (ASCII pipeline and AsciiImage) and 11 (Sveltia admin config) done, including fix rounds.
- 2026-11-23: Task 7a design refinement done: border budget, spaced GridFrame, TitleSafe, LowerThird, BarsStrip, NoSignal, TallyStrip PGM/PVW, rundown `duration`.
- 2026-11-23: Task 7 done: 7 section blocks, SectionRenderer (dividers, exhaustive switch, single h1), `renderMarkdown`, `padIndex`.
- Tasks 1–7, 11 and 7a done (2026-11-23).
- 2026-11-23: Tasks 8 (routes, TR wrappers, 404s, robots, sitemap, JSON-LD, build outputs) and 9 (quote page, shared quote schema) done and merged.

- 2026-11-23: Task 7b ASCII motion done (live broadcast signal, transmitter-mast seed, client JS constraint amended).

## Next
- G8: Task 12 (runbook and acceptance). Owner: set Worker secrets and `<auth-worker>` in `_headers` before launch.
- Owner: Sveltia step 6 manual check (runbook).
- Add `.github/CODEOWNERS`.
- Resolve the "Left to the builder" verifications from the spec (section 14).
- Verify: Lighthouse, headers scan, quote flow (JS, no JS, bad token), axe on every template.

## Blocked
- Quote email delivery: blocked until a domain is on the Cloudflare account with Email Routing enabled; until then the endpoint redirects to the error state.

## Milestones (planned order)
1. Spec approved (done, 2026-11-23).
2. Implementation plan written (done, 2026-11-23).
3. Foundation: tooling, tokens, content schema, i18n.
4. UI kit and 7 section blocks.
5. Pages, routes, TR wrappers, SEO.
6. Worker quote flow.
7. CMS admin and CODEOWNERS.
8. Deploy on Workers Builds; run the verification checklist (spec section 13).

## Log
- 2026-11-23: Project started; spec, memory bank and delegation skill created. No code yet.
- 2026-11-23: Task 1 implemented; gate (build, check, lint, test) green.
- 2026-11-23: Task 2 implemented; gate green, contrast measured (ink 16.5, ink-muted 8.3, line-strong 3.45 on canvas).
- 2026-11-23: Task 3 implemented; build, check, lint, test green (37 tests). Fix rounds: internal href regex, z.strictObject, assertEnglishTwins, href lookahead.
- 2026-11-23: Task 4 implemented; gate green; checked in browser at 360/768/1440 (timecode 25 fps, no grid holes, no horizontal scroll at 360, focus ring on all 18 interactive elements). Fix round 1 applied.
- 2026-11-23: Task 5 implemented: BaseLayout, SeoHead, SiteHeader, MobileNav (popover), LanguageToggle, TallyStrip, SiteFooter, `seo.ts` and `nav-state.ts`. Fix rounds 1–2: quote key never hidden (md in bar, always in menu), nav at lg, whole-segment nav state. Checked at 360/768/1024/1440.
- 2026-11-23: Task 6 implemented: build-time ASCII renderer (`ascii.ts`, `ascii-source.ts`, `ascii-markup.ts`) and `AsciiImage`. Fix round 1: 48-column compact grid, normalise, 30 KB budget, disk-based upload lookup (no leaked originals), new seed card. Seed figure 16.5 KB.
- 2026-11-23: Task 11 implemented: Sveltia admin at `public/admin` (editorial workflow, en/tr folders, settings singleton) with a config test. Fix round 1: nav `footer` and hero `actions` default to `[]`. Owner step 6 pending.
- 2026-11-23: Task 7a implemented: 3 ui keys (`tallyProgram`, `tallyPreview`, `noSignal`), feature-list `duration` (schema, seed, CMS), ui seed parity test; gate green (78 tests); border audit, 360/768/1440 checked in the browser.
- 2026-11-23: Task 7a fix round 1: TitleSafe inner inset (marks in the margin), TitleSafe limited to hero + ApplicationPage cover, footer first rows aligned, LowerThird `gap-2`, spec app-grid uses →.
- 2026-11-23: Task 7 implemented: blocks + SectionRenderer, scaffold renders EN home/about/contact; ASCII tones made a monotonic duotone ramp; GridFrame hairline variant and `grid-hairline`/`cell` removed; gate green (83 tests); border audit, focus walk, FAQ keyboard toggle and 360/768/1440 checked in the browser.
- 2026-11-23: Task 7 fix round 1: content h1 demoted and heading ids prefixed per section in `renderMarkdown`, rundown `<time datetime>`, `LEDE_CLASS` + `max-w-measure` token, hero position refine in the schema, spec §8 GridFrame line, hero 6/6 split; gate green (95 tests).
- 2026-11-23: Task 8 implemented: `lib/routes.ts`, EN/TR route wrappers, GenericPage/ApplicationPage/NotFoundPage, robots, sitemap filter and i18n map, `build-outputs` (relocate TR 404, prune unreferenced images), application hero ban. Fix round 1: TR not-found copy, no canonical on noindex pages. Gate green (101 tests).
- 2026-11-23: Task 9 implemented: quote schema (12 tests), QuoteForm/QuoteStatus/QuotePage, `/quote/` and `/tr/quote/`. Fix round 1: general pre-checked, `band-class.ts`, `quoteTimelinePlaceholder` key, TR quote copy and page, aria-labelledby, email pattern, MAX_SOLUTIONS build guard. Gate green (108 tests).
- 2026-11-23: Merged tree (Tasks 8 + 9): 13 pages, 114 tests, one h1 per page, no broken links.
- 2026-11-23: Task 10 implemented: Worker (`quote`, `turnstile`, `mail`, `headers`, `index`), `public/_headers` (spec §11), `build-outputs` extended (allow-list JSON, noindex). 146 tests; dry-run bundle 792 KiB; local smoke test OK.
- 2026-11-23: Task 7b implemented: `ascii-glyphs.ts` (sharp-free constants), `ascii-motion.ts` (20 tests: noise, reveal schedule, ring distance, wave trail/boost, live frame, origin), row spans in `asciiMarkup`, AsciiImage CSS motion (hum bar, sync slip, breath) and module (tune-in, rings, grain), `assetsInlineLimit` so the module ships as `/_astro/*.js`. Seed hero redrawn as a transmitter mast (owner direction). JS 1.7 KB gzipped; figure 18.1 KB; CLS 0 (full-width rows fixed a measured 0.04); checked at 1440 and 360 under the real CSP (`wrangler dev`). 172 tests.
