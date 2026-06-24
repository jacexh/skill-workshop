---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Architecture: Orchestrator

## Module Identity

**Responsibility:** Owns work admission, evidence, state policy, and dispatch planning.
**Non-responsibility:** Does not deliver runtime commands directly to Executor.
**Path / entry:** `cmd/orchestrator/` -> `internal/orchestrator/`

## Internal Architecture Model

- Evidence Plane
- State And Policy Plane
- Dispatch Plane
- Surface Plane

## Interactions

- Upstream: Portal.
- Downstream: Dispatcher.

## State And Invariants

- Dispatch decisions are idempotent.

## Source refs

- `cmd/orchestrator/`
- `internal/orchestrator/`
- `api/orchestrator/v1/orchestrator.proto`
