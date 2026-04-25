---
last_updated: 2026-04-25
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-25-finishing-rich-injection.md"
---

# Architecture

## System Overview

Skill Workshop is a Claude Code plugin marketplace — a curated collection of plugins that extend Claude Code's capabilities for software development workflows. The repository serves two purposes: (1) it is a marketplace catalog that Claude Code can install plugins from, and (2) it contains the source for each plugin. Each plugin is self-contained under `plugins/<name>/` with its own hooks, skills, and templates. The marketplace definition in `.claude-plugin/marketplace.json` makes the repo discoverable via `/plugin marketplace add`.

## Module Structure

| Module | Responsibility | Key Interfaces | Dependencies |
|--------|---------------|----------------|--------------|
| `.claude-plugin/` | Marketplace catalog definition | `marketplace.json` — lists available plugins and their locations | None |
| `plugins/superpowers-memory/` | Plugin: cross-session project knowledge persistence and plan checkpoint tracking | Skills (`load`, `update`, `rebuild`), Hooks (`session-start`, `pre-tool-use`, `stop`) | Claude Code plugin runtime, Node.js |
| `plugins/superpowers-memory/hooks/` | Hook scripts — thin bash wrappers delegating to `hook-runtime.js` | `hooks.json` declares event bindings; `hook-runtime.js` is the Node.js runtime handling `session-start` / `pre-tool-use` / `user-prompt-expansion` / `stop` / `verify` / `analyze` / `lock` / `unlock` / `lock-status` modes | Node.js, git |
| `plugins/superpowers-memory/skills/` | Three skills for managing the project knowledge base | load, update, rebuild (each in its own subdirectory with `SKILL.md`) | Read by Claude Code skill system |
| `plugins/superpowers-memory/templates/` | Structural templates for the 7 knowledge base file types | `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`, `glossary.md`, `index.md` | None |
| `plugins/superpowers-memory/content-rules.md` | Shared content generation rules for `rebuild` and `update` skills | Language, inclusion/exclusion, SSOT, quality, size guard thresholds | None |
| `plugins/superpowers-architect/` | Plugin: injects design pattern standards into planning, execution, and code review skills | Hook (`pre-tool-use`) | Claude Code plugin runtime, Node.js |
| `plugins/superpowers-architect/hooks/pre-tool-use` | Scans global + project pattern directories and injects compact index into trigger skills | Targets 5 skills; two wording modes (plan vs review); uses `node -e` for JSON parsing | Node.js, bash |
| `plugins/superpowers-architect/design-patterns/` | Reference design pattern files (6 patterns) | `database.md`, `rest-api.md`, `ddd-core.md`, `ddd-golang.md`, `ddd-python.md`, `frontend-patterns.md` | None |
| `plugins/designing-tests/` | Plugin: intent-first test design guidance | Skill (`designing-tests`), Hook (`pre-tool-use`), 4 reference files | Claude Code plugin runtime, Node.js |
| `plugins/designing-tests/hooks/pre-tool-use` | Three-tier test design injection across superpowers workflow | Targets 4 skills; three tiers: planning (`writing-plans`), execution (`executing-plans`, `subagent-driven-development`), full (`test-driven-development`); uses `node -e` for JSON parsing | Node.js, bash |
| `docs/superpowers/` | Design specs and implementation plans for plugins in this repo | `docs/superpowers/specs/`, `docs/superpowers/plans/` — consumed by developers and agents during implementation | None |

## Data Flow

1. **Install:** User runs `/plugin marketplace add jacexh/skill-workshop` → Claude Code reads `.claude-plugin/marketplace.json` → user installs desired plugin
2. **Session start:** Claude Code fires `SessionStart` hook → bash wrapper calls `hook-runtime.js session-start` → if KB missing: "not initialized" prompt; if `index.md` or `MEMORY.md` exists: reads and injects index content as additionalContext; if KB exists but no index: "run rebuild" prompt
3. **Knowledge management:** User or agent invokes `superpowers-memory:rebuild` / `superpowers-memory:update` / `superpowers-memory:load` → agent reads codebase / existing knowledge files → agent writes/updates `docs/project-knowledge/*.md` in the target project
4. **PreToolUse interception (memory):** Claude Code fires `PreToolUse` → `hook-runtime.js pre-tool-use` parses stdin JSON and dispatches by `tool_name`. For `Skill` (fires when the model programmatically invokes the Skill tool): per-skill dispatch via the `skillAdvisory` map. The 4 planning/execution skills get a 1-line advisory; `finishing-a-development-branch` delegates to the shared `classifyFinishingState()` 4-way classifier — on base branch or detached HEAD → `{}` (no-op); KB does not cover HEAD → architect-style rich-context block from `buildFinishingRichContext()` carrying commits + files since `covers_branch@SHA` (excluding `docs/project-knowledge/`) plus imperative "must invoke `superpowers-memory:update` next" (ADR-011); KB covers HEAD → soft reminder. KB-missing block (catastrophic) is gated at the `buildPreToolUseOutput` boundary, before the per-skill dispatch. For `Write` / `Edit` / `MultiEdit` / `NotebookEdit`: if `tool_input.file_path` resolves under `docs/project-knowledge/`, blocks unless `.git/superpowers-memory.lock` is held (60-min TTL; acquired/released only by `superpowers-memory:update` and `superpowers-memory:rebuild`) (ADR-010)

5. **UserPromptExpansion interception (memory):** Claude Code fires `UserPromptExpansion` when the user types `/superpowers:finishing-a-development-branch` directly (which bypasses `PreToolUse:Skill` entirely) → `hook-runtime.js user-prompt-expansion` validates `command_name` ends with `finishing-a-development-branch`, runs the same KB-ready precheck, then delegates to the shared `classifyFinishingState()` so both paths produce identical behavior (ADR-012)
6. **Session end:** Claude Code fires `Stop` → `hook-runtime.js stop` → detects file-level changes outside `docs/project-knowledge/` using git diff (committed since last KB update, staged, unstaged, untracked) → if changes found, emits systemMessage reminder to run `superpowers-memory:update`
7. **Skill interception (designing-tests):** Claude Code fires `PreToolUse` on `Skill` tool calls → `pre-tool-use` bash script → three tiers: `writing-plans` gets brief TDD planning reminder; `executing-plans`/`subagent-driven-development` get condensed test design principles (intent-first, test list, intent comments, boundary selection, quality labels); `test-driven-development` gets full `SKILL.md` body + reference file index
8. **Skill interception (architect):** Claude Code fires `PreToolUse` on `Skill` tool calls → `pre-tool-use` bash script → if skill matches one of 5 triggers (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`), scans `$SP_ARCHITECT_DIR` (global) + project-level pattern directory (overrides by filename) → builds compact index (name + description + path) → injects as additionalContext with plan or review wording

## Key Design Decisions

- **Zero-modification principle:** The plugins never modify superpowers core files; behavior influence is through hook context injection and independent skills (ADR-002)
- **Project-local knowledge base:** `docs/project-knowledge/` lives inside the target project repo, versioned alongside code (ADR-003)
- **Knowledge split into separate files:** Enables surgical incremental updates rather than full rewrites (ADR-003)
- **PreToolUse over SessionStart for KB injection:** Precise injection at skill invocation time maximizes compliance (ADR-004)
- **Index-first progressive loading:** Both memory and architect plugins inject lightweight indexes; full content loaded on demand (ADR-005, ADR-006)
- **Node.js hook runtime:** Replaced bash+python3 with a single `hook-runtime.js` for all superpowers-memory hooks (ADR-007)
- **Evidence-based staleness:** Stop hook uses file-level change detection instead of commit message patterns (ADR-008)
- **KB write-lock:** PreToolUse hook blocks Write/Edit on `docs/project-knowledge/` unless `superpowers-memory:update` or `superpowers-memory:rebuild` holds the lock (ADR-010)
- **Rich injection over hard block for staleness:** Finishing-branch hook uses architect-style rich context (diff scope + imperative MUST) instead of `decision: block` for KB staleness; hard block reserved for catastrophic KB-missing (ADR-011)
- **Dual-path coverage of finishing-a-development-branch:** Both PreToolUse:Skill (programmatic) and UserPromptExpansion (slash-command typed) share a single `classifyFinishingState()` classifier; KB-ready precheck lives at each caller boundary (ADR-012)
