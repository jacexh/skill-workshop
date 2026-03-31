---
name: load
description: Use when starting brainstorming or needing to understand current project state — reads project knowledge base and presents structured context
---

# Load Project Knowledge

Read the project knowledge base from `docs/project-knowledge/` and present a structured summary so you can quickly understand the current project state.

**Announce at start:** "I'm loading the project knowledge base."

## Process

1. Check if `docs/project-knowledge/` exists
   - If not: tell the user "Project knowledge base not initialized. Please run superpowers-memory:rebuild to generate from codebase first." and stop
2. Read all 5 knowledge files:
   - `docs/project-knowledge/architecture.md`
   - `docs/project-knowledge/tech-stack.md`
   - `docs/project-knowledge/features.md`
   - `docs/project-knowledge/conventions.md`
   - `docs/project-knowledge/decisions.md`
3. Check `last_updated` in each file's frontmatter. If any file is older than 30 days, warn: "⚠ [filename] last updated on [date], consider running superpowers-memory:update to refresh."
4. Present a structured summary:

### Output Format

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
