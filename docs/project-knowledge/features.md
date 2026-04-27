---
last_updated: 2026-04-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-26-codex-marketplace-compat-plan.md"
---

# Features

## Implemented

### Marketplace catalogs

| Feature | Description |
|---------|------------|
| Claude marketplace | `.claude-plugin/marketplace.json` — 3 plugins, discoverable via `/plugin marketplace add jacexh/skill-workshop` |
| Codex marketplace (experimental) | `.agents/plugins/marketplace.json` — 3 codex-plugins, object-form `source` + `policy` + `category`; discoverable via `codex plugin marketplace add jacexh/skill-workshop` (ADR-013) |
| GitHub Actions release | Automated `workflow_dispatch` for version bump, tag, GitHub Release per plugin |

### superpowers-memory (Claude track v1.11.0)

| Feature | Description |
|---------|------------|
| Node.js hook runtime | `hook-runtime.js` — unified runtime; modes: `session-start` / `pre-tool-use` / `user-prompt-expansion` / `verify` / `lock` / `unlock` / `lock-status` / `analyze` |
| SessionStart hook | Reads `index.md` (or legacy `MEMORY.md`); injects index as `additionalContext` |
| PreToolUse hook (Skill) | Per-skill dispatch on 5 trigger skills; `finishing-a-development-branch` runs shared `classifyFinishingState()` 4-way classifier (ADR-011) |
| UserPromptExpansion hook | Covers slash-typed `/superpowers:finishing-a-development-branch` path; same classifier (ADR-012) |
| PreToolUse hook (Write/Edit) | Intercepts `Write` / `Edit` / `MultiEdit` / `NotebookEdit` on `docs/project-knowledge/` paths; blocks unless write-lock held (ADR-010) |
| KB write-lock | `.git/superpowers-memory.lock` with 60-min TTL gates KB edits (ADR-010) |
| Verify command | Size thresholds, stale path refs, content-shape lint, total token budget |
| `load` / `update` / `rebuild` skills | KB management |
| 7 templates + content-rules.md | Content generation SSOT |
| Cross-platform dispatcher | `run-hook.cmd` polyglot bash/batch wrapper |

### superpowers-architect (Claude track v1.6.2)

| Feature | Description |
|---------|------------|
| PreToolUse hook | Intercepts 5 trigger skills with plan-vs-review wording fork |
| Progressive pattern loading | Index-only injection (name + description + path); full content via Read |
| Two-layer pattern dirs | Global `$SP_ARCHITECT_DIR` + project-local; project overrides global by filename |
| 8 reference design patterns | `database`, `rest-api`, `ddd-core`, `ddd-modeling`, `ddd-golang`, `ddd-python`, `ddd-typescript`, `frontend-patterns` |

### designing-tests (Claude track v1.6.0)

| Feature | Description |
|---------|------------|
| `designing-tests` skill | Intent-first test design, test list as planning step, intent comments, boundary selection, quality labels |
| PreToolUse three-tier hook | `writing-plans` (planning tier) / `executing-plans` + `subagent-driven-development` (execution tier) / `test-driven-development` (full tier) |
| 4 reference files | `layer-selection`, `risk-catalog`, `test-case-patterns`, `test-quality-review` |
| Cross-platform dispatcher | `run-hook.cmd` polyglot wrapper |

### Codex track (experimental — ADR-013)

| Feature | Description |
|---------|------------|
| codex-plugins/superpowers-memory v1.11.0 | SessionStart (KB index + standing primer) + UserPromptSubmit (regex on `$superpowers:brainstorming` / `$superpowers:finishing-a-development-branch`) + PreToolUse (matcher `apply_patch\|mcp__filesystem__.*` for KB write-lock); same skills/templates/content-rules as Claude track |
| codex-plugins/superpowers-architect v1.6.2 | Single SessionStart hook: 8 pattern index + fused plan-apply / review-verify meta-rule (no JIT skill dispatch on Codex) |
| codex-plugins/designing-tests v1.6.0 | Single SessionStart hook: 5 execution-tier principles + 4 reference path index; full SKILL.md on demand via `$designing-tests:designing-tests` |
| `setup` skill (per plugin) | Marker-versioned idempotent merge of `codex-hooks-snippet.json` into `~/.codex/hooks.json`; re-runnable after marketplace upgrade |
| Known protocol gaps | Auto-triggered upstream skills get only standing primer (no JIT advisory); agent-self-decided `finishing-a-development-branch` gets no diff evidence; architect plan/review wording fused; designing-tests three-tier collapsed to execution tier |

## In Progress

No features currently in progress.
