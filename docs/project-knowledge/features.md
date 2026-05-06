---
last_updated: 2026-05-06
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Features

## Implemented

### Marketplace catalogs

| Feature | Description |
|---------|------------|
| Claude marketplace | `.claude-plugin/marketplace.json` — 3 plugins, discoverable via `/plugin marketplace add jacexh/skill-workshop` |
| Codex marketplace (experimental) | `.agents/plugins/marketplace.json` — 3 codex-plugins, object-form `source` + `policy` + `category`; discoverable via `codex plugin marketplace add jacexh/skill-workshop` (ADR-013) |
| GitHub Actions release | PR-merge auto release: computes repository tag, detects changed plugin paths, bumps matching manifests/native hooks/fallback snippets, commits the bump, tags, and publishes a GitHub Release |

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
| Native Codex hooks | Each Codex plugin manifest declares a plugin-local lifecycle hook file; Codex loads it from the plugin root after restart when `[features] codex_hooks = true` (ADR-014) |
| codex-plugins/superpowers-memory | SessionStart (KB index + standing primer) + UserPromptSubmit (regex on `$superpowers:brainstorming` / `$superpowers:finishing-a-development-branch`) + PreToolUse (matcher `apply_patch\|mcp__filesystem__.*` for KB write-lock); same skills/templates/content-rules as Claude track |
| codex-plugins/superpowers-architect | SessionStart pattern index + fused meta-rule; UserPromptSubmit router for explicit upstream `superpowers` workflow skill mentions; narrow Stop continuation gate for obvious plan/implementation/review answers missing a standards judgment; `$superpowers-architect:standards` explicit workflow; project design-pattern directories override globals/defaults |
| codex-plugins/designing-tests | Single SessionStart hook: 5 execution-tier principles + 4 reference path index; full SKILL.md on demand via `$designing-tests:designing-tests` |
| `setup` skill (per plugin) | Compatibility fallback for older Codex builds or failed native hook loading; installer prefers the native hook file, writes strict `~/.codex/hooks.json`, removes stale runtime paths for that plugin, and preserves unrelated hooks |
| Known protocol gaps | Auto-triggered upstream skills still lack true PreToolUse:Skill JIT; architect compensates with native SessionStart, explicit skill mentions, explicit standards skill, and narrow Stop continuation; designing-tests three-tier collapsed to execution tier; agent-self-decided `finishing-a-development-branch` gets no diff evidence |

## In Progress

No features currently in progress.
