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
| Content editor | Keystatic at `/keystatic/` (`/admin/` redirects there) | Static admin page; saves go to GitHub as commits or branches. |
| CMS login and API | The same Worker, under `/api/keystatic/*` | GitHub App OAuth; no separate auth service. |
| Large files | R2 bucket on `assets.<domain>` | Linked from content, never stored in the repo. |

Deploy order (do not reorder): **GitHub App, then the Worker secrets and the slug build variable, then the site.**

Variables and secrets in one place:

| Name | Kind | Where it is set | Used by |
|---|---|---|---|
| `SITE_URL` | build variable | Workers Builds (production) | canonical URLs, sitemap; must be `https://...` |
| `PUBLIC_TURNSTILE_SITE_KEY` | build variable | Workers Builds (production) | the widget on the quote page |
| `TURNSTILE_SECRET_KEY` | secret | `wrangler secret put` or dashboard | Worker siteverify |
| `QUOTE_TO` | secret | same | verified Email Routing destination (your inbox) |
| `QUOTE_FROM` | secret | same | sender address on your Email Routing zone |
| `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` | build variable | Workers Builds (production) | the admin page; the last segment of `github.com/apps/<slug>` (not the full URL). A production build fails without it |
| `KEYSTATIC_GITHUB_CLIENT_ID` | secret | `wrangler secret put` or dashboard | GitHub App sign-in (the Client ID, starts with `Iv`) |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | secret | same | GitHub App sign-in (generated separately, shown once) |
| `KEYSTATIC_SECRET` | secret | same | signs the session cookies; at least 32 characters (`openssl rand -hex 32`) |

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

The secret above is Turnstile's published always-pass test secret. To test the Keystatic sign-in under `pnpm preview` (GitHub mode), add the three `KEYSTATIC_*` values from 3.1 and 3.2 here too; the App's local callback URL (3.1) must exist. This is optional: normal local editing needs none of it (below).

| Command | What it does |
|---|---|
| `pnpm dev` | Astro dev server (pages only; no Worker). Also serves Keystatic in **local mode** at `/keystatic/` (below). Does not read `public/_redirects`, so `/admin/` is a 404 here. |
| `pnpm build` | Static build into `dist/` and the Worker allow-list `worker/generated/solutions.json`. |
| `pnpm check` | `astro check` plus `tsc -p worker`. **Run after a build**: the Worker needs the generated JSON. |
| `pnpm lint` | Biome. |
| `pnpm test` | `node --test` over `src` and `worker`. |
| `pnpm preview` | Build, then `wrangler dev` (static assets, headers and the Worker together, on port 8787). |

**Local editing (no GitHub, no secrets).** Run `pnpm dev` and open `/keystatic/`. Keystatic then writes straight to the working tree, so edits appear as uncommitted file changes to review and commit yourself. It works in any browser, Safari included. Only loopback hosts are accepted (`localhost`, `127.0.0.1`, `*.localhost`); a request through a LAN address (`astro dev --host`) gets a 403 by design.

Gate before every merge, in this order: `pnpm build && pnpm check && pnpm lint && pnpm test`.

## 3. One-time setup

**Order:** do 3.7 (Turnstile) and 3.8 (Email Routing) first, because 3.5 and 3.6 need the keys and addresses they produce. Then 3.1 to 3.6, 3.9 if needed, and 3.10.

### Security checklist before the first editor

Do these in order. None of them can be skipped: until they are done, anyone with Write access could publish to production or read the Worker's secrets without a review. Details are in the sections named.

1. [ ] **Workers Builds: non-production branch builds OFF** (3.5). Branch code would otherwise run with the production deploy token and secrets.
2. [ ] **The `main` ruleset exists** (3.4), with every option listed there. Create it **before** adding any collaborator. Today `main` is unprotected: until the ruleset exists, anyone with Write access (every editor you invite) can push straight to production.
3. [ ] **Keystatic secrets and the slug build variable are set** (3.2), and the three secrets were never committed or pasted into a PR.
4. [ ] **GitHub repository security features on** (3.4): secret scanning, push protection, Dependabot alerts and updates, private vulnerability reporting; Actions disabled.
5. [ ] **GitHub App** keeps "Expire user authorization tokens" on, has no active webhook and is installed on this repository only (3.1).
6. [ ] Only then add the first editor (Write role).

After the custom domain exists, also do the hardening in 3.11 (rate-limit rule, `workers_dev` and `preview_urls` off).

**Role model:** Editor = submit (Write role; opens PRs that need 1 Code Owner approval). Admin = review + publish (repo owner and Maintain role; on the bypass list, so admins can merge their own changes).

### 3.1 GitHub App (Keystatic sign-in)

Keystatic signs editors in through a GitHub App you own. There is no separate auth service: the site Worker answers `/api/keystatic/*`.

- [ ] GitHub, Settings, Developer settings, GitHub Apps, New GitHub App. Homepage URL: your site.
- [ ] **Callback URLs** (add both): `https://<domain>/api/keystatic/github/oauth/callback` and, for local Worker testing, `http://127.0.0.1:8787/api/keystatic/github/oauth/callback`. Use `<site-name>.<account-subdomain>.workers.dev` as `<domain>` until a custom domain exists (the site Worker name is `corporate-site` in `wrangler.jsonc`), and add the custom domain's callback later (3.11).
- [ ] **Webhook:** untick "Active".
- [ ] **Repository permissions:** Contents read and write, Pull requests read and write, Metadata read (read-only, selected automatically). Nothing else.
- [ ] Keep **Expire user authorization tokens** on.
- [ ] Where can this app be installed: your account only. After creating it, **Install App** on **this repository only** (not "All repositories").
- [ ] Write down three values from the app's settings page: the **slug** (the last segment of `github.com/apps/<slug>`, not the full URL), the **Client ID** and a **client secret** (Generate a new client secret; GitHub shows it once).

Common mistakes: the numeric **App ID** is not the Client ID (the Client ID starts with `Iv`); the client secret is a separate step and is shown only once, so copy it straight into the next step.

### 3.2 Keystatic secrets and the app slug

- [ ] Generate the cookie secret: `openssl rand -hex 32` (64 characters; the Worker refuses anything under 32).
- [ ] Set the three Worker secrets from the repo root (paste when prompted), or in the dashboard under the Worker, Settings, Variables and Secrets:

```
npx wrangler secret put KEYSTATIC_GITHUB_CLIENT_ID
npx wrangler secret put KEYSTATIC_GITHUB_CLIENT_SECRET
npx wrangler secret put KEYSTATIC_SECRET
```
- [ ] Add the **build variable** `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` (the slug only) in Workers Builds, production. A production build fails without it, naming it. It is baked into the admin page, so changing it needs a new deploy.
- [ ] Local GitHub-mode testing only: put the same values in `.dev.vars` (gitignored) and run `pnpm build` once so the slug is baked in. Never commit them.
- [ ] Until all three secrets are set the Worker answers `/api/keystatic/*` with a 503 and logs `{ code: 'config' }`; that is the expected state before this step.

### 3.3 Forks, and retiring the old CMS

- [ ] Forks: edit the owner and repository name in `src/keystatic/repo.ts` (`KEYSTATIC_REPO`). This is where the admin and the Worker learn which repository to edit; it names a code host, not the brand. Commit it directly to `main` as an admin (the bypass list in 3.4 allows it) before the first site deploy: admin commits or merges directly; only editors go through review.
- [ ] If you ran the previous setup: delete the old `sveltia-cms-auth` Worker (Cloudflare dashboard, Workers, that Worker, Settings, Delete) and its GitHub OAuth app or App registration, and remove its stored secrets. The admin no longer uses either.

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
- [ ] Resulting model: Editor = submit, Admin = review + publish. GitHub, not the CMS, enforces it. Keystatic has no role system of its own: an editor is a GitHub user with Write access.

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

- [ ] Merge any 3.3 edit to `main`. Workers Builds deploys. Open `https://corporate-site.<account-subdomain>.workers.dev/`.

### 3.11 Custom domain (optional, later)

- [ ] Worker, Settings, Domains and Routes, add the custom domain (or add `"routes": [{ "pattern": "<domain>", "custom_domain": true }]` to `wrangler.jsonc`).
- [ ] Then update, in this order: `SITE_URL` build variable (redeploy), the Turnstile widget hostnames, the GitHub App callback URL (add `https://<custom-domain>/api/keystatic/github/oauth/callback`, then remove the `workers.dev` one), the R2 CORS origin.
- [ ] **Rate limit the quote endpoint.** Cloudflare dashboard, the zone, Security, WAF, Rate limiting rules (Free plan: 1 rule, and it can only match the URI Path, not the method): match `URI Path` equals `/api/quote`, count per IP, for example 5 requests per 10 seconds, action Block for 10 seconds. `GET` already returns 405, so matching the path only is fine. Turnstile alone does not stop a human-solved flood. WAF rules only apply on the custom domain, so do the next step too.
- [ ] **Close the other hosts.** In `wrangler.jsonc` set `"workers_dev": false` and `"preview_urls": false` (today both are `true`), commit to `main` and let Workers Builds deploy. Production is then reachable only on the custom domain, where the rate-limit rule applies. Before this, make sure every URL you use (Turnstile hostnames, the GitHub App callback, `SITE_URL`) is the custom domain.
- [ ] **Logs.** `observability` is on, which stores invocation logs (request URL and Cloudflare request metadata) next to the PII-free error lines. Decide: keep it and mention it on the privacy page, or set `"observability": { "enabled": true, "logs": { "invocation_logs": false } }` in `wrangler.jsonc`.

## 4. Editing flow

**Where the admin lives.** `https://<host>/keystatic/`. The old `/admin/` and anything under it answer a 301 to `/keystatic/` (`public/_redirects`, served by Workers Static Assets; `pnpm dev` does not read it).

**Editor flow (GitHub mode).** An editor needs the Write role on the repository (3.4). The behaviour below is what Keystatic is expected to do; the exact UI wording is **to confirm on first real login** (the OAuth login has not been exercised yet).

1. The editor opens `/keystatic/`, signs in with GitHub and edits an entry. Keystatic tries to save to `main`.
2. Because the `main` ruleset requires a pull request, GitHub rejects that save for an editor, and Keystatic offers to save to a **new branch** instead. Admins are on the bypass list, so their saves to `main` go through directly.
3. The editor opens the pull request from the branch link Keystatic shows (GitHub's "new pull request" page for that branch). There is no editorial status board in the admin: no Draft, In review or Ready columns. Status lives in GitHub.
4. No hosted preview is built (non-production builds are off, 3.5). A code owner reads the YAML diff on GitHub and, for a visual check, runs `pnpm build` and `pnpm preview` on the PR branch locally. The build fails on an unsafe link, a bad value or a non-raster social image.
5. A code owner approves and merges the PR on GitHub. The merge to `main` triggers the production build and deploy.

Editors write Markdown only: raw HTML in rich text is dropped, and links must be site paths, `https:`, `mailto:`, `tel:` or `#fragments`.

**Content rules every editor must know:**

- **TR slugs equal the EN twin.** A Turkish page or application must use exactly the slug of its English twin (`tr/about` for `en/about`); a TR entry with no EN twin fails the build.
- **Never type `{% ... %}` in a rich-text or FAQ answer.** Markdoc reads it as a tag: the build fails and the entry becomes unopenable in the admin until the text is removed from the file.
- **Images are stored per entry and field**, at `src/assets/uploads/<collection>/<locale>/<slug>/<field path>.<ext>`. The uploaded file's own name is ignored. Renaming a slug or reordering sections moves the files, so commit the YAML and the moved images together.
- The first save of an older entry reflows long text and requotes colour values; expect a larger diff once.

The accent colour must keep at least 3:1 contrast on the dark canvas; the build fails and names the field otherwise.

Links in content (navigation, buttons, rich text and FAQ answers) are written as English site paths (`/about/`, `/quote/`), in every language. A Turkish page links the `/tr/` version of a page or application that has one, and the English URL of one that has not; this is worked out at build time. Translating a page is therefore one PR with the new TR entry only: no navigation or link edits, in that PR or after it.

## 5. Acceptance checks (production)

Run these on the production URL once everything above is done.

- [ ] Lighthouse, mobile, production URL: Performance 95 or more (target 100), Accessibility 100, Best Practices 100, SEO 100. Command: `npx lighthouse https://<your-final-host>/ --view`.
- [ ] Scripts: no `<script>` in `dist/` outside the quote pages and `/keystatic/`, except the ASCII motion module on pages with `AsciiImage`, plus `application/ld+json` data. After `pnpm build`, this prints nothing when clean: `grep -rhoE '<script[^>]*>' dist --include='*.html' --exclude-dir=keystatic | grep -v 'application/ld+json' | grep -v 'challenges.cloudflare.com/turnstile' | grep -vE '^<script type="module" src="/_astro/[^"]+\.js">$'`. The hero ASCII figure is under 30 KB.
- [ ] Headers: `curl -sI https://<host>/` shows the Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Strict-Transport-Security headers. `curl -sI https://<host>/keystatic/` shows the admin CSP (`worker/headers.ts`), `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. `curl -sI https://<host>/admin/` answers `301` with `Location: /keystatic/`. `curl -sI https://<host>/_astro/<any file>` shows `Cache-Control: public, max-age=31536000, immutable`. securityheaders.com grade A or better.
- [ ] Quote form, with JavaScript: submit; the page shows `#sent` and a mail arrives in `QUOTE_TO` with a Reply-To of the visitor.
- [ ] Quote form, without JavaScript: the page shows `#error-verify` with the email fallback.
- [ ] Bad token: `curl -si -X POST https://<host>/api/quote -H 'Origin: https://<host>' --data '<valid fields>&cf-turnstile-response=bad'` redirects to `/quote/#error-verify`.
- [ ] Cross-origin: the same request with `Origin: https://evil.example` redirects to `#error-invalid`. A `GET /api/quote` returns 405.
- [ ] axe: `npx @axe-core/cli@<pinned version> <url>` (ad hoc; never add it as a dependency) reports 0 violations on `/`, `/about/`, `/applications/`, one application page, `/contact/`, `/privacy/`, `/quote/` (and each `#state`: `#sent`, `#error-invalid`, `#error-verify`, `#error-send`), the 404 page, `/tr/` and `/tr/quote/`.
- [ ] Keyboard-only walk of every template; layout holds at 320 CSS px and at 200% zoom; with reduced motion on, nothing moves; Turkish glyphs (ç ğ ı İ ö ş ü) render in both fonts.

### Owner manual checks

These could not be automated in the build environment.

- [ ] **(a) CMS end to end.** First apply 3.1 and 3.2, and the `main` ruleset (3.4). Open `https://<host>/keystatic/`, sign in with GitHub, edit one page in EN and the same page in TR. As an editor (Write role, not on the bypass list): save, confirm GitHub rejects the save to `main` and Keystatic offers a new branch, open the pull request from the branch link. As an admin, merge it and confirm the production site updates. Also confirm and record: the exact wording of the branch offer, that logout works, and that an editor cannot merge. Local mode (`pnpm dev`, `/keystatic/`) needs no login and can be tried first.

  Parity checks (blank and partial values must never break the site). For each, save as an editor and open the PR, then check out its branch locally and confirm `pnpm build` passes, and look at the saved YAML in the PR diff:
  1. Save a feature-list item with no duration: the key is absent (or empty) and the row shows no duration.
  2. Save an application with no brochure: the key is absent (or empty) and the page shows no brochure button.
  3. Save a CTA section with no text: the CTA renders heading and button only.
  4. Create a new EN page: the PR adds the EN entry only, no half-empty TR entry.
  5. Save the TR interface strings with a few fields cleared: the build passes and those strings show in English on `/tr/`.
  6. Try to upload an SVG or GIF as the hero image, a page's social image or an application cover: the build refuses it (PNG, JPEG and WebP only; only the logo may be an SVG).
  7. Translate an existing page that has no TR version yet: the PR adds the TR entry (same slug as the EN twin) only, `pnpm build` passes on the branch, and on the local preview every TR page's header, menu and footer link `/tr/<slug>/` with no navigation edit.

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
| CMS | Sveltia was replaced by Keystatic 0.6.10 on 2026-11-24. Local mode, collections and the Worker route are verified (spikes S1 and S2, plus the Worker tests and `wrangler dev`); the real GitHub OAuth login, branch flow and parity checks (owner check (a)) are still open | 2026-11-24 |
| Worker zod | `astro/zod` bundles in the Worker; no `zod` pin needed | 2026-11-23 |
| Build image | Not testable locally: confirm on the first Workers Builds run (Node 26.13.1 and pnpm 12; fallback in 3.5) | open |
| Email | `send_email` without `destination_address` bundles; live delivery not testable locally. Owner check in section 5 | open |
| CSP vs inline scripts | `dist/` has no inline executable script; `assetsInlineLimit` keeps script chunks external (dist script guard) | 2026-11-23 |
| ASCII hero | 96-column grid plus a 48-column compact grid, seed figure about 18 KB (budget 30 KB), animated, static under reduced motion | 2026-11-23 |
| Turkish glyphs | Both font families include them | 2026-11-23 |
| Previews | Hosted previews are off (security: they would run branch code with production secrets). Admins preview locally; optional secure previews are described in 3.5 | decided |
| Generated JSON | `check` after `build` | 2026-11-23 |
| Keystatic sign-in | Needs the owner's GitHub App (3.1, 3.2); `User-Agent` on the token exchange and logout revoke is unverified until the first real login | open |

Final local acceptance numbers (build, tests, bundle and page weight) are recorded in `memory-bank/progress.md`.

## 7. Troubleshooting

- **Build fails with an accent contrast error:** the `accent` in site settings is below 3:1 on the canvas. Pick a lighter colour; the message names the field.
- **`pnpm check` fails on a missing `solutions.json`:** run `pnpm build` first.
- **Build fails with "Links to the wrong language":** a TR page links the English URL of a page that has a TR version (for example `/quote/` instead of `/tr/quote/`). Content links are localized at build time, so a hit means a renderer skipped the href localizer: a code bug to report, not a content fix. Each line names the page, the link and the files where that link text lives (the page's entry, its EN entry where the page falls back to English, and the navigation), so you can find which link it is. Translating a page never needs a navigation edit.
- **Build fails with "the slug ... is reserved":** pages cannot be called `admin`, `keystatic`, `api`, `en` or `tr` (they would hide the CMS, its redirect, the quote endpoint or a language). Rename the page.
- **Build fails with "ASCII source ... must be a PNG, JPEG or WebP raster":** the hero image is an SVG, GIF or AVIF. Upload a PNG, JPEG or WebP instead.
- **Quote shows `#error-send`:** Email Routing is not enabled, the destination is not verified, or `QUOTE_TO` / `QUOTE_FROM` / `TURNSTILE_SECRET_KEY` are not set. Check the Worker logs (observability is on).
- **Quote shows `#error-verify` for real visitors:** the Turnstile hostnames do not include the host they use, or the site key and secret are from different widgets.
- **Production build fails naming `SITE_URL` or `PUBLIC_TURNSTILE_SITE_KEY`:** the variable is missing, empty, or `SITE_URL` is not https. Set it in Workers Builds for the production branch.
- **`/keystatic/` loads but sign-in answers 503 or "Keystatic is unavailable":** one of the three `KEYSTATIC_*` secrets is missing, or `KEYSTATIC_SECRET` is under 32 characters (3.2). The Worker log shows `{ code: 'config' }`.
- **GitHub shows "redirect_uri is not associated" or the login bounces:** the GitHub App callback URL does not match `https://<host>/api/keystatic/github/oauth/callback` exactly (3.1); add the host you are really using.
- **GitHub says the client is unknown:** `KEYSTATIC_GITHUB_CLIENT_ID` holds the numeric App ID instead of the Client ID (starts with `Iv`), or the client secret was not generated or was copied wrong.
- **Production build fails naming `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`:** set the build variable (3.2), the slug only, not the full URL.
- **An entry will not open in the admin, or the build fails on a Markdoc tag:** the rich text contains `{% ... %}`; remove it from the YAML file.
- **`/admin/` is a 404 in `pnpm dev`:** by design; the redirect is `public/_redirects`, which only the deployed Worker (or `pnpm preview`) reads. Use `/keystatic/`.
- **No hosted preview for a PR:** by design (3.5). Run `pnpm build` and `pnpm preview` on the PR branch locally.
- **Build fails with "Unsafe URL in Markdown":** a rich-text or FAQ link or image uses a scheme or form that is not allowed (`javascript:`, `data:`, `http:`, a relative path, `//host`). Use a site path starting with `/`, `https:`, `mailto:`, `tel:` or `#fragment`. The message names the section and the URL.
