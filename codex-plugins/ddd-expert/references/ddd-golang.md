---
name: ddd-golang
description: Go DDD House Style baseline and navigation index for dependency boundaries, mandatory components, and the focused layer, flow, or platform guide to load.
---

# Go DDD House Style Baseline

## Applies When

Load this router after the accepted design selects Go. Read this baseline, then
load the smallest complete set of leaves covering the touched code surfaces.
Every leaf realizes an already selected design while preserving accepted
Aggregate boundaries, state authority, and business sequencing.

## Dependency Direction

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
<context>.go and internal/pkg -> composition and Runtime
```

| Layer | Owns | Must not own |
|---|---|---|
| Domain | Aggregates, Entities, Value Objects, Domain Services, Domain Events, business sequencing, write Repository and Domain-timed collaborator contracts | protocol, persistence, logging, task/message provider mechanics, Runtime |
| Application | Commands, Queries, use-case coordination/context, Application-owned semantic capabilities, `Application` registry, DTO assemblers, same-context reactions, internal task contracts | ConnectRPC/HTTP handlers, xorm, Kafka/Asynq clients, process lifecycle |
| Transport | ConnectRPC/HTTP handlers, Integration Message subscribers, task processors, scheduled inbound triggers | Repositories, transactions, Aggregate mutation, provider runtimes |
| Infrastructure | Repository/QueryRepository implementations, DO conversion, ACLs, external adapters | Domain decisions, inbound protocol handling, process lifecycle |
| Runtime | Fx composition, configuration, shared clients, servers, consumers, workers, schedulers, telemetry, shutdown | business rules and bounded-context language |

Application has three narrow, accepted provider-neutral exceptions:

- a producing Application event handler may map a Domain Event to its own generated Integration Message contract and call `message.Publisher`;
- an accepted internal task may define its durable payload schema under `proto/<context>/task/v1`, then use `components/taskqueue` and `Enqueuer` under `application/task`;
- only for a confirmed same-BC, one-resource multi-Root transaction, a Command Handler may use the project-local `internal/pkg/transaction.Transactor` callback. Its xorm implementation and current-executor resolution remain in `internal/pkg/database`.

Generated RPC/HTTP types remain in Transport. Kafka, franz-go, Asynq, Redis, xorm sessions, Fx, and active loops remain outside Application.

## Reference Map

### Layer Guides

| Responsibility | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, Repository contract | [`ddd-golang-domain.md`](ddd-golang-domain.md) |
| Command, Query, Application service, `application.go`, assembler, transaction coordination | [`ddd-golang-application.md`](ddd-golang-application.md) |
| ConnectRPC, Chi HTTP, message subscriber, task processor, error mapping | [`ddd-golang-transport.md`](ddd-golang-transport.md) |
| xorm persistence, DO/convert, QueryRepository adapter, ACL/external adapter | [`ddd-golang-infrastructure.md`](ddd-golang-infrastructure.md) |

### Flow Guides

| End-to-end flow | Load |
|---|---|
| Read model separation, QueryRepository, projections | [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) |
| Local Domain Event and same-context reaction | [`ddd-golang-events.md`](ddd-golang-events.md) |
| Published fact/intent and provider-neutral message subscriber | [`ddd-golang-messages.md`](ddd-golang-messages.md) |
| Internal task contract, processor, polling, periodic task | [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) |
| Accepted `components/fsm` lifecycle | [`ddd-golang-fsm.md`](ddd-golang-fsm.md) |

### Platform Guides

| Platform concern | Load |
|---|---|
| Multi-BC layout, generated code, modules, tests | [`ddd-golang-scaffold.md`](ddd-golang-scaffold.md) |
| Configuration, Fx, server/worker lifecycle, logging, shutdown | [`ddd-golang-runtime.md`](ddd-golang-runtime.md) |
| Kafka provider runtime | [`ddd-golang-kafka.md`](ddd-golang-kafka.md) |
| Asynq provider runtime | [`ddd-golang-asynq.md`](ddd-golang-asynq.md) |
| Accepted OpenTelemetry | [`ddd-golang-observability.md`](ddd-golang-observability.md) |
| MySQL schema, SQL, indexes, locking, migrations | [`database.md`](database.md) |

Load [`ddd-core.md`](ddd-core.md) only for an affected cross-language
object/layer realization and [`ddd-collaboration.md`](ddd-collaboration.md)
only for an accepted published API, Domain Event, or Integration Message.

## Mandatory Adopted Stack

| Concern | Mandatory implementation | Applicability |
|---|---|---|
| Dependency injection and lifecycle | `go.uber.org/fx` | Go service Runtime |
| RPC | `connectrpc.com/connect` | RPC API exists |
| HTTP routing | `github.com/go-chi/chi/v5` | ConnectRPC mounting or hand-written HTTP exists |
| Contract toolchain | Buf, Protobuf, `google.golang.org/protobuf` | RPC, Integration Message, or durable Task payload contract exists; output is `gen/` |
| Business-data validation | `github.com/go-playground/validator/v10` | Domain Entity or Value Object validation |
| ORM | `xorm.io/xorm` | MySQL persistence or QueryRepository exists |
| MySQL driver | `github.com/go-sql-driver/mysql` | MySQL Runtime exists |
| UUID identity | `github.com/google/uuid`, UUIDv7 | A new UUID identity is required |
| Domain Events | `github.com/go-jimu/components/ddd/event` | Aggregate records same-context facts |
| Integration Messages | `github.com/go-jimu/components/ddd/message` | Cross-context asynchronous collaboration is accepted |
| Kafka | `github.com/go-jimu/contrib/message/kafka` | Kafka delivery is accepted |
| Kafka Runtime | `github.com/twmb/franz-go` | Kafka exists; import only from Runtime/provider code |
| Task Queue | `github.com/go-jimu/components/taskqueue` | Internal deferred work is accepted |
| Asynq adapter | `github.com/go-jimu/contrib/taskqueue/asynq` | Asynq delivery is accepted |
| Asynq Runtime | `github.com/hibiken/asynq` | Asynq exists; import only from Runtime/provider code |
| State machine | `github.com/go-jimu/components/fsm` | Lifecycle behavior warrants FSM |
| Logging | `log/slog` and `github.com/go-jimu/components/sloghelper` | Every Go service |
| Error enrichment | `github.com/samber/oops` | Errors cross a controlled boundary |
| Configuration | `github.com/go-jimu/components/config/loader` | Go service Runtime |
| Distributed tracing | OpenTelemetry Go, OTLP, `connectrpc.com/otelconnect` | Tracing is accepted and a backend/collector is available |

The table is the implementation default for covered concerns. Changing a stack
entry is a project technology decision rather than a per-use-case choice.

## Cross-cutting House Rules

- Every bounded context exposes `application/application.go`, `application/assembler.go`, and `<context>.go` as described by the Scaffold guide.
- `Application.Commands` contains every Command Handler; `Application.Queries` contains every Query Handler. Transport receives the registry and delegates once.
- Application DTO/Domain Entity conversion lives in `application/assembler.go`. DO/Domain Entity conversion lives in `infrastructure/convert.go`.
- Exported Domain fields are a mechanical mapping surface. New Aggregates use `domain.NewXxx` or another Domain Factory; outer layers do not assign fields to perform business changes.
- Business data is validated in Domain. Application DTOs and DOs do not duplicate validator tags. Query filters/read models follow the CQRS guide.
- Apply the lifecycle selected by accepted authority: a Repository-loaded request-scoped Aggregate becomes stale under the Domain guide's optimistic branch; a resident Aggregate remains the live authority and persists snapshots/checkpoints. Do not infer either branch from persistence technology.
- Transport or Runtime owns one execution completion log. Application emits a separate business-semantic log only when it adds independent value or owns a terminal/suppressed outcome.
- One bounded context never imports another context's `internal/business/<context>` packages. Collaborate through an accepted published contract, Integration Message, or ACL.

## Change Router

| Change | Load in addition to this baseline |
|---|---|
| Domain behavior, invariant, lifecycle, Repository contract | Domain |
| Resident Aggregate, snapshot, or checkpoint persistence | Domain, Application, Infrastructure, and Runtime as actually affected |
| Command/Query/use-case coordination, assembler | Application; CQRS when the read model separates |
| RPC/HTTP endpoint, message consumer, task processor | Transport plus the relevant Flow Guide |
| Repository/QueryRepository implementation, DO/schema, external adapter | Infrastructure plus Database when persisted |
| Confirmed multi-Root local atomic change | Domain, Application, Infrastructure, Database, Scaffold, and Runtime for composition |
| Local Domain Event or same-context reaction | Events plus every touched Layer Guide |
| Published fact or asynchronous intent | Messages plus every touched Layer Guide; Kafka only when it is the provider |
| Internal task, polling, periodic work | Task Queue plus every touched Layer Guide; Asynq only when it is the provider |
| Accepted FSM | Domain and FSM |
| Fx/config/server/worker/goroutine/shutdown | Runtime and Scaffold |
| Accepted OpenTelemetry | Observability plus the touched Transport/provider leaves |

Codify selects the engineering realization from accepted project constraints, repository evidence, and the applicable House Rules while preserving confirmed business boundaries, consistency meaning, and published contracts.
