---
last_updated: 2026-04-01
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-01-auto-kb-update.md
---

# Features

## Implemented

| Feature | Description | Spec | Plan |
|---------|------------|------|------|
| Plugin marketplace catalog | `.claude-plugin/marketplace.json` makes this repo discoverable and installable via `/plugin marketplace add jacexh/skill-workshop` | — | — |
| `superpowers-memory` plugin | Full plugin with hooks + skills for project knowledge persistence and plan checkpoint tracking | [Design Spec](../superpowers/specs/2026-03-31-superpowers-memory-design.md) | [Implementation Plan](../superpowers/plans/2026-03-31-superpowers-memory.md) |
| SessionStart hook | Detects whether `docs/project-knowledge/` exists; outputs "not initialized" prompt if missing; otherwise returns `{}` (no-op). Behavior guidelines removed — handled by PreToolUse. | Design Spec §Hooks | Plan Task 3 |
| PreToolUse hook | Intercepts `superpowers:brainstorming`, `superpowers:writing-plans`, and `superpowers:finishing-a-development-branch`; injects KB-state-aware context (not_initialized / stale / fresh) at the exact moment each skill is called | [Auto-KB Design](../superpowers/specs/2026-04-01-auto-kb-update-design.md) | [Auto-KB Plan](../superpowers/plans/2026-04-01-auto-kb-update.md) Task 5 |
| Stop hook | Fires at session end; uses SHA-based KB staleness check (`git log -1` on `docs/project-knowledge/` vs `HEAD`); outputs `:update` reminder only when KB is behind | [Auto-KB Design](../superpowers/specs/2026-04-01-auto-kb-update-design.md) | [Auto-KB Plan](../superpowers/plans/2026-04-01-auto-kb-update.md) Task 3 |
| Cross-platform hook dispatcher | `run-hook.cmd` polyglot bash/batch wrapper routes hook calls on both Unix and Windows | Design Spec §Plugin Structure | Plan Task 2 |
| 5 knowledge base templates | Structural scaffolds for `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`; expanded in v1.0.8 with Pattern Overview, Layers, Entry Points, Error Handling, Cross-Cutting Concerns, Runtime, Backlog, Known Issues, Naming Patterns, and more | [Template Optimization Design](../superpowers/specs/2026-04-01-template-optimization-design.md) | [Template Optimization Plan](../superpowers/plans/2026-04-01-template-optimization.md) |
| `superpowers-memory:load` skill | Reads all 5 knowledge files; presents structured project context summary; warns if any file is >30 days stale | Design Spec §Skills | Plan Task 7 |
| `superpowers-memory:update` skill | Incremental KB update: reads current KB + recent plan/spec/git diff; updates only changed files; sets frontmatter | Design Spec §Skills | Plan Task 8 |
| `superpowers-memory:rebuild` skill | Full KB regeneration from codebase scan: reads project structure, configs, docs, git log; writes all 5 KB files | Design Spec §Skills | Plan Task 9 |
| Plugin README | User-facing documentation covering problem statement, skills table, hooks table, KB structure | — | Plan Task 10 |

## In Progress

| Feature | Description | Plan | Status |
|---------|------------|------|--------|
| — | No features currently in progress | — | — |
