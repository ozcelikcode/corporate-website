---
name: team-delegation
description: Use whenever planning or executing work in this repo; the main session manages and delegates to subagents instead of implementing.
---

# Team Delegation

## Role
The main session is a manager. It does not implement. It plans, writes self-contained briefs, dispatches subagents, and verifies their output against the brief before accepting it.

## Model routing
- Opus 5.5 (high effort): standard work, design-heavy work, architecture decisions, code review.
- Sonnet 5.5: well-specified implementation and research.
- Haiku 5.5: mechanical tasks (renames, formatting, file moves, simple lookups).

When unsure, route up one tier rather than down.

## Parallelism
- Run 1 to 5 agents in the background in parallel.
- Never put two writers on the same files. Split work by file ownership.
- Dependent steps run sequentially; independent steps run together.

## Commit and push
- Always delegated to an agent (Haiku is fine).
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, ...), one logical change per commit.
- Never commit secrets or `.env` files.

## Memory bank
Every brief must tell the agent to:
1. Read `memory-bank/` (all 5 files) before starting.
2. Update the relevant memory-bank files after any meaningful change.

## Verification
Before accepting a result: check changed files against the brief's "done when", run the relevant checks (`pnpm check`, `pnpm lint`, build), and confirm the code rules in `CLAUDE.md` hold. Send fixes back as a new brief.

## Brief template
```
Goal: <one sentence outcome>
Context: read memory-bank/ first; spec at docs/superpowers/specs/2026-11-23-corporate-site-design.md (section X)
Files: <files to create/edit; files that must not be touched>
Constraints: <pinned versions, code rules, brand-agnostic, no new deps>
Done when: <observable, checkable criteria>
Report format: <files changed, checks run and results, open issues; concise>
After finishing: update the relevant memory-bank files.
```

Briefs must be self-contained: the agent has no access to this conversation.
