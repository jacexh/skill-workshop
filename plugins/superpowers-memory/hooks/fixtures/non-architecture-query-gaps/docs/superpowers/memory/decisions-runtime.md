---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: incremental
---

# Decisions: Runtime

## ADR-003: Runtime Delivery Must Be Durable
**Decision:** Runtime delivery messages are committed before live fanout.
**Trade-off:** One more persistence boundary must be operated.
**Affects:** architecture-runtime.md, features.md, conventions.md
→ [adr/ADR-003-runtime-delivery-durable.md](adr/ADR-003-runtime-delivery-durable.md)
