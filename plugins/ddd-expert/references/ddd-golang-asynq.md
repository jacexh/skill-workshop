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

Only `internal/pkg/taskqueue` imports the adapter and provider:

```go
import (
	"github.com/go-jimu/components/taskqueue"
	taskasynq "github.com/go-jimu/contrib/taskqueue/asynq"
	"github.com/hibiken/asynq"
)
```

Runtime constructs the adopted capabilities:

```go
client := taskasynq.NewRedisClient(redisOptions)
worker := taskasynq.NewRedisWorker(redisOptions, workerConfig)
scheduler := taskasynq.NewRedisScheduler(redisOptions, schedulerOptions)

if err := worker.Register(processor); err != nil {
	return err
}
if err := scheduler.RegisterPeriodicTask(periodic); err != nil {
	return err
}
```

`redisOptions` is `asynq.RedisConnOpt`, `workerConfig` is `asynq.Config`, and
`schedulerOptions` is `*asynq.SchedulerOpts`. Runtime owns Redis addresses,
credentials, lanes, concurrency, provider attempts, middleware, health, and
timeouts.

## Envelope and Registration

The adapter preserves `TaskType`, payload bytes, and `PayloadCodec` from the
provider-neutral envelope. House-style processors use explicit `DecodeProto`.

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
