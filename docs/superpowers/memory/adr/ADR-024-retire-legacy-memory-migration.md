---
adr: 024
title: Retire legacy memory migration
date: 2026-07-03
status: Accepted
---

# ADR-024: Retire legacy memory migration

## Context

ADR-019 established `docs/superpowers/memory/` as the canonical Project
Knowledge Base path and included a temporary migration path for older projects.
That compatibility path now adds more surface area than value: public skills
describe extra steps, runtime write protection checks more directories, and
release fixtures need setup code that does not reflect the current product.

## Decision

Remove the migration behavior and compatibility guidance. The memory plugin
manages only `docs/superpowers/memory/`.

Public `query`, `ingest`, `lint`, and compatibility aliases do not move retired
memory directories. Runtime write protection only covers the canonical memory
directory. Release fixtures use the canonical layout directly.

## Alternatives Rejected

- **Keep silent migration:** Reduces upgrade friction for old installations, but
  keeps hidden writes in read-only skills and preserves code paths that normal
  users should no longer need.
- **Keep write-lock protection for retired paths only:** Prevents accidental old
  path edits, but still forces runtime and tests to carry a compatibility branch.
- **Add absence tests for retired paths:** Would document the removal, but it is
  not worth a dedicated behavior surface; normal runtime and skill-surface checks
  are sufficient.

## Consequences

Projects must already use `docs/superpowers/memory/` or be moved manually before
memory skills can operate on them.

The runtime, skills, README, and fixtures are simpler and no longer describe a
legacy upgrade flow.
