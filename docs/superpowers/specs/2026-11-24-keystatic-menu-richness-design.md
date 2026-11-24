# Keystatic, softer type, mega menu and richer pages: design

Date: 2026-11-24. Status: approved by the owner (2026-11-24).
Extends: `docs/superpowers/specs/2026-11-23-corporate-site-design.md` (still binding where this document is silent).
Research: `.superpowers/sdd/keystatic-research.md` (local scratch; key facts are repeated here).

## 1. Intent

The owner likes the current design but raised four points:

1. **CMS.** Sveltia CMS feels like a plain browser tool. The owner wants a nicer, more product-like admin. Payload was considered and rejected: it needs a database and, in practice, the paid Workers plan, and it would move content out of Git. **Keystatic** (free, MIT, Git-based) was chosen. It must work in Safari.
2. **Type.** The sharp monospace face used for menus, labels and form fields should become a softer face.
3. **Menu.** The header must look more corporate, and hovering a menu item must open a submenu. The owner called this important.
4. **Depth.** "The site should not be this simple." The owner did not say what is missing. Section 6 is the manager's proposal, open to correction.

## 2. Goals, non-goals, anti-goals

Goals:
- Editors and admins use Keystatic at `/keystatic/` in any modern browser, including Safari. Content stays YAML in the repository, and changes still reach `main` only through a reviewed pull request.
- Monospace is kept only where it means "signal" or "machine": the ASCII figure, the timecode and rundown durations. Everything else uses the sans face.
- Header items can have a submenu that opens on hover, on keyboard focus and on tap, and works without JavaScript.
- Four new section blocks and a fuller footer give pages more substance, all editable in the CMS.

Non-goals:
- No server rendering of public pages, no database, no visitor accounts, no paid plans.
- No visual redesign beyond the points above. Colours, the ASCII hero, broadcast details and the layout grid stay.
- No news or blog collection in this round.

Anti-goals (failure even if it "works"):
- A menu that opens only on hover and is unusable on touch or keyboard, or that flickers when the pointer crosses a gap.
- An admin that lets an editor write to `main` directly, or that breaks the static build when an editor saves.
- Page weight creeping up: no new client JS on public pages beyond what exists (the ASCII module and Turnstile).

## 3. Approaches considered

| CMS option | Trade-off | Decision |
|---|---|---|
| Payload on Workers + D1 + R2 | Most polished admin, built-in roles and drafts. Needs the $5/month Workers plan in practice (per-request CPU limits on free), moves content into a database, and means a rewrite. | Rejected by owner. |
| Keystatic with the official Astro integration and `@astrojs/cloudflare` | Least custom code. Its routes are hard-coded on-demand, so the whole site needs the SSR adapter and the quote Worker must be merged into it. | Rejected: larger change to a working static deploy. |
| **Keystatic as a static client-only page plus the generic API handler in our existing Worker** | Site stays `output: 'static'` with no adapter. One new React-only admin page. `/api/keystatic/*` (an OAuth token broker only, no storage) joins `/api/quote` in `worker/index.ts`. Some runtime unknowns, so a spike comes first. | **Chosen.** |

Menu: a CSS-only disclosure (`:hover`, `:focus-within`, plus a Popover API toggle button for touch) was chosen over a JS menu script, to keep the near-zero-JS rule.

## 4. Keystatic integration

### 4.1 Architecture
- Packages: `@keystatic/core` 0.6.10, `react` and `react-dom` 19.3.1, and `@astrojs/react` 7.1.9 only if the admin page needs it to bundle the island. All exact pins. `@keystatic/astro` is **not** used. Sveltia and its config are removed.
- `src/pages/keystatic/index.astro` is a standalone static page (noindex) that mounts `<Keystatic config appSlug />` from `@keystatic/core/ui` as a client-only island. The config lives in `keystatic.config.ts` at the repo root.
- `worker/index.ts` mounts `makeGenericAPIRouteHandler` from `@keystatic/core/api/generic` at `/api/keystatic/*`, with three Worker secrets: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET` and `KEYSTATIC_SECRET` (at least 32 characters). Build var: `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`.
- `wrangler.jsonc`:
  - `run_worker_first` gains `/keystatic/*`.
  - The Worker serves `/keystatic/` for every `/keystatic/*` path, so reloads and deep links work.
  - `nodejs_compat` is added only if the spike shows it is needed.
- `/admin/` permanently redirects to `/keystatic/`.
- Local editing: `pnpm dev` with Keystatic `storage: local` (the dev server writes files, no browser file-system API, so it works in Safari). Production uses `storage: github`, chosen by build mode.

### 4.2 Security
- A relaxed CSP applies to `/keystatic/*` only, set by the Worker:
  - `connect-src` for `api.github.com` and `raw.githubusercontent.com`;
  - `style-src 'unsafe-inline'`;
  - `img-src` adding `blob:` and `data:`;
  - no third-party fonts (the bundled Inter request is blocked; the UI falls back to the system font).

  Public pages keep the strict CSP.
- Cookies come from the Keystatic handler. The refresh token is httpOnly and encrypted; the access-token cookie is readable by the admin page by design. Strict CSP elsewhere and `X-Frame-Options`/`frame-ancestors 'none'` on `/keystatic/*` limit exposure.
- Branch protection is unchanged:
  - Editors have Write access. When a save to `main` is rejected, Keystatic offers to create a branch.
  - The editor opens the pull request from the branch link Keystatic shows, which goes to GitHub's "new pull request" page.
  - A code owner approves it. Admins are on the bypass list.

  The runbook is rewritten for this flow. Keystatic has no editorial status board; that loss is accepted.
- The GitHub App is created by the owner (by hand or from local dev). The runbook gives the exact permissions: Contents read/write, Pull requests read/write, Metadata read. The callback URL is `https://<domain>/api/keystatic/github/oauth/callback`. The old `sveltia-cms-auth` Worker and OAuth app are retired.

### 4.3 Content model
- One collection per locale and type:
  - pages EN and TR: `src/content/pages/{en,tr}/*`
  - applications EN and TR: `src/content/applications/{en,tr}/*`

  Singletons cover settings, navigation EN/TR and UI strings EN/TR. Data format is YAML in the existing paths.
- Blocks use `fields.blocks`, which stores `{discriminant, value}`. A one-time script migrates the seed YAML to that shape. The Zod schemas parse the stored shape and `.transform` it into today's flat `{type, ...}` section type, so section components do not change.
- Rich text uses `fields.markdoc.inline` with tables, images and code blocks turned off. It is stored as a Markdown string in the same YAML file, so `renderMarkdown` and its sanitisation stay as they are.
- Images use `fields.image` writing to `src/assets/uploads`, raster only, as today.
- A parity test replaces `admin-config.test.ts`. For every Keystatic collection and singleton it checks that:
  - the path matches files on disk;
  - every field maps to a schema key;
  - Keystatic accepts all seed files.

### 4.4 Spike first (gate)
Before the migration, a throwaway branch proves under `wrangler dev` with a real GitHub App:
- login;
- a read;
- a commit to a branch;
- a rejected commit to protected `main`, which falls back to a branch;
- a logout.

It also confirms:
- whether the `process.env.NODE_ENV` read needs `nodejs_compat`;
- the missing `User-Agent` issue on the token exchange;
- how big the admin bundle is.

If the spike fails on something with no fix, the fallback is the second approach in the table (SSR adapter), brought back to the owner first.

## 5. Softer type and corporate mega menu

### 5.1 Type
- `label-mono` is replaced by `label`, set in the sans face (Schibsted Grotesk): medium weight, sentence case, slight positive tracking, the same size token.
- It applies to nav, buttons, form labels, section labels, the footer, the language toggle, FAQ and prose `h6`.
- Martian Mono stays only in `AsciiImage`, `Timecode`, the rundown duration column and the PGM/PVW tally labels, which are broadcast hardware cues.
- If only the timecode needs mono, the font payload is reduced to a single mono weight.

### 5.2 Menu
- Navigation items gain optional `children`: a list of `{label, href, description?}`, up to 6 per item.
- An item can set `source: applications` to list every application automatically, using its title and summary in the current locale.
- Desktop (from lg):
  - Each parent shows a small chevron.
  - Hover, or keyboard focus inside, opens a full-width panel under the header rule after a short intent delay (a named token). It closes with the same delay, so crossing the gap never flickers.
  - The panel has a link column with descriptions and a feature tile. The tile shows a short heading, text and an action, from the navigation entry's optional `feature` fields.
  - A parent that has a page stays a link; a separate chevron button toggles the panel for touch and keyboard (Popover API, `popovertarget`). Escape closes it, and focus is visible.
- Mobile: children become `<details>` accordions inside the existing menu sheet.
- No JS. The panel uses tokens only and keeps the border budget: one hairline along its top edge, the same as the header rule.
- The header bar gets a slightly taller height token, the logo gets more room, and the quote key stays.
- It is checked in Chromium, Firefox and WebKit (Safari engine) at 360, 768, 1024 and 1440.

## 6. Richer pages (manager proposal, owner may correct)

New blocks, each under about 60 lines, typed, in the CMS and with EN and TR seeds:

| Block | Content | Look |
|---|---|---|
| `stats` | 3–4 items `{value, label, note?}` | Large figures with a small label, set like an on-air stat bar |
| `logos` | heading plus 4–12 raster logos `{image, alt, href?}` | Muted greyscale wall, colour on hover |
| `testimonial` | quote, name, role, organisation, optional portrait | Pull-quote with a lower-third name strap |
| `media-split` | label, heading, Markdown text, image, optional action, `reverse` flag | Image and text side by side, alternating |

- **Footer:**
  - Four columns: brand line and contact details from settings, the navigation groups, an applications list built from content, and socials.
  - Below them, the bars strip and the legal row.
- **Home composition (seed):** hero, statement, stats, app-grid, media-split ×2, feature-list (rundown), logos, testimonial, cta.
- **About and application pages:** these get a `media-split` and `stats` in their seeds.
- **Seed assets:** logos and portraits are neutral generated placeholders (abstract marks, no real brands), raster only.

## 7. Delivery

The work runs in parallel streams with no shared files, after a short manager-owned spike:

1. **Spike (Keystatic on our Worker).** Its outcome decides 4.1.
2. **Stream A: Keystatic migration.**
   - config, admin page, Worker route, wrangler, YAML block-shape migration with the schema transform, parity test;
   - Sveltia removal, runbook and memory bank.
3. **Stream B: type and menu.**
   - tokens and `label` utility, header, mega panel, mobile accordions;
   - navigation schema `children`/`feature`/`source`, plus a nav content update;
   - only the schema file and nav YAML that Stream A does not migrate. B goes first on the navigation schema, and A models it afterwards.
4. **Stream C: new blocks (UI only).** The four components and the footer, with fixture props.
5. **Integration (after A and C).** Block schemas, Keystatic block definitions, seeds, home and about composition.
6. **Final review and browser check.** Chromium, Firefox and WebKit; reduced motion; no new public JS; Lighthouse ≥ 95 on the home page.

Owner tasks: create the GitHub App, set the three secrets and the slug build var, and retire the Sveltia auth Worker.

## 8. Builder-check rulings (manager calls)

- **Local editing in `pnpm dev`.** A small dev-only Astro integration (`astro:server:setup`) mounts the Node build of `makeGenericAPIRouteHandler` with `storage: local` on the Vite dev server at `/api/keystatic/*`. Nothing from it ships to production. The Worker route serves GitHub mode only. `output: 'static'` is unchanged.
- **Sequencing.**
  - Streams B and C do not depend on the spike and start at once.
  - The spike's local-mode half needs no GitHub App and runs at once. Its GitHub-mode half waits for the owner to create the App (a guided 5-minute step).
  - Stream A starts after the spike passes. If the spike forces the SSR fallback, B and C are unaffected.
- **Branch fallback pass criterion.** The spike passes if an editor without bypass can save to a new branch from the UI, by whichever flow Keystatic offers, and a direct save to `main` is rejected by GitHub. The anti-goal holds either way, because GitHub enforces protection server-side. The runbook documents the flow the spike observed.
- **Navigation children.**
  - An item has either explicit `children` (at most 6) or `source: applications`, never both.
  - The generated list includes every application in its `order` field, then by title, capped at 8.
  - It uses the current-locale entry and falls back to EN, the same fallback the site already uses.
- **Block migration scope.**
  - Every section type, hero included, becomes a `fields.blocks` entry, and the hero fields keep their names.
  - The flat-shape transform lives in the content schema, so section components and their tests do not change.
- **Roles.** "Admin" means GitHub's ruleset bypass list. Nothing role-specific is built in Keystatic.
- **Base branch.**
  - The work starts from the tip of `fix/hero-type-admin` (PR #2, still open) on a new branch.
  - If PR #2 merges first, the new branch is rebased on `main`.
  - The untracked `* 2.*` files and `src/pages 2/` in the working tree are stale copies of the 2026-11-23 scaffold and are not part of this work.

## 9. Left to the builder

- Exact intent-delay values, panel max width, the chevron glyph (via `Glyph`), sans tracking value, and stat figure size, all within existing tokens.
- Whether `@astrojs/react` is needed or a plain Vite-bundled script can mount the React admin.
- Placeholder logo and portrait generation method (build-time `sharp` or committed small WebP files under 30 KB each).
