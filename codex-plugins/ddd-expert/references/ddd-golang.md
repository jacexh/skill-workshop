---
name: ddd-golang
description: Go / go-jimu DDD reference. Use when a DDD phase skill needs Go-specific file placement, object-shape routing, package boundaries, go-jimu component choices, logging, tests, or module assembly guidance.
---

# Go / go-jimu Reference Router

This file is the Go entry point. It should help the agent choose the smallest Go reference set, not teach DDD from scratch. Load it after `explore` / `shape` has accepted the model, or when `guard` needs to map observed Go code to expected DDD shape.

Use [`ddd-modeling.md`](ddd-modeling.md) for model decisions, [`ddd-core.md`](ddd-core.md) for language-neutral architecture rules, and the layer files below for Go / go-jimu implementation shape.

## Layer Reference Map

| Concern | Load | Use for |
|---|---|---|
| Scaffold / project layout | [`ddd-golang-scaffold.md`](ddd-golang-scaffold.md) | `internal/business/<context>`, `internal/pkg`, `pkg/gen`, module roots, generated-code layout, test layout |
| Domain | [`ddd-golang-domain.md`](ddd-golang-domain.md) | Aggregate Root, Entity, Value Object, Domain Service, Repository interface, Domain Event recording, FSM, Domain errors |
| Application | [`ddd-golang-application.md`](ddd-golang-application.md) | command handler, Application service, generated RPC shortcut, event/message handler placement, execution-boundary logging |
| CQRS / read side | [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) | QueryRepository, read DTO, query handler, read facade, projection/read-model update |
| Infrastructure | [`ddd-golang-infrastructure.md`](ddd-golang-infrastructure.md) | Repository implementation, DO/converter, persistence adapter, ACL/external adapter, generated protocol adapter placement |
| Database standards | [`database.md`](database.md) | SQL fields, timestamp type, soft delete, optimistic lock, migration/index rules |
| Domain Events / messages | [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) | `event.Collection`, Domain Event Handler, Boundary Publisher, Integration Message Handler, Kafka adapter |
| Taskqueue / periodic work | [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) | `TaskType`, Processor, enqueue policy, `PeriodicTask`, asynq runtime wiring |
| Runtime / config / lifecycle | [`ddd-golang-runtime.md`](ddd-golang-runtime.md) | `cmd`, `fx.Module`, `Option`, `fx.Lifecycle`, shutdown, config profiles, Kubernetes |

## Object Shape Router

| Accepted object shape | Start with | Stop / return upstream when |
|---|---|---|
| Aggregate Root | [`ddd-golang-domain.md §0.1`](ddd-golang-domain.md) | aggregate boundary, identity, lifecycle, or invariant owner is not accepted |
| Entity / Value Object | [`ddd-golang-domain.md §0.2`](ddd-golang-domain.md) | identity vs value semantics are unclear |
| Domain Service / policy | [`ddd-golang-domain.md §0.3`](ddd-golang-domain.md) | the rule can belong to one aggregate or is actually Application orchestration |
| Repository interface | [`ddd-golang-domain.md §0.4`](ddd-golang-domain.md) | repository exists only because a database table exists |
| Command Handler / Application service | [`ddd-golang-application.md §0.1`](ddd-golang-application.md) | use-case boundary, transaction owner, or event dispatch timing is not designed |
| QueryRepository | [`ddd-golang-cqrs.md §0.1`](ddd-golang-cqrs.md) | read model family, freshness, authorization, or source semantics are unknown |
| Read DTO / read model | [`ddd-golang-cqrs.md §0.2`](ddd-golang-cqrs.md) | read contract shape is mixed with write-side Domain behavior |
| Query Handler | [`ddd-golang-cqrs.md §0.3`](ddd-golang-cqrs.md) | it is unclear whether the read path is trivial delegation or real orchestration |
| Cross-context read facade | [`ddd-golang-cqrs.md §0.4`](ddd-golang-cqrs.md) | owning context, publication boundary, or freshness semantics are unknown |
| Projection / read-model updater | [`ddd-golang-cqrs.md §0.5`](ddd-golang-cqrs.md) | projection trigger, source event/message/task, or consistency semantics are unknown |
| Repository implementation / DO / converter | [`ddd-golang-infrastructure.md §0.1`](ddd-golang-infrastructure.md), [`database.md`](database.md) | Domain object shape or persistence authority is not accepted |
| Domain Event type | [`ddd-golang-events-messages.md §0.1`](ddd-golang-events-messages.md), [`ddd-golang-domain.md §0.1`](ddd-golang-domain.md) | same-BC fact vs cross-context contract is unclear |
| Event collection / command-side dispatch | [`ddd-golang-events-messages.md §0.2`](ddd-golang-events-messages.md), [`ddd-golang-application.md §0.1`](ddd-golang-application.md) | drain/dispatch owner or persistence timing is unclear |
| Domain Event Handler | [`ddd-golang-events-messages.md §0.3`](ddd-golang-events-messages.md) | same-BC reaction role is not classified |
| Boundary Publisher | [`ddd-golang-events-messages.md §0.4`](ddd-golang-events-messages.md) | Domain Event to Integration Message boundary is unclear |
| Integration Message Handler | [`ddd-golang-events-messages.md §0.5`](ddd-golang-events-messages.md) | cross-context consumer role is not classified |
| Task contract / processor / periodic producer | [`ddd-golang-taskqueue.md §0`](ddd-golang-taskqueue.md) | task lifecycle is business-visible and not modeled |
| Runtime component / entrypoint / lifecycle | [`ddd-golang-runtime.md §0`](ddd-golang-runtime.md) | process ownership, shutdown, config, or module placement is unknown |
| Generated RPC / protocol adapter | [`ddd-golang-application.md §0.7`](ddd-golang-application.md), [`ddd-golang-scaffold.md §0.4`](ddd-golang-scaffold.md) | generated type would leak into Domain or use-case packages |
| Logging-only change | [`ddd-golang-application.md §0.8`](ddd-golang-application.md), [`ddd-golang-runtime.md §0`](ddd-golang-runtime.md) | log owner is not an execution boundary |

## Go Planning Additions

For Go implementation plans, keep the DDD model source separate from code placement:

- **Local package change:** name the bounded context, package path, layer, and why the layer owns the behavior.
- **New use case:** name command/query/event/message/task shape, transaction boundary, event/message dispatch timing, and tests.
- **New aggregate or bounded context:** name package layout, data authority, Repository/QueryRepository split, module assembly owner, and cross-context contracts.
- **Cross-context change:** name producing context, published payload contract, consuming handler/facade/ACL, idempotency, and generated-code impact.
- **Runtime-only change:** use `ddd-golang-runtime.md`; do not fabricate DDD gate fields for pure process/config/shutdown work.

## Go Defaults

These defaults apply when a repository has adopted this guide or existing code already uses these components.

| Concern | Default |
|---|---|
| Dependency injection | `go.uber.org/fx` |
| Generated RPC | ConnectRPC / gRPC generated stubs; thin mapping at the accepted adapter boundary |
| Domain Events | `github.com/go-jimu/components/ddd/event` |
| Integration Messages | `github.com/go-jimu/components/ddd/message` |
| Kafka adapter | `github.com/go-jimu/contrib/message/kafka` with explicit `FailurePolicy` |
| Taskqueue | `github.com/go-jimu/components/taskqueue` and `github.com/go-jimu/contrib/taskqueue/asynq` |
| FSM | `github.com/go-jimu/components/fsm` when lifecycle complexity crosses the FSM threshold |
| Logging | `log/slog` plus `github.com/go-jimu/components/sloghelper` |
| Error wrapping | `github.com/samber/oops` when the repository uses it |
| Configuration | `github.com/go-jimu/components/config` + `config/loader` |

If existing repository code has standardized on a different component, record the local convention and use it consistently. Do not invent local substitutes for adopted go-jimu component contracts.

## Package Boundary Rules

- Domain never imports generated protocol packages, database/ORM clients, message brokers, Redis/cache clients, runtime packages, `internal/pkg` adapters, another bounded context's Domain package, or Infrastructure.
- Application use-case packages depend on Domain and Application-owned ports. `application/application.go` may import generated RPC types only when the repository uses the Go RPC shortcut and the method remains thin.
- Infrastructure implements Domain/Application ports and owns database, broker, external API, retry, cache, and SDK mechanics.
- `internal/pkg/<capability>` owns shared technical clients and runtime adapters; bounded-context Infrastructure receives initialized clients.
- `pkg/gen/**` is generated protocol code, not Domain model.

## Logging Rule

Domain code does not log. It returns errors and records Domain Events. Every active execution boundary logs exactly one completion summary for success, failure, skip, or retry with `operation`, `outcome`, `duration_ms`, relevant IDs, and `sloghelper.Error(err)` on failure.

Execution boundaries include RPC/HTTP handlers, command/query handlers when they are entrypoints, Domain Event handlers, Integration Message handlers, task processors, scheduler ticks, long-running loops, and lifecycle hooks. Avoid duplicate error logs when outer middleware already owns the completion log.

## File Quick Index

| Path | Owner |
|---|---|
| `internal/business/<context>/domain/<aggregate>.go` | Aggregate Root / Entity |
| `internal/business/<context>/domain/valueobject.go` | Value Objects |
| `internal/business/<context>/domain/event.go` | Domain Event types |
| `internal/business/<context>/domain/repository.go` | write-side Repository interface |
| `internal/business/<context>/application/command/<use_case>.go` | command + command handler |
| `internal/business/<context>/application/query/repository.go` | QueryRepository/read-side ports |
| `internal/business/<context>/application/query/dto.go` | read DTOs/read models |
| `internal/business/<context>/application/eventhandler/<event>.go` | same-BC Domain Event Handler |
| `internal/business/<context>/application/messagepublisher/<event>_publisher.go` | Domain Event -> Integration Message Boundary Publisher |
| `internal/business/<context>/application/messagehandler/<message>.go` | Integration Message Handler |
| `internal/business/<context>/application/taskprocessor/<task>.go` | taskqueue Processor |
| `internal/business/<context>/application/application.go` | Application constructor and optional generated RPC shortcut |
| `internal/business/<context>/interfaces/**` | hand-written protocol adapters only |
| `internal/business/<context>/infrastructure/**` | repository implementations, DOs, converters, ACLs, external adapters |
| `internal/business/<context>/api/**` | published same-process read facade/API for other bounded contexts |
| `internal/pkg/<capability>/**` | shared technical runtime/client package |
| `pkg/gen/**` | generated protocol contracts |

## Review Shortcuts

- Business condition branches over aggregate state outside Domain usually route to [`ddd-golang-domain.md`](ddd-golang-domain.md) and the Domain behavior baseline.
- New command-side Application ports route to [`ddd-modeling.md §0.2`](ddd-modeling.md) before implementation.
- Generated RPC methods with repository calls, transactions, dispatch, enqueueing, or multi-port orchestration route to [`ddd-golang-application.md §0.7`](ddd-golang-application.md) and the Interface/Application baseline.
- Database schema, DO/converter, optimistic-lock, and soft-delete changes route to [`ddd-golang-infrastructure.md`](ddd-golang-infrastructure.md) plus [`database.md`](database.md).
- Runtime loops, polling, schedulers, and shutdown behavior route to [`ddd-golang-runtime.md`](ddd-golang-runtime.md) and/or [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md).

## References

- [`ddd-modeling.md`](ddd-modeling.md)
- [`ddd-core.md`](ddd-core.md)
- [`ddd-agent-contract.md`](ddd-agent-contract.md)
