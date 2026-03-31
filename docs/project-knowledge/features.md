---
last_updated: 2026-04-01
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Implemented

| Feature | Description | Spec | Plan |
|---------|------------|------|------|
| Plugin marketplace catalog | `.claude-plugin/marketplace.json` makes this repo discoverable and installable via `/plugin marketplace add jacexh/skill-workshop` | — | — |
| `superpowers-memory` plugin | Full plugin with hooks + skills for project knowledge persistence and plan checkpoint tracking | [Design Spec](../superpowers/specs/2026-03-31-superpowers-memory-design.md) | [Implementation Plan](../superpowers/plans/2026-03-31-superpowers-memory.md) |
| SessionStart hook | Detects whether `docs/project-knowledge/` exists; injects 5 behavior guidelines (read KB before brainstorming, update checkboxes, pass context to subagents, etc.) or "not initialized" prompt | Design Spec §Hooks | Plan Task 3 |
| TaskCompleted hook | Fires on any task completion; reminds agent to update plan file checkbox from `- [ ]` to `- [x]` | Design Spec §Hooks | Plan Task 4 |
| Stop hook | Fires at session end; checks `git diff` for plan file changes; conditionally suggests running `:update` | Design Spec §Hooks | Plan Task 5 |
| Cross-platform hook dispatcher | `run-hook.cmd` polyglot bash/batch wrapper routes hook calls on both Unix and Windows | Design Spec §Plugin Structure | Plan Task 2 |
| 5 knowledge base templates | Structural scaffolds for `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md` with frontmatter and section headers | Design Spec §Templates | Plan Task 6 |
| `superpowers-memory:load` skill | Reads all 5 knowledge files; presents structured project context summary; warns if any file is >30 days stale | Design Spec §Skills | Plan Task 7 |
| `superpowers-memory:update` skill | Incremental KB update: reads current KB + recent plan/spec/git diff; updates only changed files; sets frontmatter | Design Spec §Skills | Plan Task 8 |
| `superpowers-memory:rebuild` skill | Full KB regeneration from codebase scan: reads project structure, configs, docs, git log; writes all 5 KB files | Design Spec §Skills | Plan Task 9 |
| Plugin README | User-facing documentation covering problem statement, skills table, hooks table, KB structure | — | Plan Task 10 |

## In Progress

| Feature | Description | Plan | Status |
|---------|------------|------|--------|
| — | No features currently in progress | — | — |
