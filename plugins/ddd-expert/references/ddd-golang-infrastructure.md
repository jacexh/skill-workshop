---
name: ddd-golang-infrastructure
description: Go / go-jimu Infrastructure-layer reference. Use when implementing or reviewing Repository implementations, DO/converter code, migrations, database adapters, ACLs, external clients, generated protocol adapters, shared internal/pkg clients, transaction mechanics, soft delete, or optimistic locking.
---

# Go Infrastructure Layer Reference

Infrastructure owns external mechanisms. It implements Domain/Application ports and keeps database, broker, SDK, cache, retry, routing, and generated-protocol mechanics outside Domain.

## 0. Go / go-jimu Infrastructure Building Block Lookup

| Object | Start here |
|---|---|
| Repository implementation / DO / converter | §0.1 Repository Implementation / DO / Converter Card |
| Migration / schema / SQL rule | §0.2 Persistence Migration Card and [`database.md`](database.md) |
| External adapter / ACL | §0.3 External Adapter / ACL Card |
| Generated protocol adapter | §0.4 Generated Protocol Adapter Card |
| Shared technical client / runtime adapter | §0.5 Shared Client and Runtime Adapter Card |

### 0.1 Repository Implementation / DO / Converter Card

**Placement**

- `internal/business/<context>/infrastructure/<aggregate>_repository.go`
- `internal/business/<context>/infrastructure/do.go`
- `internal/business/<context>/infrastructure/converter.go`

**Required shape**

- Compile-time assertion: implementation satisfies the Domain Repository interface.
- Constructor receives initialized clients from `internal/pkg/<capability>` or module wiring; it does not open config by itself.
- Repository persists Aggregate Roots, not child entities as independent collections.
- `Save(ctx, aggregate)` handles create/update/state-driven soft delete for one aggregate.
- Repository initializes `event.Collection` when rehydrating aggregates.
- Repository never drains or dispatches Domain Events.

**Version and transaction**

- Domain `Version` is read-only.
- New aggregate insert sets persisted version to the initial stored value used by the repository convention.
- Existing aggregate update uses optimistic lock (`WHERE id = ? AND version = ?`) and increments in SQL/ORM (`version = version + 1`).
- Storage transaction/session mechanics stay inside Infrastructure.
- Application owns the semantic transaction boundary; Infrastructure owns the storage transaction mechanism.

**DO / converter**

- DOs mirror storage shape, not Domain behavior.
- Converter maps between DO and Domain explicitly where names/types differ.
- Use project timestamp value types where present; otherwise make Unix-millisecond mapping explicit.
- Do not put business decisions in converters.

**Soft delete**

- If deletion is business-visible, Domain owns lifecycle/status and Repository maps that state to `deleted_at`.
- If deletion is purely technical, Infrastructure manages `deleted_at` transparently.
- Domain never knows the `deleted_at` column.

### 0.2 Persistence Migration Card

Route to [`database.md`](database.md) for SQL standards. The implementation trace should record:

- migration path and naming;
- table name and standard fields;
- timestamp representation;
- `deleted_at` strategy;
- optimistic-lock column and update expression;
- indexes needed by use cases;
- rollback/backfill risk when applicable.

Review checks:

- `deleted_at` filter is present where needed.
- version increments happen in persistence, not Domain.
- migration does not encode Domain invariants only as SQL constraints without Domain checks.

### 0.3 External Adapter / ACL Card

Use Infrastructure for adapters to external systems or legacy models:

- third-party APIs;
- broker/client SDKs;
- cache implementations;
- ACL mapping from external language into Domain language;
- routing or peer-forwarding mechanisms.

Rules:

- Adapter implements a Domain/Application-owned semantic port when such a port has been accepted by design.
- Adapter may use generated protocol/client types internally.
- Domain-facing methods accept/return Domain or Application DTO types, not generated transport structs.
- Business decisions extracted from external payloads must be translated before Domain is called.

### 0.4 Generated Protocol Adapter Card

Generated types are protocol contracts, not Domain objects.

Accepted placements:

- `application/application.go` for the Go generated RPC shortcut when the method is thin.
- `interfaces/**` for hand-written protocol adapters or repos with that convention.
- `infrastructure/**` for outbound generated clients or ACLs.
- `pkg/gen/**` only for generated code.

Rules:

- Domain does not import `pkg/gen/**`.
- Use-case packages do not expose generated types in semantic ports unless the accepted design explicitly treats the type as a read contract.
- Mapping happens at Application/Interface/Infrastructure boundaries.
- Fat generated RPC adapters route back to [`ddd-golang-application.md §0.7`](ddd-golang-application.md) and the risk router.

### 0.5 Shared Client and Runtime Adapter Card

Shared technical clients live under `internal/pkg/<capability>`:

- database engines/session factories;
- Kafka/message runners;
- taskqueue runtime adapters;
- Redis/cache clients;
- HTTP clients or SDK wrappers;
- config/runtime/lifecycle modules.

Bounded-context Infrastructure receives initialized clients. Domain and Application use cases do not import `internal/pkg` adapters unless the project has an accepted provider-neutral component contract in that package.

Runtime loops, lifecycle hooks, shutdown order, and process config route to [`ddd-golang-runtime.md`](ddd-golang-runtime.md). Task queues route to [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md).

## Infrastructure File Layout

| Path | Contents |
|---|---|
| `infrastructure/<aggregate>_repository.go` | write Repository implementation |
| `infrastructure/<read_model>_query_repository.go` | QueryRepository implementation |
| `infrastructure/do.go` | storage models |
| `infrastructure/converter.go` | DO <-> Domain / DTO conversion |
| `infrastructure/<external>_client.go` | context-specific external adapter/ACL |
| `infrastructure/<message>_publisher.go` | adapter-specific publisher when not already in shared runtime |
| `internal/pkg/<capability>/**` | shared technical clients/runtime packages |

## Common Misplacements

- Application receives raw `*xorm.Session`, `*gorm.DB`, `database/sql.Tx`, `TxManager`, or `UnitOfWork` to coordinate persistence mechanics.
- Repository drains Domain Events.
- DO/converter contains business branching over state.
- Infrastructure is the only place that enforces a business invariant.
- A cache, peer directory, queue subject, or retry policy becomes a Domain/Application port without a semantic capability gate.
