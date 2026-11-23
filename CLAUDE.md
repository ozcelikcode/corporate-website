# Corporate Site

A static, brand-agnostic corporate showcase built with Astro 7 (static output), Tailwind 4 and a single Cloudflare Worker for the quote form (`/api/quote`). Content is typed YAML edited through Sveltia CMS; EN at `/`, optional TR at `/tr/`. Brand, logo, accent and contacts come from CMS settings. Never name any company or tenant in code, docs or plans: say "the tenant" or "the brand".

## Memory bank (mandatory)
Before any task, read all 5 files in `memory-bank/` (projectbrief, techContext, systemPatterns, activeContext, progress). After each meaningful change, update the relevant ones.

## Workflow
- Use the `team-delegation` skill (`.claude/skills/team-delegation/SKILL.md`): the main session manages and delegates; it does not implement.
- Source of truth: `docs/superpowers/specs/2026-11-23-corporate-site-design.md`.

## Non-negotiable code rules
- No `any`; strict TypeScript.
- No swallowed errors; no `console.log` (only the Worker's PII-free `console.error`).
- No magic numbers, raw hex or raw px in components; use tokens and named constants.
- No hardcoded copy; every user-facing string comes from typed content.
- One responsibility per file; PascalCase components, kebab-case everything else.
- No dead code, no unused dependencies; exact version pins only.
- Free tier only; secrets via wrangler secrets; large files in R2, never in the repo.
- Lean beats feature-rich: no visitor auth, payments, cart, servers or paid services.
