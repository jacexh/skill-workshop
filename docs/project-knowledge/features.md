---
last_updated: 2026-04-25
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-25-finishing-rich-injection.md"
---

# Features

## Implemented

### Marketplace (v1.5.7)

| Feature | Description |
|---------|------------|
| Plugin marketplace catalog | `.claude-plugin/marketplace.json` — 3 plugins discoverable via `/plugin marketplace add jacexh/skill-workshop` |
| GitHub Actions release | Automated `workflow_dispatch` for version bumping, tagging, and GitHub Release per plugin |

### superpowers-memory (v1.10.1)

| Feature | Description |
|---------|------------|
| Node.js hook runtime | `hook-runtime.js` — unified runtime for all hooks + `verify` + `analyze` + `lock` / `unlock` / `lock-status` modes; thin bash wrappers delegate to it |
| SessionStart hook | Reads `index.md` or `MEMORY.md` (backward compat) from `docs/project-knowledge/`; injects index as additionalContext; prompts rebuild if KB missing |
| PreToolUse hook (Skill) | Intercepts 5 skills with per-skill dispatch. The 4 planning/execution skills get a 1-line advisory; `finishing-a-development-branch` uses a 4-way classifier — block on KB-missing, no-op on base branch, architect-style rich injection on stale, soft reminder when KB covers HEAD (ADR-011) |
| PreToolUse hook (Write/Edit) | Intercepts `Write` / `Edit` / `MultiEdit` / `NotebookEdit` on paths under `docs/project-knowledge/`; blocks unless a write-lock is held; lock is acquired/released only by `superpowers-memory:update` and `superpowers-memory:rebuild` (ADR-010) |
| KB write-lock | `.git/superpowers-memory.lock` with 60-min TTL gates all KB edits; auto-cleaned when stale; no escape hatch — manual edits also go through `superpowers-memory:update` (ADR-010) |
| Stop hook | Evidence-based staleness: detects file-level changes outside `docs/project-knowledge/` via git diff (committed, staged, unstaged, untracked); emits systemMessage reminder if changes found |
| Verify command | Checks file size thresholds, stale path references, and git commit readiness; used by `rebuild` and `update` skills before commit |
| `load` skill | Two-phase: reads index first, then offers on-demand detail file loading |
| `update` skill | Incremental KB update from recent changes; regenerates index; preserves `triggered_by_plan` |
| `rebuild` skill | Full KB regeneration: two-phase codebase scan, generates 6 KB files + index, runs verify, commits |
| 7 templates | Structural scaffolds: `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`, `glossary.md`, `index.md` |
| `content-rules.md` | Shared content generation rules (language, inclusion/exclusion, SSOT, size guard) for `rebuild` and `update` |
| Cross-platform dispatcher | `run-hook.cmd` polyglot bash/batch wrapper for Unix and Windows |

### superpowers-architect (v1.5.6)

| Feature | Description |
|---------|------------|
| PreToolUse hook | Intercepts 5 skills: `writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`; two wording modes (plan vs review) |
| Progressive pattern loading | Injects only name + description + path index; Claude loads full content on demand via `Read` tool |
| Two-layer pattern directories | Global `$SP_ARCHITECT_DIR` (default `~/.claude/superpowers-architect/design-patterns/`) + project-level pattern directory; project overrides global by filename |
| 6 reference design patterns | `database.md`, `rest-api.md`, `ddd-core.md`, `ddd-golang.md`, `ddd-python.md`, `frontend-patterns.md` |

### designing-tests (v1.6.0)

| Feature | Description |
|---------|------------|
| `designing-tests` skill | Intent-first test design: derive tests from function intent before reading implementation; test list as planning step; intent comments on every test; quality labels (real/shallow/fake); boundary selection rule |
| PreToolUse hook (three-tier) | Intercepts 4 skills: `writing-plans` (planning tier — TDD reminder), `executing-plans` + `subagent-driven-development` (execution tier — condensed principles), `test-driven-development` (full tier — SKILL.md body + reference index) |
| 4 reference files | `layer-selection.md`, `risk-catalog.md`, `test-case-patterns.md` (with EP/BVA/Decision Table definitions), `test-quality-review.md` |
| Cross-platform dispatcher | `run-hook.cmd` polyglot bash/batch wrapper for Unix and Windows |

## In Progress

No features currently in progress.
