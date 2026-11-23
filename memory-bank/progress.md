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
- Tasks 1–6, 11 and 7a done (2026-11-23).

## Next
- G5 Task 7 (section blocks) on the Task 7a rules.
- Owner: Sveltia step 6 manual check (runbook).
- Build the Worker (`/api/quote`), Turnstile verification, mail builder.
- Add `.github/CODEOWNERS`.
- Remaining section blocks, pages and TR wrappers.
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
