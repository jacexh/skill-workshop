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
| Application | Commands, Queries, use-case coordination/context, Application-owned semantic capabilities, `Application` entry, DTO assemblers, same-context reactions, internal task contracts | ConnectRPC/HTTP handlers, xorm, Kafka/Asynq clients, process lifecycle |
| Transport | ConnectRPC/HTTP handlers, Integration Message subscribers, task processors | Repositories, transactions, Aggregate mutation, provider runtimes |
| Infrastructure | Repository and QueryRepository adapters, DO conversion, ACLs, Port adapters | Domain decisions, inbound protocol handling, process lifecycle |
| Runtime | Fx composition, configuration, shared clients, servers, consumers, workers, schedulers, telemetry, shutdown | business rules and bounded-context language |

Application's narrow provider-neutral exceptions are listed in the
[Application guide](ddd-golang-application.md#boundary-and-allowed-exceptions).

## Reference Map

Load each guide only for the code surface it covers. A cross-layer change needs
all affected guides; a conditional mechanism needs its guide only when accepted.

| Touched code surface | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, lifecycle, Repository or Domain-owned Port contract | [Domain](ddd-golang-domain.md) |
| Command, Query, use-case coordination, Application entry or assembler | [Application](ddd-golang-application.md); [CQRS](ddd-golang-cqrs.md) for read-model separation |
| RPC/HTTP endpoint, message subscriber, task processor, public error mapping | [Transport](ddd-golang-transport.md) plus the affected event/message/task flow below |
| Domain-owned Port implementation or outbound ACL | [Infrastructure](ddd-golang-infrastructure.md); Domain for contract changes and Runtime for composition changes |
| xorm Repository, Data Object, persistence conversion | [Infrastructure](ddd-golang-infrastructure.md), [Persistence](ddd-golang-persistence.md), and affected [Database](database.md) rules |
| QueryRepository, projections, focused Aggregate reads | [CQRS](ddd-golang-cqrs.md); Infrastructure and Database for SQL/read mapping changes |
| Resident Aggregate snapshots or checkpoints | Domain, Application, Persistence, and Runtime as actually affected |
| Confirmed same-BC, one-resource multi-Root atomic change, or Outbox dispatch | [Transactions](ddd-golang-transactions.md) plus every affected layer; Database for persistence and Runtime for composition |
| Local Domain Event or same-context reaction | [Events](ddd-golang-events.md) plus every affected layer |
| Published fact or asynchronous intent | [Messages](ddd-golang-messages.md) plus every affected layer; [Kafka](ddd-golang-kafka.md) only for that provider |
| Internal task, processor, polling, or periodic work | [Task Queue](ddd-golang-taskqueue.md) plus every affected layer; [Asynq](ddd-golang-asynq.md) only for that provider |
| Accepted components/fsm lifecycle | Domain and [FSM](ddd-golang-fsm.md) |
| Multi-BC layout, package/module structure, generated contracts, test placement | [Scaffold](ddd-golang-scaffold.md) |
| Fx wiring, configuration, logging, active loops, startup or shutdown | [Runtime](ddd-golang-runtime.md); Scaffold when package/module structure changes |
| Shared ConnectRPC listener, health, or server lifecycle | Runtime and [Server](ddd-golang-server.md) |
| Accepted OpenTelemetry | [Observability](ddd-golang-observability.md) plus affected Transport/provider guides |
| MySQL schema, SQL, indexes, locking, or migrations | Affected [Database](database.md) rules |

Load [ddd-core.md](ddd-core.md) for an affected Domain object, Domain-owned Port,
or cross-language layer realization, and [ddd-collaboration.md](ddd-collaboration.md)
only for an accepted published API, Domain Event, or Integration Message.

## Cataloged Ports

Two Application Ports in `architecture.md` are adopted go-jimu
contracts. Application depends on the contract directly; Runtime composes its
adapter from the provider leaf.

| Catalog row | Go realization |
|---|---|
| Publisher Application Port | `message.Publisher` |
| Its adapter | the provider publisher in `internal/pkg/messagebus`; [Kafka](ddd-golang-kafka.md) when Kafka applies |
| Task enqueue Application Port | `taskqueue.Enqueuer` |
| Its adapter | the provider client in `internal/pkg/taskqueue`; [Asynq](ddd-golang-asynq.md) when Asynq applies |

## Adopted Stack Defaults

| Concern | Default implementation | Applicability |
|---|---|---|
| Dependency injection and lifecycle | `go.uber.org/fx` | Go service Runtime |
| RPC | `connectrpc.com/connect/v2` | RPC API exists |
| RPC health checks | `connectrpc.com/grpchealth/v2` | RPC API exists |
| HTTP routing | standard library `http.ServeMux` | ConnectRPC mounting or hand-written HTTP exists |
| Contract toolchain | Buf, Protobuf, `google.golang.org/protobuf` | RPC, Integration Message, or durable Task payload contract exists; output is `gen/` |
| Business-data validation | `github.com/go-playground/validator/v10` | Domain Entity or Value Object validation |
| ORM | `xorm.io/xorm` | MySQL persistence or QueryRepository exists |
| MySQL driver | `github.com/go-sql-driver/mysql` | MySQL Runtime exists |
| UUID identity | `github.com/google/uuid`, UUIDv7 | A new UUID identity is required |
| Domain Events | `github.com/go-jimu/components/ddd/event` | Aggregate records same-context facts |
| Must-run Domain Event handlers | `github.com/go-jimu/components/ddd/event/outbox`, `github.com/go-jimu/contrib/event/outbox/xorm` | A Policy's failure outcome must survive a process stop |
| Local transactions | `github.com/go-jimu/components/transaction`, `github.com/go-jimu/contrib/transaction/xorm` | A use case runs in `Within` |
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
| Distributed tracing | OpenTelemetry Go, OTLP, `connectrpc.com/otelconnect` | Tracing is accepted |

Library APIs and behavior, including error identity and failure outcomes,
follow the documentation of the version pinned in `go.mod`, read through
`go doc` or the module source. The leaves state house choices that hold across
library versions: placement, ownership, and when to use an API.

The table supplies defaults for covered concerns left open by accepted project
decisions. Apply the workflow contract's project-convention rule before adopting
a dependency or reorganizing existing code. A language choice alone is not a
stack migration.

## Logs and Errors

- The caller of an Application use case logs that call once: Transport middleware for a synchronous request; the Domain Event handler, message subscriber, or task processor for asynchronous work. go-jimu components and provider adapters log delivery. A level states business meaning: Error marks a business failure that nothing recovers. Application emits a separate business-semantic log only when it adds independent value or owns a terminal/suppressed outcome.
- At the first controlled boundary, enrich and wrap a provider error once with `oops.With(...).Wrap(providerErr)`, or `oops.Wrap(providerErr)` when there is no owned context. Later layers add context only for new semantics and preserve `errors.Is/As`. A function that returns an error leaves logging to the execution owner.
- Expected rejection is not an internal failure.
- Errors and logs carry no secret configuration, credentials, DSNs, full payloads, unbounded SQL values, or sensitive personal data.
