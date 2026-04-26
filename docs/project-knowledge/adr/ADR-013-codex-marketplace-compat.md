---
adr: 013
title: Strategy A — parallel codex-plugins/ tree for Codex marketplace compatibility
status: Accepted
date: 2026-04-26
---

## Context

OpenAI Codex CLI introduced a plugin / hook / skill system in 2026. Codex users can install upstream `superpowers` and inherit its skills (`brainstorming`, `writing-plans`, `finishing-a-development-branch`, …), but the three companion plugins in this repository (`superpowers-memory`, `superpowers-architect`, `designing-tests`) have no Codex-side counterpart. The decision: how to ship Codex-compatible variants without breaking the Claude Code track.

Codex protocol differs in three load-bearing ways:
1. Plugins **cannot** carry hook configs — hooks live in `~/.codex/hooks.json` (or repo `.codex/hooks.json`), not in plugin directories.
2. `PreToolUse` matcher does **not** intercept skill calls — only `Bash`, `apply_patch`, MCP tool names. The Claude-side per-skill JIT injection is unportable.
3. Codex has `UserPromptSubmit` (raw user prompt text, not expanded slash) but **no** `UserPromptExpansion`; `Stop` fires per assistant turn (not session end).

Skill triggering also differs: Codex agents auto-trigger most upstream skills (`writing-plans`, `executing-plans`, `requesting-code-review`, …) but two skills (`brainstorming`, `finishing-a-development-branch`) are typically user-typed via `$plugin:skill` mention syntax.

## Decision

**Strategy A — parallel `codex-plugins/` tree, full duplication, Claude side untouched, experimental.**

Concretely:
- A new `codex-plugins/` directory at repo root parallels `plugins/`. Each Codex plugin is a self-contained subtree mirroring the Claude layout, with platform-specific changes only.
- A new Codex marketplace catalog at `.agents/plugins/marketplace.json` (object-form `source`, `policy`, `category` per Codex schema) coexists with `.claude-plugin/marketplace.json`.
- Each Codex plugin ships `skills/setup/SKILL.md` — agent instructions for marker-versioned idempotent merge of the plugin's `codex-hooks-snippet.json` into `~/.codex/hooks.json`. Re-running setup is the upgrade path (Codex marketplace upgrade does **not** modify hook config).
- Coverage strategy maps to Codex's actual primitives:
  - Auto-triggered upstream skills → `SessionStart` primer (always present, decay-tolerant standing rules)
  - Manually-typed upstream skills → `UserPromptSubmit` regex on `prompt` field (`$superpowers:brainstorming`, `$superpowers:finishing-a-development-branch`)
  - KB write-lock → `PreToolUse` with matcher `apply_patch|mcp__filesystem__.*`

## Alternatives Rejected

**B — Shared `shared/` core + thin platform adapters.** Move platform-independent assets (`hook-runtime.js` business logic, templates, content-rules, design patterns, references) into a top-level `shared/` directory; `plugins/<name>/` and `codex-plugins/<name>/` become thin shells referencing them. Honors SSOT (`content-rules.md` rule), eliminates drift risk for ~2,000 lines of asset content. **Rejected** because it requires modifying the existing Claude tree (extracting assets and updating import paths) — incompatible with the user's stated constraint that the experimental Codex track must not destabilize the production Claude track.

**C — Codex tree references Claude tree directly.** `codex-plugins/<name>/skills/` symlinks or relative-imports `../../plugins/<name>/skills/`; runtime under codex-plugins/ delegates to Claude's `hook-runtime.js` via cross-tree `require()`. Zero duplication. **Rejected** because (a) symlinks are unreliable on Windows (cross-platform constraint per `conventions.md`), (b) coupling direction inverts — Codex now binds Claude tree's internal structure, so Claude refactors can break Codex silently.

## Consequences

**Acceptable:**
- ~2,000 lines of asset content + ~700 lines of runtime logic exist twice. Drift is now possible and must be detected by other means (a future shared-source extraction can reverse this if the Codex track graduates from experimental).
- Three Codex protocol gaps are documented and accepted: (1) auto-triggered planning skills get only standing primer, no JIT advisory; (2) agent-self-decided `finishing-a-development-branch` invocation gets no diff evidence; (3) architect's plan/review wording fork collapses to a fused meta-rule in SessionStart.
- Codex `Stop` hook is per-turn, not per-session — would create reminder spam if implemented. Memory plugin's Codex variant ships **without** a Stop hook (Claude side already removed it in commit `e6153b8` for the same reason).
- Setup UX requires user to invoke `$plugin:setup` explicitly after install/upgrade. There is no auto-injection into `~/.codex/hooks.json`.

**Validated by source inspection of `openai/codex@main`:**
- `UserPromptSubmit.prompt` is raw user text (no slash expansion) — verified via `codex-rs/protocol/src/items.rs::UserMessageItem::message`.
- Skill mentions are detected post-hook by `collect_explicit_skill_mentions` (`codex-rs/core-skills/src/injection.rs`) — not surfaced as `PreToolUse` events.
- Marketplace upgrade is manual via `codex plugin marketplace upgrade [name]` (`codex-rs/cli/src/marketplace_cmd.rs`) — no auto-sync for user-added marketplaces.

**Reversal cost:** If the Codex track graduates from experimental, migrating to Strategy B (shared core) is a one-shot refactor — extract `shared/`, point both trees at it. The cost grows with how much the two trees drift in the meantime.
