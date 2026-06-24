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

## Layering

The platform has orchestrator, dispatcher, and executor services.

**Call direction rules:**
- Services call request/response APIs downward and publish messages for cross-context reactions.

## Scenario Sequences

### Execute Work

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant D as Dispatcher
    participant E as Executor
    O->>D: enqueue work
    D->>E: deliver message
    E-->>O: result
```
