---
last_updated: 2026-04-15
updated_by: superpowers-memory:update
triggered_by_plan: null
---

# Features

## Implemented

### Marketplace (v1.5.7)

| Feature | Description |
|---------|------------|
| Plugin marketplace catalog | `.claude-plugin/marketplace.json` — 3 plugins discoverable via `/plugin marketplace add jacexh/skill-workshop` |
| GitHub Actions release | Automated `workflow_dispatch` for version bumping, tagging, and GitHub Release per plugin |

### superpowers-memory (v1.5.5)

| Feature | Description |
|---------|------------|
| Node.js hook runtime | `hook-runtime.js` — unified runtime for all 3 hooks + `verify` + `analyze` modes; thin bash wrappers delegate to it |
| SessionStart hook | Reads `index.md` or `MEMORY.md` (backward compat) from `docs/project-knowledge/`; injects index as additionalContext; prompts rebuild if KB missing |
| PreToolUse hook | Intercepts 5 skills: `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`; blocks if KB not ready, otherwise injects advisory |
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

### designing-tests (v1.5.7)

| Feature | Description |
|---------|------------|
| `designing-tests` skill | Risk-driven test design: choose narrowest real boundary, design minimal sufficient coverage, classify tests as real/shallow/fake |
| PreToolUse hook | Intercepts `test-driven-development` skill; injects `SKILL.md` body + reference file index as additionalContext |
| 4 reference files | `layer-selection.md`, `risk-catalog.md`, `test-case-patterns.md`, `test-quality-review.md` |
| Cross-platform dispatcher | `run-hook.cmd` polyglot bash/batch wrapper for Unix and Windows |

## In Progress

No features currently in progress.
