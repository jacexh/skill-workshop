# superpowers-architect Plugin Design

## Goal

A Claude Code plugin that automatically injects relevant architectural design patterns as hard constraints when Claude is writing plans, executing code, or performing code reviews — so every plan and implementation stays consistent with team-defined standards without any manual steps.

## Problem Statement

The `writing-plans` skill produces detailed implementation plans, but it has no awareness of project-specific or team-wide design standards (e.g., database conventions, API design rules, architecture boundaries). Engineers must either rely on memory or manually paste standards into prompts. This leads to inconsistent plans and code that doesn't follow agreed-upon patterns.

## Solution Overview

A `pre-tool-use` hook plugin that uses **progressive loading** to inject patterns efficiently:

**Stage 1 — Hook injects index only** (minimal tokens):
- Intercepts targeted skill invocations
- Scans a two-layer patterns directory (global user patterns + project-level overrides)
- Injects only `name + description + path` for each pattern — never the full body

**Stage 2 — Claude loads full content on demand**:
- Claude reads the current task/spec context and decides which patterns are relevant
- Uses the `Read` tool to load only the relevant pattern files in full
- Irrelevant patterns are never loaded — their content never enters the context window

This avoids dumping all pattern content into every prompt. Ten pattern files costs the same index tokens regardless; only the files actually needed contribute body tokens.

Claude decides which patterns are relevant — no config files, no tag matching, no manual activation.

---

## Plugin Structure

```
plugins/superpowers-architect/
  .claude-plugin/
    plugin.json
  hooks/
    hooks.json
    pre-tool-use
  design-patterns/                         ← Example patterns only (not loaded, for reference)
    database.md
    rest-api.md
    architecture.md
  README.md
```

The plugin's `design-patterns/` directory ships example patterns for reference. It is **not** loaded by the hook — patterns stored here would be overwritten on plugin updates.

### Global Patterns Directory

User-maintained global patterns are stored outside the plugin directory, configurable via environment variable:

```
SP_ARCHITECT_DIR
  Default: ~/.claude/superpowers-architect/design-patterns/
```

Set this in `~/.zshrc` / `~/.bashrc` to point to any directory:

```bash
export SP_ARCHITECT_DIR="$HOME/.claude/superpowers-architect/design-patterns/"
```

### Project-Level Overrides

Projects place their patterns in `docs/design-patterns/` at the repo root:

```
<project>/
  docs/design-patterns/
    database.md           ← Overrides global database.md
    event-sourcing.md     ← Project-specific, no global equivalent
```

### Priority Order

```
High  <project>/docs/design-patterns/                       ← project-level (highest)
      $SP_ARCHITECT_DIR                     ← user global (default: ~/.claude/superpowers-architect/design-patterns/)
Low   plugins/superpowers-architect/design-patterns/        ← examples only, NOT loaded
```

---

## Pattern File Format

Each pattern file uses frontmatter for index metadata and Markdown for content:

```markdown
---
name: Database Design Standards
description: Table schema conventions, index strategy, migration rules
---

## Rules

- All tables MUST have `created_at` and `updated_at` timestamp columns
- Primary keys use UUID v4
- ...
```

Only `name` and `description` are required in frontmatter. The body is natural-language constraints read directly by Claude.

---

## Merge & Override Logic

When the hook runs:

1. Resolve global dir: `$SP_ARCHITECT_DIR` (default `~/.claude/superpowers-architect/design-patterns/`)
2. Scan global dir `*.md` → global files
3. Scan `<project>/docs/design-patterns/*.md` → project files
4. Merge: project files override global files with the **same filename**; files unique to either layer are kept as-is

Example:

```
Global:   database.md  rest-api.md  architecture.md
Project:  database.md  event-sourcing.md

Merged:
  database.md       ← project version (overrides global)
  rest-api.md       ← global version
  architecture.md   ← global version
  event-sourcing.md ← project-specific
```

---

## Hook Behavior

### Trigger Conditions

The hook fires on these skills:

| Skill | Injection Purpose |
|---|---|
| `superpowers:writing-plans` | Apply standards when designing the plan |
| `superpowers:executing-plans` | Apply standards during inline execution |
| `superpowers:subagent-driven-development` | Apply standards in subagent execution |
| `superpowers:requesting-code-review` | Check code against standards |
| `superpowers:receiving-code-review` | Apply standards when acting on review feedback |

For all other skills, the hook exits immediately with `{}`.

### Injected Context — Planning / Execution

```
══════ Architect Standards ══════
The following design patterns define hard constraints for this codebase.
Read any that are relevant to the current task and apply them strictly
before writing the plan or generating code.

- [Database Design Standards]
  Table schema conventions, index strategy, migration rules
  Path: ~/.claude/superpowers-architect/design-patterns/database.md

- [REST API Design Standards]
  RESTful naming, status codes, pagination conventions
  Path: ~/.claude/superpowers-architect/design-patterns/rest-api.md

- [Event Sourcing Standards]  ← project-specific
  Event modeling, aggregate root design rules
  Path: docs/design-patterns/event-sourcing.md

If none are relevant to the current task, skip.
══════════════════════════════════
```

### Injected Context — Code Review

```
══════ Architect Standards ══════
The following design patterns define the hard constraints for this codebase.
Read any that are relevant and use them as the review criteria.

[same index format as above]
══════════════════════════════════
```

### No Patterns Found

If both directories are empty or missing, the hook exits with `{}` (no injection).

---

## Implementation Notes

### Hook Script Logic (pre-tool-use)

```
1. Parse stdin JSON → extract tool_input.skill
2. Check if skill is in the trigger list; if not, exit {}
3. Determine skill_type: "review" or "plan"
4. Resolve global_dir: $SP_ARCHITECT_DIR or ~/.claude/superpowers-architect/design-patterns/
5. Scan global_dir/*.md → global files
6. Scan <project>/docs/design-patterns/*.md → project files
7. Merge: build map of filename → path, project takes priority
8. For each file in merged map:
   a. Extract frontmatter name + description via python3
   b. Add entry to index
9. If index is empty, exit {}
10. Build additionalContext string (with wording based on skill_type)
11. Output JSON with hookSpecificOutput.additionalContext
```

### Dependencies

- `bash` + `python3` (frontmatter parsing via stdin) — no external deps, consistent with project conventions
- `git` not required (pattern files are static)

---

## What This Is Not

- **Not a skill** — no user-invoked commands needed; the hook runs automatically
- **Not config-driven** — no `config.json`, no tag activation, no manual setup per project
- **Not a superpowers-memory extension** — separate concern: memory tracks *what the project is*, architect enforces *how it should be built*

---

## Out of Scope (MVP)

- A `superpowers-architect:init` skill for interactive setup (can be added later)
- Pattern validation or linting
- Conditional injection based on changed files (git diff)
- Support for non-Markdown pattern formats
