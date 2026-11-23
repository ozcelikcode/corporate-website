# Project Brief

## Purpose
A static, brand-agnostic corporate showcase site. It presents the brand's identity, mission, applications and quote/contact channels in a calm, trustworthy way. Brand name, logo, accent colour, contacts and socials come from CMS site settings. No code, doc or plan names the tenant: refer to "the tenant" or "the brand".

## Principles
1. Small beats feature-rich. "Efficient and beautiful" beats "feature-rich". Every file, dependency and block must earn its place.
2. Hand-crafted, not templated. Control-room monitor-wall look: calm spacing with hairlines in moderation, sharp corners, a few broadcast details, mono tally labels, one two-tone headline, one ASCII hero image.
3. Platform first. Use forms, `<dialog>`, Popover API and `<details>` before any JS.
4. Content is data. Every user-facing string lives in typed content.

## Scope

### Pages
- Home (`/`), About, Contact, Privacy, Applications index, Application detail (`/applications/<slug>`), Quote (`/quote`), 404.
- English at `/`; optional Turkish at `/tr/` (translated entries only, EN fallback).
- `/admin` serves the CMS (static page).

### The 7 section blocks
`hero`, `statement`, `app-grid`, `feature-list`, `rich-text`, `cta`, `faq`. Pages and applications compose them through a typed `sections[]` union.

### Roles
- Visitor: reads the site, submits the quote form. No account.
- Editor (GitHub Write): edits content in the CMS; each entry becomes a branch + PR.
- Admin (Maintain/Admin + CODEOWNER): reviews the YAML diff and a local build (no hosted previews by default) and merges to `main`.

## Out of scope (forbidden)
- Visitor authentication or accounts.
- Payments, cart, checkout.
- Servers, VPS, databases.
- Paid services of any kind (free tiers only).
- Feature creep: no blocks, dependencies or libraries without a clear need.

## Success criteria
- Lighthouse about 100 across the board.
- Near-zero client JS: Turnstile on `/quote`, and one ≤ 2 KB self-hosted ASCII motion module on pages with the ASCII hero (owner request, Task 7b).
- WCAG 2.2 AA; mobile-first.
- Zero hosting cost; near-zero maintenance.
- Typed content fully separate from code; no hardcoded copy.
- None of the anti-goals present: `any`, swallowed errors, leftover `console.log`, magic numbers, raw hex/px in components, repeated style blocks, dead code, unused deps.
- Quote flow works with JS, without JS (email fallback), and with a bad token.

## Source of truth
`docs/superpowers/specs/2026-11-23-corporate-site-design.md`
