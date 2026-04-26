---
last_updated: 2026-04-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-26-codex-marketplace-compat-plan.md"
---

# Architecture

## System Overview

Skill Workshop is a dual-track plugin marketplace. Each track exposes the same three companion plugins (`superpowers-memory`, `superpowers-architect`, `designing-tests`) to a different host runtime: **Claude Code** via `plugins/` + `.claude-plugin/marketplace.json`, **Codex CLI** via `codex-plugins/` + `.agents/plugins/marketplace.json`. The two trees are independent (Strategy A — full duplication, ADR-013); the Codex track is experimental, and Claude remains the primary supported track. Each plugin is self-contained under its respective `<track>/<name>/` with hooks, skills, and templates.

## Module Structure

| Module | Responsibility | Key Interfaces | Dependencies |
|--------|---------------|----------------|--------------|
| `.claude-plugin/marketplace.json` | Claude marketplace catalog (string `source`) | Discoverable via `/plugin marketplace add` | None |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog (object `source` + `policy` + `category`) | Discoverable via `codex plugin marketplace add` | None |
| `plugins/superpowers-memory/` | Claude track: cross-session project knowledge persistence + KB write-lock | Skills (`load`, `update`, `rebuild`), Hooks (`session-start`, `pre-tool-use`, `user-prompt-expansion`) | Claude Code plugin runtime, Node.js, git |
| `plugins/superpowers-memory/hooks/` | Bash wrappers + `hook-runtime.js` Node.js runtime; `hooks.json` declares event bindings; runtime modes: `session-start` / `pre-tool-use` / `user-prompt-expansion` / `verify` / `lock` / `unlock` / `lock-status` / `analyze` | Stdin JSON in, JSON `hookSpecificOutput` out | Node.js, git |
| `plugins/superpowers-memory/skills/` | Three skills for KB management | `load`, `update`, `rebuild` | Claude Code skill system |
| `plugins/superpowers-memory/templates/` | 7 KB file structural templates | `architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`, `glossary.md`, `index.md` | None |
| `plugins/superpowers-memory/content-rules.md` | Shared content generation rules (SSOT) | Language, inclusion/exclusion, ownership matrix, size guards | None |
| `plugins/superpowers-architect/` | Claude track: design pattern standards injection | Hook (`pre-tool-use`) | Claude Code plugin runtime, Node.js |
| `plugins/superpowers-architect/hooks/pre-tool-use` | Scans global + project pattern dirs, injects compact index into 5 trigger skills with plan/review wording fork | Targets 5 skills; uses `node -e` for JSON parsing; reads YAML frontmatter for name/description | Node.js, bash |
| `plugins/superpowers-architect/design-patterns/` | 8 reference design pattern files | `database.md`, `rest-api.md`, `ddd-core.md`, `ddd-modeling.md`, `ddd-golang.md`, `ddd-python.md`, `ddd-typescript.md`, `frontend-patterns.md` | None |
| `plugins/designing-tests/` | Claude track: intent-first test design guidance | Skill (`designing-tests`), Hook (`pre-tool-use`), 4 reference files | Claude Code plugin runtime, Node.js |
| `plugins/designing-tests/hooks/pre-tool-use` | Three-tier injection across 4 skills: planning / execution / full | Targets `writing-plans` / `executing-plans` / `subagent-driven-development` / `test-driven-development` | Node.js, bash |
| `codex-plugins/superpowers-memory/` | Codex track: equivalent KB persistence + write-lock | Skills (`load`, `update`, `rebuild`, `setup`), Hooks (`session-start`, `user-prompt-submit`, `pre-tool-use`) | Codex CLI plugin runtime, Node.js, git |
| `codex-plugins/superpowers-memory/hooks/codex-runtime.js` | Codex-side runtime: same business logic as Claude `hook-runtime.js`, platform-adapted (no `${CLAUDE_PLUGIN_ROOT}`, `user-prompt-submit` mode replaces `user-prompt-expansion`, PreToolUse matcher checks `apply_patch` and `mcp__filesystem__.*` instead of `Write`/`Edit`/…) | Same JSON protocol, output via `hookSpecificOutput` | Node.js, git |
| `codex-plugins/superpowers-memory/codex-hooks-snippet.json` | Declarative hook config consumed by `setup` skill | Marker-versioned merge into `~/.codex/hooks.json` (ADR-013) | None |
| `codex-plugins/superpowers-architect/` | Codex track: design patterns via single SessionStart hook | Hook + `setup` skill | Codex CLI plugin runtime, Node.js |
| `codex-plugins/superpowers-architect/hooks/codex-runtime.js` | Single `session-start` mode; reads pattern dirs (global + project) and YAML frontmatter; emits 8 pattern index + fused plan-apply / review-verify meta-rule | Output `additionalContext` is always-on standing context (no JIT, ADR-013) | Node.js |
| `codex-plugins/designing-tests/` | Codex track: execution-tier test principles + reference index | Skill (`designing-tests`, copied) + `setup` skill | Codex CLI plugin runtime, Node.js |
| `codex-plugins/designing-tests/hooks/codex-runtime.js` | Single `session-start` mode; emits 5 numbered execution-tier principles + 4 reference path index; full SKILL.md available on demand via `$designing-tests:designing-tests` | Three Claude tiers collapse to execution tier baseline (ADR-013) | Node.js |
| `docs/superpowers/` | Specs and implementation plans | `specs/`, `plans/` — consumed by developers and agents | None |

## Data Flow

1. **Install (Claude):** `/plugin marketplace add jacexh/skill-workshop` → reads `.claude-plugin/marketplace.json` → user installs plugin → hooks auto-active.
2. **Install (Codex):** `codex plugin marketplace add jacexh/skill-workshop` → reads `.agents/plugins/marketplace.json` → user installs plugin → user invokes `$<plugin>:setup` skill → setup writes plugin's `codex-hooks-snippet.json` block into `~/.codex/hooks.json` with version marker → user restarts Codex → hooks active.
3. **Codex upgrade flow:** `codex plugin marketplace upgrade` updates plugin files only — does **not** touch `~/.codex/hooks.json`. User must rerun `$<plugin>:setup`; the setup skill detects the marker version and replaces the old block (idempotent).
4. **Session start (Claude):** SessionStart hook → reads `index.md`, injects via `additionalContext`.
5. **Session start (Codex memory):** SessionStart hook → injects KB index + standing primer (4 rules covering KB workflow). Standing primer compensates for absence of per-skill JIT (ADR-013).
6. **Knowledge management:** `superpowers-memory:rebuild` / `update` / `load` agent reads codebase / existing KB → writes/updates `docs/project-knowledge/*.md`. Same skill content on both tracks.
7. **PreToolUse interception (Claude memory):** parses stdin → dispatches by `tool_name`. For `Skill`: per-skill advisory + `classifyFinishingState()` 4-way classifier when skill is `finishing-a-development-branch`. For `Write`/`Edit`/`MultiEdit`/`NotebookEdit` under `docs/project-knowledge/`: blocks unless write-lock held (ADR-010).
8. **UserPromptExpansion interception (Claude memory):** matcher `finishing-a-development-branch` → same `classifyFinishingState()` classifier (ADR-012). Covers slash-typed path that bypasses `PreToolUse:Skill`.
9. **UserPromptSubmit interception (Codex memory):** regex on `prompt` field — `$superpowers:brainstorming` → load advisory; `$superpowers:finishing-a-development-branch` → KB-ready precheck → same `classifyFinishingState()` classifier reused with `eventName="UserPromptSubmit"` (ADR-013). Agent-self-decided invocation is uncoverable on Codex (documented gap).
10. **PreToolUse interception (Codex memory):** matcher `apply_patch|mcp__filesystem__.*` → `resolveTargetPath()` extracts path from `tool_input.{file_path,path,patch}` → blocks if path under `docs/project-knowledge/` and lock not held (ADR-010 carries over; same lock file `.git/superpowers-memory.lock`).
11. **Skill interception (architect Claude / designing-tests Claude):** PreToolUse:Skill on trigger skills → injects pattern index or test-design tier text.
12. **SessionStart interception (architect Codex / designing-tests Codex):** single hook event → injects pattern index + fused meta-rule (architect) or execution-tier principles + reference index (designing-tests). No skill-call JIT available on Codex (ADR-013).

## Key Design Decisions

- **Zero-modification principle:** Plugins never modify upstream `superpowers` files — behavior influence via hook context injection only (ADR-002).
- **Project-local knowledge base:** `docs/project-knowledge/` lives inside the target project repo, versioned alongside code (ADR-003).
- **Knowledge split into separate files:** Enables surgical incremental updates (ADR-003).
- **PreToolUse over SessionStart for KB injection (Claude):** Precise injection at skill invocation time maximizes compliance (ADR-004).
- **Index-first progressive loading:** Both plugins inject lightweight indexes; full content loaded on demand (ADR-005, ADR-006).
- **Node.js hook runtime:** Single `hook-runtime.js` for all superpowers-memory hooks (ADR-007).
- **Evidence-based staleness (Claude):** Now via per-skill PreToolUse advisories pointing to `load`/`update`; the previous Stop-hook-based detection was removed in commit `e6153b8` because per-turn firing produced noise rather than signal.
- **KB write-lock:** PreToolUse blocks edits to `docs/project-knowledge/` unless `update`/`rebuild` holds the lock (ADR-010).
- **Rich injection over hard block for staleness:** Finishing-branch hook returns architect-style rich context (diff scope + imperative MUST) instead of `decision: block`; hard block reserved for catastrophic KB-missing (ADR-011).
- **Dual-path coverage of finishing-a-development-branch (Claude):** PreToolUse:Skill (programmatic) and UserPromptExpansion (slash-command) share `classifyFinishingState()`; KB-ready precheck at each caller (ADR-012).
- **Codex marketplace compat — Strategy A:** Parallel `codex-plugins/` tree with full duplication; Codex track is experimental; setup-skill pattern handles `~/.codex/hooks.json` registration with marker version (ADR-013).
