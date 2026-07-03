---
adr: 019
title: Canonical memory directory under docs/superpowers
date: 2026-06-24
status: Superseded by ADR-024
---

# ADR-019: Canonical memory directory under docs/superpowers

## Context

The Project Knowledge Base originally used a pre-canonical directory. After aligning the plugin more closely with LLM Wiki concepts and the superpowers workflow, the storage path needed a clearer home near `docs/superpowers/specs/` and `docs/superpowers/plans/`.

A compatibility layer that reads and writes both the old and new directories would increase implementation and user-facing complexity. It would also create a drift risk: one agent could keep reading the old path while another writes the new one.

## Decision

Use `docs/superpowers/memory/` as the only canonical Project Knowledge Base path.

Runtime reads, verification, status output, suggested owners, and bootstrap/full-refresh instructions use the canonical path. ADR-024 supersedes this record's temporary migration behavior and makes `docs/superpowers/memory/` the only managed memory directory.

## Alternatives Rejected

- **Long-term dual-path compatibility**: Reading both directories would reduce upgrade friction, but it would make query, lint, freshness checks, and write-lock behavior harder to reason about. It also risks stale facts surviving in the old path.
- **Silent copy migration**: Copying files would avoid git-index requirements, but it would lose rename intent and could leave duplicate directories behind.
- **Manual-only migration**: Requiring users to run the move themselves keeps skills pure, but existing projects would repeatedly fail query/lint/ingest until a human notices the path mismatch. ADR-024 later accepts this trade-off after the migration window closed.

## Consequences

The storage model is simpler: project specs, plans, and memory now live under `docs/superpowers/`.

`query` and `lint` remain non-writing for knowledge content.

Existing tests use the canonical fixture layout directly.
