---
name: ddd-golang-asynq
description: Go House Style for an accepted Asynq task provider, Redis configuration, registration, and lifecycle.
---

# Go Asynq Runtime

## Applies When

Load this leaf only when the accepted Go task provider is Asynq. Load
[ddd-golang-taskqueue.md](ddd-golang-taskqueue.md) for the provider-neutral task
contract and processor shape.

## Imports and Constructors

Only `internal/pkg/taskqueue` imports the adapter
`github.com/go-jimu/contrib/taskqueue/asynq` and `github.com/hibiken/asynq`.
Runtime constructs the adapter's Redis client, worker, and scheduler, and owns
Redis addresses, credentials, lanes, concurrency, provider attempts,
middleware, health, and timeouts.

## Envelope and Registration

The adapter preserves `TaskType`, payload bytes, and `PayloadCodec` from the
provider-neutral envelope. House-style processors use explicit `DecodeProto`.

`Task.ID()` maps to `asynq.TaskID`. asynq scopes an ID to its queue and keeps it
while the task is pending, scheduled, active, retrying, or archived; the
adapter sets no `asynq.Retention`, so completion frees it. A conflicting
enqueue returns an error matching both `taskqueue.ErrDuplicateTask` and
`asynq.ErrTaskIDConflict`. On the worker `Task.ID()` is empty; processors and
Runtime logging read the asynq-assigned or producer-set ID from
`taskqueue.ExecutionInfo.TaskID()`.

Bounded Context modules contribute `taskqueue.Processor` and accepted
`taskqueue.PeriodicTask` values. Runtime registers them before startup and
manages client close plus worker/scheduler `Start` and `Shutdown` through Fx
lifecycle hooks.

## Logging and Verification

Runtime owns one task completion record with operation, outcome, duration,
task identity, task type, attempt, and safe correlation fields. Application
logs only an independently useful business fact.

Provider integration tests use Redis/Asynq for registration, envelope/codec
preservation, enqueue options, routing, uniqueness, attempt policy, scheduler
behavior, terminal-error surfacing, disabled registrations, and bounded
shutdown.
