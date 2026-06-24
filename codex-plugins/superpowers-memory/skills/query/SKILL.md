---
name: query
description: Use before exploring the codebase, planning, architecture decisions, broad search, or answering project questions — reads Project Knowledge Base and answers from it without writing
---

# Query Project Knowledge

Read `docs/superpowers/memory/` to answer a concrete project question. This skill is read-only after the one-time legacy migration check.
When no concrete question is supplied, use this skill for orientation: read `index.md`, then the smallest useful owner files before planning or exploration.

**Announce at start:** "I'm querying the project knowledge base."

## Process

1. Run the legacy hard-migration check. If `docs/project-knowledge/` exists and `docs/superpowers/memory/` does not exist, run:

```bash
mkdir -p docs/superpowers
git mv docs/project-knowledge docs/superpowers/memory
```

If both directories exist, stop and report the path conflict instead of merging.
2. If `docs/superpowers/memory/` does not exist, tell the user: "Project knowledge base not initialized. Run superpowers-memory:ingest bootstrap to create it."
3. Read `docs/superpowers/memory/index.md`. If it does not exist, fall back to reading the canonical owner files that exist.
4. Normalize the user question into likely project terms and aliases.
5. Select the smallest useful set of owner files or shards, normally 1-3.
6. If the index is insufficient, search `docs/superpowers/memory/` for the terms and aliases.
7. Read candidate owner entries.
8. Follow `See:`, `Related:`, ADR, spec, plan, or source references only when evidence is not yet sufficient.
9. Stop when at least one owner entry answers the question, linked references do not contradict it, and the answer can name its source.
10. If no owner entry directly answers a durable project question, answer with low confidence from the best evidence and emit a structured Memory candidate for `ingest`.
11. If the answer creates a durable synthesis, comparison, or analysis that is likely to be reused, emit a structured Memory candidate even when the current answer is complete.
12. conversation is not a KB slot: do not suggest `conversation.md`. If the reusable fact came from chat/transcript context, route the Memory candidate to a spec/plan/ADR first when appropriate, or to the existing owner file that owns the durable fact.

## Output

```markdown
Answer:
[Direct answer grounded in project knowledge.]

Sources read:
- docs/superpowers/memory/index.md
- docs/superpowers/memory/<owner>.md

Confidence:
[High | Medium | Low] - [short reason]

Next:
[Optional source files or actions.]

Memory candidate:
[Optional; include only when a durable fact is missing, stale, contradictory, not directly answerable, or when a reusable durable synthesis should be preserved.]
- Candidate type: <answerability gap | stale fact | contradiction | durable synthesis>
- Missing answerability coverage: <question or high-value object not directly answered>
- Suggested owner/shard: docs/superpowers/memory/<owner-or-shard>.md
- Candidate outline: <durable facts to add: system topology, service card, scenario sequence, responsibility, layers/components, interactions, state/flow/invariants, source refs>
- Source refs: <spec/plan/ADR/doc/source paths to validate; chat/transcript only as weak source when no durable source exists>
```

## Skip Conditions

Skip this skill for trivial local commands, exact narrow edits where the file is already known, pure formatting, or a follow-up in the same area when project knowledge was queried recently and nothing material changed.

## Related Skills

- Use `superpowers-memory:ingest` to write Memory candidates or update the Project Knowledge Base.
- Use `superpowers-memory:lint` to check knowledge health without answering a task question.
