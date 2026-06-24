---
name: query
description: Use before exploring the codebase, planning, architecture decisions, broad search, or answering project questions — reads Project Knowledge Base and answers from it without writing
---

# Query Project Knowledge

Read `docs/project-knowledge/` to answer a concrete project question. This skill is read-only.
When no concrete question is supplied, use this skill for orientation: read `index.md`, then the smallest useful owner files before planning or exploration.

**Announce at start:** "I'm querying the project knowledge base."

## Process

1. If `docs/project-knowledge/` does not exist, tell the user: "Project knowledge base not initialized. Run superpowers-memory:ingest bootstrap to create it."
2. Read `docs/project-knowledge/index.md`. If it does not exist, fall back to reading the canonical owner files that exist.
3. Normalize the user question into likely project terms and aliases.
4. Select the smallest useful set of owner files or shards, normally 1-3.
5. If the index is insufficient, search `docs/project-knowledge/` for the terms and aliases.
6. Read candidate owner entries.
7. Follow `See:`, `Related:`, ADR, spec, plan, or source references only when evidence is not yet sufficient.
8. Stop when at least one owner entry answers the question, linked references do not contradict it, and the answer can name its source.

## Output

```markdown
Answer:
[Direct answer grounded in project knowledge.]

Sources read:
- docs/project-knowledge/index.md
- docs/project-knowledge/<owner>.md

Confidence:
[High | Medium | Low] - [short reason]

Next:
[Optional source files or actions.]

Memory candidate:
[Optional one-paragraph candidate only when a durable fact is missing, stale, or contradictory.]
```

## Skip Conditions

Skip this skill for trivial local commands, exact narrow edits where the file is already known, pure formatting, or a follow-up in the same area when project knowledge was queried recently and nothing material changed.

## Related Skills

- Use `superpowers-memory:ingest` to write Memory candidates or update the Project Knowledge Base.
- Use `superpowers-memory:lint` to check knowledge health without answering a task question.
