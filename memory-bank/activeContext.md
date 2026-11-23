# Active Context

## Current state (2026-11-23)
- Design spec written: `docs/superpowers/specs/2026-11-23-corporate-site-design.md`.
- Status: owner APPROVED the spec on 2026-11-23. Tasks 1 (toolchain) and 2 (tokens, fonts) implemented on `feat/site-v1`.
- Repo decision (2026-11-23): GitHub repo is public, so CODEOWNERS-enforced branch protection on `main` is free.
- Memory bank and project instructions (`CLAUDE.md`, team-delegation skill) are set up.

## Next step
- Implementation plan written: `docs/superpowers/plans/2026-11-23-corporate-site.md` (12 tasks, 8 dispatch groups G1–G8, subagent-driven execution).
- G3: Task 3 (content) ∥ Task 4 (UI atoms).

## Key decisions so far
- Own UI kit of about 12 Astro primitives with `class-variance-authority`; no shadcn/React islands.
- CMS: Sveltia (git-based, editorial workflow), auth through `sveltia-cms-auth` on a free Worker.
- Edge: Astro `output: 'static'` + one hand-written Worker for `/api/*`; no Astro Cloudflare adapter.
- Fonts: Schibsted Grotesk + Martian Mono, local via the Astro fonts API.
- TypeScript pinned at 6.0.3 (`@astrojs/check` peer range excludes 7.x).
- Quote flow: plain HTML form, Turnstile, same-origin check, body cap; `send_email` with recipient/sender as Worker secrets; 303 redirect to `:target` status panels.
- No honeypot or rate-limit binding.
- ASCII hero rendered at build with `sharp`, 6 quantized tones, run-length spans.
- TallyStrip timecode is a CSS `@property` counter (no JS).
- Accent must reach >= 3:1 contrast on canvas; `critical` is the only other semantic colour.
- R2 files are linked, not embedded, in v1.
- `SITE_URL` and the Turnstile site key are build vars, not CMS settings.
- Applications index is a `pages` entry with an `app-grid` block.
- Brand-agnostic: no company or tenant name anywhere in code, docs or plans.

## Left to the builder (verify during implementation)
i18n fallback in static dynamic routes, Sveltia feature support, `astro/zod` in the Worker, Workers Builds Node/pnpm support, `send_email` on free plan, CSP vs inline scripts, ASCII hero tuning (HTML under about 30 KB).
