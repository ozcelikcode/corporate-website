# Deploy and setup runbook

Step-by-step guide for the site owner. Every step has a checkbox. Brand-agnostic: replace the `<placeholders>` with your own values. Source of truth for the design is `docs/superpowers/specs/2026-11-23-corporate-site-design.md` (section 13 is the checklist this runbook expands).

All services used here have a free tier. Nothing in this runbook needs a paid plan, except that Cloudflare asks for a payment method on file before you can create an R2 bucket (section 3.9).

## 1. Overview

What runs where:

| Piece | Where | Notes |
|---|---|---|
| Static site (`dist/`) | Cloudflare Workers Static Assets | Built by Workers Builds on every push to `main`. |
| Quote endpoint `POST /api/quote` | The same Worker (`worker/index.ts`) | Only `/api/*` runs Worker code; pages never do. |
| Quote mail | Cloudflare Email Routing (`send_email` binding `QUOTE_MAILER`) | Reaches verified destination addresses only. |
| Bot check | Cloudflare Turnstile | Widget on `/quote/` and `/tr/quote/`, verified in the Worker. |
| Content editor | Sveltia CMS at `/admin/` | Writes to GitHub through a pull request per edit. |
| CMS login | `sveltia-cms-auth` (its own small Worker) | Not part of this repo. |
| Large files | R2 bucket on `assets.<domain>` | Linked from content, never stored in the repo. |

Deploy order (do not reorder): **auth Worker, then the GitHub App callback, then the site.**

Variables and secrets in one place:

| Name | Kind | Where it is set | Used by |
|---|---|---|---|
| `SITE_URL` | build variable | Workers Builds (production) | canonical URLs, sitemap; must be `https://...` |
| `PUBLIC_TURNSTILE_SITE_KEY` | build variable | Workers Builds (production) | the widget on the quote page |
| `TURNSTILE_SECRET_KEY` | secret | `wrangler secret put` or dashboard | Worker siteverify |
| `QUOTE_TO` | secret | same | verified Email Routing destination (your inbox) |
| `QUOTE_FROM` | secret | same | sender address on your Email Routing zone |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | secrets | on the auth Worker | GitHub App login |
| `ALLOWED_DOMAINS` | variable | on the auth Worker | hosts allowed to start a CMS login |

Never commit a secret. Never put one in `wrangler.jsonc`.

## 2. Local development

Requirements: Node `26.13.1` (see `.nvmrc`; fall back to Node 24 LTS only if Workers Builds lacks 26) and pnpm `12.23.0` (`packageManager`).

- [ ] `pnpm install --frozen-lockfile`
- [ ] Create `.dev.vars` in the repo root (gitignored; never commit it):

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
QUOTE_TO=<an address verified in Email Routing, or any address for local tests>
QUOTE_FROM=<sender on your Email Routing zone>
```

The secret above is Turnstile's published always-pass test secret.

| Command | What it does |
|---|---|
| `pnpm dev` | Astro dev server (pages only; no Worker). |
| `pnpm build` | Static build into `dist/` and the Worker allow-list `worker/generated/solutions.json`. |
| `pnpm check` | `astro check` plus `tsc -p worker`. **Run after a build**: the Worker needs the generated JSON. |
| `pnpm lint` | Biome. |
| `pnpm test` | `node --test` over `src` and `worker`. |
| `pnpm preview` | Build, then `wrangler dev` (static assets, headers and the Worker together, on port 8787). |

Gate before every merge, in this order: `pnpm build && pnpm check && pnpm lint && pnpm test`.

## 3. One-time setup

**Order:** do 3.7 (Turnstile) and 3.8 (Email Routing) first, because 3.5 and 3.6 need the keys and addresses they produce. Then 3.1 to 3.6, 3.9 if needed, and 3.10.

### Security checklist before the first editor

Do these in order. None of them can be skipped: until they are done, anyone with Write access could publish to production or read the Worker's secrets without a review. Details are in the sections named.

1. [ ] **Workers Builds: non-production branch builds OFF** (3.5). Branch code would otherwise run with the production deploy token and secrets.
2. [ ] **The `main` ruleset exists** (3.4), with every option listed there. Create it **before** adding any collaborator.
3. [ ] **`ALLOWED_DOMAINS` on the auth Worker** lists exact hosts only: no wildcard, never empty (3.1).
4. [ ] **GitHub repository security features on** (3.4): secret scanning, push protection, Dependabot alerts and updates, private vulnerability reporting; Actions disabled.
5. [ ] **GitHub App** keeps "Expire user authorization tokens" on and is installed on this repository only (3.2).
6. [ ] Only then add the first editor (Write role).

After the custom domain exists, also do the hardening in 3.11 (rate-limit rule, `workers_dev` and `preview_urls` off).

**Role model:** Editor = submit (Write role; opens PRs that need 1 Code Owner approval). Admin = review + publish (repo owner and Maintain role; on the bypass list, so admins can merge their own changes).

### 3.1 Auth Worker (`sveltia-cms-auth`)

- [ ] Clone the official repository `sveltia/sveltia-cms-auth` into a separate folder (it is not vendored here). Read its README first: confirm the deploy steps and variable names are still the ones below.
- [ ] Deploy it as its own Worker: `npx wrangler deploy` from that folder. Note the URL it prints, `https://<auth-worker>.<account-subdomain>.workers.dev`. This is `<auth-worker-url>` below.
- [ ] **Mandatory:** set `ALLOWED_DOMAINS` to the exact production site host(s). The auth Worker uses it both to accept a login and as the only target it sends the GitHub token to. Unset, empty or a wildcard (such as `*.workers.dev`) lets any site that opens the login window receive a user's GitHub token. List full hostnames only, no wildcard, never blank. For example `<site-name>.<account-subdomain>.workers.dev` (known before the first site deploy: the site Worker name is `corporate-site` in `wrangler.jsonc`, so `corporate-site.<account-subdomain>.workers.dev`). Add the custom domain later (3.11).

### 3.2 GitHub App

- [ ] GitHub, Settings, Developer settings, GitHub Apps, New GitHub App.
- [ ] Callback URL: `<auth-worker-url>/callback`. Untick "Webhook active".
- [ ] Repository permissions: Contents read and write, Pull requests read and write.
- [ ] Install the app on this repository only.
- [ ] Generate a client secret. On the auth Worker set the two secrets (paste when prompted):

```
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```
- [ ] Keep **Expire user authorization tokens** on, and install the app on this repository only (not "All repositories").

### 3.3 One-time repo edits (commit before the first site deploy)

- [ ] `public/admin/config.yml`: set `backend.repo` to `<owner>/<repo>` and `backend.base_url` to `<auth-worker-url>`.
- [ ] `public/_headers`: in the `/admin/*` block replace `https://<auth-worker>.workers.dev` in `connect-src` with the auth Worker origin. Check it matches exactly, including the account subdomain.
- [ ] Commit both directly to `main` as an admin (the bypass list in 3.4 allows it). This is the one clear path: admin commits or merges directly; only editors go through review.

### 3.4 GitHub: CODEOWNERS, branch protection, editors

The repo is public, so these are free.

- [ ] `.github/CODEOWNERS` holds `* @<your-github-handle>`. Check the handle is yours and exists; change it if not. Add more admins on the same line if wanted.
- [ ] Settings, Rules, Rulesets, new branch ruleset for `main` (Enforcement: Active, target: default branch). **Create it before adding any editor.** Turn on all of these:
  - Restrict deletions and block force pushes.
  - Require a pull request before merging: **1 required approval**, **require review from Code Owners**, **dismiss stale pull request approvals when new commits are pushed**, **require approval of the most recent reviewable push**, and **require conversation resolution before merging**.
  - Without "dismiss stale approvals" and "most recent push", an editor could get an approval, push different commits and merge.
  - Add the **bypass list**: Repository admin role and Maintain role (always allow). Without a bypass an admin cannot approve their own PR and nothing could ever be published by the owner.
  - Do not add a required status check for Workers Builds: non-production builds are off (3.5), so no such check exists.
- [ ] Settings, Security and quality, Advanced Security: turn on **secret scanning**, **push protection**, **Dependabot alerts**, **Dependabot security updates** and **private vulnerability reporting** (all free on a public repo).
- [ ] Settings, Actions, General: choose **Disable actions**. The repository has no workflows; a Write user could otherwise push one on a branch and run it. The weaker alternative, "Allow <owner>, and select non-<owner>, actions and reusable workflows", does not stop a workflow's own `run:` steps, so it protects much less.
- [ ] Settings, Collaborators: add each editor with the **Write** role. Writers are not on the bypass list, so every editor PR needs 1 Code Owner approval.
- [ ] Resulting model: Editor = submit, Admin = review + publish. GitHub, not the CMS, enforces it.

### 3.5 Cloudflare: Workers Builds (the site)

- [ ] Cloudflare dashboard, Workers & Pages, Create, import this Git repository.
- [ ] Worker name `corporate-site` (must match `wrangler.jsonc`).
- [ ] Build command `pnpm build`; deploy command `npx wrangler deploy`; production branch `main`; **non-production branch builds OFF** (Worker, Settings, Build, Branch control: clear "Enable Preview Builds").
- [ ] Why off: a build runs code from the pushed branch (`package.json`, `astro.config.ts`, `src/integrations/*`, even the `wrangler` binary from its lockfile) with the production deploy token, and a `versions upload` preview also gets the production secrets and the mail binding. Any editor with Write access could then deploy to production or read secrets without a review. Leave this off until you have set up the secure previews below.
- [ ] To check a content PR, admins run `pnpm build` (and `pnpm preview`) locally on the PR branch.
- [ ] Build variables (production, used on `main` only): `SITE_URL` = `https://<your-final-host>` (no trailing slash; use the `workers.dev` URL until a custom domain exists) and `PUBLIC_TURNSTILE_SITE_KEY` = the production site key from 3.7. A production build fails with a message naming the variable if either is missing or `SITE_URL` is not https.
- [ ] Note on the build modes: `resolveBuildMode` only reads `SITE_URL` and the site key when the branch is `main`; any other branch build (local or CI) uses the Turnstile test key, `noindex` and `http://localhost:4321` canonicals.
- [ ] **Optional, later improvement: secure previews.** If you want hosted previews, use a separate preview Worker or environment that has no production secrets and no `send_email` binding, built with an API token that cannot deploy the production Worker, and put Cloudflare Access (a free policy limited to the owner and editors) in front of its URLs. Do not use `versions upload` on the production Worker.
- [ ] Expect the first Workers Build to fail until both variables exist (production builds refuse to run without them); set them, then retry the build.
- [ ] If the build fails on the Node or pnpm version, set the build variable `NODE_VERSION` to `24` as the fallback and record it in `memory-bank/techContext.md`.

### 3.6 Secrets for the Worker

Run from the repo root (logged in with `npx wrangler login`), or set them in the dashboard under the Worker, Settings, Variables and Secrets:

```
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put QUOTE_TO
npx wrangler secret put QUOTE_FROM
```

- [ ] All three set. Values: the Turnstile widget's secret key (3.7), your verified destination inbox (3.8), a sender address on the Email Routing zone (3.8).

### 3.7 Turnstile

- [ ] Dashboard, Turnstile, Add widget. Mode **Managed**. Hostnames: the production host(s), for example `corporate-site.<account-subdomain>.workers.dev` and later your custom domain.
- [ ] Copy the **site key** into the `PUBLIC_TURNSTILE_SITE_KEY` build variable and the **secret key** into the `TURNSTILE_SECRET_KEY` secret.
- [ ] Production keys live on `main` only; never put them in `.dev.vars`.

### 3.8 Email Routing

- [ ] The domain you use for mail must be a zone on this Cloudflare account. Dashboard, that domain, Email, Email Routing: enable it.
- [ ] Add your inbox as a destination address and click the verification link Cloudflare mails you. `QUOTE_TO` must be this verified address.
- [ ] `QUOTE_FROM` is any address on that zone (for example `quotes@<your-zone>`). It works from day one while the site is still served on `workers.dev`.
- [ ] Until this is done the endpoint answers with the `#error-send` state, which is expected.

### 3.9 R2 (large files, optional)

Cloudflare requires a payment method on file to create any R2 bucket, even inside the free tier. Skip this section if you have no large files yet.

- [ ] Dashboard, R2, create a bucket.
- [ ] Settings, Custom Domains: connect `assets.<domain>`.
- [ ] Settings, Public access: make sure the `r2.dev` subdomain is **disabled**.
- [ ] Rules, Cache Rules: for host `assets.<domain>` set Cache eligibility to Eligible for cache (Cache Everything).
- [ ] Bucket CORS policy: allow method `GET` from the site origin (`https://<your-final-host>`).
- [ ] Link files from content with plain `https://assets.<domain>/...` URLs.

### 3.10 First deploy

- [ ] Merge the 3.3 edits to `main`. Workers Builds deploys. Open `https://corporate-site.<account-subdomain>.workers.dev/`.

### 3.11 Custom domain (optional, later)

- [ ] Worker, Settings, Domains and Routes, add the custom domain (or add `"routes": [{ "pattern": "<domain>", "custom_domain": true }]` to `wrangler.jsonc`).
- [ ] Then update, in this order: `SITE_URL` build variable (redeploy), the Turnstile widget hostnames, the auth Worker `ALLOWED_DOMAINS` (exact hosts, no wildcard), the R2 CORS origin.
- [ ] **Rate limit the quote endpoint.** Cloudflare dashboard, the zone, Security, WAF, Rate limiting rules (Free plan: 1 rule, and it can only match the URI Path, not the method): match `URI Path` equals `/api/quote`, count per IP, for example 5 requests per 10 seconds, action Block for 10 seconds. `GET` already returns 405, so matching the path only is fine. Turnstile alone does not stop a human-solved flood. WAF rules only apply on the custom domain, so do the next step too.
- [ ] **Close the other hosts.** In `wrangler.jsonc` set `"workers_dev": false` and `"preview_urls": false` (today both are `true`), commit to `main` and let Workers Builds deploy. Production is then reachable only on the custom domain, where the rate-limit rule applies. Before this, make sure every URL you use (Turnstile hostnames, `ALLOWED_DOMAINS`, `SITE_URL`) is the custom domain.
- [ ] **Logs.** `observability` is on, which stores invocation logs (request URL and Cloudflare request metadata) next to the PII-free error lines. Decide: keep it and mention it on the privacy page, or set `"observability": { "enabled": true, "logs": { "invocation_logs": false } }` in `wrangler.jsonc`.

## 4. Editing flow

1. An editor opens `/admin/`, signs in with GitHub and edits an entry. Saving creates a branch and a pull request (editorial workflow).
2. No hosted preview is built (non-production builds are off, 3.5). A code owner reads the YAML diff on GitHub and, for a visual check, runs `pnpm build` and `pnpm preview` on the PR branch locally. The build fails on an unsafe link, a bad value or a non-raster social image.
3. A code owner reviews and merges the PR on GitHub, or publishes it from the CMS "Ready" column. Editors write Markdown only: raw HTML in rich text is dropped, and links must be site paths, `https:`, `mailto:`, `tel:` or `#fragments`.
4. The merge to `main` triggers the production build and deploy.

The accent colour must keep at least 3:1 contrast on the dark canvas; the build fails and names the field otherwise.

Links in content (navigation, buttons, rich text and FAQ answers) are written as English site paths (`/about/`, `/quote/`), in every language. A Turkish page links the `/tr/` version of a page or application that has one, and the English URL of one that has not; this is worked out at build time. Translating a page is therefore one PR with the new TR entry only: no navigation or link edits, in that PR or after it.

## 5. Acceptance checks (production)

Run these on the production URL once everything above is done.

- [ ] Lighthouse, mobile, production URL: Performance 95 or more (target 100), Accessibility 100, Best Practices 100, SEO 100. Command: `npx lighthouse https://<your-final-host>/ --view`.
- [ ] Scripts: no `<script>` in `dist/` outside the quote pages and `/admin/`, except the ASCII motion module on pages with `AsciiImage`, plus `application/ld+json` data. After `pnpm build`, this prints nothing when clean: `grep -rhoE '<script[^>]*>' dist --include='*.html' --exclude-dir=admin | grep -v 'application/ld+json' | grep -v 'challenges.cloudflare.com/turnstile' | grep -vE '^<script type="module" src="/_astro/[^"]+\.js">$'`. The hero ASCII figure is under 30 KB.
- [ ] Headers: `curl -sI https://<host>/` shows the Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Strict-Transport-Security headers. `curl -sI https://<host>/admin/` shows the admin CSP (the page is the Astro route `src/pages/admin/index.astro`, so `/admin/` also works in `astro dev`; only `config.yml` lives in `public/admin/`). `curl -sI https://<host>/_astro/<any file>` shows `Cache-Control: public, max-age=31536000, immutable`. securityheaders.com grade A or better.
- [ ] Quote form, with JavaScript: submit; the page shows `#sent` and a mail arrives in `QUOTE_TO` with a Reply-To of the visitor.
- [ ] Quote form, without JavaScript: the page shows `#error-verify` with the email fallback.
- [ ] Bad token: `curl -si -X POST https://<host>/api/quote -H 'Origin: https://<host>' --data '<valid fields>&cf-turnstile-response=bad'` redirects to `/quote/#error-verify`.
- [ ] Cross-origin: the same request with `Origin: https://evil.example` redirects to `#error-invalid`. A `GET /api/quote` returns 405.
- [ ] axe: `npx @axe-core/cli@<pinned version> <url>` (ad hoc; never add it as a dependency) reports 0 violations on `/`, `/about/`, `/applications/`, one application page, `/contact/`, `/privacy/`, `/quote/` (and each `#state`: `#sent`, `#error-invalid`, `#error-verify`, `#error-send`), the 404 page, `/tr/` and `/tr/quote/`.
- [ ] Keyboard-only walk of every template; layout holds at 320 CSS px and at 200% zoom; with reduced motion on, nothing moves; Turkish glyphs (ç ğ ı İ ö ş ü) render in both fonts.

### Owner manual checks

These could not be automated in the build environment.

- [ ] **(a) CMS end to end (Chromium).** Open `https://<host>/admin/` in Chromium (the "Work with Local Repository" option needs Chromium; the GitHub login itself works in any browser). Log in with GitHub. Edit one page in EN and the same page in TR. As an editor, "Save" then "Ready for review": a PR appears. As an admin, publish it (or merge on GitHub) and confirm the production site updates. Also check: an empty hero actions list saves cleanly, and sorting in the Applications list works (both were unverified in Sveltia 0.271.2).

  CMS parity checks (blank and partial values must never break the site). For each, save as an editor and open the PR, then check out its branch locally and confirm `pnpm build` passes (or run these after merge, on production), and look at the saved YAML in the PR diff:
  1. Save a feature-list item with no duration: the key is absent (or empty) and the row shows no duration.
  2. Save an application with no brochure: the key is absent (or empty) and the page shows no brochure button.
  3. Save a CTA section with no text: the CTA renders heading and button only.
  4. Create a new EN page: the PR adds `src/content/pages/en/<slug>.yaml` only, no half-empty `pages/tr/<slug>.yaml` (new entries start in EN only; TR is turned on from the editor's menu when translated).
  5. Save the TR interface strings with a few fields cleared: the build passes and those strings show in English on `/tr/`.
  6. Try to upload an SVG or GIF as the hero image, a page's social image or an application cover: the field refuses it (PNG, JPEG and WebP only; only the logo may be an SVG).
  7. Translate an existing page that has no TR version yet (turn TR on for it from the editor's menu): the PR adds `src/content/pages/tr/<slug>.yaml` only, `pnpm build` passes on the branch, and on the local preview every TR page's header, menu and footer link `/tr/<slug>/` with no navigation edit.

  Record the outcome of each (pass, or what the YAML looked like) in `memory-bank/techContext.md` under "CMS parity checks".
- [ ] **(b) Turnstile in the real Workers runtime.**
  1. Locally: `pnpm build`, then `pnpm preview` (port 8787) with the dummy secret in `.dev.vars`. POST the form with Turnstile's dummy token:

     ```
     curl -si -X POST http://localhost:8787/api/quote -H 'Origin: http://localhost:8787' \
       --data 'name=Ann&email=a@b.co&company=Co&role=&country=&solutions=general&timeline=asap&message=hello&consent=on&locale=en&cf-turnstile-response=XXXX.DUMMY.TOKEN.XXXX'
     ```

     Expected: `303` to `/quote/#error-verify`. The Worker log shows `{ code: 'verify', step: 'hostname' }`, because Turnstile's test secret always answers with the hostname `example.com`; this proves the live siteverify call is reached and the hostname check works. Any other non-empty fake token (for example `cf-turnstile-response=bad`) behaves the same and logs `step: 'hostname'`; `step: 'token'` appears only for an empty, missing or over-limit token (no siteverify call is made). (A full success cannot be produced with test keys; use the next item.) Send empty `role=` and `country=` as shown: the schema needs the fields present, as browsers always send them.
  2. Production: submit the real form once. Expected: `#sent` and a mail in your inbox.
- [ ] **(c) HOLD key.** On `/`, with motion on, the ASCII hero animates. Press the `HOLD` key in the strip at the top (also reachable with the Tab key and Space): all motion stops and the static ASCII picture shows; press again to resume.

## 6. Builder verifications (spec section 14)

Dates are the build dates, 2026-11-23.

| Item | Result | Date |
|---|---|---|
| TypeScript version | `@astrojs/check@0.9.12` peers `typescript ^5 or ^6`; pinned 6.0.3 (newest 6.x) | 2026-11-23 |
| Fonts option shape | `fontProviders.local()` with `variants`, verified in Astro 7.4.13; latin and latin-ext files, Turkish glyphs present | 2026-11-23 |
| i18n fallback | Resolved by manual routing: TR routes only for translated entries; EN fallbacks are `noindex`, no canonical | 2026-11-23 |
| Sveltia 0.271.2 | Config verified from docs: `editorial_workflow`, `type`-keyed lists, singletons, per-collection media folders, `output.omit_empty_optional_fields`, `i18n.initial_locales: default`, image `accept`. R2 stored as plain URL fields. Owner check (a), including the CMS parity checks, still open | 2026-11-23 |
| Worker zod | `astro/zod` bundles in the Worker; no `zod` pin needed | 2026-11-23 |
| Build image | Not testable locally: confirm on the first Workers Builds run (Node 26.13.1 and pnpm 12; fallback in 3.5) | open |
| Email | `send_email` without `destination_address` bundles; live delivery not testable locally. Owner check in section 5 | open |
| CSP vs inline scripts | `dist/` has no inline executable script; `assetsInlineLimit` keeps script chunks external (dist script guard) | 2026-11-23 |
| ASCII hero | 96-column grid plus a 48-column compact grid, seed figure about 18 KB (budget 30 KB), animated, static under reduced motion | 2026-11-23 |
| Turkish glyphs | Both font families include them | 2026-11-23 |
| Previews | Hosted previews are off (security: they would run branch code with production secrets). Admins preview locally; optional secure previews are described in 3.5 | decided |
| Generated JSON | `check` after `build` | 2026-11-23 |
| Auth Worker | Confirm the official repo's current steps and variable names at deploy time (3.1) | open |

Final local acceptance numbers (build, tests, bundle and page weight) are recorded in `memory-bank/progress.md`.

## 7. Troubleshooting

- **Build fails with an accent contrast error:** the `accent` in site settings is below 3:1 on the canvas. Pick a lighter colour; the message names the field.
- **`pnpm check` fails on a missing `solutions.json`:** run `pnpm build` first.
- **Build fails with "Links to the wrong language":** a TR page links the English URL of a page that has a TR version (for example `/quote/` instead of `/tr/quote/`). Content links are localized at build time, so a hit means a renderer skipped the href localizer: a code bug to report, not a content fix. Each line names the page, the link and the files where that link text lives (the page's entry, its EN entry where the page falls back to English, and the navigation), so you can find which link it is. Translating a page never needs a navigation edit.
- **Build fails with "the slug ... is reserved":** pages cannot be called `admin`, `api`, `en` or `tr` (they would hide the CMS, the quote endpoint or a language). Rename the page.
- **Build fails with "ASCII source ... must be a PNG, JPEG or WebP raster":** the hero image is an SVG, GIF or AVIF. Upload a PNG, JPEG or WebP instead.
- **Quote shows `#error-send`:** Email Routing is not enabled, the destination is not verified, or `QUOTE_TO` / `QUOTE_FROM` / `TURNSTILE_SECRET_KEY` are not set. Check the Worker logs (observability is on).
- **Quote shows `#error-verify` for real visitors:** the Turnstile hostnames do not include the host they use, or the site key and secret are from different widgets.
- **Production build fails naming `SITE_URL` or `PUBLIC_TURNSTILE_SITE_KEY`:** the variable is missing, empty, or `SITE_URL` is not https. Set it in Workers Builds for the production branch.
- **CMS login window opens then fails:** the auth Worker `ALLOWED_DOMAINS` lacks the host, the GitHub App callback URL is not `<auth-worker-url>/callback`, or `base_url` in `config.yml` / `connect-src` in `_headers` is wrong.
- **No hosted preview for a PR:** by design (3.5). Run `pnpm build` and `pnpm preview` on the PR branch locally.
- **Build fails with "Unsafe URL in Markdown":** a rich-text or FAQ link or image uses a scheme or form that is not allowed (`javascript:`, `data:`, `http:`, a relative path, `//host`). Use a site path starting with `/`, `https:`, `mailto:`, `tel:` or `#fragment`. The message names the section and the URL.
