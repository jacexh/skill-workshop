---
name: query
description: Use before exploring the codebase, planning, architecture decisions, broad search, or answering project questions — reads Project Knowledge Base and answers from it without writing
---

# Query Project Knowledge

Read `docs/superpowers/memory/` to answer a concrete project question or to route follow-up code exploration. This skill is read-only after the one-time legacy migration check.
When no concrete question is supplied, use this skill for orientation: read `index.md`, classify likely project areas, then load only the smallest useful owner files before planning or exploration.

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
4. Run **Question classification** before opening owner files:
   - `exact-code`: exact symbol, exact path, compiler/test error, stack trace, or implementation detail. Prefer direct code search; use memory only for nearby constraints.
   - `architecture-or-constraint`: service boundaries, ownership, flows, rules, "why", or "what should I avoid". Use memory first.
   - `implementation-routing`: change request where files are unknown. Use memory to narrow code targets, then search source refs.
   - `term-or-alias`: vocabulary, renamed object, tombstone, or acronym. Search glossary/alias entries first; do not read the whole glossary unless needed.
   - `decision-or-history`: ADR, trade-off, supersession, or rationale. Route through decision summaries and at most the matching ADR detail file.
   - `orientation`: no concrete question. Read index plus 1-2 owner/router files that explain current project shape.
5. Normalize the question into likely project terms and aliases. Use glossary entries as alias expansion, not as a default context dump.
6. Build a **Retrieval route** before reading details:
   - Candidate owner/shard files from `index.md`, parent owner files, and aliases.
   - Candidate source refs for follow-up code search.
   - Explicit **Skipped** large files, especially `decisions.md` or `glossary.md`, when the question can be routed to a shard, ADR detail, owner file, or direct source search.
7. Select the smallest useful set of owner files or shards, normally 1-3.
8. If the index is insufficient, search `docs/superpowers/memory/` for terms and aliases. Prefer targeted `rg` hits over opening a large root file.
9. Read candidate owner entries.
10. Follow `See:`, `Related:`, ADR, spec, plan, or source references only when evidence is not yet sufficient. Default to one hop; take a second hop only for contradiction, low confidence, or missing source refs.
11. Stop when at least one owner entry answers the question or when the route has produced enough code search seeds for the next step. Linked references must not contradict the answer.
12. If no owner entry directly answers a durable project question, answer with low confidence from the best evidence and emit a structured Memory candidate for `ingest`.
13. If the answer creates a durable synthesis, comparison, or analysis that is likely to be reused, emit a structured Memory candidate even when the current answer is complete.
14. conversation is not a KB slot: do not suggest `conversation.md`. If the reusable fact came from chat/transcript context, route the Memory candidate to a spec/plan/ADR first when appropriate, or to the existing owner file that owns the durable fact.

## Output

```markdown
Question classification:
[exact-code | architecture-or-constraint | implementation-routing | term-or-alias | decision-or-history | orientation] - [why]

Retrieval route:
- Read: docs/superpowers/memory/index.md
- Read: docs/superpowers/memory/<owner-or-shard>.md - [why this is the smallest useful source]
- Search: <optional targeted memory/source search terms>

Skipped:
- docs/superpowers/memory/<large-or-irrelevant>.md - [why not loaded]

Answer:
[Direct answer grounded in project knowledge.]

Sources read:
- docs/superpowers/memory/index.md
- docs/superpowers/memory/<owner>.md

Code search seeds:
- <path, symbol, command, or rg query that should be used next when code inspection is needed>

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
