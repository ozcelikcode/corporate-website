# Task 11 report: Sveltia admin config

Status: DONE_WITH_CONCERNS (step 6 manual check pending for owner).

## Implemented
- `public/admin/index.html`: doctype, charset, viewport, `noindex`, pinned `@sveltia/cms@0.271.2` script with SRI (sha384 computed from the unpkg file, 64 base64 chars) and `crossorigin="anonymous"`.
- `public/admin/config.yml`: github backend (placeholder repo and `base_url`), `editorial_workflow`, `media_folder: src/assets/uploads`, i18n `multiple_folders` en/tr (default en); `settings` singleton; `ui`, `navigation` (create/delete false); `pages`; `applications`. One `&sections` anchor reused by pages and applications (7 block types, `typeKey: type`). Patterns mirror the Zod regexes (hex accent, contact/link/action hrefs, slug, https brochure/socials); maxlength 32 labels, 160 description, 120 tagline, items 1..8, actions max 2, faq/header/contacts min 1, order int >= 0.
- `src/lib/admin-config.test.ts`: 4 tests.

## Checks
- TDD: test first failed with ENOENT (config.yml missing); after implementation 4/4 pass.
- `pnpm test`: 42 pass, 0 fail. `pnpm lint`: 0 errors (2 pre-existing infos in sections-schema.ts). `pnpm build`: ok; `dist/admin/config.yml` exists (gate).
- YAML parsed with the `yaml` package: 4 collections, 7 section types, anchor shared (deep-equal) between pages and applications.
- Step 6 (Chromium + File System Access, "Work with Local Repository"): PENDING FOR OWNER. Not run.

## Doc URLs (sveltiacms.app/en/docs/...)
collections, collections/singletons, collections/files, collections/entries, collections/entries/operations, collections/entries/slugs, fields (common options), fields/list, fields/string, i18n, i18n/structures, media/internal, workflows/editorial.

## Deviations from the brief (and why)
1. `slug: '{{fields._slug}}'` is deprecated (removal in v1.0.0, per slugs doc). Pages use `slug: { editable: [create] }` (the documented replacement; slug not localized so EN/TR twins share the filename).
2. Applications use `slug: '{{fields.slug}}'` instead of `'{{slug}}'`: the schema has its own required `slug` field, and `{{slug}}` derives from `name`, so filename and slug field could diverge. `slug` field is `i18n: duplicate`.
3. Singleton has no `i18n: false`: docs say to omit it for monolingual files (`false` is documented only for fields).
4. `ui`/`navigation` entries have a static `summary` because they have no title field.
5. Biome checks YAML: it forced double quotes on patterns (lint error otherwise); config reformatted accordingly.

## Self-review / concerns
- Docs fetched via summarizer, not read from source; `sortable_fields` and `publish` options were not documented on the fetched pages. `sortable_fields: [order, name]` kept from the brief, unverified in 0.271.2: check in step 6.
- Editor/admin split is enforced by GitHub (CODEOWNERS, branch protection, merge rights), not by config: docs say direct publish is not offered to users who cannot push/merge and you cannot approve your own PR. `publish: false` not used (it would also hide publish for admins; unclear).
- Empty optional lists (`actions`, `apps`, `socials`, `links`, `footer`) are `required: false`; whether Sveltia writes `[]` vs omits the key is unverified (schema needs `actions` present for hero: check in step 6).
- `app-grid.apps` is a plain string list (not a relation widget). Contacts "needs an email entry" and the 3:1 contrast are enforced by the build only; hints say so.
- `base_url`/`repo` are placeholders; runbook replaces them.
- Brochure is a plain https string (R2 media not confirmed).

## Memory-bank delta
- techContext "CMS": Sveltia 0.271.2 verified from docs: top-level `singletons` supported; `slug.editable` replaces deprecated `{{fields._slug}}`; list `types` + `typeKey` supported; field `pattern` is `[regex, message]`; `required: [en]` supported with i18n; `multiple_folders` layout `<folder>/<locale>/<slug>.yaml`; Biome lints/formats `public/admin/config.yml` (double quotes). Open: manual local-repo check pending for owner; `sortable_fields` and empty-list serialisation unverified.
- progress: Task 11 done (config + test + index.html), step 6 pending owner.

## Fix report (review round 1)
- Schemas: nav `footer` now `.default([])` (content.config.ts); hero `actions` now `.max(2).default([])` (sections-schema.ts). New test: hero without `actions` parses to `[]`. `pnpm check` 0 errors, build ok, test 43/43. Biome's auto-fix rewrote `[\/\\]` to `[/\\]` in both files; reverted, so only the two defaults changed. Lint currently reports only the same 2 pre-existing infos about that escape.
- Applications `slug`: docs list `readonly` but nothing for read-only-after-create, so added a hint (must equal the file name, do not change after creation).
- Per-field `i18n: true` in `ui`/`navigation` kept: i18n docs say each field must opt in; collection-level `i18n: true` does not cover them.
- Docs: sveltiacms.app/en/docs/fields, /en/docs/i18n.
- Memory-bank delta: techContext: hero `actions` and nav `footer` default to `[]` so CMS may omit empty lists; Sveltia has `readonly` but no read-only-after-create; field i18n must be per-field.
