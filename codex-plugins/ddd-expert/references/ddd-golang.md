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
| Domain | Aggregates, Entities, Value Objects, Domain Services, Domain Events, business sequencing, write Repository and Domain-owned Port contracts | protocol, persistence, logging, task/message provider mechanics, Runtime |
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

Load each guide only for the code surface it covers. A cross-layer change needs
all affected guides; a conditional mechanism needs its guide only when accepted.

| Touched code surface | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, lifecycle, Repository or Domain-owned Port contract | [Domain](ddd-golang-domain.md) |
| Command, Query, use-case coordination, Application registry or assembler | [Application](ddd-golang-application.md); [CQRS](ddd-golang-cqrs.md) for read-model separation |
| RPC/HTTP endpoint, message subscriber, task processor, public error mapping | [Transport](ddd-golang-transport.md) plus the affected event/message/task flow below |
| Domain-owned Port implementation or outbound ACL | [Infrastructure](ddd-golang-infrastructure.md); Domain for contract changes and Runtime for composition changes |
| xorm Repository, Data Object, persistence conversion | [Infrastructure](ddd-golang-infrastructure.md), [Persistence](ddd-golang-persistence.md), and affected [Database](database.md) rules |
| QueryRepository, projections, focused Aggregate reads | [CQRS](ddd-golang-cqrs.md); Infrastructure and Database for SQL/read mapping changes |
| Resident Aggregate snapshots or checkpoints | Domain, Application, Persistence, and Runtime as actually affected |
| Confirmed same-BC, one-resource multi-Root atomic change | [Transactions](ddd-golang-transactions.md) plus every affected layer; Database for persistence and Runtime for composition |
| Local Domain Event or same-context reaction | [Events](ddd-golang-events.md) plus every affected layer |
| Published fact or asynchronous intent | [Messages](ddd-golang-messages.md) plus every affected layer; [Kafka](ddd-golang-kafka.md) only for that provider |
| Internal task, processor, polling, or periodic work | [Task Queue](ddd-golang-taskqueue.md) plus every affected layer; [Asynq](ddd-golang-asynq.md) only for that provider |
| Accepted components/fsm lifecycle | Domain and [FSM](ddd-golang-fsm.md) |
| Multi-BC layout, package/module structure, generated contracts, test placement | [Scaffold](ddd-golang-scaffold.md) |
| Fx wiring, configuration, logging, active loops, startup or shutdown | [Runtime](ddd-golang-runtime.md); Scaffold when package/module structure changes |
| Shared ConnectRPC/Chi listener or server lifecycle | Runtime and [Server](ddd-golang-server.md) |
| Accepted OpenTelemetry | [Observability](ddd-golang-observability.md) plus affected Transport/provider guides |
| MySQL schema, SQL, indexes, locking, or migrations | Affected [Database](database.md) rules |

Load [ddd-core.md](ddd-core.md) for an affected Domain object, Domain-owned Port,
or cross-language layer realization, and [ddd-collaboration.md](ddd-collaboration.md)
only for an accepted published API, Domain Event, or Integration Message.

## Adopted Stack Defaults

| Concern | Default implementation | Applicability |
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

The table supplies defaults for covered concerns left open by accepted project
decisions. Apply the workflow contract's project-convention rule before adopting
a dependency or reorganizing existing code. A language choice alone is not a
stack migration.

## Cross-cutting House Rules

- Every bounded context exposes `application/application.go`, `application/assembler.go`, and `<context>.go` as described by the Scaffold guide.
- `Application.Commands` contains every Command Handler; `Application.Queries` contains every Query Handler. Transport receives the registry and delegates once.
- Application DTO/Domain Entity conversion lives in `application/assembler.go`. DO/Domain Entity conversion lives in `infrastructure/convert.go`.
- Exported Domain fields are a mechanical mapping surface. New Aggregates use `domain.NewXxx` or another Domain Factory; outer layers do not assign fields to perform business changes.
- Business data is validated in Domain. Application DTOs and DOs do not duplicate validator tags. Query filters/read models follow the CQRS guide.
- Apply the lifecycle selected by accepted authority: a Repository-loaded request-scoped Aggregate becomes stale under the Domain guide's optimistic branch; a resident Aggregate remains the live authority and persists snapshots/checkpoints. Do not infer either branch from persistence technology.
- Transport or Runtime owns one execution completion log. Application emits a separate business-semantic log only when it adds independent value or owns a terminal/suppressed outcome.
- One bounded context never imports another context's `internal/business/<context>` packages. Collaborate through an accepted published contract, Integration Message, or ACL.

Codify selects the engineering realization from accepted project constraints, repository evidence, and the applicable House Rules while preserving confirmed business boundaries, consistency meaning, and published contracts.
