# Corporate Site

A static, brand-agnostic corporate website. Brand name, logo, accent colour and contacts come from CMS settings, so the same code serves any tenant. English at `/`, optional Turkish at `/tr/`. A hero image is rendered as an animated ASCII broadcast signal (static under reduced motion, with a HOLD key to pause it).

## Stack

- Astro 7 (static output), Tailwind 4, TypeScript 6 (strict), Biome
- Cloudflare Workers Static Assets, one Worker for `POST /api/quote` (Turnstile, Email Routing `send_email`)
- Sveltia CMS at `/admin/` (GitHub backend, editorial workflow), login through a separate `sveltia-cms-auth` Worker
- Content is typed YAML in `src/content`, validated with Zod at build time
- Free tier only; no database, no visitor accounts

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Astro dev server |
| `pnpm build` | Static build into `dist/` |
| `pnpm check` | Type check (run after a build) |
| `pnpm lint` / `pnpm format` | Biome check / fix |
| `pnpm test` | Unit tests (`node --test`) |
| `pnpm preview` | Build, then run the site and Worker locally with `wrangler dev` |
| `pnpm run deploy` | Build and deploy (normally done by Workers Builds on `main`) |

Needs Node 26.13.1 (`.nvmrc`) and pnpm 12.23.0. Local secrets go in `.dev.vars` (gitignored); see the runbook.

## Editing content

Open `/admin/` in Chromium, sign in with GitHub and edit pages, applications, navigation, UI strings or site settings in EN and TR. Saving opens a pull request; a code owner merges it and the site rebuilds. Details in the runbook, section 4.

## Documentation

- [Deploy and setup runbook](docs/runbook.md)
- [Design spec](docs/superpowers/specs/2026-11-23-corporate-site-design.md)
- [Implementation plan](docs/superpowers/plans/2026-11-23-corporate-site.md)
- [Memory bank](memory-bank/) (project brief, tech context, patterns, active context, progress)
- Project rules: [CLAUDE.md](CLAUDE.md)

## License

See [LICENSE](LICENSE).
