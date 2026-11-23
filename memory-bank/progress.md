# Progress

## Done
- 2026-11-23: Design spec written (`docs/superpowers/specs/2026-11-23-corporate-site-design.md`): intent, constraints, approaches, architecture, folder tree, content model, design system, wrangler/package drafts, headers, quote flow, deployment checklist.
- 2026-11-23: Memory bank created (projectbrief, techContext, systemPatterns, activeContext, progress).
- 2026-11-23: Root `CLAUDE.md` and project skill `team-delegation` created.
- 2026-11-23: Owner approved the design spec. Repo made public (CODEOWNERS enforcement on `main` now possible).
- 2026-11-23: Implementation plan written (`docs/superpowers/plans/2026-11-23-corporate-site.md`, 12 tasks, groups G1–G8).
- 2026-11-23: Task 1 toolchain scaffold done (configs, build-mode + 6 tests, worker stub, scaffold page).
- 2026-11-23: Task 2 done: tokens, global styles and utilities, local Fontsource variable fonts, token swatch on the scaffold page.

## Next
- G3: Task 3 content ∥ Task 4 UI atoms.
- Build tokens, global styles, i18n and content libs, content collections.
- Build UI primitives, section blocks, layout components, pages, TR wrappers.
- Build the Worker (`/api/quote`), Turnstile verification, mail builder.
- Configure Sveltia admin (`public/admin`) and `.github/CODEOWNERS`.
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
