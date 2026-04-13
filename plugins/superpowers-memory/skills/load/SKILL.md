---
name: load
description: Use before exploring the codebase, brainstorming, or making architectural decisions — reads project knowledge base so you understand the project before touching files or directories
---

# Load Project Knowledge

Read the project knowledge base from `docs/project-knowledge/` and present a structured summary so you can quickly understand the current project state.

**Announce at start:** "I'm loading the project knowledge base."

## Process

1. Check if `docs/project-knowledge/` exists
   - If not: tell the user "Project knowledge base not initialized. Please run superpowers-memory:rebuild to generate from codebase first." and stop

2. **Phase 1 — Index:**
   - Check if `docs/project-knowledge/index.md` exists
   - If yes: read `docs/project-knowledge/index.md` and display its complete contents verbatim as the initial overview (see Output Format below)
   - If no: check for legacy `docs/project-knowledge/MEMORY.md` (older versions used this name) and use it instead
   - If neither exists: skip to Phase 2 and read all files directly

3. **Phase 2 — Staleness check + on-demand detail:**

   **Staleness check:**
   For each knowledge file, read `last_updated` from frontmatter. Use two-tier detection (excluding the KB directory itself):

       # Tier 1: conventional commits (precise signal)
       git log --oneline --since="<last_updated>" -E -i --grep="^(feat|refactor)" --no-merges -- . ':!docs/project-knowledge' | wc -l

       # Tier 2: if tier 1 returns 0, fall back to total commit count
       git log --oneline --since="<last_updated>" --no-merges -- . ':!docs/project-knowledge' | wc -l

   - Tier 1 ≥ 5 → warn: "⚠ [filename] may be stale — N feat/refactor commits since last update on [date]. Consider running superpowers-memory:update."
   - Tier 1 = 0 AND tier 2 ≥ 20 → warn: "⚠ [filename] may be stale — N commits since last update on [date]. Consider running superpowers-memory:update."
   - Otherwise → no warning

   **On-demand detail:**
   - State: "I can load any of these files in full if the current task requires it."
   - Load specific files based on task context using this mapping:
     - Brainstorming a structural change or new module → `architecture.md`
     - Writing or evaluating an ADR → `decisions.md`
     - Adding a dependency or changing the build → `tech-stack.md`
     - Implementing a new feature or checking what's done → `features.md`
     - Setting up conventions, hooks, or workflow rules → `conventions.md`
     - Understanding domain terminology → `glossary.md` (skip if file does not exist — older knowledge bases may not have it)
     - If the task spans multiple areas, load all relevant files before proceeding.

### Output Format (index.md present)

```
## Project Knowledge Index

[index.md content displayed as-is]

---
Ready to load detail files on demand. Which areas are relevant to your current task?
```

### Output Format (legacy — no index.md)

```
## Project Knowledge Overview

### Architecture
[Key points from architecture.md: system boundaries, components]

### Tech Stack
[Key points from tech-stack.md: primary languages, frameworks, key dependencies]

### Implemented Features
[Summary from features.md: feature count, recent features, in-progress items]

### Design Constraints & Conventions
[Key rules from conventions.md: must-follow constraints, testing strategy]

### Key Decisions
[Recent decisions from decisions.md: latest 3-5 ADRs with status]
```

## After Loading

After presenting the summary, proceed with the task at hand (typically brainstorming). The loaded knowledge should inform your design decisions — reference specific constraints, existing patterns, and architectural choices from the knowledge base.

## Related Skills

- Run `superpowers-memory:rebuild` first if `docs/project-knowledge/` does not exist.
- Run `superpowers-memory:update` after completing a development branch to keep the knowledge base current.
