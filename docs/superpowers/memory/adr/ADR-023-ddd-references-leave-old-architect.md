---
adr: 023
title: DDD references leave old architect plugin
date: 2026-07-02
status: Accepted
---

# ADR-023: DDD references leave old architect plugin

## Context

After `superpowers-ddd-architect` became the active DDD/backend plugin, `superpowers-architect` still carried bundled copies of migrated DDD and database references under `design-patterns/`. Keeping those copies made the old explicit standards skill look like a fallback DDD path and created drift risk. The Python and TypeScript DDD guides were also still in the old plugin, but they depended on the migrated `ddd-core.md` and `ddd-modeling.md` references.

## Decision

Remove bundled DDD/backend and database references from `superpowers-architect` on both Claude and Codex tracks. Move `ddd-python.md` and `ddd-typescript.md` into `superpowers-ddd-architect/references/` alongside the Go, modeling, core, runtime, taskqueue, event/message, database, and risk-router references.

`superpowers-architect` remains explicit-only for general standards lookup. Its bundled defaults no longer include `ddd-*.md` or `database.md`; project/global pattern directories may still provide their own general or database standards.

## Consequences

- There is one canonical bundled home for DDD references: `superpowers-ddd-architect/references/`.
- The DDD plugin is multi-language for backend DDD: Go, Python, and TypeScript.
- The old architect plugin no longer exposes broken Python/TypeScript DDD guides that point to removed core/modeling files.
- Release tests assert that old bundled defaults contain no `ddd-*.md` files and no migrated `database.md`.

## References

- `plugins/superpowers-ddd-architect/references/ddd-python.md`
- `plugins/superpowers-ddd-architect/references/ddd-typescript.md`
- `codex-plugins/superpowers-ddd-architect/references/ddd-python.md`
- `codex-plugins/superpowers-ddd-architect/references/ddd-typescript.md`
- `scripts/release/test/test_codex_architect_runtime.sh`
- `scripts/release/test/test_codex_ddd_architect_runtime.sh`
