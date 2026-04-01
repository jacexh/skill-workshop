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
   - Check if `docs/project-knowledge/MEMORY.md` exists
   - If yes: read `docs/project-knowledge/MEMORY.md` and display its complete contents verbatim as the initial overview (see Output Format below)
   - If no (legacy project without MEMORY.md): skip to Phase 2 and read all 5 files directly

3. **Phase 2 — On-demand detail:**
   - After presenting the index (or after reading all 5 files in legacy mode), check `last_updated` in each file's frontmatter. If any file is older than 30 days, warn: "⚠ [filename] last updated on [date], consider running superpowers-memory:update to refresh."
   - State: "I can load any of these files in full if the current task requires it."
   - Load specific files based on task context (e.g., load `architecture.md` before brainstorming a structural change, load `decisions.md` before writing a new ADR)

### Output Format (MEMORY.md present)

```
## Project Knowledge Index

[MEMORY.md content displayed as-is]

---
Ready to load detail files on demand. Which areas are relevant to your current task?
```

### Output Format (legacy — no MEMORY.md)

```
## Project Knowledge Overview

### Architecture
[Key points from architecture.md: system overview, module structure]

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
