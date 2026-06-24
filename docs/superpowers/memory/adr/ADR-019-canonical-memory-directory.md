---
adr: 019
title: Canonical memory directory under docs/superpowers
date: 2026-06-24
status: Accepted
---

# ADR-019: Canonical memory directory under docs/superpowers

## Context

The Project Knowledge Base originally lived at `docs/project-knowledge/`. After aligning the plugin more closely with LLM Wiki concepts and the superpowers workflow, the storage path needed a clearer home near `docs/superpowers/specs/` and `docs/superpowers/plans/`.

A compatibility layer that reads and writes both the old and new directories would increase implementation and user-facing complexity. It would also create a drift risk: one agent could keep reading the old path while another writes the new one.

## Decision

Use `docs/superpowers/memory/` as the only canonical Project Knowledge Base path.

At the start of each public memory skill, run a legacy hard-migration check:

```bash
mkdir -p docs/superpowers
git mv docs/project-knowledge docs/superpowers/memory
```

Run the migration only when `docs/project-knowledge/` exists and `docs/superpowers/memory/` does not. If both directories exist, stop and ask the user to resolve the conflict instead of merging automatically.

Runtime reads, verification, status output, suggested owners, and bootstrap/full-refresh instructions use the canonical path. The write-lock blocks direct writes to both `docs/superpowers/memory/` and legacy `docs/project-knowledge/`, so the legacy directory cannot keep accumulating manual edits.

## Alternatives Rejected

- **Long-term dual-path compatibility**: Reading both directories would reduce upgrade friction, but it would make query, lint, freshness checks, and write-lock behavior harder to reason about. It also risks stale facts surviving in the old path.
- **Silent copy migration**: Copying files would avoid git-index requirements, but it would lose rename intent and could leave duplicate directories behind.
- **Manual-only migration**: Requiring users to run the move themselves keeps skills pure, but existing projects would repeatedly fail query/lint/ingest until a human notices the path mismatch.

## Consequences

The storage model is simpler: project specs, plans, and memory now live under `docs/superpowers/`.

`query` and `lint` remain non-writing for knowledge content, but they have one allowed upgrade side effect: moving the legacy directory with `git mv` when needed.

Existing tests keep legacy fixtures and migrate them during test setup, so the runtime can enforce the new canonical path while still covering legacy input.
