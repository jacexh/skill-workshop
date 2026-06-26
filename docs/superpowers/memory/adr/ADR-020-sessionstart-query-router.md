---
adr: 020
title: SessionStart no longer injects index content
date: 2026-06-26
status: Accepted
---

# ADR-020: SessionStart no longer injects index content

## Context

`superpowers-memory:query` is now the preferred project-knowledge entry point. Its first step is to read `docs/superpowers/memory/index.md`, classify the question, and load the smallest useful owner files or shards.

Keeping the same `index.md` text in SessionStart duplicated that query workflow, spent context on turns that do not need project knowledge, and made the session-start prompt look broader than the intended "small primer" runtime guidance.

## Decision

Memory SessionStart no longer inlines `docs/superpowers/memory/index.md` content on either Claude or Codex.

When a KB and index exist, SessionStart emits only:

- KB availability and the index path.
- KB freshness/status.
- Short guidance to invoke `superpowers-memory:query` before broad code search, planning, architecture judgment, unfamiliar repo work, or answering project questions.
- Short finishing guidance to ensure the KB reflects HEAD and run `superpowers-memory:ingest` when stale.

`superpowers-memory:query` remains responsible for reading `index.md` and routing to owner files/shards. `index.md` keeps its strict size threshold because it is the first query-router file, not because it is injected at SessionStart.

## Alternatives Rejected

1. **Keep injecting `index.md` at SessionStart.** This preserves passive project-map awareness, but duplicates the query workflow and adds background context to unrelated turns.
2. **Remove all SessionStart memory text.** This is smaller, but agents would lose the lightweight reminder that a KB exists and that `query` is the intended read path.

## Consequences

- SessionStart is smaller and less noisy.
- Agents must invoke `query` to see the project map.
- Documentation and content rules should describe `index.md` as a query router rather than an always-injected hot-path file.
- ADR-005 and ADR-016 remain historical context but are superseded where they described SessionStart index injection.

## References

- `plugins/superpowers-memory/hooks/hook-runtime.js`
- `codex-plugins/superpowers-memory/hooks/codex-runtime.js`
- `plugins/superpowers-memory/content-rules.md`
- `codex-plugins/superpowers-memory/content-rules.md`
- `scripts/release/test/test_memory_verify.sh`
