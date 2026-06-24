---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: full-refresh
---

# Decisions

## ADR-001: Use Durable Runtime Delivery
**Decision:** Runtime delivery events are stored durably before live fanout.

## ADR-002: Split Browser Stream From Runtime Delivery
**Decision:** Browser stream replay is served by a read-side gateway.
**Trade-off:** One more service boundary must be operated.
