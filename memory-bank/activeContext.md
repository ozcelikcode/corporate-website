# Active Context

## Current state (2026-11-23)
- Design spec: `docs/superpowers/specs/2026-11-23-corporate-site-design.md`. Owner APPROVED it on 2026-11-23.
- Implemented on `feat/site-v1`: Tasks 1–6 and 11 (toolchain, tokens/fonts, content + i18n, UI atoms, layout shell + SEO head, ASCII pipeline + AsciiImage, Sveltia admin config). Gate green per task, including fix rounds.
- Repo decision (2026-11-23): GitHub repo is public, so CODEOWNERS-enforced branch protection on `main` is free.
- Memory bank and project instructions (`CLAUDE.md`, team-delegation skill) are set up.

## Current focus
- G4 done: Task 5 (layout), Task 6 (ASCII), Task 11 (Sveltia).
- Next: Task 7a design refinement (rules in `systemPatterns.md`, "Design direction"), then G5 Task 7 (section blocks).
- Plan: `docs/superpowers/plans/2026-11-23-corporate-site.md` (12 tasks, dispatch groups G1–G8, subagent-driven execution).

## Design direction (owner feedback, 2026-11-23)
- Borders in moderation: hairlines only on header/footer edges, section dividers, form controls and the hero media frame. Content grids use spacing and surface tone, not boxed cells.
- Tasteful broadcast details: tally + PGM/PVW, title-safe corner brackets on media (instead of crosshairs everywhere), lower-third headings and card titles, rundown-style feature list with timecode durations, SMPTE colour-bar micro strip divider, "NO SIGNAL" test-pattern 404, optional VU meter.

## Key decisions so far
- Own UI kit of about 12 Astro primitives with `class-variance-authority`; no shadcn/React islands.
- CMS: Sveltia (git-based, editorial workflow), auth through `sveltia-cms-auth` on a free Worker.
- Edge: Astro `output: 'static'` + one hand-written Worker for `/api/*`; no Astro Cloudflare adapter.
- Fonts: Schibsted Grotesk + Martian Mono, local via the Astro fonts API.
- TypeScript pinned at 6.0.3 (`@astrojs/check` peer range excludes 7.x).
- Quote flow: plain HTML form, Turnstile, same-origin check, body cap; `send_email` with recipient/sender as Worker secrets; 303 redirect to `:target` status panels.
- No honeypot or rate-limit binding.
- ASCII hero rendered at build with `sharp`, 6 quantized tones, run-length spans, 30 KB HTML budget per figure.
- TallyStrip timecode is a CSS `@property` counter (no JS).
- Accent must reach >= 3:1 contrast on canvas; `critical` is the only other semantic colour.
- R2 files are linked, not embedded, in v1.
- `SITE_URL` and the Turnstile site key are build vars, not CMS settings.
- Applications index is a `pages` entry with an `app-grid` block.
- Logo is a wordmark; inline nav from lg; quote CTA from md (in the bar), always in the menu sheet below md.
- Brand-agnostic: no company or tenant name anywhere in code, docs or plans.

## Open items and owner decisions
- Sveltia step 6 (manual check in Chromium with File System Access, "Work with Local Repository"): pending owner, see runbook. Also unverified: `sortable_fields` and how empty lists are serialised.
- Font preload: 4 upright files, accepted.
- Quote key arrow: the header shows → (Button rule for internal links); the wireframe draws ↗. Not ruled yet.
- Unoptimized imported images (any image imported without `<Image>`/`getImage`) ship the original, EXIF included, to `dist/_astro`. Decide in Task 8: strip EXIF on upload, or route all images through the optimizer.
- Task 7: judge ASCII tone contrast at the 78% shimmer floor, set the hero track, put `scanlines` on the media cell only, and tune the grid counts if needed.
- `.superpowers/` is git-ignored (SDD reports and review diffs stay local).

## Left to the builder (verify during implementation)
i18n fallback in static dynamic routes, `astro/zod` bundling in the Worker, Workers Builds Node/pnpm support, `send_email` on free plan, CSP vs inline scripts. Sveltia open checks are listed in `techContext.md`.
