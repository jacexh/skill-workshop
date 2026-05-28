---
name: ddd-golang-taskqueue
description: Go DDD taskqueue and polling-task patterns. Use when adding background tasks, polling/reconciliation jobs, asynq workers, task payload schemas, TaskType definitions, task processors, task enqueueing, task middleware, internal/pkg/taskqueue wiring, or task worker lifecycle in Go DDD services. Complements ddd-golang.md and ddd-golang-runtime.md.
---

# Go Task Queue Patterns for DDD
## Polling, Reconciliation, and Asynq-backed Workers

**Version**: v1.0
**Date**: 2026-05-28
**Scope**: Go task queue patterns complementing [`ddd-golang.md`](ddd-golang.md) and [`ddd-golang-runtime.md`](ddd-golang-runtime.md)
**Prerequisites**:
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) - Code agents must read this first.
- **Go implementation**: [`ddd-golang.md`](ddd-golang.md) - Layer responsibilities, directory layout, event/message separation, module assembly.
- **Go runtime**: [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Config ownership, `fx.Lifecycle`, graceful shutdown, and worker shutdown ordering.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Adding a task queue, background job, polling task, reconciliation task, scheduled task, or delayed retry flow.
> - Editing `internal/pkg/taskqueue/**`, asynq wiring, task middleware, task schema registration, or worker lifecycle hooks.
> - Adding a `TaskType`, task payload struct, task processor, task enqueue call, or task payload schema registry.
> - Reviewing whether a polling/reconciliation concern belongs in Domain, Application, Infrastructure, or runtime wiring.

---

## 1. Architectural Classification

A task queue is an **application/runtime orchestration mechanism**, not a Domain concept.

Use these placement rules:

| Concern | Layer / package |
|---|---|
| Business state, invariants, state transitions | `internal/business/<context>/domain` |
| Polling/reconciliation use case and processor | `internal/business/<context>/application/taskprocessor` |
| Task payload struct, `TaskType`, `taskqueue.Definition`, schema registration for that use case | Same bounded context, usually `application/taskprocessor` or `application/task` |
| Enqueue decision from an application use case | Application layer, through `github.com/go-jimu/components/taskqueue.Enqueuer` |
| Shared queue client, asynq worker, middleware, processor registration, worker lifecycle | `internal/pkg/taskqueue` |
| Provider adapter | `github.com/go-jimu/contrib/taskqueue/asynq` |
| Provider-specific asynq options/config | `internal/pkg/taskqueue` config and wiring |

Domain must not import `components/taskqueue`, `contrib/taskqueue/asynq`, `github.com/hibiken/asynq`, Redis clients, worker routers, or runtime packages.

Application code may import `github.com/go-jimu/components/taskqueue` because it is the provider-neutral task contract. Application code must not import `github.com/go-jimu/contrib/taskqueue/asynq` or `github.com/hibiken/asynq`.

Infrastructure/runtime code may import `contrib/taskqueue/asynq` and `github.com/hibiken/asynq`, but it must not put provider mechanics behind new Domain/Application interfaces such as `AsynqClient`, `JobDispatcher`, or `RedisQueue`.

---

## 2. Default Technology Stack

Repositories adopting this guide use:

| Concern | Default library |
|---|---|
| Provider-neutral task contract | `github.com/go-jimu/components/taskqueue` |
| Asynq adapter | `github.com/go-jimu/contrib/taskqueue/asynq` |
| Provider runtime | `github.com/hibiken/asynq`, hidden behind `internal/pkg/taskqueue` |

Do not create project-local substitutes for `TaskType`, `Task`, `Enqueuer`, `Processor`, `Registrar`, `Worker`, `SchemaRegistry`, task middleware, or asynq adapters when these components fit the use case.

Generics are optional. Prefer the non-generic `SchemaRegistry` and explicit type assertions unless a repository already has a local generic helper that improves clarity without leaking provider details.

---

## 3. TaskType and Schema Registry

Every task contract has one semantic `TaskType` and one payload schema.

Rules:

1. Define a `TaskType` constant for each task contract. Use a stable, versioned name such as `document.review.v1`.
2. Define one `taskqueue.Definition` for the task. Put the provider queue lane in `Definition.Queue`, not in business code branches.
3. Register the payload schema with `taskqueue.SchemaRegistry` during application/module startup.
4. Use `SchemaRegistry.NewJSONTask` for enqueueing and `SchemaRegistry.DecodeJSON` for processing when a registry is available.
5. The registry instance is **service-owned**, not library-global. A common shape is `internal/pkg/taskqueue.NewSchemaRegistry()` returning one fx singleton, while bounded-context modules register their own schemas via `fx.Invoke`.
6. Treat registration as startup wiring. Do not register schemas lazily during request handling or task processing.

Do not make handlers expose `Listening() []string` or listen to multiple task types. That pattern belongs to the existing event/message abstractions and becomes ambiguous when applied to tasks. For tasks, use one `taskqueue.Processor` per `TaskType`.

---

## 4. Processor Design

A processor is an Application-layer adapter for one task type. It should:

- decode the payload using the schema registry;
- call an Application service/use case;
- be idempotent because asynq may retry and duplicate delivery can happen;
- return `nil` only after the task's intended work is accepted or completed;
- return an error for transient failures that should use provider retry;
- return an error wrapping `taskqueue.ErrSkipRetry` for invalid payloads or permanent non-retryable cases;
- re-enqueue a follow-up task for normal "not ready yet" polling, then return `nil`.

Normal polling is not the same thing as failure retry. If a task observes "not ready yet", make the next poll explicit with `Enqueuer.Enqueue(..., taskqueue.WithDelay(...))`. Do not rely only on provider retry for expected waiting states; provider retry is for failed attempts.

Polling tasks must have a bound: max attempts, deadline, terminal status, or an explicit Application policy that records an exhausted reconciliation. Infinite self-requeue loops are rejected.

Example shape:

```go
// internal/business/document/application/taskprocessor/review_document.go
package taskprocessor

import (
    "context"
    "fmt"
    "time"

    "github.com/go-jimu/components/taskqueue"
)

const ReviewDocumentTaskType taskqueue.TaskType = "document.review.v1"

var ReviewDocumentTask = taskqueue.Definition{
    Type:  ReviewDocumentTaskType,
    Queue: "reconcile",
}

type ReviewDocumentPayload struct {
    DocumentID string `json:"document_id"`
    Attempt    int    `json:"attempt"`
}

func RegisterReviewDocumentSchema(registry *taskqueue.SchemaRegistry) error {
    return registry.Register(ReviewDocumentTask, func() any { return &ReviewDocumentPayload{} })
}

func NewReviewDocumentProcessor(
    registry *taskqueue.SchemaRegistry,
    enqueuer taskqueue.Enqueuer,
    service *ReviewService,
) taskqueue.Processor {
    return taskqueue.NewProcessor(ReviewDocumentTaskType, func(ctx context.Context, task taskqueue.Task) error {
        decoded, err := registry.DecodeJSON(task)
        if err != nil {
            return err
        }
        payload, ok := decoded.(*ReviewDocumentPayload)
        if !ok {
            return fmt.Errorf("%w: unexpected payload %T", taskqueue.ErrSkipRetry, decoded)
        }

        result, err := service.ReviewDocument(ctx, payload.DocumentID)
        if err != nil {
            return err // transient failure: let the provider retry this attempt
        }
        if result.Done {
            return nil
        }
        if payload.Attempt >= 20 {
            return fmt.Errorf("%w: review deadline exceeded document_id=%s", taskqueue.ErrSkipRetry, payload.DocumentID)
        }

        payload.Attempt++
        next, err := registry.NewJSONTask(payload, taskqueue.WithKey(payload.DocumentID))
        if err != nil {
            return err
        }
        return enqueuer.Enqueue(
            ctx,
            next,
            taskqueue.WithDelay(30*time.Second),
            taskqueue.WithMaxRetry(3),
            taskqueue.WithUnique(30*time.Second),
        )
    })
}
```

The service above is an Application service. If it needs to mutate aggregates, it must use the normal command-side transaction rules from [`ddd-core.md`](ddd-core.md). If it only observes external/read state and records reconciliation progress, keep the policy in Application unless a real domain invariant is involved.

---

## 5. `internal/pkg/taskqueue` Runtime Boundary

`internal/pkg/taskqueue` owns the queue runtime for the service:

- its own `Option` struct and config tags;
- creation of asynq-backed `taskqueue.Enqueuer`;
- creation of the asynq-backed `taskqueue.Worker`;
- processor registration;
- common middleware wrapping;
- `fx.Lifecycle` hooks for `Start(ctx)` and `Shutdown(ctx)`;
- cleanup hooks such as `client.Close()`;
- provider config such as queues, concurrency, Redis connection, and shutdown timeout.

`cmd/**/main.go` should only aggregate options, import modules, and call `app.Run()`. It should not manually register processors, install task middleware, create asynq objects, or start/stop workers.

Use task words for taskqueue runtime objects: `Worker`, `ProcessorRouter`, `Registrar`, `Processor`, `Enqueuer`. Do not introduce HTTP server, HTTP mux, or HTTP handler terminology for task workers.

Example runtime shape:

```go
// internal/pkg/taskqueue/taskqueue.go
package taskqueue

import (
    "context"
    "log/slog"
    "time"

    componenttaskqueue "github.com/go-jimu/components/taskqueue"
    taskasynq "github.com/go-jimu/contrib/taskqueue/asynq"
    "github.com/hibiken/asynq"
    "go.uber.org/fx"
)

type Option struct {
    RedisAddr       string         `json:"redis-addr" yaml:"redis-addr" toml:"redis-addr"`
    Queues          map[string]int `json:"queues" yaml:"queues" toml:"queues"`
    Concurrency     int            `json:"concurrency" yaml:"concurrency" toml:"concurrency"`
    ShutdownTimeout time.Duration  `json:"shutdown-timeout" yaml:"shutdown-timeout" toml:"shutdown-timeout"`
}

type ProcessorIn struct {
    fx.In
    Processors []componenttaskqueue.Processor `group:"taskqueue.processors"`
}

func NewSchemaRegistry() *componenttaskqueue.SchemaRegistry {
    return componenttaskqueue.NewSchemaRegistry()
}

func NewEnqueuer(lc fx.Lifecycle, opt Option) componenttaskqueue.Enqueuer {
    client := taskasynq.NewRedisClient(asynq.RedisClientOpt{Addr: opt.RedisAddr})
    lc.Append(fx.Hook{
        OnStop: func(context.Context) error {
            return client.Close()
        },
    })
    return client
}

func NewWorker(
    lc fx.Lifecycle,
    opt Option,
    logger *slog.Logger,
    in ProcessorIn,
) (componenttaskqueue.Worker, error) {
    queues := opt.Queues
    if len(queues) == 0 {
        queues = map[string]int{"default": 1}
    }
    concurrency := opt.Concurrency
    if concurrency <= 0 {
        concurrency = 10
    }

    worker := taskasynq.NewRedisWorker(
        asynq.RedisClientOpt{Addr: opt.RedisAddr},
        asynq.Config{Queues: queues, Concurrency: concurrency},
    )

    for _, processor := range in.Processors {
        wrapped := componenttaskqueue.NewProcessor(
            processor.TaskType(),
            componenttaskqueue.Chain(
                processor.Process,
                componenttaskqueue.Logging(logger),
                componenttaskqueue.Recover(),
            ),
        )
        if err := worker.Register(wrapped); err != nil {
            return nil, err
        }
    }

    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            return worker.Start(ctx)
        },
        OnStop: func(ctx context.Context) error {
            if opt.ShutdownTimeout <= 0 {
                return worker.Shutdown(ctx)
            }
            shutdownCtx, cancel := context.WithTimeout(ctx, opt.ShutdownTimeout)
            defer cancel()
            return worker.Shutdown(shutdownCtx)
        },
    })
    return worker, nil
}
```

Bounded-context modules should contribute processors and schema registrations, not construct workers:

```go
var Module = fx.Module(
    "domain.document",
    fx.Provide(
        NewReviewService,
        fx.Annotate(
            taskprocessor.NewReviewDocumentProcessor,
            fx.As(new(taskqueue.Processor)),
            fx.ResultTags(`group:"taskqueue.processors"`),
        ),
    ),
    fx.Invoke(taskprocessor.RegisterReviewDocumentSchema),
)
```

The exact `fx.Annotate` style may vary by repository. The invariant is stable: the bounded context owns task semantics, and `internal/pkg/taskqueue` owns provider runtime registration.

---

## 6. Middleware and Observability

Every worker should install at least:

- `taskqueue.Recover()` to convert panics into a stable error;
- `taskqueue.Logging(logger)` to log task type, queue, key, outcome, elapsed time, and provider execution metadata when present.

Use `taskqueue.ExecutionInfoFromContext(ctx)` inside processors only when the use case needs provider metadata for diagnostics. Do not make retry count, queue name, or asynq task ID part of Domain decisions.

Middleware belongs in `internal/pkg/taskqueue`, not in each processor. Add application-specific logging fields in the processor only when they are semantic identifiers such as aggregate ID, tenant ID, or command ID.

---

## 7. Enqueueing Rules

Application use cases may enqueue tasks through `taskqueue.Enqueuer`.

Rules:

- Build tasks through the schema registry where available: `registry.NewJSONTask(&Payload{...}, taskqueue.WithKey(...))`.
- Use `taskqueue.WithKey` for natural idempotency or ordering keys.
- Use `taskqueue.WithUnique` when duplicate suppression is part of the delivery policy.
- Use `taskqueue.WithDelay` / `WithProcessAt` for planned future attempts.
- Use `WithMaxRetry`, `WithTimeout`, and `WithDeadline` to make failure policy explicit when defaults are not acceptable.
- Do not pass asynq options through Application APIs. Provider-specific options stay in `internal/pkg/taskqueue`.

If enqueueing is a direct consequence of a Domain state change, first consider whether the reaction should be modeled as a same-BC Domain Event handler or a Boundary Publisher. Use task enqueueing directly from a command only when the delayed/background task is an explicit output of that command and the Architecture Gate says why event/message extraction is not the better fit.

---

## 8. Testing Rules

Test by layer:

- Domain tests cover business rules without taskqueue imports.
- Application processor tests use a fake `taskqueue.Enqueuer` and real `taskqueue.SchemaRegistry` payload encoding/decoding.
- Runtime tests for `internal/pkg/taskqueue` verify processor registration, middleware wrapping, and lifecycle hook behavior without depending on business processors.
- Provider integration tests may use Redis/asynq when the repository already has integration-test infrastructure.

Do not test task payload handling by reimplementing JSON encoding logic in assertions. Create tasks with `SchemaRegistry.NewJSONTask`, process them through the real processor, and assert observable application behavior or enqueue calls.

---

## 9. Anti-patterns

Reject these in review:

1. Domain imports `components/taskqueue`, `contrib/taskqueue/asynq`, `hibiken/asynq`, Redis, or `internal/pkg/taskqueue`.
2. Application imports `contrib/taskqueue/asynq` or `hibiken/asynq`.
3. `cmd/**/main.go` registers processors, middleware, schemas, hooks, or asynq objects directly.
4. A concrete task handler listens to `[]TaskType` or switches over many unrelated task types.
5. A task processor mixes Domain Event handling, Integration Message handling, and task processing roles.
6. Polling "not ready yet" is implemented as a provider retry error instead of explicit delayed re-enqueue with a bound.
7. A global mutable schema registry is hidden in a package variable.
8. A project-local `AsynqClient`, `JobQueue`, `TaskDispatcher`, or `RedisQueue` duplicates the adopted component/contrib stack.
9. Middleware is copied into every processor instead of installed once in `internal/pkg/taskqueue`.
10. Provider metadata such as queue name, retry count, or asynq task ID drives Domain decisions.

---

## 10. Completion Self-Check

Before claiming a taskqueue change is complete:

- [ ] `ddd-agent-contract.md`, `ddd-golang.md`, `ddd-golang-runtime.md`, and this file were read when applicable.
- [ ] Every task has exactly one `TaskType`, one payload schema, and one processor.
- [ ] The schema is registered during startup/module wiring, not lazily at processing time.
- [ ] The processor lives under the bounded context's `application` subtree.
- [ ] `internal/pkg/taskqueue` owns asynq client/worker creation, middleware, registration, and lifecycle hooks.
- [ ] `cmd/**/main.go` remains a thin entry point.
- [ ] Polling tasks distinguish normal waiting from transient failure retry.
- [ ] Polling has a max attempt, deadline, terminal state, or explicit exhaustion policy.
- [ ] Domain imports remain clean.
- [ ] Tests cover processor behavior and runtime wiring at the right layer, or docs-only duplicated copies and links were checked.

---

**References:**
- [`ddd-agent-contract.md`](ddd-agent-contract.md) - Agent execution contract (read first)
- [`ddd-golang.md`](ddd-golang.md) - Go DDD implementation (layers, aggregates, events, integration messages, module assembly)
- [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Go runtime: configuration, `fx.Lifecycle`, graceful shutdown, Kubernetes
- [`ddd-core.md`](ddd-core.md) - Language-agnostic DDD + Clean Architecture specification
