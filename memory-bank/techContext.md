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
`@astrojs/check@0.9.12` peers `typescript ^5 || ^6`, so 7.x is unsupported. Checked 2026-11-23: 6.0.3 is the newest 6.x. `@types/node` not needed: `pnpm check` passes without it.

## Build and output
- Astro `output: 'static'`; no Cloudflare adapter (avoids an SSR Worker in front of static pages).
- `trailingSlash: 'always'`, paired with `html_handling: auto-trailing-slash`.
- Scripts: `test` (`node --test "src/**/*.test.ts" "worker/**/*.test.ts"`), `dev`, `build`, `preview` (build + `wrangler dev`), `check` (`astro check` + `tsc -p worker --noEmit`), `lint`, `format` (Biome), `deploy`.
- Fonts via Astro fonts API (`fonts` top-level config, stable since Astro 6), `fontProviders.local()`; see "Fonts" below.

## Fonts (Task 2)
- Files: `src/assets/fonts/schibsted-grotesk/{latin,latin-ext}-wght-{normal,italic}.woff2` and `src/assets/fonts/martian-mono/{latin,latin-ext}-wght-normal.woff2`, each folder with `OFL.txt`.
- Source: Fontsource CDN, variable builds pinned at 5.3.0: `https://cdn.jsdelivr.net/fontsource/fonts/schibsted-grotesk:vf@5.3.0/<subset>-wght-<style>.woff2` and `.../martian-mono:vf@5.3.0/<subset>-wght-normal.woff2` (verified `wOF2` magic). `OFL.txt` from google/fonts `ofl/schibstedgrotesk/OFL.txt` and `ofl/martianmono/OFL.txt` (SIL OFL 1.1). `unicode-range` values copied from `@fontsource-variable/*@5.3.0` CSS into named constants in `astro.config.ts`.
- Option shape (Astro 7.4.13, read from `node_modules/astro/dist/assets/fonts`): `{ provider: fontProviders.local(), name, cssVariable, fallbacks, options: { variants: [{ src: [path], weight: '400 900', style, unicodeRange }] } }`. Weights: Schibsted `400 900` (normal + italic), Martian `100 800` (the vf instance has `wght` only; `wdth` is fixed). Fallbacks: `system-ui, sans-serif` / `ui-monospace, monospace` (Astro adds metric-matched Arial/Courier fallbacks).
- Usage: `<Font cssVariable="--font-grotesk" preload />` (+ `--font-martian`) from `astro:assets`; it emits inline `<style>` @font-face blocks and preload links. `preload={[{ style: 'normal' }]}` preloads 4 upright files (latin + latin-ext of both families). Accepted: the local provider sets no subset, so latin-ext cannot be filtered out.

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
- `publish_mode: editorial_workflow`; i18n `multiple_folders` en/tr (default en, layout `<folder>/<locale>/<slug>.yaml`); settings as singleton; `media_folder: src/assets/uploads`.
- Files: `public/admin/index.html` (`noindex`, pinned `@sveltia/cms@0.271.2` with SRI and `crossorigin="anonymous"`) and `public/admin/config.yml` (github backend with placeholder `repo`/`base_url`, replaced in the runbook). Collections: `settings` singleton, `ui`, `navigation` (create/delete off), `pages`, `applications`; one shared `&sections` anchor (7 block types, `typeKey: type`). `src/lib/admin-config.test.ts` checks the config.
- Verified from docs: top-level `singletons`; `slug.editable` replaces the deprecated `{{fields._slug}}`; field `pattern` is `[regex, message]`; `required: [en]` with i18n; i18n must be opted in per field (collection-level does not cover `ui`/`navigation` fields). Biome formats the YAML (double quotes).
- Editor/admin split is enforced by GitHub (CODEOWNERS, branch protection, merge rights), not by the config.
- Hero `actions` and nav `footer` default to `[]` in the schema, so the CMS may omit empty lists.
- Final fix wave, verified against the 0.271.2 type definitions (`https://unpkg.com/@sveltia/cms@0.271.2/types/public.d.ts`) and the docs:
  - `output.omit_empty_optional_fields: true` (root level): fields with `required: false` and an empty value are left out; list items are never removed (an all-empty item stays `{}`). Docs: https://sveltiacms.app/en/docs/data-output#controlling-data-output
  - `i18n.initial_locales: default`: a new entry draft has only EN enabled; editors enable TR from the editor's three-dot menu. Replaces the deprecated `save_all_locales`. Docs: https://sveltiacms.app/en/docs/i18n/options#disabling-non-default-locale-content
  - Image field `accept` (comma-separated MIME types or extensions; filters uploads and the selection dialog, and validates existing selections): hero image `image/png,image/jpeg,image/webp`. Docs: https://sveltiacms.app/en/docs/fields/file (the Image field shares the File field options: https://sveltiacms.app/en/docs/fields/image)
  - The schemas read blank optional values as absent anyway (`lib/blank.ts`), for files saved by hand or before these options; whether a `required: [en]` field counts as optional for TR output is undocumented, so TR ui blanks are dropped by the schema.
- Admin CSP `script-src` stays `'self' https://unpkg.com` (not narrowed to the package path): the pinned bundle lazy-imports other unpkg packages at runtime (`@sindresorhus/transliterate` for slugs, `dayjs`, `exifr`, `pdfjs-dist`, `@jsquash/*`, `@sveltia/ui@0.96.3` shiki engine, `@shikijs/*`, `leaflet`, and its own `dist/chunks/`), found by reading the 0.271.2 bundle. A path-limited source would break slug generation and image handling.
- Unverified: `sortable_fields: [order, name]` in 0.271.2. Owner step 6 (manual check in Chromium, File System Access, "Work with Local Repository") is pending; see the runbook.

## CMS parity checks (runbook 5, owner check (a))
Record each outcome here after the owner runs them: feature item without duration, application without brochure, CTA without text, new EN page (no TR file), TR ui with cleared fields, SVG/GIF hero upload refused. Status: pending owner. Build-side behaviour for each is covered by tests (`blank.test.ts`, `content-schemas.test.ts`, `sections-schema.test.ts`, `ascii-source.test.ts`, `admin-config.test.ts`) and was probed with real builds (blank `ogImage`, blank TR ui strings, `admin` page slug, SVG hero).

## External-service rules
- Free tier only. Nothing paid, nothing self-hosted.
- Secrets only via `wrangler secret put` or the dashboard: `TURNSTILE_SECRET_KEY`, `QUOTE_TO`, `QUOTE_FROM`. Never committed; no tenant data in the repo.
- Large files (PDFs, video, brochures) live in R2, never in the repo.
- Worker may use `console.error({ code, step })` only (no PII).

## Open verifications (builder)
Astro i18n fallback on dynamic static routes; Sveltia: R2 support, `sortable_fields`, empty-list serialisation and owner step 6; `astro/zod` bundling in the Worker (else add `zod ^4.6.7`); Workers Builds Node/pnpm support; `send_email` on free plan. No inline `<script>` in `dist/` (CSP): verified in Task 7b (dist script guard).

## Spec §14 results (Task 10)
- `astro/zod` bundles in the Worker (`wrangler deploy --dry-run`): no `zod` pin needed. `cloudflare:email` and the JSON import (`with { type: 'json' }`) bundle too. Bundle `index.js` 792 KiB (limit 3 MiB).
- `send_email` binding `QUOTE_MAILER` (no `destination_address`); `Buffer` is not used in the Worker (no `nodejs_compat`), base64 goes through `btoa`.
- `astro:build:done` still passes `pages`; the allow-list comes from `pages[].pathname`.
- Cloudflare `_headers`: two `/*` blocks do not merge (the later one replaced the first in `wrangler dev`), so the preview noindex line is inserted into the existing `/*` block (regex tolerant of CRLF, trailing spaces, comments; throws when no `/*` rule exists).
- Local smoke test: `.dev.vars` (gitignored) with Turnstile's always-pass secret; `wrangler dev` on 8787 serves the CSP from `_headers`. Real email delivery and live siteverify are not verified locally.

## Client scripts (Task 7b)
- Astro 7 inlines a component `<script>` chunk under Vite's `build.assetsInlineLimit` (4 KiB; `shouldInlineScriptChunk` in `astro/dist/core/build/plugins/plugin-scripts.js`). The CSP (`script-src 'self'`) blocks inline scripts, so `astro.config.ts` sets `vite.build.assetsInlineLimit` to a function returning `false` for `.js` files (other assets keep the default via `undefined`).
- Astro renders the module where the component is (`<script type="module" src="/_astro/AsciiImage.astro_astro_type_script_index_0_lang.<hash>.js">` at the start of the hero section), once per page, only on pages rendering `AsciiImage` (`/`, `/tr/`). Checked under the real CSP with `wrangler dev`.
- The dist script guard in the plan header asserts this after every build.

## Test conventions
- `node --test` with `node:assert/strict`; `*.test.ts` next to its unit; relative imports end in `.ts`; tested modules never import `astro:*` at runtime.
- Test files are excluded from both tsconfigs; Biome still lints them.

## Build-mode rules (`src/lib/build-mode.ts`)
- Production only when `WORKERS_CI_BRANCH === 'main'`: then `SITE_URL` (https, trailing slash stripped) and `PUBLIC_TURNSTILE_SITE_KEY` are required (empty counts as missing) or the build throws.
- Any other branch or a local build ignores both vars: `siteUrl` = `PREVIEW_SITE_URL` (`http://localhost:4321`, interim, open §14 "Previews" item), Turnstile test key `1x00000000000000000000AA`.
- `astro.config.ts` feeds `site` from it; `src/lib/env.ts` exposes `BUILD` from `astro:env`.

## Tooling notes
- pnpm 12 blocks install scripts: `pnpm-workspace.yaml` has `allowBuilds` for esbuild and workerd, and `minimumReleaseAgeExclude` for `@cloudflare/workers-types@5.20261123.1`.
- Biome 2.6: `linter.rules.preset: "recommended"`; Markdown formatter/linter disabled (docs are not reformatted); `.superpowers` and `.code-review-graph` excluded.
- Root `.gitignore` ignores `.superpowers/` (SDD briefs, reports and review diffs stay local).

## Routing and i18n fallback (Task 8)
- Spec section 14 i18n fallback is resolved by manual routing (no Astro i18n config): TR routes exist only for translated entries; EN fallbacks are `noindex` with no canonical.
- Sitemap uses the `@astrojs/sitemap` i18n option; `robotsTxt` lives in `lib/seo.ts`.
