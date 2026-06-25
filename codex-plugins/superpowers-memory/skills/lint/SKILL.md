---
name: lint
description: Use to health-check Project Knowledge Base without writing — reports stale references, shape violations, SSOT issues, retrieval cost, split candidates, and suggested ingest targets
---

# Lint Project Knowledge

Check `docs/superpowers/memory/` without writing knowledge files. The only allowed write is the one-time legacy directory migration below.

**Announce at start:** "I'm linting the project knowledge base."

## Process

1. Run the legacy hard-migration check. If `docs/project-knowledge/` exists and `docs/superpowers/memory/` does not exist, run:

```bash
mkdir -p docs/superpowers
git mv docs/project-knowledge docs/superpowers/memory
```

If both directories exist, stop and report the path conflict instead of merging.
2. If `docs/superpowers/memory/` does not exist, report that bootstrap ingest is needed.
3. Run deterministic checks:

```bash
node "${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js" lint
```

4. Interpret the JSON output for the requested scope: whole KB, one owner file, or one topic.
5. Report issues by severity.
6. Review LLM Wiki health for the requested scope: contradictions, stale claims, orphan/unreachable shards, missing owner/concept pages, missing cross-references, source/data gaps, and answerability coverage.
7. Interpret `coverageGaps` as advisory ingest targets. These do not make `verify.ok` false; they indicate likely query-answerability gaps for complex repos, including missing module/scenario shards, shallow service cards that only name generic code layers, scenario diagrams without local source refs, legacy view shards that split architecture by `contexts` / `flows`, missing module/scenario cross-references, scenario authority/order/failure field gaps, feature product/workflow coverage gaps, unrouted `<slot>-<domain>.md` shards, decision detail/trade-off routing gaps, decision affected routing gaps, large root decision files that need `decisions-<domain>.md` family shards, large root glossaries that need alias-router rebuilds plus `glossary-<domain>.md` term shards, and reference owner/source gaps.
8. Flag additional advisory coverage gaps when a high-frequency object is referenced by index/features/architecture/decisions/glossary/source refs but has no direct owner entry or shard, when a global architecture map exists but a core bounded context lacks a module shard or service-card layering details/design-doc planes/subsystems, when core named scenarios lack sequence coverage/source refs or scenario authority/order/failure semantics, or when `query` would need broad cross-file inference to answer a normal project question.
9. For topic scope, recommend whether normal incremental ingest is enough or whether to escalate to topic-scope refresh. Use topic-scope refresh when affected routing, bidirectional module/scenario refs, owner/source anchors, shard routes, or high-value object answerability remain incomplete after a narrow update.
10. Report suggested ingest targets instead of editing files.

## Output

```markdown
Issues:
- [Critical | Important | Minor] [owner/source] [finding]

Suggested ingest targets:
- Owner: docs/superpowers/memory/<owner>.md
  Source: <spec/plan/ADR/source>
  Reason: <missing | stale | contradiction | weak source | routing gap | orphan shard | missing owner | missing cross-reference | source gap | answerability gap>

Advisory:
- [retrieval cost, split candidates, coverageGaps, wiki health gap, coverage gap, or non-blocking notes]
```

## Rules

- Do not write files, except for the legacy `git mv` migration when needed.
- Do not acquire the write lock.
- Use `superpowers-memory:ingest` for fixes.
