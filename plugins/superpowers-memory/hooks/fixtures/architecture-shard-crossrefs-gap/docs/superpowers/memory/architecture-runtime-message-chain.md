---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Architecture: Runtime Message Chain

## Purpose

Portal starts a runtime path that eventually reaches Executor.

## Participants

- Portal
- Orchestrator
- Dispatcher
- Executor

## Sequence Phases

```mermaid
sequenceDiagram
    participant Portal
    participant O as Orchestrator
    participant D as Dispatcher
    participant E as Executor
    Portal->>O: request runtime
    O->>D: enqueue command
    D->>E: deliver command
```

## Data Flow

- Runtime command moves from Portal to Orchestrator to Dispatcher to Executor.

## Source refs

- `cmd/orchestrator/`
- `cmd/dispatcher/`
- `cmd/executor/`
