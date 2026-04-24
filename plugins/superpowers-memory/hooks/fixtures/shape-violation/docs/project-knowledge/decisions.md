---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Decisions

## ADR-001: Use Go
**Decision:** Use Go.
**Why:** Team expertise.
**Trade-off:** None.

## ADR-002: Use Redis for cache

**Context:** Need fast cache with TTL.
**Decision:** Redis.
**Alternatives rejected:**
- Memcached: insufficient feature set for our use case.

**Consequences:** One more runtime dependency.
