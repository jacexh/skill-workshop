---
last_updated: 2026-04-01
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-01-memory-index.md
---

# Features

## Implemented

| Feature | Description | Spec | Plan |
|---------|------------|------|------|
| Plugin marketplace catalog | `.claude-plugin/marketplace.json` makes this repo discoverable and installable via `/plugin marketplace add jacexh/skill-workshop` | — | — |
| `superpowers-memory` plugin | Full plugin with hooks + skills for project knowledge persistence and plan checkpoint tracking | [Design Spec](../superpowers/specs/2026-03-31-superpowers-memory-design.md) | [Implementation Plan](../superpowers/plans/2026-03-31-superpowers-memory.md) |
| SessionStart hook | Three branches: (1) KB not initialized → "run rebuild" prompt; (2) `MEMORY.md` exists → inject index content as additionalContext; (3) KB exists but no MEMORY.md → `{}` silent fallback | [Memory Index Design](../superpowers/specs/2026-04-01-memory-index-design.md) | [Memory Index Plan](../superpowers/plans/2026-04-01-memory-index.md) Task 4 |
| PreToolUse hook | Intercepts `superpowers:brainstorming`, `superpowers:writing-plans`, and `superpowers:finishing-a-development-branch`; injects KB-state-aware context (not_initialized / stale / fresh) at the exact moment each skill is called | [Auto-KB Design](../superpowers/specs/2026-04-01-auto-kb-update-design.md) | [Auto-KB Plan](../superpowers/plans/2026-04-01-auto-kb-update.md) Task 5 |
| Stop hook | Fires at session end; uses SHA-based KB staleness check (`git log -1` on `docs/project-knowledge/` vs `HEAD`); outputs `:update` reminder only when KB is behind | [Auto-KB Design](../superpowers/specs/2026-04-01-auto-kb-update-design.md) | [Auto-KB Plan](../superpowers/plans/2026-04-01-auto-kb-update.md) Task 3 |
| Cross-platform hook dispatcher | `run-hook.cmd` polyglot bash/batch wrapper routes hook calls on both Unix and Windows | Design Spec §Plugin Structure | Plan Task 2 |
| 6 knowledge base templates | Structural scaffolds for `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md` (expanded in v1.0.8); plus `MEMORY.md` template (added in v1.2.1) as single source of truth for the index format used by `rebuild` and `update` skills | [Template Optimization Design](../superpowers/specs/2026-04-01-template-optimization-design.md) | [Template Optimization Plan](../superpowers/plans/2026-04-01-template-optimization.md) |
| `superpowers-memory:load` skill | Two-phase loading: Phase 1 reads MEMORY.md index if present; Phase 2 offers on-demand detail file loading. Legacy fallback reads all 5 files directly. Warns if any file >30 days stale. | [Memory Index Design](../superpowers/specs/2026-04-01-memory-index-design.md) | [Memory Index Plan](../superpowers/plans/2026-04-01-memory-index.md) Task 3 |
| `superpowers-memory:update` skill | Incremental KB update: reads current KB + recent plan/spec/git diff; updates only changed files; always regenerates MEMORY.md index in full | [Memory Index Plan](../superpowers/plans/2026-04-01-memory-index.md) Task 2 | Plan Task 8 |
| `superpowers-memory:rebuild` skill | Full KB regeneration from codebase scan; generates all 5 KB files + MEMORY.md index | [Memory Index Plan](../superpowers/plans/2026-04-01-memory-index.md) Task 1 | Plan Task 9 |
| `MEMORY.md` knowledge index | `docs/project-knowledge/MEMORY.md` — structured index with filename + description + 2-3 key points per file; written by `rebuild`/`update`; injected by `session-start` at every session; required first read in `pre-tool-use` brainstorming/writing-plans messages | [Memory Index Design](../superpowers/specs/2026-04-01-memory-index-design.md) | [Memory Index Plan](../superpowers/plans/2026-04-01-memory-index.md) |
| Plugin README | User-facing documentation covering problem statement, skills table, hooks table, KB structure | — | Plan Task 10 |

## In Progress

| Feature | Description | Plan | Status |
|---------|------------|------|--------|
| — | No features currently in progress | — | — |
