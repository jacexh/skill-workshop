---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Architecture Flows

## Scenario Sequences

### Start Runtime

```mermaid
sequenceDiagram
    participant P as Portal
    participant O as Orchestrator
    participant D as Dispatcher
    participant E as Executor
    P->>O: request work start
    O->>D: enqueue start command
    D->>E: deliver start command
```

**Source refs:** `cmd/orchestrator/`, `cmd/dispatcher/`, `cmd/executor/`.

### Deliver Runtime Message

```mermaid
sequenceDiagram
    participant E as Executor
    participant D as Dispatcher
    participant O as Orchestrator
    E->>D: runtime message
    D->>D: durable append
    D->>O: committed fact
```

**Source refs:** `api/dispatcher/v1/dispatcher.proto`, `internal/dispatcher/`.

### Stop Runtime

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant D as Dispatcher
    participant E as Executor
    O->>D: stop request
    D->>E: stop command
```

**Source refs:** `api/orchestrator/v1/orchestrator.proto`, `api/executor/v1/executor.proto`.

### Replay Runtime

```mermaid
sequenceDiagram
    participant Portal
    participant D as Dispatcher
    participant E as Executor
    Portal->>D: replay stream
    D-->>Portal: durable messages
    E-->>D: live messages
```

**Source refs:** `internal/dispatcher/`, `api/dispatcher/v1/dispatcher.proto`.

## Key Object FSMs

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> running: Start / emits RuntimeStarted
    running --> stopped: Stop / emits RuntimeStopped
```
