---
name: lint
description: Use to health-check Project Knowledge Base without writing — reports stale references, shape violations, SSOT issues, retrieval cost, split candidates, and suggested ingest targets
---

# Lint Project Knowledge

Check `docs/project-knowledge/` without writing files.

**Announce at start:** "I'm linting the project knowledge base."

## Process

1. If `docs/project-knowledge/` does not exist, report that bootstrap ingest is needed.
2. Run deterministic checks:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" lint
```

3. Interpret the JSON output for the requested scope: whole KB, one owner file, or one topic.
4. Report issues by severity.
5. Review LLM Wiki health for the requested scope: contradictions, stale claims, orphan/unreachable shards, missing owner/concept pages, missing cross-references, source/data gaps, and answerability coverage.
6. Interpret `coverageGaps` as advisory ingest targets. These do not make `verify.ok` false; they indicate likely query-answerability gaps for complex repos, including shallow service cards that only name generic code layers, scenario diagrams without local source refs, and legacy view shards that split architecture by `contexts` / `flows` instead of module-first and named scenario shards.
7. Flag additional advisory coverage gaps when a high-frequency object is referenced by index/features/architecture/decisions/glossary/source refs but has no direct owner entry or shard, when a global architecture map exists but a core bounded context lacks a module shard or service-card layering details/design-doc planes/subsystems, when core named scenarios lack sequence coverage/source refs, or when `query` would need broad cross-file inference to answer a normal project question.
8. Report suggested ingest targets instead of editing files.

## Output

```markdown
Issues:
- [Critical | Important | Minor] [owner/source] [finding]

Suggested ingest targets:
- Owner: docs/project-knowledge/<owner>.md
  Source: <spec/plan/ADR/source>
  Reason: <missing | stale | contradiction | weak source | routing gap | orphan shard | missing owner | missing cross-reference | source gap | answerability gap>

Advisory:
- [retrieval cost, split candidates, coverageGaps, wiki health gap, coverage gap, or non-blocking notes]
```

## Rules

- Do not write files.
- Do not acquire the write lock.
- Use `superpowers-memory:ingest` for fixes.
