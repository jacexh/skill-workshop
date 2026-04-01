# Design Spec: MEMORY.md as Project Knowledge Index

**Date:** 2026-04-01
**Status:** Draft
**Related plugin:** `superpowers-memory`

---

## Problem

The current KB workflow requires the agent to read all 5 knowledge files (`architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`) every time context is needed. There is no lightweight entry point that tells the agent *what is in* the KB and *which files are relevant* for the current task. Additionally, the `session-start` hook injects nothing when the KB is initialized (`{}`), missing an opportunity to give the agent passive KB awareness at session start.

---

## Solution

Introduce `docs/project-knowledge/MEMORY.md` as a structured index file that:

1. Lists all 5 knowledge files with a one-line description and 2-3 key points each
2. Is written (and kept current) by `rebuild` and `update` skills
3. Is injected by the `session-start` hook into every session where the KB is initialized
4. Is the mandatory first read for `pre-tool-use` hook messages, with on-demand loading of the 5 detail files

---

## MEMORY.md Format

File location: `docs/project-knowledge/MEMORY.md`

**Size constraint:** Keep under 30 lines to minimize session-start token cost.

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: <plan-filename-or-null>
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System overview, module structure, data flow
  Key points: [e.g., Plugin Marketplace pattern; PreToolUse + Stop + SessionStart hooks; zero-modification principle]

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: [e.g., Bash + Markdown + JSON; python3 for stdin parsing; no external dependencies]

- [features.md](features.md) — Implemented features, in-progress work
  Key points: [e.g., 3 hooks (SessionStart, PreToolUse, Stop); 3 skills (load, update, rebuild); current version]

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: [e.g., set -euo pipefail in all hooks; no external deps rule; conventional commits]

- [decisions.md](decisions.md) — ADR log, known issues
  Key points: [e.g., ADR-004 PreToolUse precise injection; ADR-002 zero-modification principle]
```

---

## Changes by Component

### `rebuild` skill

Add a new final step after generating the 5 knowledge files:

- Scan the 5 generated files, extract 2-3 key points per file
- Write `docs/project-knowledge/MEMORY.md` using the format above
- Set frontmatter: `last_updated`, `updated_by: superpowers-memory:rebuild`, `triggered_by_plan: null`
- Include `MEMORY.md` in the git commit

### `update` skill

Add a new final step after updating changed knowledge files:

- Regenerate `MEMORY.md` in full (full overwrite — any file's key points may have changed)
- Set frontmatter: `last_updated`, `updated_by: superpowers-memory:update`, `triggered_by_plan: <plan-name>`
- Include `MEMORY.md` in the git commit

### `load` skill

Change from "always read all 5 files" to a two-phase approach:

**Phase 1 — Index:**
1. Check if `MEMORY.md` exists
2. If yes: read and present the index as the initial overview
3. If no (legacy project without MEMORY.md): fall back to reading all 5 files directly (existing behavior)

**Phase 2 — On-demand detail:**
- After presenting the index, state: "I can load any of these files in full if the current task requires it."
- Load specific files based on task context or user request

### `session-start` hook

```
if docs/project-knowledge/ does not exist:
    → output "not initialized" prompt (unchanged)
elif docs/project-knowledge/MEMORY.md exists:
    → read MEMORY.md content, inject as additionalContext
else:
    → output {}  (KB exists but no index yet — silent fallback)
```

The injected context gives the agent passive KB awareness from session start without requiring an explicit `load` invocation.

### `pre-tool-use` hook

The `fresh` state messages for `superpowers:brainstorming` and `superpowers:writing-plans` are updated to explicitly require reading `MEMORY.md` first:

**Before (fresh):**
```
Before brainstorming, you MUST read docs/project-knowledge/ to understand
the current architecture, tech stack, conventions, and decisions.
```

**After (fresh):**
```
Before brainstorming, you MUST read docs/project-knowledge/MEMORY.md
to get the project knowledge index, then load any relevant files listed
there before proceeding.
```

**Rationale:** Session-start injection is best-effort (agent may not have absorbed it). The pre-tool-use message is the authoritative instruction — it must be explicit and actionable. Both layers are complementary: session-start provides passive awareness; pre-tool-use enforces the read at the critical moment.

`stale` state prepends a warning before the same instruction:
```
WARNING: The knowledge base may be behind the current codebase.
Consider running superpowers-memory:update first.
You MUST read docs/project-knowledge/MEMORY.md ...
```

`not_initialized` state is unchanged.

---

## Migration

Projects that already have `docs/project-knowledge/` but no `MEMORY.md` are handled gracefully:

- `session-start`: falls back to `{}` (silent, no disruption)
- `load`: falls back to reading all 5 files (existing behavior)
- `pre-tool-use`: still points to `MEMORY.md` — agent will find it missing and read individual files instead; the next `update` or `rebuild` run will generate it

No breaking changes. Existing projects get full benefit after the next `update` or `rebuild` run.

---

## Out of Scope

- Using `MEMORY.md` as the sole source of truth (the 5 detail files remain authoritative)
- Auto-generating `MEMORY.md` from the `load` skill (load is read-only)
- Injecting full file contents at session-start (only the index is injected)
