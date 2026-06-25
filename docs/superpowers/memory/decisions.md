---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions

Root decision router. Load this file first, then open the smallest matching decision family shard. Full rationale remains in `adr/ADR-NNN-*.md`.

## Decision Families

- [decisions-memory.md](decisions-memory.md) — Project Knowledge Base storage, loading, verification, staleness, write locks, and progressive layout.
  Key ADRs: ADR-019, ADR-016, ADR-012, ADR-011, ADR-010, ADR-009, ADR-008, ADR-007, ADR-005, ADR-004, ADR-003.

- [decisions-architect.md](decisions-architect.md) — Architect standards injection and DDD guidance split decisions.
  Key ADRs: ADR-018, ADR-017, ADR-015, ADR-006.

- [decisions-codex.md](decisions-codex.md) — Codex marketplace compatibility, native hooks, and install/upgrade behavior.
  Key ADRs: ADR-014, ADR-013.

- [decisions-foundation.md](decisions-foundation.md) — Foundational plugin integration boundaries and cross-platform hook dispatch.
  Key ADRs: ADR-002, ADR-001.

## Query Hints

- Need "why did memory do this?" → start with [decisions-memory.md](decisions-memory.md), then the linked ADR detail.
- Need "why did architect split this guide?" → start with [decisions-architect.md](decisions-architect.md).
- Need "why does Codex differ from Claude?" → start with [decisions-codex.md](decisions-codex.md), then ADR-013 or ADR-014.
- Need historical foundations → start with [decisions-foundation.md](decisions-foundation.md).
