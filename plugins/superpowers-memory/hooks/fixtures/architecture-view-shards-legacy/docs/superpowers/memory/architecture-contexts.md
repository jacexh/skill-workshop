---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: null
---

# Architecture Contexts

## Service Architecture Cards

#### Orchestrator
**Responsibility:** Owns admission, evidence, state policy, and dispatch planning for work execution.
**Path / entry:** `cmd/orchestrator/` -> `internal/orchestrator/`
**Internal layers / components:** Evidence Plane; State And Policy Plane; Dispatch Plane; Surface Plane.
**Interactions:** Receives Portal requests, reads Work state, and asks Dispatcher to deliver runtime commands.
**State / invariants:** Dispatch decisions are idempotent and fenced by work attempt.
**Source refs:** `cmd/orchestrator/`, `internal/orchestrator/`, `api/orchestrator/v1/orchestrator.proto`.

#### Dispatcher
**Responsibility:** Owns durable command/message append and live runtime fanout.
**Path / entry:** `cmd/dispatcher/` -> `internal/dispatcher/`
**Internal layers / components:** Message Router; Append Processor; Replay Projection; Live Fanout Bridge.
**Interactions:** Receives Orchestrator commands and Executor streams, writes durable messages, and publishes live events.
**State / invariants:** Durable append precedes live publish.
**Source refs:** `cmd/dispatcher/`, `internal/dispatcher/`, `api/dispatcher/v1/dispatcher.proto`.

#### Executor
**Responsibility:** Runs the runtime process and connects outward to Dispatcher.
**Path / entry:** `cmd/executor/` -> `internal/executor/`
**Internal layers / components:** Runtime Adapter Strategy; Command Subscriber; Message Publisher; Shutdown Coordinator.
**Interactions:** Receives Dispatcher commands and emits runtime messages.
**State / invariants:** Executor exposes no inbound control API.
**Source refs:** `cmd/executor/`, `internal/executor/`, `api/executor/v1/executor.proto`.
