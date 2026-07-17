---
name: ddd-golang
description: Go DDD House Style baseline and navigation index for dependency boundaries, mandatory components, and the focused layer, flow, or platform guide to load.
---

# Go DDD House Style Baseline

Load this baseline after the Model is confirmed. It does not decide Aggregate boundaries, consistency, or collaboration. It fixes how confirmed responsibilities are implemented in Go and routes detailed work to the smallest relevant Knowledge Leaf.

Every Go rule below is a House Rule: it applies only when its stated concern exists, and it is mandatory once applicable. An existing alternative is a House Style conflict, not an automatic exception. For an uncovered concern or explicit exception, Codify derives the engineering choice from accepted project constraints and repository evidence and records it where the project normally records architecture decisions.

## Dependency Direction

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
<context>.go and internal/pkg -> composition and Runtime
```

| Layer | Owns | Must not own |
|---|---|---|
| Domain | Aggregates, Entities, Value Objects, Domain Services, Domain Events, write Repository contracts | protocol, persistence, logging, task/message providers, Runtime |
| Application | Commands, Queries, use-case coordination, `Application` registry, DTO assemblers, same-context reactions, internal task contracts | ConnectRPC/HTTP handlers, xorm, Kafka/Asynq clients, process lifecycle |
| Transport | ConnectRPC/HTTP handlers, Integration Message subscribers, task processors, scheduled inbound triggers | Repositories, transactions, Aggregate mutation, provider runtimes |
| Infrastructure | Repository/QueryRepository implementations, DO conversion, ACLs, external adapters | Domain decisions, inbound protocol handling, process lifecycle |
| Runtime | Fx composition, configuration, shared clients, servers, consumers, workers, schedulers, telemetry, shutdown | business rules and bounded-context language |

Application has two narrow, accepted provider-neutral exceptions:

- a producing Application event handler may map a Domain Event to its own generated Integration Message contract and call `message.Publisher`;
- an accepted internal task contract may use `components/taskqueue` and `Enqueuer` under `application/task`.

Generated RPC/HTTP types remain in Transport. Kafka, franz-go, Asynq, Redis, xorm sessions, Fx, and active loops remain outside Application.

## Reference Map

### Layer Guides

| Responsibility | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, Repository contract, FSM | [`ddd-golang-domain.md`](ddd-golang-domain.md) |
| Command, Query, Application service, `application.go`, assembler, transaction coordination | [`ddd-golang-application.md`](ddd-golang-application.md) |
| ConnectRPC, Chi HTTP, message subscriber, task processor, error mapping | [`ddd-golang-transport.md`](ddd-golang-transport.md) |
| xorm persistence, DO/convert, QueryRepository adapter, ACL/external adapter | [`ddd-golang-infrastructure.md`](ddd-golang-infrastructure.md) |

### Flow Guides

| End-to-end flow | Load |
|---|---|
| Read model separation, QueryRepository, projections | [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) |
| Domain Events, published facts/intents, Kafka, Outbox | [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) |
| Internal task, processor, polling, periodic task, Asynq | [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) |

### Platform Guides

| Platform concern | Load |
|---|---|
| Multi-BC layout, generated code, modules, tests | [`ddd-golang-scaffold.md`](ddd-golang-scaffold.md) |
| Configuration, Fx, server/worker lifecycle, logging, telemetry, shutdown | [`ddd-golang-runtime.md`](ddd-golang-runtime.md) |
| MySQL schema, SQL, indexes, locking, migrations | [`database.md`](database.md) |

Use [`ddd-modeling.md`](ddd-modeling.md) for model discovery, [`ddd-core.md`](ddd-core.md) for the DDD + Clean Architecture baseline, and [`ddd-collaboration.md`](ddd-collaboration.md) for cross-Aggregate or cross-context design.

## Mandatory Adopted Stack

| Concern | Mandatory implementation | Applicability |
|---|---|---|
| Dependency injection and lifecycle | `go.uber.org/fx` | Go service Runtime |
| RPC | `connectrpc.com/connect` | RPC API exists |
| HTTP routing | `github.com/go-chi/chi/v5` | ConnectRPC mounting or hand-written HTTP exists |
| Contract toolchain | Buf, Protobuf, `google.golang.org/protobuf` | RPC or Integration Message contract exists; output is `gen/` |
| Business-data validation | `github.com/go-playground/validator/v10` | Domain Entity or Value Object validation |
| ORM | `xorm.io/xorm` | MySQL persistence or QueryRepository exists |
| MySQL driver | `github.com/go-sql-driver/mysql` | MySQL Runtime exists |
| UUID identity | `github.com/google/uuid`, UUIDv7 | A new UUID identity is required |
| Domain Events | `github.com/go-jimu/components/ddd/event` | Aggregate records same-context facts |
| Integration Messages | `github.com/go-jimu/components/ddd/message` | Cross-context asynchronous collaboration is accepted |
| Kafka | `github.com/go-jimu/contrib/message/kafka` | Kafka delivery is accepted |
| Kafka Runtime | `github.com/twmb/franz-go` | Kafka exists; import only from Runtime/provider code |
| Outbox | `github.com/go-jimu/components/ddd/message/outbox` | Outbox is explicitly accepted |
| Task Queue | `github.com/go-jimu/components/taskqueue` | Internal deferred work is accepted |
| Asynq adapter | `github.com/go-jimu/contrib/taskqueue/asynq` | Asynq delivery is accepted |
| Asynq Runtime | `github.com/hibiken/asynq` | Asynq exists; import only from Runtime/provider code |
| State machine | `github.com/go-jimu/components/fsm` | Lifecycle behavior warrants FSM |
| Logging | `log/slog` and `github.com/go-jimu/components/sloghelper` | Every Go service |
| Error enrichment | `github.com/samber/oops` | Errors cross a controlled boundary |
| Configuration | `github.com/go-jimu/components/config/loader` | Go service Runtime |
| Distributed tracing | OpenTelemetry Go, OTLP, `connectrpc.com/otelconnect` | Tracing is accepted and a backend/collector is available |

Do not substitute Gin/Echo for Chi, grpc-go for ConnectRPC, GORM/sqlc for xorm, Sarama for the go-jimu Kafka adapter, Zap for slog, or a project-local wrapper for an adopted go-jimu contract. A technology concern absent from this table remains uncovered until its choice is accepted and documented.

## Cross-cutting House Rules

- Every bounded context exposes `application/application.go`, `application/assembler.go`, and `<context>.go` as described by the Scaffold guide.
- `Application.Commands` contains every Command Handler; `Application.Queries` contains every Query Handler. Transport receives the registry and delegates once.
- Application DTO/Domain Entity conversion lives in `application/assembler.go`. DO/Domain Entity conversion lives in `infrastructure/convert.go`.
- Exported Domain fields are a mechanical mapping surface. New Aggregates use `domain.NewXxx` or another Domain Factory; outer layers do not assign fields to perform business changes.
- Business data is validated in Domain. Application DTOs and DOs do not duplicate validator tags. Query filters/read models follow the CQRS guide.
- A saved Aggregate instance is stale: it may be read, assembled, and drained of already-recorded events, but it is not mutated or saved again.
- Transport or Runtime owns one execution completion log. Application emits a separate business-semantic log only when it adds independent value or owns a terminal/suppressed outcome.
- One bounded context never imports another context's `internal/business/<context>` packages. Collaborate through an accepted published contract, Integration Message, or ACL.

## Change Router

| Change | Load in addition to this baseline |
|---|---|
| Domain behavior, invariant, lifecycle, Repository contract | Domain |
| Command/Query/use-case coordination, assembler | Application; CQRS when the read model separates |
| RPC/HTTP endpoint, message consumer, task processor | Transport plus the relevant Flow Guide |
| Repository/QueryRepository implementation, DO/schema, external adapter | Infrastructure plus Database when persisted |
| Domain Event or Integration Message publication/consumption | Events/messages plus every touched Layer Guide |
| Internal task, polling, periodic work | Task queue plus every touched Layer Guide |
| Fx/config/server/worker/goroutine/shutdown/telemetry | Runtime and Scaffold |

If the change would alter confirmed business boundaries, consistency meaning, published contracts, or recovery semantics, return to EventStorming. Otherwise Codify selects the engineering realization from accepted project constraints, repository evidence, and the applicable House Rules.
