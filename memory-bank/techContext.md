# Tech Context

## Runtime pins
- Node `26.13.1` (`.nvmrc`; `engines.node >=26.13.1`). Fallback: Node 24 LTS if Workers Builds lacks 26.
- pnpm `12.23.0` (`packageManager`). Strict dependency resolution.

## Stack (exact pins, no ranges)
Dependencies:
- astro `7.4.13`
- @astrojs/sitemap `3.7.6`
- @astrojs/markdown-remark `7.3.10` (optional peer in Astro 7, so explicit)
- tailwindcss `4.3.5`, @tailwindcss/vite `4.3.5`
- class-variance-authority `0.7.1`
- sharp `0.35.5` (build-time ASCII; direct dep for pnpm strict)

Dev dependencies:
- @astrojs/check `0.9.12`
- typescript `6.0.3`
- @biomejs/biome `2.6.8`
- wrangler `4.166.0`
- @cloudflare/workers-types `5.20261123.1`

### Why TypeScript 6.0.3, not 7.0.2
`@astrojs/check@0.9.12` peers `typescript ^5 || ^6`, so 7.x is unsupported. Builder may bump to the newest 6.x.

## Build and output
- Astro `output: 'static'`; no Cloudflare adapter (avoids an SSR Worker in front of static pages).
- `trailingSlash: 'always'`, paired with `html_handling: auto-trailing-slash`.
- Scripts: `dev`, `build`, `preview` (build + `wrangler dev`), `check` (`astro check` + `tsc -p worker --noEmit`), `lint`, `format` (Biome), `deploy`.
- Fonts via Astro fonts API, `fontProviders.local()`: Schibsted Grotesk + Martian Mono (OFL, `latin` + `latin-ext`).

## Cloudflare services (free tier only)
- Workers Static Assets: serves `dist/`; `run_worker_first: ["/api/*"]`; `not_found_handling: "404-page"`. Static requests never invoke the Worker.
- Worker (`worker/index.ts`): `POST /api/quote` only; free tier 100k requests/day.
- `send_email` binding `QUOTE_MAILER` (no `destination_address`): reaches verified Email Routing destinations only; needs a domain on the account. Until then the endpoint redirects to the error state.
- Turnstile: Managed widget, `data-action="quote"`, siteverify in the Worker.
- R2 on a custom domain (`assets.<domain>`, `r2.dev` disabled, Cache Everything, CORS GET): large files (brochures) are linked, not embedded.
- Workers Builds: production branch `main`, `pnpm build` then `npx wrangler deploy`; preview builds on for PR branches.
- Build vars (dashboard): `SITE_URL`, `PUBLIC_TURNSTILE_SITE_KEY` (via `astro:env`).

## CMS
- Sveltia CMS (pinned exactly, loaded from a pinned bundle with SRI in `public/admin/index.html`; pre-1.0, tested at 0.271.2).
- Auth: `sveltia-cms-auth` on a free Worker, GitHub App OAuth. Vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_DOMAINS`.
- `publish_mode: editorial_workflow`; i18n `multiple_folders` en/tr; settings as singleton; `media_folder: src/assets/uploads`.

## External-service rules
- Free tier only. Nothing paid, nothing self-hosted.
- Secrets only via `wrangler secret put` or the dashboard: `TURNSTILE_SECRET_KEY`, `QUOTE_TO`, `QUOTE_FROM`. Never committed; no tenant data in the repo.
- Large files (PDFs, video, brochures) live in R2, never in the repo.
- Worker may use `console.error({ code, step })` only (no PII).

## Open verifications (builder)
Fonts API option shape; Astro i18n fallback on dynamic static routes; Sveltia feature support (editorial workflow, singletons, R2); `astro/zod` bundling in the Worker (else add `zod ^4.6.7`); Workers Builds Node/pnpm support; `send_email` on free plan; no inline `<script>` in `dist/` (CSP).
