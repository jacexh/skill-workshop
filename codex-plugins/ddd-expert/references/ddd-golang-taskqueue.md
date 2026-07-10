---
name: ddd-golang-taskqueue
description: Go House Style for Application-owned internal task contracts, Transport task processors, provider-neutral enqueue policy, periodic triggers, and Asynq runtime wiring.
---

# Go Task Queue

A Task Queue is a conditional internal delivery mechanism for deferred
Application work. Do not introduce it before the design accepts background task
execution. Once accepted, use:

- `github.com/go-jimu/components/taskqueue` for provider-neutral contracts;
- `github.com/go-jimu/contrib/taskqueue/asynq` for the Asynq adapter;
- `github.com/hibiken/asynq` only in `internal/pkg/taskqueue`.

An external bounded context sends an Integration Message. It never enqueues
another context's internal task directly.

## Responsibility and Placement

```text
internal/business/<context>/
  application/
    task/
      <task>.go             # TaskType, Definition, payload, task constructor
  transport/
    taskprocessor/
      <task>.go             # taskqueue.Processor -> one Application Command
  <context>.go              # schema/processor/periodic contribution

internal/pkg/taskqueue/
  taskqueue.go              # registry, Asynq client/worker/scheduler, lifecycle
```

| Responsibility | Owner |
|---|---|
| Business eligibility, deadline, terminal state, compensation | Domain/Application |
| Versioned task type, definition, payload, task construction | Application `task` package |
| Enqueue accepted deferred work | Application through `taskqueue.Enqueuer` |
| Decode one task and delegate to one command | Transport `taskprocessor` |
| Redis, Asynq options, worker retry, concurrency, middleware, lifecycle | Runtime |
| Provider-neutral periodic task and semantic schedule | BC assembly |
| Asynq schedule registration, leadership, replica coordination, lifecycle | Runtime |

Do not add project-local `JobQueue`, `TaskDispatcher`, or `AsynqClient` ports
that duplicate `taskqueue.Enqueuer`, `SchemaRegistry`, `Processor`, and the
adopted adapter.

## Application Task Contract

Define a stable, versioned `taskqueue.TaskType`, one `taskqueue.Definition`, and
one JSON payload under `application/task`. Payloads carry stable identifiers and
immutable facts needed to invoke the use case. They do not carry Aggregates,
Data Objects, protobuf messages, or Asynq types.

```go
// internal/business/document/application/task/review_document.go
package task

import "github.com/go-jimu/components/taskqueue"

const ReviewDocumentType taskqueue.TaskType = "document.review.v1"

var ReviewDocumentDefinition = taskqueue.Definition{
	Type:  ReviewDocumentType,
	Queue: "document",
}

type ReviewDocument struct {
	DocumentID string `json:"document_id"`
}

func RegisterReviewDocument(registry *taskqueue.SchemaRegistry) error {
	return registry.Register(ReviewDocumentDefinition, func() any {
		return &ReviewDocument{}
	})
}

func NewReviewDocument(
	registry *taskqueue.SchemaRegistry,
	documentID string,
) (taskqueue.Task, error) {
	return registry.NewJSONTask(
		&ReviewDocument{DocumentID: documentID},
		taskqueue.WithKey(documentID),
	)
}
```

Use the shared `SchemaRegistry`; register definitions during module startup, not
lazily during enqueue or processing. `SchemaRegistry.NewJSONTask` finds the
registered `Definition` from the payload type. `SchemaRegistry.DecodeJSON`
resolves `Task.Type()` and returns a newly allocated registered payload.

The optional `Definition.Queue` is a provider-neutral lane. Set it only when an
accepted operational design needs a named lane; otherwise leave it empty for
the runtime default.

## Enqueue from Application

Application may directly depend on `taskqueue.Enqueuer` and
`taskqueue.SchemaRegistry`. It may use the component's provider-neutral
policies when the accepted workflow needs them:

- `WithDelay` or `WithProcessAt` for an explicit future attempt;
- `WithMaxRetry` for provider failure attempts;
- `WithTimeout` for one execution attempt;
- `WithDeadline` for the last acceptable provider attempt;
- `WithUnique` for bounded provider duplicate suppression.

```go
// internal/business/document/application/command/request_review.go
package command

import (
	"context"
	"time"

	"github.com/go-jimu/components/taskqueue"
	applicationtask "example.com/service/internal/business/document/application/task"
)

type RequestReviewHandler struct {
	registry *taskqueue.SchemaRegistry
	enqueuer taskqueue.Enqueuer
}

func (h *RequestReviewHandler) enqueueReview(ctx context.Context, documentID string) error {
	queued, err := applicationtask.NewReviewDocument(h.registry, documentID)
	if err != nil {
		return err
	}
	return h.enqueuer.Enqueue(
		ctx,
		queued,
		taskqueue.WithMaxRetry(3),
		taskqueue.WithTimeout(2*time.Minute),
	)
}
```

These options are delivery policy, not Domain truth. Asynq queue names, Redis
configuration, `asynq.Option`, and worker retry metadata remain in Runtime.

Direct enqueue after a database commit has a commit gap. Do not silently add a
durable task/outbox mechanism. If state and task intent must be atomic, require
an accepted persistence design first.

## Transport Task Processor

A processor lives under `transport/taskprocessor`, implements one
`taskqueue.Processor`, decodes with the real `SchemaRegistry`, maps to one
Application Command, and delegates once.

```go
// internal/business/document/transport/taskprocessor/review_document.go
package taskprocessor

import (
	"context"
	"fmt"

	"github.com/go-jimu/components/taskqueue"
	"example.com/service/internal/business/document/application"
	"example.com/service/internal/business/document/application/command"
	applicationtask "example.com/service/internal/business/document/application/task"
)

type ReviewDocumentProcessor struct {
	registry *taskqueue.SchemaRegistry
	app      *application.Application
}

var _ taskqueue.Processor = (*ReviewDocumentProcessor)(nil)

func NewReviewDocumentProcessor(
	registry *taskqueue.SchemaRegistry,
	app *application.Application,
) *ReviewDocumentProcessor {
	return &ReviewDocumentProcessor{registry: registry, app: app}
}

func (*ReviewDocumentProcessor) TaskType() taskqueue.TaskType {
	return applicationtask.ReviewDocumentType
}

func (p *ReviewDocumentProcessor) Process(ctx context.Context, queued taskqueue.Task) error {
	decoded, err := p.registry.DecodeJSON(queued)
	if err != nil {
		return err
	}
	payload, ok := decoded.(*applicationtask.ReviewDocument)
	if !ok {
		return fmt.Errorf("%w: unexpected review payload %T", taskqueue.ErrSkipRetry, decoded)
	}
	return p.app.Commands.ReviewDocument.Handle(ctx, command.ReviewDocument{
		DocumentID: payload.DocumentID,
	})
}
```

`taskqueue.DecodeJSON` wraps malformed JSON with `taskqueue.ErrSkipRetry`.
The Asynq adapter translates an error matching `taskqueue.ErrSkipRetry` to
`asynq.SkipRetry`, so Transport can reject a permanently invalid delivery
without importing Asynq.

Outcome rules:

- `nil`: the Application use case completed or reached an accepted stable no-op;
- ordinary non-nil error: the attempt failed and provider retry policy may run;
- error matching `taskqueue.ErrSkipRetry`: the delivery is permanently invalid
  or unsupported and provider retry must stop.

Business eligibility, transaction control, and Domain validation stay in the
Application/Domain path. The processor does not query repositories to decide
business behavior and does not treat every Domain rejection as a technical
retry.

## Polling and Follow-up Tasks

"Not ready yet" is an expected workflow state, not a failed provider attempt.
Application explicitly creates the next delayed task and the current processor
returns `nil` after that enqueue succeeds.

Every polling flow must have a business deadline, a maximum semantic attempt,
a terminal state, or an explicit exhaustion/compensation outcome. Provider
retry count from `taskqueue.ExecutionInfoFromContext` is diagnostic metadata;
it must not replace persisted workflow state or drive Domain decisions.

Repeated tasks are expected. Use Domain guards, deterministic keys, natural
convergence, or an accepted persistent idempotency mechanism. `WithUnique` is a
bounded provider feature, not proof of business idempotency.

## Periodic Tasks

A periodic scheduler only enqueues a normal Internal Task Contract. It does not
call an Application service or execute business logic itself. BC assembly owns
the accepted provider-neutral periodic task, including its semantic cron and
business timezone. Runtime owns Asynq registration, scheduler leadership,
replica coordination, and lifecycle. Domain/Application owns business-visible
due state, deadlines, pause/resume, catch-up, and compensation. When schedule
values are deployment-configurable, Runtime supplies validated values to the BC
provider without taking ownership of which business task the schedule triggers.

Use the real provider-neutral schedule API:

```go
// internal/business/billing/billing.go (BC module provider)
package billing

import (
	"time"

	"github.com/go-jimu/components/taskqueue"
	applicationtask "example.com/service/internal/business/billing/application/task"
)

func NewDailyInvoiceCheck(
	registry *taskqueue.SchemaRegistry,
) (taskqueue.PeriodicTask, error) {
	schedule, err := taskqueue.CronSchedule(
		"0 2 * * *",
		taskqueue.WithLocation("Asia/Taipei"),
	)
	if err != nil {
		return taskqueue.PeriodicTask{}, err
	}

	queued, err := applicationtask.NewEvaluateDueInvoices(registry)
	if err != nil {
		return taskqueue.PeriodicTask{}, err
	}
	return taskqueue.NewPeriodicTask(
		"billing.evaluate_due_invoices.daily",
		schedule,
		queued,
		taskqueue.WithUnique(23*time.Hour),
		taskqueue.WithMaxRetry(3),
	)
}
```

`CronSchedule` accepts a standard five-field expression and optional IANA
location. `IntervalSchedule` accepts a positive `time.Duration` and rejects a
location. A `PeriodicTask` has a static Task envelope; resolve "today", current
tenants, and currently due records inside the Application use case. The
component rejects `WithProcessAt` and `WithDeadline` on `PeriodicTask` because
static absolute times become stale on repeated fires.

`PeriodicTask.Name()` is unique only within one scheduler instance. Multiple
replicas still require one scheduler deployment, leader election, a distributed
lock, or another accepted coordination mechanism.

## Asynq Runtime

Only `internal/pkg/taskqueue` imports the adapter and provider:

```go
import (
	"github.com/go-jimu/components/taskqueue"
	taskasynq "github.com/go-jimu/contrib/taskqueue/asynq"
	"github.com/hibiken/asynq"
)
```

Runtime owns these real constructors and capabilities:

```go
registry := taskqueue.NewSchemaRegistry()

client := taskasynq.NewRedisClient(redisOptions) // taskqueue.Enqueuer
worker := taskasynq.NewRedisWorker(redisOptions, workerConfig)
scheduler := taskasynq.NewRedisScheduler(redisOptions, schedulerOptions)

if err := worker.Register(processor); err != nil {
	return err
}
if err := scheduler.RegisterPeriodicTask(periodic); err != nil {
	return err
}
```

Here `redisOptions` is an `asynq.RedisConnOpt`, `workerConfig` is an
`asynq.Config`, and `schedulerOptions` is `*asynq.SchedulerOpts`.

The BC module contributes schema registrations, `taskqueue.Processor` values,
and accepted `taskqueue.PeriodicTask` values. Runtime registers them before
startup, closes the enqueue client, and manages worker/scheduler `Start` and
`Shutdown` with Fx lifecycle hooks. `cmd/<service>/main.go` does not construct or
register these objects.

Install panic recovery and one completion-log boundary in Runtime middleware.
`taskqueue.Recover()` is available. `taskqueue.Logging(logger)` is also
available, but it currently emits both start and completion records with its
own field format; use it only when that output matches the service logging
contract, otherwise install the service's single-completion middleware once.

## Verification

- Application task tests use a real `SchemaRegistry` and assert the encoded
  type, payload, key, and provider-neutral enqueue options.
- Transport processor tests create tasks through
  `SchemaRegistry.NewJSONTask`, execute the real processor, and assert one
  Application delegation, retry error, or `ErrSkipRetry` result.
- Polling tests cover not-ready re-enqueue, deadline/exhaustion, duplicate
  execution, and terminal no-op behavior.
- Periodic tests assert `PeriodicTask` name, schedule, static task, and policy;
  they do not reimplement Asynq cron compilation.
- Runtime tests cover duplicate registration, worker/scheduler startup,
  bounded shutdown, and disabled periodic producers not being registered.
- Provider integration tests use Redis/Asynq when the change depends on actual
  enqueue, retry, uniqueness, or scheduler behavior.
