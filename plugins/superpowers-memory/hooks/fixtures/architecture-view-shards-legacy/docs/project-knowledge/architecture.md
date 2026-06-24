---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Architecture

## Pattern Overview

**Overall:** DDD services with async runtime coordination.

## System Context

**Actors:**
- Developers

**External Systems:**
- Kubernetes
- Message bus

## System Topology / Context Map

```mermaid
graph LR
    Portal --> Orchestrator
    Orchestrator --> Dispatcher
    Dispatcher --> Executor
```

**Call direction rules:**
- Portal enters through Orchestrator, Dispatcher owns runtime delivery, and Executor connects outward.
