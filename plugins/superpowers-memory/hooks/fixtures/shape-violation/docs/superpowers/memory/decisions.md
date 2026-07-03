---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Decisions

## ADR-001: Use Go
**Decision:** Use Go.
**Trade-off:** None.
→ [adr/ADR-001-use-go.md](adr/ADR-001-use-go.md)

## ADR-002: Use Redis for cache

**Context:** Need fast cache with TTL and pub/sub semantics.
**Decision:** Redis 7.x as the primary cache backend for all services.
**Alternatives rejected:**
- Memcached: insufficient feature set for our use case; no pub/sub; no persistence.
- Postgres LISTEN/NOTIFY: wrong granularity; couples cache to the primary DB.
- In-process LRU: breaks under multi-replica deployment; no cross-instance invalidation.

**Consequences:** One more runtime dependency. Adds memory-pressure tuning burden. Operations team needs to watch max-memory eviction policy.

## ADR-003: Dispatcher dissolved (Superseded by ADR-007)
**Original:** Dispatcher was dissolved into Supervisor's Adapter module.
