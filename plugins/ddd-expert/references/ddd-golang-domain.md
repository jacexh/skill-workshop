---
name: ddd-golang-domain
description: Go / go-jimu Domain-layer reference. Use when implementing or reviewing Aggregate Roots, Entities, Value Objects, Domain Services, Domain policies, Repository interfaces, Domain Event recording, FSM state, validation, or Domain import boundaries.
---

# Go Domain Layer Reference

Use this file only after `domain-modeling` / `design` has accepted the Domain object. This file translates accepted Domain objects into Go / go-jimu code shape; it must not decide aggregate boundaries or classify objects by itself.

## 0. Go / go-jimu Domain Building Block Lookup

| Object | Start here |
|---|---|
| Aggregate Root | §0.1 Aggregate Root Card |
| Entity / Value Object | §0.2 Entity / Value Object Card |
| Domain Service / policy | §0.3 Domain Service / Policy Card |
| Repository interface | §0.4 Repository Interface Card |
| Lifecycle state machine | §0.5 State Machine Card |
| Domain error / validation | §0.6 Error and Validation Card |

### 0.1 Aggregate Root Card

**Placement**

- `internal/business/<context>/domain/<aggregate>.go`
- Domain Events usually live in `domain/event.go`.
- Repository interface lives in `domain/repository.go`; implementation lives in Infrastructure.

**Required / conditional fields**

| Field | Rule |
|---|---|
| Identity | Required. Use a stable Domain identity such as `ID string` or a Value Object. |
| Business state | Required when lifecycle or invariants depend on state. |
| Business data | Required. Invariant-bearing data belongs on the aggregate, child Entity, or Value Object. |
| `Version int` | Required for persisted mutable aggregates using optimistic locking. Domain treats it as read-only. SQL increments it. |
| `Events event.Collection` | Required when the aggregate records same-BC Domain Events; acceptable by default for mutable aggregates that may emit events. |
| Timestamps | Include only when business rules need time values or the existing Domain model already exposes them. Infrastructure audit columns alone do not create Domain behavior. |

**Required behavior**

- Constructor/factory establishes valid initial state, identity, `Version`, and event collection.
- State changes happen through methods. Do not expose setters for invariant-bearing fields.
- Domain methods mutate in-memory state first, then record Domain Events through `event.Collection`.
- Domain returns errors and records facts; it never persists, dispatches, publishes, enqueues, starts goroutines, or logs.
- Exported fields are allowed for mapping/read/log enrichment, but external code must not branch on them to make business decisions or assign them to perform transitions.

**go-jimu component usage**

- Use `github.com/go-jimu/components/ddd/event` for `event.Collection` and Domain Event types.
- Use `github.com/go-jimu/components/fsm` when lifecycle complexity crosses the FSM threshold in §0.5.
- Do not invent local event collection or FSM substitutes when the repository has adopted go-jimu.

**Application obligations**

- Load aggregate, call Domain method, `repo.Save(ctx, aggregate)`, then drain/dispatch `aggregate.Events.Drain()` exactly once after successful save.
- Repository never drains events.
- After `Save()`, the in-memory aggregate is stale; reload before further mutation.

**Fast review checks**

- Reject business rules in command handlers, event/message handlers, task processors, generated RPC handlers, or infrastructure when they belong to aggregate methods/policies.
- Reject Domain imports of generated protocol packages, HTTP/gRPC server packages, ORM/database clients, broker clients, Redis/cache clients, `internal/pkg` adapters, Infrastructure, or another bounded context's Domain package.
- Reject Domain logging. Move the observable result to a returned error, Domain Event, or execution-boundary completion log.

### 0.2 Entity / Value Object Card

**Entity**

- Has identity and lifecycle inside an aggregate boundary.
- Lives beside the aggregate unless it is large enough to justify its own `domain/<entity>.go`.
- Mutations go through methods that preserve invariants.
- Child entities are normally persisted through the aggregate Repository, not their own Repository.

**Value Object**

- Defined by attributes, not identity.
- Prefer immutable construction: validate in constructor or `Validate() error`; expose methods that return a new value when a change is needed.
- Keep external/protocol validation out of Domain. Domain validation is business validation.
- Do not attach JSON/proto/ORM semantics that make the Value Object a transport or persistence DTO.

**Review checks**

- If callers compare IDs or mutate state, it is not a Value Object.
- If a child object is loaded/saved independently, revisit aggregate boundary in `domain-modeling`.

### 0.3 Domain Service / Policy Card

Use a Domain Service or policy only when the business rule:

- spans multiple aggregates or Value Objects;
- cannot naturally live on one aggregate;
- is pure Domain logic without database, broker, RPC, runtime, or clock/scheduler mechanics.

Implementation shape:

- Keep it in `domain/service.go`, `domain/policy.go`, or a focused file such as `domain/pricing_policy.go`.
- Accept Domain objects and Value Objects, return decisions/errors/events, and keep side effects outside.
- If it needs a Repository, external client, runtime state, cache, or generated DTO, it is probably Application orchestration or Infrastructure.

### 0.4 Repository Interface Card

**Placement**

- `internal/business/<context>/domain/repository.go`
- Interface name is normally `Repository` inside the Domain package.
- It represents write-side aggregate collection semantics, not SQL operation names.

**Required shape**

- Methods operate on Aggregate Roots.
- `Get(ctx, id)` / `Find...` returns Domain aggregates.
- `Save(ctx, aggregate)` covers create/update/state-driven soft delete; do not split into `Insert`, `Update`, `Delete` merely because SQL has those operations.
- Repository interface should not expose raw transaction/session/ORM objects.

**Version and event rules**

- Domain `Version` is a concurrency token. Repository SQL increments `version = version + 1`.
- Repository initializes `event.Collection` when rehydrating an aggregate.
- Repository never drains or dispatches events.

**Stop conditions**

- If the interface is created only to wrap a database client, cache, queue, lock, retry, route, peer, or deployment detail, route to `ddd-modeling.md §0.1` / §0.2 before coding.
- If the new method serves read-only product screens, use [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) instead.

### 0.5 State Machine Card

Use `github.com/go-jimu/components/fsm` when any of these are true:

- 5+ business states;
- forbidden transitions or guard conditions matter;
- multiple actors/commands/events drive lifecycle;
- transition rules affect resource release, capacity, billing, retry, archive, permission, or idempotency;
- the design/spec includes a state diagram, transition table, or invariant list.

Rules:

- States, actions, and guard conditions are Domain concepts.
- Aggregate Root implements the state context.
- Domain methods call the registered state machine; they do not assign state directly.
- Transitions may record Domain Events after state changes.
- Infrastructure persists state labels only; it does not know transition rules.

For simple 2-4 state mostly linear lifecycles, enum plus Domain methods is acceptable. Application, handlers, processors, and repositories still must not assemble their own transition tables.

### 0.6 Error and Validation Card

- Domain errors describe business invalidity or invariant violations.
- `Validate() error` is the canonical validation shape when an object owns business field validation.
- `github.com/go-playground/validator/v10` may be used inside `Validate()` if the repository already uses it; tags are implementation detail, not a transport contract.
- Cross-field invariants and state transitions should be explicit Go code.
- Use `github.com/samber/oops` only when the project has adopted it; do not hide Domain error identity behind unmatchable wrapping.

## Domain Import Boundary

Allowed examples: standard library, `errors`, `fmt`, `strings`, `time`, UUID libraries, `github.com/samber/oops` if adopted, `github.com/go-jimu/components/ddd/event`, `github.com/go-jimu/components/fsm`.

Prohibited examples: `pkg/gen/**`, `connectrpc.com/connect`, `google.golang.org/grpc`, HTTP server packages, ORM/database clients, Kafka/NATS/Rabbit/Redis clients, `internal/pkg/**` adapters, Infrastructure packages, another bounded context's Domain package.

## Test Expectations

- Domain tests instantiate aggregates/value objects directly.
- Test invariants, state transitions, event recording, idempotent/no-op behavior, and error cases.
- No mocks are needed for pure Domain tests.
- If a Domain object is hard to test without infrastructure, it probably owns the wrong responsibility.
