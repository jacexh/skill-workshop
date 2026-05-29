---
name: ddd-golang-taskqueue
description: Go DDD taskqueue, polling-task, and periodic-task patterns. Use when adding background tasks, polling/reconciliation jobs, periodic task producers, asynq workers or schedulers, task payload schemas, TaskType definitions, task processors, task enqueueing, task middleware, internal/pkg/taskqueue wiring, or task worker lifecycle in Go DDD services. Complements ddd-golang.md and ddd-golang-runtime.md.
---

# Go Task Queue Patterns for DDD
## Polling, Reconciliation, Periodic Producers, and Asynq-backed Workers

**Version**: v1.3
**Date**: 2026-05-29
**Scope**: Go task queue patterns complementing [`ddd-golang.md`](ddd-golang.md) and [`ddd-golang-runtime.md`](ddd-golang-runtime.md)
**Prerequisites**:
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) - Code agents must read this first.
- **Go implementation**: [`ddd-golang.md`](ddd-golang.md) - Layer responsibilities, directory layout, event/message separation, module assembly.
- **Go runtime**: [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Config ownership, `fx.Lifecycle`, graceful shutdown, and worker shutdown ordering.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Adding a task queue, background job, polling task, reconciliation task, periodic task producer, scheduled task, or delayed retry flow.
> - Editing `internal/pkg/taskqueue/**`, asynq wiring, task middleware, task schema registration, scheduler registration, or worker lifecycle hooks.
> - Adding a `TaskType`, task payload struct, task processor, task enqueue call, periodic task definition, or task payload schema registry.
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
| Periodic task contract (`taskqueue.PeriodicTask`, `Schedule`, name, task envelope, enqueue policy) | Same bounded context as the task contract, usually `application/taskprocessor` or `application/task` |
| Shared queue client, asynq worker/scheduler, middleware, processor registration, periodic task registration, lifecycle | `internal/pkg/taskqueue` |
| Provider adapter | `github.com/go-jimu/contrib/taskqueue/asynq` |
| Provider-specific asynq options/config, Redis connection, scheduler options | `internal/pkg/taskqueue` config and wiring |

Domain must not import `components/taskqueue`, `contrib/taskqueue/asynq`, `github.com/hibiken/asynq`, Redis clients, worker routers, or runtime packages.

Application code may import `github.com/go-jimu/components/taskqueue` because it is the provider-neutral task contract. Application code must not import `github.com/go-jimu/contrib/taskqueue/asynq` or `github.com/hibiken/asynq`.

Infrastructure/runtime code may import `contrib/taskqueue/asynq` and `github.com/hibiken/asynq`, but it must not put provider mechanics behind new Domain/Application interfaces such as `AsynqClient`, `JobDispatcher`, or `RedisQueue`.

### Business-visible scheduling and task state

Before placing a scheduler, periodic producer, retry rule, deadline, pause /
resume flag, catch-up rule, or task status in `application/taskprocessor`, ask
whether the rule is visible to the business or operators as part of the product
language:

| Question | Placement |
|---|---|
| Is this only "enqueue this task every N minutes / at this cron time"? | `PeriodicTask` plus runtime scheduler wiring |
| Does the schedule affect customer rights, billing, approval windows, contract deadlines, or compliance obligations? | Domain state/policy plus Application orchestration |
| Does pause/resume, catch-up, retry eligibility, or deadline expiry have business-visible meaning? | Domain state/policy; taskqueue only triggers checks |
| Does a missed fire only affect throughput or operational latency? | Runtime/provider policy, metrics, or deployment coordination |

When the answer is business-visible, model the policy with Domain language
first. The periodic task should enqueue a stable "check due work" task; the
processor asks the Application service to evaluate Domain state and decide what
is due. Do not hide customer-visible deadlines, eligibility, compensation
state, or lifecycle transitions inside asynq options or processor-local
conditionals.

---

## 2. Default Technology Stack

Repositories adopting this guide use:

| Concern | Default library |
|---|---|
| Provider-neutral task contract | `github.com/go-jimu/components/taskqueue` |
| Asynq adapter | `github.com/go-jimu/contrib/taskqueue/asynq` |
| Provider runtime | `github.com/hibiken/asynq`, hidden behind `internal/pkg/taskqueue` |

Do not create project-local substitutes for `TaskType`, `Task`, `Enqueuer`, `Processor`, `Registrar`, `Worker`, `PeriodicTask`, `PeriodicTaskScheduler`, `SchemaRegistry`, task middleware, or asynq adapters when these components fit the use case.

The periodic-task rules below assume `github.com/go-jimu/components` v0.9.7+
for `components/taskqueue` and `github.com/go-jimu/contrib/taskqueue/asynq`
v0.3.3+ or newer compatible versions. Earlier versions may not enforce
interval-location and periodic enqueue-policy validation at construction time.

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

## 5. Periodic Task Producers

A periodic task is a **scheduled enqueue** of a concrete `taskqueue.Task`. It is
not a scheduler callback, not a second handler model, and not a place to run
business logic. The work still belongs to the normal one-`TaskType`,
one-payload-schema, one-`Processor` task contract from §§3-4.

Rules:

1. Define the `TaskType`, `Definition`, payload schema, and `Processor` exactly
   as for any other task.
2. Build a `taskqueue.PeriodicTask` from a stable semantic name, a
   `taskqueue.Schedule`, a concrete static `taskqueue.Task`, and enqueue
   policy options. This `name + Schedule + Task + EnqueuePolicy` shape is the
   narrow contract; do not add `Enabled`, callback handlers, tenant resolvers,
   run history, or provider runtime fields to `PeriodicTask`.
3. For configuration-disabled periodic work, do not construct, provide, or
   register the `PeriodicTask`. A disabled task should be absent from DI/module
   registration rather than represented by `PeriodicTask{Enabled:false}`.
4. Use `taskqueue.CronSchedule` for standard five-field cron expressions and
   `taskqueue.IntervalSchedule` for fixed intervals. Do not put provider
   extensions such as `CRON_TZ=` or `@every` into Application code; provider
   adapters compile the neutral schedule into provider syntax.
5. Use `taskqueue.WithLocation` only with `CronSchedule` when the schedule is
   location-specific. `IntervalSchedule(..., taskqueue.WithLocation(...))` is
   invalid because an interval is duration-based, not wall-clock based.
6. Keep periodic enqueue policy narrow. `WithUnique`, `WithMaxRetry`, and
   `WithTimeout` are normal periodic-task policies. `WithDelay` is allowed only
   when each scheduled fire should intentionally enqueue a task for later
   processing. Do not use `WithProcessAt` or `WithDeadline` on
   `PeriodicTask`; static absolute times become stale across repeated schedule
   fires and are rejected by the component contract.
7. Treat `PeriodicTask.Name()` as the duplicate key within one
   `PeriodicTaskScheduler` / registrar instance. Duplicate registration in that
   instance must fail with `taskqueue.ErrDuplicatePeriodicTask`. Cross-process
   or cross-replica duplicate registration is a runtime/deployment concern:
   use one scheduler deployment, leader election, a distributed lock, task
   uniqueness, and idempotent processors as appropriate.
8. Keep `PeriodicTask` payloads static. If the job needs "today", "current
   tenant set", or another dynamic value, enqueue a stable "run due work" task
   and derive dynamic inputs inside the processor or Application service using
   an injected clock/read model.
9. Register periodic tasks during startup wiring, never lazily in request
   handling or inside a processor.
10. Leave jitter, misfire/catch-up, pause/resume, run history, and dynamic
   schedule changes out of `PeriodicTask`. Add those as Application policy,
   provider/runtime adapter behavior, or a separate control-plane interface
   only when a real use case requires them.

Do not add `HandleFunc` or callback APIs to the scheduler. The scheduler's only
job is to enqueue the task; the already-registered `taskqueue.Processor`
handles the task when the worker receives it.

Example periodic task definition:

```go
// internal/business/billing/application/taskprocessor/generate_invoices.go
package taskprocessor

import (
    "context"
    "fmt"
    "time"

    "github.com/go-jimu/components/taskqueue"
)

const GenerateInvoicesTaskType taskqueue.TaskType = "billing.generate_invoices.v1"

var GenerateInvoicesTask = taskqueue.Definition{
    Type:  GenerateInvoicesTaskType,
    Queue: "billing",
}

type GenerateInvoicesPayload struct{}

func RegisterGenerateInvoicesSchema(registry *taskqueue.SchemaRegistry) error {
    return registry.Register(GenerateInvoicesTask, func() any { return &GenerateInvoicesPayload{} })
}

func NewGenerateInvoicesProcessor(
    registry *taskqueue.SchemaRegistry,
    service *InvoiceService,
) taskqueue.Processor {
    return taskqueue.NewProcessor(GenerateInvoicesTaskType, func(ctx context.Context, task taskqueue.Task) error {
        decoded, err := registry.DecodeJSON(task)
        if err != nil {
            return err
        }
        if _, ok := decoded.(*GenerateInvoicesPayload); !ok {
            return fmt.Errorf("%w: unexpected payload %T", taskqueue.ErrSkipRetry, decoded)
        }
        return service.GenerateDueInvoices(ctx)
    })
}

func NewDailyGenerateInvoicesTask(registry *taskqueue.SchemaRegistry) (taskqueue.PeriodicTask, error) {
    schedule, err := taskqueue.CronSchedule("0 2 * * *", taskqueue.WithLocation("Asia/Shanghai"))
    if err != nil {
        return taskqueue.PeriodicTask{}, err
    }

    task, err := registry.NewJSONTask(
        &GenerateInvoicesPayload{},
        taskqueue.WithKey("billing.generate_invoices.daily"),
    )
    if err != nil {
        return taskqueue.PeriodicTask{}, err
    }

    return taskqueue.NewPeriodicTask(
        "billing.generate_invoices.daily",
        schedule,
        task,
        taskqueue.WithUnique(25*time.Hour),
        taskqueue.WithMaxRetry(3),
        taskqueue.WithTimeout(10*time.Minute),
    )
}
```

The example intentionally has an empty payload. The processor asks the
Application service to generate currently due invoices; the scheduler does not
compute dates, query tenants, or call business services.

---

## 6. `internal/pkg/taskqueue` Runtime Boundary

`internal/pkg/taskqueue` owns the queue runtime for the service:

- its own `Option` struct and config tags;
- creation of asynq-backed `taskqueue.Enqueuer`;
- creation of the asynq-backed `taskqueue.Worker`;
- creation of the asynq-backed `taskqueue.PeriodicTaskScheduler` when the
  service has periodic producers;
- processor registration;
- periodic task registration;
- common middleware wrapping;
- `fx.Lifecycle` hooks for `Start(ctx)` and `Shutdown(ctx)`;
- cleanup hooks such as `client.Close()`;
- provider config such as queues, concurrency, Redis connection, scheduler
  options, and shutdown timeout.

When using the adopted asynq stack, `taskasynq.NewRedisScheduler` plus
`RegisterPeriodicTask` is the recommended Redis-backed production entry for
periodic enqueueing, not a temporary demo path. Keep that entry inside
`internal/pkg/taskqueue`; bounded contexts contribute `PeriodicTask` values and
never import the asynq adapter directly.

`cmd/**/main.go` should only aggregate options, import modules, and call `app.Run()`. It should not manually register processors, periodic tasks, middleware, schemas, hooks, create asynq objects, or start/stop workers/schedulers.

Use task words for taskqueue runtime objects: `Worker`, `ProcessorRouter`, `Registrar`, `PeriodicTaskScheduler`, `Processor`, `Enqueuer`. Do not introduce HTTP server, HTTP mux, or HTTP handler terminology for task workers or periodic producers.

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

type PeriodicTaskIn struct {
    fx.In
    PeriodicTasks []componenttaskqueue.PeriodicTask `group:"taskqueue.periodic_tasks"`
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

func NewPeriodicTaskScheduler(
    lc fx.Lifecycle,
    opt Option,
    in PeriodicTaskIn,
) (componenttaskqueue.PeriodicTaskScheduler, error) {
    scheduler := taskasynq.NewRedisScheduler(
        asynq.RedisClientOpt{Addr: opt.RedisAddr},
        &asynq.SchedulerOpts{},
    )

    for _, periodic := range in.PeriodicTasks {
        if err := scheduler.RegisterPeriodicTask(periodic); err != nil {
            return nil, err
        }
    }

    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            return scheduler.Start(ctx)
        },
        OnStop: func(ctx context.Context) error {
            if opt.ShutdownTimeout <= 0 {
                return scheduler.Shutdown(ctx)
            }
            shutdownCtx, cancel := context.WithTimeout(ctx, opt.ShutdownTimeout)
            defer cancel()
            return scheduler.Shutdown(shutdownCtx)
        },
    })
    return scheduler, nil
}
```

Bounded-context modules should contribute processors, periodic task definitions,
and schema registrations, not construct workers or schedulers:

```go
var Module = fx.Module(
    "domain.billing",
    fx.Provide(
        NewInvoiceService,
        fx.Annotate(
            taskprocessor.NewGenerateInvoicesProcessor,
            fx.As(new(taskqueue.Processor)),
            fx.ResultTags(`group:"taskqueue.processors"`),
        ),
        fx.Annotate(
            taskprocessor.NewDailyGenerateInvoicesTask,
            fx.ResultTags(`group:"taskqueue.periodic_tasks"`),
        ),
    ),
    fx.Invoke(
        taskprocessor.RegisterGenerateInvoicesSchema,
    ),
)
```

The exact `fx.Annotate` style may vary by repository. The invariant is stable: the bounded context owns task semantics, and `internal/pkg/taskqueue` owns provider runtime registration.

---

## 7. Middleware and Observability

Every worker should install at least:

- `taskqueue.Recover()` to convert panics into a stable error;
- `taskqueue.Logging(logger)` to log task type, queue, key, outcome, elapsed time, and provider execution metadata when present.

Use `taskqueue.ExecutionInfoFromContext(ctx)` inside processors only when the use case needs provider metadata for diagnostics. Do not make retry count, queue name, or asynq task ID part of Domain decisions.

Middleware belongs in `internal/pkg/taskqueue`, not in each processor. Add application-specific logging fields in the processor only when they are semantic identifiers such as aggregate ID, tenant ID, or command ID.

---

## 8. Enqueueing Rules

Application use cases may enqueue tasks through `taskqueue.Enqueuer`.

Rules:

- Build tasks through the schema registry where available: `registry.NewJSONTask(&Payload{...}, taskqueue.WithKey(...))`.
- Use `taskqueue.WithKey` for natural idempotency or ordering keys.
- Use `taskqueue.WithUnique` when duplicate suppression is part of the delivery policy.
- Use `taskqueue.WithDelay` / `WithProcessAt` for planned future attempts.
- Use `WithMaxRetry`, `WithTimeout`, and `WithDeadline` to make failure policy explicit when defaults are not acceptable.
- Do not pass asynq options through Application APIs. Provider-specific options stay in `internal/pkg/taskqueue`.

These enqueueing rules apply to one-off or follow-up tasks. Periodic task
policy is narrower: `PeriodicTask` must not use `WithProcessAt` or
`WithDeadline`, and `WithDelay` needs an explicit reason because it delays every
scheduled fire.

If enqueueing is a direct consequence of a Domain state change, first consider whether the reaction should be modeled as a same-BC Domain Event handler or a Boundary Publisher. Use task enqueueing directly from a command only when the delayed/background task is an explicit output of that command and the Architecture Gate says why event/message extraction is not the better fit.

---

## 9. Testing Rules

Test by layer:

- Domain tests cover business rules without taskqueue imports.
- Application processor tests use a fake `taskqueue.Enqueuer` and real `taskqueue.SchemaRegistry` payload encoding/decoding.
- Application periodic-task tests use the real `taskqueue.SchemaRegistry` and
  assert the `PeriodicTask` name, schedule, static task envelope, and enqueue
  policy. They do not test provider cron syntax.
- Configuration-disabled periodic tasks are tested by asserting the producer is
  not provided/registered, not by asserting an `Enabled` flag.
- Runtime tests for `internal/pkg/taskqueue` verify processor registration,
  periodic task registration, middleware wrapping, and lifecycle hook behavior
  without depending on business processors.
- Provider adapter tests verify schedule compilation and enqueue-policy mapping
  to asynq options, including rejecting interval schedules with locations and
  rejecting periodic `WithProcessAt` / `WithDeadline` policies; provider
  integration tests may use Redis/asynq when the repository already has
  integration-test infrastructure.

Do not test task payload handling by reimplementing JSON encoding logic in assertions. Create tasks with `SchemaRegistry.NewJSONTask`, process them through the real processor, and assert observable application behavior or enqueue calls.

---

## 10. Anti-patterns

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
11. A scheduler exposes `HandleFunc`, callback registration, or business-service calls instead of enqueueing a `PeriodicTask`.
12. Application code passes provider-specific schedule strings such as `CRON_TZ=...` or `@every ...` instead of `CronSchedule`, `IntervalSchedule`, and `WithLocation`.
13. Periodic task payload construction tries to compute dynamic values such as today's date, tenant lists, or external state during scheduler registration.
14. `cmd/**/main.go` registers periodic tasks or starts/stops schedulers directly.
15. `IntervalSchedule` is combined with `WithLocation`; use `CronSchedule` for wall-clock scheduling.
16. `PeriodicTask` uses `WithProcessAt` or a static `WithDeadline`.
17. A configuration toggle is modeled as `PeriodicTask.Enabled` instead of omitting registration.
18. Code assumes `ErrDuplicatePeriodicTask` protects against multi-process or multi-replica duplicate schedulers without a runtime coordination mechanism.

---

## 11. Completion Self-Check

Before claiming a taskqueue change is complete:

- [ ] `ddd-agent-contract.md`, `ddd-golang.md`, `ddd-golang-runtime.md`, and this file were read when applicable.
- [ ] Every task has exactly one `TaskType`, one payload schema, and one processor.
- [ ] The schema is registered during startup/module wiring, not lazily at processing time.
- [ ] The processor lives under the bounded context's `application` subtree.
- [ ] Periodic producers use `taskqueue.PeriodicTask`, `CronSchedule` / `IntervalSchedule`, and `PeriodicTaskScheduler`; no scheduler `HandleFunc` or provider-specific schedule string leaked into Application code.
- [ ] Periodic tasks have stable names, static task envelopes, and explicit duplicate/idempotency policy when needed.
- [ ] Business-visible scheduling, deadline, pause/resume, catch-up, retry eligibility, and compensation rules were modeled as Domain/Application policy before taskqueue runtime wiring.
- [ ] Periodic schedules use `WithLocation` only with `CronSchedule`; `IntervalSchedule` remains duration-based.
- [ ] Periodic enqueue policy avoids `WithProcessAt` and `WithDeadline`; `WithDelay` has an explicit every-fire deferral reason.
- [ ] Configuration-disabled periodic tasks are not registered, and duplicate-name expectations are scoped to one scheduler/registrar instance unless runtime coordination is documented.
- [ ] `internal/pkg/taskqueue` owns asynq client/worker/scheduler creation, middleware, registration, and lifecycle hooks.
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
