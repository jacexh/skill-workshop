---
name: ddd-core
description: DDD + Clean Architecture specification for backend services. Use when designing, implementing, or reviewing backend code with bounded contexts, aggregates, repositories, domain events, CQRS, or domain modeling. Also use when creating new backend services or reviewing architecture conformance. Code agents must read ddd-agent-contract.md first.
---

# Backend Architecture Specification
## DDD + Clean Architecture

**Version**: v2.3
**Date**: 2026-05-11
**Scope**: All backend services, language-agnostic
**Prerequisite**: Before using this specification, complete the strategic modeling phase described in [`ddd-modeling.md`](ddd-modeling.md). That document guides you from business requirements to a domain model (bounded contexts, aggregate boundaries). This document then provides the tactical implementation rules for that model.

> **Agents — read this first**: [`ddd-agent-contract.md`](ddd-agent-contract.md) defines the mandatory execution order, stop protocol, and prohibited actions for code agents working on DDD tasks. Do not skip it.

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This specification combines **Domain-Driven Design (DDD)** with **Clean Architecture**. The goals are:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code is organized by bounded context, not by technical layer
4. **Testability** — Business logic can be tested without any infrastructure dependency

### 1.2 Layered Architecture

Four layers, with the **Domain Layer as the core**:

```
        ┌──────────────────────────────────────┐
        │          Interface Layer             │
        │   Protocol adaptation: HTTP / gRPC   │
        │   Input validation, routing,         │
        │   request/response transformation    │
        └─────────────────┬────────────────────┘
                          │ depends on
        ┌─────────────────▼────────────────────┐
        │         Application Layer            │
        │   Use-case orchestration:            │
        │   Command / Query Handlers           │
        │   QueryRepository interfaces,        │
        │   Transaction boundaries, auth       │
        └─────────────────┬────────────────────┘
                          │ depends on
        ┌─────────────────▼────────────────────┐
        │           Domain Layer               │  ← Core. No implementation deps.
        │   Aggregates, Entities,              │
        │   Value Objects, Domain Services,    │
        │   Write Repository interfaces,       │
        │   Domain Events                      │
        └──────────────────────────────────────┘
                          ▲
                          │ implements (dependency inversion)
        ┌─────────────────┴────────────────────┐
        │       Infrastructure Layer           │
        │   Repository implementations,        │
        │   ORM, external API clients,         │
        │   message queues, cache              │
        └──────────────────────────────────────┘
```

### 1.3 Dependency Rule

**The golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer depends on Application and Domain layers
- Application Layer depends only on Domain Layer
- Domain Layer has no concrete implementation dependencies (no frameworks, ORM, database drivers, HTTP clients/servers, message queue clients, or generated protocol packages). General-purpose, implementation-independent libraries (standard library, UUID/ULID generators, time utilities) are allowed when they do not couple Domain to an external system
- Infrastructure Layer depends on Domain Layer (to implement Repository interfaces) and Application Layer (to implement QueryRepository interfaces); neither Domain nor Application depends on Infrastructure

**Common violations to avoid:**
- Domain layer imports an ORM type or database package
- Domain layer imports an HTTP framework type
- Application layer directly accesses a database connection

---

## 2. Directory Structure

### 2.1 Overall Layout

Code is organized **vertically by bounded context**. Each bounded context is a self-contained directory with its own four-layer structure. Flat horizontal layouts (top-level `controllers/`, `models/`, `repositories/`) are prohibited.

```
project/
├── cmd/                     # Entry points (varies by language)
├── config/                  # Configuration files
├── internal/                # Internal code (not importable externally)
│   ├── <context-a>/         # Bounded context A
│   │   ├── domain/          # Domain layer
│   │   ├── application/     # Application layer
│   │   ├── interfaces/      # Interface layer
│   │   └── infrastructure/  # Infrastructure layer
│   ├── <context-b>/         # Bounded context B
│   └── shared/              # Shared infrastructure (use sparingly)
└── proto/                   # Interface definitions (Protobuf, OpenAPI, etc.)
```

### 2.2 Bounded Context Internal Structure

```
internal/<context>/
├── domain/
│   ├── <aggregate>.{ext}          # Aggregate root + entities
│   ├── value_object.{ext}         # Value objects
│   ├── event.{ext}                # Domain events
│   ├── repository.{ext}           # Repository interface (write)
│   └── service.{ext}              # Domain service (optional)
│
├── application/
│   ├── command.{ext}              # Command definitions
│   ├── query.{ext}                # Query definitions
│   ├── query_repository.{ext}     # Query repository interface (read, CQRS)
│   ├── handler.{ext}              # Command and Query handlers
│   ├── dto.{ext}                  # Data Transfer Objects
│   └── assembler.{ext}            # DTO ↔ Domain object conversion
│
├── interfaces/
│   ├── http/                      # REST handlers
│   └── grpc/                      # gRPC server implementations
│
└── infrastructure/
    ├── <aggregate>_repository.{ext}       # Write repository implementation
    ├── <read_model>_query_repository.{ext} # Read repository implementation
    ├── <message>_publisher.{ext}          # Message/event publisher adapter
    ├── data_object.{ext}          # ORM / database models
    ├── converter.{ext}            # DO ↔ Entity conversion
    └── dto.{ext}                  # Infrastructure-local DTOs, if shared by adapters
```

> `{ext}` refers to the file extension of the language in use (`.go`, `.py`, `.java`, `.ts`, etc.).
>
> Inside a bounded context, keep `infrastructure/` flat by default. Primary adapter files use semantic capability names: one port, Repository, or adapter maps to one `<capability>.{ext}` file plus its test file. Supporting files such as `data_object`, `converter`, or `dto` may stay role-named when they are shared by those adapters. Do not create `redis/`, `mysql/`, `persistence/`, or `messaging/` subdirectories merely because of the backing technology. Technology names belong in concrete type names or file suffixes only when multiple implementations coexist, for example `runtime_state_redis.{ext}` and `runtime_state_memory.{ext}`. Shared technology components belong in the project's shared technical package (for example `internal/pkg/redis` or `shared/db`), not under a bounded context's `infrastructure/`.

---

## 3. Layer Responsibilities

### 3.1 Domain Layer

**Core rule: no concrete implementation dependencies. The standard library and general-purpose, implementation-independent libraries are allowed; frameworks, ORMs, drivers, and protocol clients are not.**

#### Building Blocks

| Concept | Responsibility |
|---------|----------------|
| **Aggregate Root** | Guardian of business invariants. The sole entry point for external access. Repositories operate on aggregate roots only. |
| **Entity** | An object with a unique identity that persists across its lifecycle. |
| **Value Object** | No identity; equality is determined by attribute values. Immutable after creation. |
| **Domain Service** | Handles business logic that genuinely spans multiple aggregates and has no natural home on any one of them. **Use sparingly.** Default to placing behavior on the aggregate or value object that owns the data; extract a Domain Service only when the rule cannot be expressed there. Overuse leads to anemic aggregates (aggregates reduced to data containers with rules drifting into stateless services). |
| **Repository Interface** | Defines the persistence contract for aggregates (write operations). Declaration only — no implementation. |
| **Domain Event** | Records something significant that happened within one bounded context. Used to decouple follow-up behavior inside that context; cross-context communication uses Integration Messages. |

#### Constraints

- **Never** import any framework, ORM, database driver, HTTP client/server, message queue client, or generated protocol package
- General-purpose, implementation-independent libraries (UUID/ULID, time, crypto primitives, validation libraries used inside `Validate()`) are permitted when they do not couple Domain to a specific external system
- **Never** depend directly on another bounded context's domain layer
- All state changes must go through **domain methods** — external direct field mutation is prohibited
- Business rules (validation, invariants) live in the domain layer and must not leak into the Application or Interface layer
- Port ownership is decided by the semantic capability, not by the concrete types used at an external boundary. If a Domain-owned port is reached through gRPC/Protobuf, define Domain-owned input/output types and map generated proto DTOs at the Application or Infrastructure boundary.

#### ID Generation

- Aggregate Root and Entity IDs are generated in the **Domain layer** (typically inside the Factory Method)
- Use infrastructure-independent ID schemes (e.g., UUID, ULID, Snowflake) that can be generated without database access
- **Never** rely on database auto-increment IDs — this couples the Domain to the Infrastructure and prevents creating a fully valid aggregate before persistence

#### Aggregate Design

```
Aggregate Root
├── Factory Method
│   └── Creates valid aggregate instances; enforces all required business rules at creation time
├── Domain Methods
│   ├── Encapsulate state change logic
│   ├── Enforce business invariants
│   └── Collect domain events
└── Version field
    └── Optimistic concurrency token; owned by the domain, incremented by Infrastructure
```

#### Factory Design

- **Simple creation**: use the Aggregate Root's own factory method (static method or constructor)
- **Complex creation** (requires assembling multiple Value Objects, cross-entity validation, or non-trivial initialization logic): extract an independent **Domain Factory** class within the Domain layer
- A Domain Factory must still enforce all business invariants — it is not a shortcut to bypass validation
- Domain Factories must not depend on any infrastructure; all inputs are domain objects or primitive values

#### Value Object Design

- Validate on construction — an invalid value object must not be instantiable
- Implement equality based on attribute values, not reference
- Typical examples: `Email`, `Money`, `Address`, `PhoneNumber`

#### Validation Contract

Every Domain type with validation requirements (Aggregate Root, Entity, Value Object) exposes them through a domain method — typically `Validate()`. Validation is part of the type's own behavior contract.

- External layers (Application, Interface, Infrastructure) call `obj.Validate()`. They must never invoke reflection-based or annotation-driven validation (e.g., `validator.Struct(obj)` in Go, Pydantic-style external validators) on a Domain type from outside — such mechanisms, when used, are an implementation detail of `Validate()`, not part of the public API
- Constructors and factory methods call `Validate()` before returning, so a Domain object is never observed in an invalid state
- Domain mutation methods call or preserve `Validate()` before persisting state changes
- Inside `Validate()`, the implementation is free to use reflection-based libraries, hand-written checks, or a mix — the choice is internal to the Domain type
- Use explicit code for cross-field rules, state transitions, and invariants that cannot be expressed cleanly with declarative annotations

#### Domain Rules in Technical Capabilities

A bounded context may own technical-facing capabilities such as runtime coordination, routing, scheduling, delivery, or observability. These are still Domain concerns when they have stable ubiquitous language, state transitions, errors, or invariants.

- Do not assume a capability is Infrastructure merely because it is technical or not directly visible to end users
- State transition rules, admission policies, semantic naming, and domain-visible derivation rules belong in Domain methods, Value Objects, or Domain Services
- Infrastructure may enforce these rules mechanically through storage constraints, locks, leases, CAS, or external APIs — but the rule itself must be named and testable outside Infrastructure
- Litmus test: can you describe the rule in business / ubiquitous-language terms and write a test for it without reaching into a database, queue, or network? If yes, it is Domain

Use this decision table before placing a technical-facing module:

| Question | If yes | Owner |
|----------|--------|-------|
| Does it define stable terms, states, lifecycle transitions, admission policy, routing policy, ownership semantics, or derivation rules? | Name the rule and model it explicitly | Domain |
| Does it sequence a use case, choose a port, coordinate transaction boundaries, map domain errors, or dispatch already-collected events? | Keep it thin and rule-free | Application |
| Does it adapt a database, cache, queue, lock service, generated protocol, framework lifecycle, telemetry backend, or network API? | Implement an interface or port defined inward | Infrastructure |

Common anti-patterns:

- Putting a dispatcher, registry, router, scheduler, or ownership manager in Infrastructure before naming its domain-visible states and policies
- Hiding admission or routing rules inside handlers because the capability looks "technical"
- Defining an interface in Infrastructure and importing it inward from Application or Domain
- Duplicating the same technical-facing rule across multiple adapters instead of modeling it once

#### Domain Event Collection

Aggregate Root must provide a mechanism for collecting, reading, and clearing domain events:

- Domain methods **append** events to an internal list; they never dispatch events directly
- After a successful `Save()`, the Application layer calls a drain method such as **`collect_events()`** and dispatches the returned events
- The Repository never drains events; the Application layer is the sole drainer so the same aggregate instance cannot be drained twice
- Each drain / clear operation is one-shot — a second drain on the same in-memory instance returns an empty list, so callers must not retry `Save()` on an already-drained instance (reload via `Get()` first; see §3.2)
- Never dispatch events before persistence has succeeded; otherwise a failed `Save()` can surface events the system later disowns

```
# Application Command Handler flow:
aggregate = repo.get(id)
aggregate.do_something()        # events collected internally
repo.save(aggregate)            # persist succeeds
events = aggregate.collect_events()  # drain events
event_bus.dispatch(events)      # dispatch after persist
```

### 3.2 Application Layer

**Core rule: orchestrate only. No business rules here.**

#### Responsibilities

- Split operations into **Commands** (writes) and **Queries** (reads) following CQRS
- **Command Handler**: load aggregate → call domain method → persist → dispatch events
- **Query Handler**: call QueryRepository directly → return DTO (bypasses domain model); the dedicated handler struct is optional for single-call delegating reads
- **Define QueryRepository interfaces** in this layer only for application/product read use cases — read models are an application concern, not a domain concern. Infrastructure implements these interfaces, but Infrastructure routing/topology lookups are not QueryRepositories.
- Define **transaction boundaries**: one Command Handler corresponds to one transaction
- Coarse-grained authorization checks belong here

#### CQRS Flow

```
Write path (Command):
  Interface → CommandHandler → AggregateRoot (domain method) → Repository.Save() → dispatch events

Read path (Query):
  Interface → QueryHandler (optional) → QueryRepository (direct DB query) → return DTO
```

#### Query Handler: When the Struct Is Optional

The Query Handler is structurally a thin orchestration step. When its `Handle` body is a single delegating call to `QueryRepository`, the dedicated handler struct / class adds ceremony without abstraction value — the Interface or Application entry point may call `QueryRepository` directly.

Keep an explicit Query Handler when the read path does at least one of:

- Composes multiple `QueryRepository` calls or cross-context Reader ports
- Filters or redacts fields based on the calling actor (read-side authorization)
- Implements caching policy (cache-aside, TTL choice, key derivation)
- Encodes / decodes pagination cursors or normalizes DTO shapes
- Performs derived computation across multiple records (presentation logic only — never business rules)

Otherwise collapse it. The `QueryRepository` interface itself must remain in either case — it preserves the Application ↔ Infrastructure dependency boundary for product read use cases regardless of whether a Query Handler wraps it. This dependency boundary does not make every Infrastructure lookup an Application query port; capability classification still comes first.

#### CQRS Port Granularity

CQRS is a boundary design rule, not just a file naming convention. Command-side ports and Query-side ports must be split by caller intent, observed consistency, and failure semantics. A shared storage mechanism is not a shared Application port.

Use this decision table before exposing a read/write interface inward:

| Caller need | Port shape | Owner |
|-------------|------------|-------|
| Persist, append, publish, deliver, or mutate data as part of a command / producer flow | Command-side capability port, named for the lifecycle capability; use a `*Writer` suffix only for genuinely one-directional output | Domain when it persists aggregates; Application when it writes an application-owned log, projection, message, or external output |
| New caller observes the same capability semantics (aggregate, consistency, failure/authorization) as an existing port | Add a method to the existing port — do **not** introduce a new port | Same owner as the existing port |
| Serve a UI/API/product read-model query | QueryRepository or reader/facade port returning DTOs/read models | Application |
| Expose a read-only view to another bounded context | Published facade/query port, not the source context's internal QueryRepository | Owning context Application/API boundary |
| Bootstrap projection sequence, cursor, lease, ownership, or high-watermark coordination | Semantic coordination port if the use case observes the coordination semantics | Domain-facing when it owns stable rules; otherwise Application orchestration |
| Locate a peer, forward a request, read routing ownership state, choose an address/replica, carry hop headers, or inspect deployment topology | Concrete Infrastructure routing/transport adapter, not an Application query port | Infrastructure |
| Combine several SQL/log-store/cache methods only because one adapter implements them | Concrete Infrastructure adapter, not an inward port | Infrastructure |

Rules:

- Do not expose a storage-shaped omnibus interface such as `MessageStore`, `EventStore`, `AuditStore`, or `DataStore` to multiple use cases when it mixes producer writes, UI replay, audit lookup, projection bootstrap, and other unrelated read models.
- Do not place read methods on a write Repository merely because the same table holds the data. Write Repositories protect aggregate persistence. Query ports serve consumer-specific read models.
- Do not force consumers to implement or mock methods they never call. Interface bloat is a sign that the port is tracking an adapter, not a use case.
- It is acceptable for one Infrastructure struct to implement several semantic capability-lifecycle ports. Wiring should bind it separately to each inward interface.
- The default evolution path for an inward-defined port is to add a method to an existing port when a new consumer observes the same capability semantics. Fork into a new consumer-specific reader / facade / writer port only when the new caller has different freshness, ordering, authorization, pagination, fallback, or failure semantics. Forking is the exception; extension is the default. (See `ddd-modeling.md §0.2.2`.)
- Do not create a Command or Query port just because Application code must trigger Infrastructure. First classify the capability. Peer forwarding, cache/coordination routing read models, network addresses, hop headers, retry/backoff settings, queue subjects, storage table names, replica selection, and deployment topology are Infrastructure mechanics unless the use case itself names and observes a stable semantic lifecycle.
- A CQRS query port must answer a product/application read use case, not a generic "query Infrastructure state" need.

Example:

```
Wrong inward port:
  ActivityLogStore {
    Append(record)                  // producer write path
    ListReplay(streamID, cursor)    // consumer replay read
    ListByCorrelation(query)        // audit/correlation lookup
    MaxProjectionSeq(streamID)      // projection bootstrap
  }

Better inward ports:
  Producer application:
    ActivityLogWriter.Append(record)
    ProjectionSequenceCounter.Next(streamID)

  Consumer query application:
    ActivityReplayReader.ListReplay(streamID, cursor)
    ActivityCorrelationReader.ListByCorrelation(query)

  Infrastructure:
    ActivityLogAdapter may implement all of the above behind separate bindings.
```

#### Constraints

- No business rules — delegate entirely to domain methods
- Specifically, Application must not implement business field validation; it constructs Domain inputs, calls Domain constructors / methods / `Validate()`, and maps Domain errors outward (see §3.1 Validation Contract)
- Application must not become the owner of domain rules for technical-facing capabilities (see §3.1 Domain Rules in Technical Capabilities); it orchestrates Domain methods/services and Infrastructure implementations
- Never access the database directly; always go through Repository / QueryRepository interfaces
- **Default transaction boundary: one transaction modifies one aggregate only.** If a use case needs to modify multiple aggregates, prefer modifying the first aggregate and persisting it, then use Domain Events / Integration Messages, a Saga / Process Manager, or compensating actions to coordinate the other aggregates in separate transactions. Co-locating multiple aggregate mutations in a single transaction is prohibited unless the exception gate below is satisfied.
- Domain events are dispatched **after a successful persist**, never immediately after calling a domain method
- Error handling: log Infrastructure errors at this layer; propagate Domain errors silently (they are part of the normal business flow)
- After calling `Repository.Save()`, the in-memory aggregate is considered **stale**. If further operations are needed on the same aggregate, reload it with `Repository.Get()` before proceeding:

```
# Correct pattern for sequential operations on the same aggregate
ar = repo.get(id)
ar.method_1()
repo.save(ar)

ar = repo.get(id)   # reload — never reuse the reference after Save()
ar.method_2()
repo.save(ar)
```

#### Multi-Aggregate Transaction Exception Gate

Treat multi-aggregate writes in one transaction as a design exception, not a convenience. The plan must satisfy every item below before implementation:

- **Same bounded context**: the aggregates belong to the same bounded context and the write does not cross a service, database, or external consistency boundary.
- **Non-repairable invariant**: the business can name an invariant that would be violated by temporary inconsistency and cannot be safely repaired by compensation, retry, replay, or reconciliation.
- **Modeling check completed**: the team has checked whether the rule should instead be modeled as one aggregate, a new aggregate (for example a `Transfer`, `Reservation`, `LedgerEntry`, or `Registry` aggregate), a Domain Service plus one aggregate write, or a database uniqueness / exclusion constraint surfaced as a Domain error.
- **Alternatives rejected with reason**: Domain Events, Integration Messages, Saga / Process Manager, outbox / replay, and idempotent consumers have been considered and rejected for this specific invariant.
- **Concurrency plan**: the write states the lock / optimistic-concurrency strategy, expected contention, retry behavior, and stale-state rules after `Save()`.
- **Failure semantics**: the command defines what callers observe when either aggregate write fails, and whether any side effects may already have been admitted.
- **No precedent**: migration scripts, data repair jobs, and legacy transition code may use broader transactions, but they must be labeled as operational / transitional exceptions and must not become precedent for normal Command Handlers.

If the exception cannot be justified in those terms, keep the normal one-aggregate transaction boundary and coordinate through events, messages, or an explicit process.

### 3.3 Interface Layer

**Core rule: protocol transformation only. No business logic.**

#### Responsibilities

- Translate incoming requests (HTTP / gRPC / MQ) into Application layer Commands or Queries
- Translate Application layer results into protocol-specific response formats
- **Format validation** (not business validation) happens here
- Map domain errors and infrastructure errors to protocol-specific error codes

#### Error Code Mapping

| Error Type | HTTP Status | gRPC Code |
|------------|-------------|-----------|
| Resource not found (domain) | 404 | `NOT_FOUND` |
| Invalid input (domain) | 400 | `INVALID_ARGUMENT` |
| Business precondition not met (domain) | 422 | `FAILED_PRECONDITION` |
| Concurrent modification (domain) | 409 | `ABORTED` |
| Infrastructure error | 500 | `INTERNAL` |

### 3.4 Infrastructure Layer

**Core rule: technical implementation only. No business logic.**

#### Responsibilities

- Implement the Repository interfaces defined in the Domain layer and the QueryRepository interfaces defined in the Application layer
- Handle ORM mapping: Data Object (DO) ↔ Domain Entity conversion
- Implement optimistic locking (see below)
- Implement soft deletes (see below)
- Provide clients for external services, caches, and message queues

#### Repository Pattern

A Repository represents a **collection of aggregates**, not a database access object. Its interface must reflect collection semantics, not database operation semantics.

Repository and QueryRepository interfaces are semantic boundaries. Infrastructure may combine multiple technical mechanisms behind one implementation (for example MySQL plus Redis cache-aside, write-through cache, local memory cache, retries, or lock renewal) as long as the caller still observes the same aggregate or read-model contract.

Do **not** introduce technology-shaped ports such as `Cacher`, `RedisStore`, `MysqlReader`, `LockClient`, `Peer`, `Directory`, or `Router` merely because an implementation uses that technology or because Application triggers the operation. Create a separate port only when the Application use case needs a distinct semantic capability with its own failure policy or consistency boundary. Examples:

- Keep one `UserRepository` when Redis is only an acceleration layer for loading/saving `User` aggregates.
- Keep one `UserQueryRepository` when Redis caches DTO/read-model queries but callers do not reason about cache state.
- Keep the normal Repository / event bus interface when MySQL transaction coupling, Outbox rows, retry counters, broker adapters, or commit hooks are only reliability mechanisms behind persistence or delivery.
- Introduce a separate port only when the use case explicitly commands cache invalidation, distributed locking, lease ownership, rate limiting, or another named technical-facing capability.

Technical consistency and routing requirements must not leak upward as dedicated ports. Do not create `OutboxWriter`, `BrokerPublisher`, `UnitOfWork`, `TransactionalEventPublisher`, `Peer`, `Directory`, `RoutingDirectory`, or similar Application/Domain interfaces solely because the implementation needs an atomic database transaction, an outbox table, a message broker, retry scheduling, peer forwarding, cache/coordination ownership lookup, network address resolution, hop-header handling, or deployment-topology inspection. Hide those mechanisms inside the Repository implementation, a transaction-aware event bus implementation, or an Infrastructure adapter unless the caller genuinely observes and chooses that capability as part of the use case.

`Save()` is the **single method** for persisting an aggregate, covering create, update, and state-driven soft-delete scenarios. Never split it into `Insert()`, `Update()`, or `Delete()` based on underlying SQL operations — the caller must not need to know which statement executes.

```
✅ Correct — collection semantics:
  repo.save(aggregate)      # handles create, update, and state-driven soft delete internally

❌ Wrong — database semantics:
  repo.insert(aggregate)
  repo.update(aggregate)
  repo.delete(id)
```

`Save()` determines the correct operation internally based on the aggregate's state (e.g., `Version == 0` → INSERT; `Version > 0` → UPDATE).

#### Optimistic Locking

```
Version semantics:
  0      → New aggregate, never persisted. Save() executes INSERT.
  N > 0  → Previously persisted. Save() executes a version-guarded UPDATE.

UPDATE statement:
  UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = <current_version>

If affected rows == 0 → return a concurrent modification error.

Ownership and stale state:
  - The Domain layer holds the Version field as a read-only concurrency token.
  - The Infrastructure layer is solely responsible for incrementing it (via SQL).
  - After Save(), the in-memory aggregate's Version is stale.
    Always reload via Repository.Get() before any subsequent operation.
```

#### Soft Delete

Distinguish between **business-driven logical deletion** and **technical data retention**:

- **Business-driven**: When "deletion" is a business action (e.g., order cancellation, user deactivation), the Domain layer must model it as an explicit state (e.g., `Status.Cancelled`, `Status.Deactivated`). The aggregate transitions to this state via a domain method. The Infrastructure layer's `Save()` maps this domain state to set `deleted_at` in the database — the domain never knows about `deleted_at`.
- **Technical retention**: When soft delete is purely a data retention policy with no business meaning, the Infrastructure layer manages `deleted_at` transparently and the Domain layer is completely unaware.

In both cases, the `deleted_at` column is an Infrastructure concern. The difference is whether the domain models the "deleted" state explicitly.

```
Business-driven soft delete:
  Domain:         aggregate.cancel()  → sets Status = Cancelled
  Infrastructure: Save() detects Status == Cancelled → sets deleted_at = now()

Technical soft delete:
  Domain:         unaware
  Infrastructure: manages deleted_at based on retention policy
```

---

## 4. DDD Tactical Design Reference

| DDD Concept | Layer | Implementation | Notes |
|-------------|-------|----------------|-------|
| Aggregate Root | Domain | Class / struct + domain methods | Enforces business invariants |
| Entity | Domain | Class / struct with unique ID | Mutable; identity persists over time |
| Value Object | Domain | Immutable class / struct | Equality by value, not reference |
| Domain Service | Domain | Stateless class / function | Cross-aggregate business logic |
| Repository | Domain (interface) + Infra (impl) | Interface + implementation | Write-side persistence abstraction |
| Query Repository | Application (interface) + Infra (impl) | Interface + implementation | Read-side; returns DTOs directly; not a domain concern |
| Domain Event | Domain | Data class / struct | Records significant domain occurrences |
| Application Service (Command / Query Handler) | Application | Command / Query Handler | Orchestrates use cases; owns transaction boundary. "Application Service" is the conceptual name; in code it is realized as a Command Handler or Query Handler |
| DTO / Protocol Message | Application / Interface / Infrastructure | Data class / struct / generated schema type | Decouples internal and external models; generated protocol messages are contracts, not Domain entities |
| Factory | Domain | Static factory method / constructor / independent Factory class | Encapsulates complex object creation |

---

## 5. Cross-Context Communication

### 5.1 Direct Calls Are Prohibited

Bounded contexts must **never** directly call another context's Application Service or Repository.

```
❌ Wrong:
  OrderService.createOrder()
      └── directly calls UserService.getUser()
 
✅ Correct:
  OrderService.createOrder()
      └── publishes OrderCreatedEvent
              └── UserService subscribes and handles asynchronously
```

### 5.2 Legitimate Cross-Context Mechanisms

Cross-context interaction must use one of these four mechanisms. Anything else (importing another context's Domain model, calling its Application Service directly, sharing database tables) is prohibited.

| # | Mechanism | Use when | Coupling |
|---|-----------|----------|----------|
| 1 | **Integration Messages** (default for cross-context state propagation) | One context's state change should trigger reactions in others | Loose; eventual consistency |
| 2 | **Cross-Context Queries** (read-only) | A context needs a current snapshot of data owned elsewhere, with no write side-effects | Loose; through explicit query interfaces, never through the source context's Domain model |
| 3 | **Anti-Corruption Layer (ACL)** | Integrating with external / legacy systems whose model you cannot or should not adopt | Translation overhead; prevents pollution |
| 4 | **Protocol Contracts** (Protobuf, OpenAPI, GraphQL SDL) | Cross-service / cross-repository structured data contracts; generated code shared | Schema-level only; no Domain coupling |

Integration Messages are the default for asynchronous cross-context state propagation. The other three exist for cases messages cannot serve cleanly — they are not fallbacks for laziness.

### 5.3 Domain Events and Integration Messages

Domain Events record facts inside a bounded context. Integration Messages publish selected facts across bounded-context boundaries:

```
Publisher (Order context):
  1. Execute business logic; aggregate collects domain events internally
  2. Persist the aggregate
  3. After successful persist, translate selected Domain Events into Integration Messages
  4. Publish Integration Messages to other contexts
 
Subscriber (User context):
  1. Subscribe to the relevant Integration Message
  2. Handle within its own transaction boundary
  3. Never depend on the publisher's internal domain model
```

#### Boundary Rule

A **Domain Event** is internal to its bounded context — it uses the publisher's ubiquitous language and may be refactored whenever the publisher's domain model evolves. An **Integration Message** is the cross-context semantic contract — its payload is part of the published language and follows additive schema-evolution discipline (no breaking field changes; deprecate before removing).

#### Concept / Contract / Port / Mechanism

Keep the concept, contract, port, and delivery mechanism separate:

- **Concept**: the cross-context fact another bounded context may depend on.
- **Contract**: the stable payload schema, message kind, versioning, and compatibility rules.
- **Port**: the implementation-independent publish / subscribe API exposed to Application code.
- **Mechanism**: broker, queue, HTTP callback, relay, retry, DLQ, ordering, and other adapter-specific delivery concerns.

#### Default Lifecycle

1. A Domain method records one or more Domain Events inside the producing bounded context.
2. The Application command handler persists the aggregate.
3. After successful `Save()`, Application drains the Domain Events and dispatches them inside the same bounded context.
4. A boundary translator / publisher in that bounded context selects publishable facts and maps them to Integration Message contract payloads.
5. The publisher submits the Integration Message through the publish port; success means the selected adapter accepted the message according to its own semantics, not that any consumer has handled it.
6. The subscriber adapter resolves the message payload and routes by message kind.
7. The consumer handler processes the message in its own transaction boundary.
8. The adapter applies its delivery policy (ack, retry, DLQ, stop, or other failure handling).

Directly constructing and publishing an Integration Message in the command handler is a shortcut for simple use cases where cross-context publication is an explicit output of that command. The default is Domain Event first, boundary translation second.

#### Publication Failure Policy

| Requirement | Default handling |
|-------------|------------------|
| Ordinary notification; loss is acceptable | Log adapter admission / delivery failure; the original command remains successful after its aggregate is persisted |
| User-facing command requires publish admission | Treat publication as an explicit command output and return the publish-port error, or use the direct-publish shortcut deliberately |
| Pre-publish loss is unacceptable | Use an explicit reliability design; do not hide this requirement inside a command handler or technology-shaped port |
| Subscriber adapter may redeliver | Make the consumer idempotent according to that adapter's delivery semantics |

#### Domain Event vs Integration Message

| Property | Domain Event | Integration Message |
|----------|--------------|-------------------|
| Scope | Inside one bounded context | Crosses bounded contexts |
| Vocabulary | Publisher's ubiquitous language | Stable published language / contract |
| Schema evolution | Refactored freely with the domain | Additive only; deprecation discipline |
| Coupling | None outside the publishing context | Consumers depend on it |
| Typical mechanism | Bounded-context-internal dispatcher / handlers; concrete delivery is implementation-specific | Publish / subscribe port implemented by a broker adapter, or §5.7 protocol contract |

#### Refactoring Existing Events

**Rule:** what crosses a bounded context is always an Integration Message, even when it is constructed from a Domain Event one-to-one. In simple monolithic deployments the two often share the same struct/class, but the *contract* is what matters — once a consumer depends on the payload, schema changes need consumer-side coordination.

When refactoring a Domain Event whose payload is also published cross-context, treat the publishing side as a **producer of an Integration Message** and choose one of:

1. **Translate at the boundary** — keep the Domain Event internal; an event handler in the same bounded context produces an Integration Message with a stable payload before publishing
2. **Lock the payload** — accept that this Domain Event's payload is also a published contract, and apply additive evolution discipline to it
3. **Versioned Integration Message** — emit `OrderPlacedV1`, `OrderPlacedV2` while keeping consumers running on either version through a deprecation window

Conflating internal Domain Events with cross-context Integration Messages is the most common cause of "we can't change anything because every event is a contract" — an outcome that defeats the loose coupling event-driven boundaries were supposed to provide.

### 5.4 Integration Message Payload Design

Integration Messages use a **rich fact** style: carry the aggregate ID plus the minimum set of fields the consumer needs to process the fact — nothing more.

**Rules:**
- **Never** include a full entity or aggregate root object in an event payload
- Carry only the fields that are necessary for consumers to act on the message
- Fields represent a **snapshot of the state at the moment the fact occurred** — consumers must treat them as a historical record, not as current state
- If a consumer needs the latest state of an entity, it must query it explicitly from its own data source

```
✅ Correct — minimum necessary fields:
  UserActivatedEvent    { user_id, activated_at }
  OrderCompletedEvent   { order_id, user_id, total_amount, occurred_at }
  PasswordChangedEvent  { user_id, changed_at }

❌ Wrong — full object embedded:
  UserActivatedEvent    { user: User{ id, name, email, status, ... } }
  OrderCompletedEvent   { order: Order{ id, items: [...], address: {...}, ... } }
```

Embedding full objects couples the consumer to the publisher's internal domain model. Any change to the aggregate structure becomes a breaking change for all consumers.

### 5.5 Cross-Context Queries

When a bounded context needs a current snapshot of data owned by another context (display a user's name on an order receipt; show product info during cart construction), it may read through a **port the owning context explicitly publishes** — never by reaching into another context's internal Domain model, repository, or `QueryRepository` class.

Two transport variants:

| Deployment | Mechanism |
|------------|-----------|
| **Same-process modular monolith** | The owning context exports a query port / facade (a small read-side interface) that returns DTOs / read models. Consumers depend on the port; the implementation lives in the owning context's Application or Infrastructure layer |
| **Cross-process / cross-service** | The contract is expressed as an API or protocol contract (REST, gRPC/Protobuf, GraphQL); both sides depend on the schema, neither side imports the other's Domain |

Rules that apply to both variants:

- Responses are DTOs / read models — Domain objects are never returned across the boundary
- Queries must not produce side effects in the source context; for cross-context state propagation, use Integration Messages
- Avoid query chains across more than two contexts; if you find yourself doing this, the bounded context boundaries are likely wrong

Cross-context queries are appropriate when the consumer's read needs cannot be satisfied by an event-driven projection (data is too large to replicate, or freshness requirements demand a live read).

### 5.6 Anti-Corruption Layer (ACL)

When integrating with external systems or legacy services, always introduce an **Anti-Corruption Layer** to prevent external models from polluting the internal domain model:

```
External System → ACL (translation / adaptation) → Internal Domain Model
```

The ACL lives in the Infrastructure layer and is transparent to the Domain layer.

### 5.7 Protocol Contracts

For cross-service or cross-repository communication, define data contracts in a schema language (Protobuf, OpenAPI, GraphQL SDL) and consume the generated code on both sides.

Rules:

- The schema is the contract — generated types are shared structurally, but neither side imports the other's Domain model
- Generated protocol types are DTOs / contracts, not Domain entities or Value Objects. Sharing a Protobuf message between modules does not make it a shared Domain model. A Query Handler may surface a generated protocol message directly as a read-side DTO; the prohibition is on using it as a Domain entity, Value Object, or Domain-facing port input/output type.
- Domain-facing ports must not use generated protocol types as input/output. Generated messages remain valid as Interface/Application read DTOs, generated RPC request/response types, and Infrastructure adapter contracts.
- Domain layers must not depend on generated protocol packages; if Domain logic needs an internal representation, define a Domain type and convert at the boundary (in Application or Infrastructure)
- Do not relocate a Domain-facing port to Application merely because Application is the layer that touches the generated stub. Keep the semantic port in the owning layer (with Domain-typed inputs/outputs) and add `Proto ↔ Domain` assemblers in the layer that holds the proto dependency.
- Schema evolution follows additive rules — no breaking field changes; deprecate before removing
- Protocol contracts complement Integration Messages and Cross-Context Queries (one for sync structured data; the others for state propagation and ad-hoc reads), they do not replace them

**Placement**: generated code lives in a single language-conventional location, isolated from Domain. Each language guide names its concrete directory; the abstract rule is "one place, never inside a Domain package, never co-mingled with hand-written business types". Examples:

| Language | Generated-code location |
|----------|------------------------|
| Go | `pkg/gen/` |
| Python | `packages/contracts/` or `src/contracts/gen/` |
| TypeScript | `packages/contracts/` |

Hand-written shared event payload types (used to type Integration Messages crossing context boundaries within the same repository) are a different artifact from generated protocol code and should not be placed in the same directory.

---

## 6. Domain Events and Dispatch Timing

### 6.1 Dispatch Timing

Domain events must be dispatched **after a successful persist**. Never dispatch immediately after calling a domain method.

```
✅ Correct:
  1. Call domain method    (events are collected inside the aggregate)
  2. Persist aggregate     (transaction commits)
  3. Dispatch events       (after commit)
 
❌ Wrong:
  1. Call domain method
  2. Dispatch events immediately  ← persist may still fail → data inconsistency
  3. Persist aggregate
```

### 6.2 Cross-process delivery

Cross-context Integration Messages are typically delivered through a message broker (Kafka, NATS, RocketMQ, RabbitMQ, etc.) using **at-least-once delivery + idempotent consumers** as the default reliability model. Domain Events stay inside one bounded context; their delivery semantics come from that bounded context's chosen dispatcher implementation. If the implementation is in-memory, crash-time loss is acceptable only when the producer's persisted state remains the source of truth and downstream readers can derive missing reactions from a query or replay.

The narrow case where pre-publish loss is unacceptable — payment, inventory, regulatory compliance — requires a separate reliability design. This guide does not prescribe an implementation; consult the language ecosystem's standard solutions, and keep the reliability mechanism inside the Repository or Infrastructure adapter so it does not leak as a Domain or Application port (§3.4).

---

## 7. Naming Conventions

The following conventions describe **conceptual naming**. Each language should apply its own casing style (camelCase, snake_case, PascalCase, etc.) while preserving the conceptual names below.

| Concept | Pattern | Example |
|---------|---------|---------|
| Domain Event | `<Name>Event` | `UserCreatedEvent` |
| Command | `<Action><Target>Command` | `ChangePasswordCommand` |
| Command Handler | `<Action><Target>CommandHandler` | `ChangePasswordCommandHandler` |
| Query | `Find<Target>Query` | `FindUserByIdQuery` |
| Query Handler | `Find<Target>QueryHandler` | `FindUserByIdQueryHandler` |
| Repository interface (write) | `<Aggregate>Repository` | `UserRepository` |
| Query repository interface (read) | `<Aggregate>QueryRepository` | `UserQueryRepository` |
| Data Object | `<Entity>DO` or `<Entity>PO` | `UserDO` |
| DTO | `<Purpose>DTO` | `UserDetailDTO` |
| Value Object | Business name directly | `Email`, `Money`, `Address` |
| Domain Error | `<Description>Error` or `Err<Description>` | `UserNotActiveError` |

---

## 8. Error Handling

### 8.1 Error Classification

| Error Type | Defined In | Handling |
|------------|------------|----------|
| **Domain Error** | Domain layer | Represents a business rule violation. Part of the normal business flow. Do not log. Propagate up; translate to 4xx at the Interface layer. |
| **Infrastructure Error** | Infrastructure layer | Represents a technical failure (DB timeout, network issue). Log at the Application layer. Translate to 5xx at the Interface layer. |
| **Input Validation Error** | Interface layer | Represents a malformed request. Handle and return 4xx directly at the Interface layer. Do not propagate inward. |
 
### 8.2 Error Propagation

```
Domain layer:
  Define domain error constants.
  Return / raise them when business rules are violated.
 
Infrastructure layer:
  Attach context (e.g., entity ID, operation name) to technical errors before propagating.

Application layer:
  Infrastructure errors → log + propagate
  Domain errors        → propagate silently (no logging)

Interface layer:
  All errors → translate to protocol error codes → return to caller
```

---

## 9. Testing Strategy

### 9.1 Per-Layer Approach

| Layer | Test Type | Dependencies | Goal |
|-------|-----------|--------------|------|
| **Domain** | Pure unit tests | Language runtime + the same implementation-independent libraries Domain itself depends on (see §3.1 Constraints) | Verify business rules, invariants, domain event emission |
| **Application** | Unit tests + mocks | Mocked Repository / QueryRepository | Verify use-case orchestration logic |
| **Infrastructure** | Integration tests | Real database (test containers) | Verify SQL correctness, optimistic locking, soft deletes |
| **Interface** | End-to-end tests | Simulated HTTP / gRPC requests | Verify protocol transformation and error code mapping |

### 9.2 Domain Layer Test Priorities

Domain tests should cover:
- Happy paths for all business rules
- All error paths (invalid input, illegal state transitions)
- Domain events emitted at the correct moments
- Value object validation logic

### 9.3 Mock Usage Rules

- Only mock **cross-layer boundary interfaces** (Repository, external service clients)
- Never mock domain objects — instantiate aggregates directly in domain tests
- Infrastructure layer tests use real databases via test containers, not mocks

---

## 10. Architecture Review Checklist

Use this checklist when reviewing backend, DDD, refactor, or technical-capability changes:

- **Modeling gate**: `ddd-modeling.md` was applied first, with a gate level and bounded context / business capability stated.
- **Import boundaries**: Domain imports no framework, generated protocol package, storage driver, queue client, HTTP server/client, Infrastructure package, or another bounded context's Domain package.
- **Layer ownership**: Domain owns named rules/invariants; Application owns orchestration, transaction boundaries, product read query interfaces, and semantic ports needed by use cases after capability classification; Infrastructure implements adapters and owns routing/transport/topology mechanics.
- **Technical capability classification**: dispatchers, registries, schedulers, routers, connectors, ownership managers, delivery mechanisms, projections, observability, and audit logic are classified before package placement.
- **Interface direction**: inward layers define the interfaces they need; outer layers implement them. Infrastructure-defined interfaces must not be imported inward.
- **CQRS port granularity**: ports are named for semantic capabilities, caller side, and consumer-specific product read models, not implementation technologies. Redis/MySQL/cache/queue/log-store clients, peer forwarding, routing directories, hop headers, retry/backoff, and deployment topology are composed inside Infrastructure unless the use case itself needs a separate semantic lifecycle boundary. Reject omnibus store interfaces that mix unrelated producer writes, UI replay, audit lookup, and projection coordination.
- **Transaction boundary**: Command Handlers default to one aggregate write per transaction. Any multi-aggregate transaction passes the exception gate in §3.2 and remains inside one bounded context.
- **Cross-context boundaries**: communication uses Integration Messages, cross-context queries, ACL, or protocol contracts; no direct calls into another context's Domain model or Application Service.
- **Package/path consistency**: a package path that claims `domain`, `application`, `interfaces`, or `infrastructure` follows that layer's dependency and responsibility rules.

---

## 11. Key Principles Summary

1. **Domain layer has no concrete implementation dependencies** — no frameworks, ORMs, drivers, or protocol clients; general-purpose libraries are allowed when they don't couple Domain to an external system
2. **Vertical slicing** — organize by bounded context, not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces; Application defines product/application read QueryRepository interfaces after capability classification; Infrastructure implements both
4. **CQRS port granularity** — define ports by caller semantics, command/query side, and consumer-specific product read models; cache/database/queue/log-store clients, routing directories, peer forwarding, and topology mechanics stay inside Infrastructure unless they are a named use-case lifecycle capability ([ddd-modeling.md §0.2](ddd-modeling.md), §3.2 CQRS Port Granularity, §3.4 Repository Pattern)
5. **Aggregate boundary** — Repository operates on aggregate roots only, never on child entities directly
6. **State encapsulation** — all state changes go through domain methods; direct field mutation from outside is prohibited
7. **ID generation in Domain** — use infrastructure-independent ID schemes (UUID, ULID, Snowflake); never rely on database auto-increment
8. **Disciplined cross-context communication** — use one of: Integration Messages (default for cross-context state propagation), cross-context queries (read-only), ACL (external/legacy), protocol contracts (cross-service schemas); direct calls into another context's Domain model or Application Service are prohibited; Integration Message payloads carry the ID plus the minimum necessary facts, never full entities or aggregate objects
9. **Event collection** — aggregates collect events internally; the Application layer drains and dispatches once after a successful persist, and the Repository never drains
10. **CQRS** — Commands go through the domain model or an application-owned semantic writer port after capability classification; Queries go through consumer-specific QueryRepository/reader/facade ports and return product DTOs/read models. Do not expose one storage-shaped port for unrelated writers and readers, and do not model routing/topology lookup as a CQRS query port.
11. **Transaction boundary** — one Command Handler owns one transaction; the default is one aggregate write per transaction; multi-aggregate writes require the §3.2 exception gate and must stay inside one bounded context
12. **Repository collection semantics** — `Save()` covers create, update, and state-driven soft delete; never split by database operation type
13. **Soft delete** — business-driven deletion is modeled as domain state; `deleted_at` is always an Infrastructure concern
14. **Optimistic locking** — Infrastructure increments `version` via SQL; domain holds `Version` as a read-only token; always reload after `Save()` before further operations
15. **Event dispatch timing** — dispatch events after a successful persist, never before
16. **Event reliability** — Domain Event delivery is bounded-context-internal and implementation-specific; cross-process Integration Messages default to broker at-least-once delivery + consumer-side idempotency
17. **Technical capability classification** — classify technical-facing code before interface ownership; it is Domain-facing when it owns stable language, states, policies, or invariants, while routing/transport/topology mechanics stay Infrastructure

---

## Appendix A: Strategic Modeling

This document covers tactical architecture principles — it assumes you already know what your bounded contexts and aggregates are. For the strategic modeling phase (discovering bounded contexts, identifying aggregate roots, designing aggregate boundaries from business requirements), see:

| Phase | Document |
|-------|----------|
| Strategic modeling | [`ddd-modeling.md`](ddd-modeling.md) |

## Appendix B: Language-Specific Implementation Guides

This document covers language-agnostic architecture principles only. For technology stack selection, code examples, and language-specific conventions, refer to the corresponding implementation guide:

| Language | Document |
|----------|----------|
| Go | [`ddd-golang.md`](ddd-golang.md) |
| Python | [`ddd-python.md`](ddd-python.md) |
| TypeScript | [`ddd-typescript.md`](ddd-typescript.md) |

---

**References:**
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
- [Implementing Domain-Driven Design — Vaughn Vernon](https://vaughnvernon.com/?page_id=168)
