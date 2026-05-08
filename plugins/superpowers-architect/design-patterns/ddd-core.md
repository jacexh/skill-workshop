---
name: ddd-core
description: DDD + Clean Architecture specification for backend services. Use when designing, implementing, or reviewing backend code with bounded contexts, aggregates, repositories, domain events, CQRS, or domain modeling. Also use when creating new backend services or reviewing architecture conformance.
---

# Backend Architecture Specification
## DDD + Clean Architecture

**Version**: v2.2
**Date**: 2026-04-15
**Scope**: All backend services, language-agnostic
**Prerequisite**: Before using this specification, complete the strategic modeling phase described in [`ddd-modeling.md`](ddd-modeling.md). That document guides you from business requirements to a domain model (bounded contexts, aggregate boundaries). This document then provides the tactical implementation rules for that model.

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
    ├── persistence/
    │   ├── repository.{ext}           # Repository implementation (write)
    │   ├── query_repository.{ext}     # Query repository implementation (read)
    │   ├── data_object.{ext}          # ORM / database models
    │   └── converter.{ext}            # DO ↔ Entity conversion
    └── messaging/
        └── publisher.{ext}            # Event publisher implementation
```

> `{ext}` refers to the file extension of the language in use (`.go`, `.py`, `.java`, `.ts`, etc.).

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
| **Domain Service** | Handles business logic that spans multiple aggregates and doesn't naturally belong to any single entity. |
| **Repository Interface** | Defines the persistence contract for aggregates (write operations). Declaration only — no implementation. |
| **Domain Event** | Records something significant that happened within the domain. Used to decouple inter-context communication. |

#### Constraints

- **Never** import any framework, ORM, database driver, HTTP client/server, message queue client, or generated protocol package
- General-purpose, implementation-independent libraries (UUID/ULID, time, crypto primitives, validation libraries used inside `Validate()`) are permitted when they do not couple Domain to a specific external system
- **Never** depend directly on another bounded context's domain layer
- All state changes must go through **domain methods** — external direct field mutation is prohibited
- Business rules (validation, invariants) live in the domain layer and must not leak into the Application or Interface layer

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

#### Domain Event Collection

Aggregate Root must provide a mechanism for collecting and retrieving domain events:

- Domain methods **append** events to an internal list; they never dispatch events directly
- Aggregate Root exposes a **`collect_events()`** method that returns and **clears** the internal event list
- The Application layer calls `collect_events()` after a successful `Save()` and dispatches the returned events
- Each call to `collect_events()` drains the list — calling it twice in a row returns an empty list on the second call

```
# Typical flow in a Command Handler:
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
- **Query Handler**: call QueryRepository directly → return DTO (bypasses domain model)
- **Define QueryRepository interfaces** in this layer — read models are an application concern, not a domain concern. Infrastructure implements these interfaces.
- Define **transaction boundaries**: one Command Handler corresponds to one transaction
- Coarse-grained authorization checks belong here

#### CQRS Flow

```
Write path (Command):
  Interface → CommandHandler → AggregateRoot (domain method) → Repository.Save() → dispatch events

Read path (Query):
  Interface → QueryHandler → QueryRepository (direct DB query) → return DTO
```

#### Constraints

- No business rules — delegate entirely to domain methods
- Specifically, Application must not implement business field validation; it constructs Domain inputs, calls Domain constructors / methods / `Validate()`, and maps Domain errors outward (see §3.1 Validation Contract)
- Application must not become the owner of domain rules for technical-facing capabilities (see §3.1 Domain Rules in Technical Capabilities); it orchestrates Domain methods/services and Infrastructure implementations
- Never access the database directly; always go through Repository / QueryRepository interfaces
- **One transaction modifies one aggregate only.** If a use case needs to modify multiple aggregates, modify the first aggregate and persist it, then use domain events to trigger modifications to other aggregates in separate transactions (eventual consistency). Co-locating multiple aggregate mutations in a single transaction is prohibited.
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
| Application Service | Application | Command / Query Handler | Orchestrates use cases; owns transaction boundary |
| DTO | Application / Interface | Data class / struct | Decouples internal and external models |
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
| 1 | **Domain Events** (default for state propagation) | One context's state change should trigger reactions in others | Loose; eventual consistency |
| 2 | **Cross-Context Queries** (read-only) | A context needs a current snapshot of data owned elsewhere, with no write side-effects | Loose; through explicit query interfaces, never through the source context's Domain model |
| 3 | **Anti-Corruption Layer (ACL)** | Integrating with external / legacy systems whose model you cannot or should not adopt | Translation overhead; prevents pollution |
| 4 | **Protocol Contracts** (Protobuf, OpenAPI, GraphQL SDL) | Cross-service / cross-repository structured data contracts; generated code shared | Schema-level only; no Domain coupling |

Domain Events are the default for asynchronous state propagation. The other three exist for cases events cannot serve cleanly — they are not fallbacks for laziness.

### 5.3 Domain Events

Domain events are the preferred mechanism for asynchronous cross-context state propagation:

```
Publisher (Order context):
  1. Execute business logic; aggregate collects domain events internally
  2. Persist the aggregate
  3. Dispatch events after successful persist
 
Subscriber (User context):
  1. Subscribe to the relevant event
  2. Handle within its own transaction boundary
  3. Never depend on the publisher's internal domain model
```

### 5.4 Domain Event Payload Design

Domain events use a **Rich Event** style: carry the aggregate ID plus the minimum set of fields the consumer needs to process the event — nothing more.

**Rules:**
- **Never** include a full entity or aggregate root object in an event payload
- Carry only the fields that are necessary for consumers to act on the event
- Fields represent a **snapshot of the state at the moment the event occurred** — consumers must treat them as a historical record, not as current state
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
- Queries must not produce side effects in the source context; for state changes, use Domain Events
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
- Domain layers must not depend on generated protocol packages; if Domain logic needs an internal representation, define a Domain type and convert at the boundary (in Application or Infrastructure)
- Schema evolution follows additive rules — no breaking field changes; deprecate before removing
- Protocol contracts complement Domain Events and Cross-Context Queries (one for sync structured data; the others for state propagation and ad-hoc reads), they do not replace them

**Placement**: generated code lives in a single language-conventional location, isolated from Domain. Each language guide names its concrete directory; the abstract rule is "one place, never inside a Domain package, never co-mingled with hand-written business types". Examples:

| Language | Generated-code location |
|----------|------------------------|
| Go | `pkg/gen/` |
| Python | `packages/contracts/` or `src/contracts/gen/` |
| TypeScript | `packages/contracts/` |

Hand-written shared event payload types (used to type domain events crossing context boundaries within the same repository) are a different artifact from generated protocol code and should not be placed in the same directory.

---

## 6. Domain Events and Reliability

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

### 6.2 Reliability Tiers

Choose the appropriate delivery strategy based on business requirements:

| Scenario | Strategy | Trade-off |
|----------|----------|-----------|
| In-process events, loss tolerable | In-memory event bus | Simplest; events lost on crash |
| Cross-service notification, no loss | Outbox Pattern | Atomic write with business data; separate worker delivers |
| High throughput, eventual consistency | Message queue + idempotent consumer | Kafka, RocketMQ, etc. |

**Outbox Pattern flow:**

```
Single transaction:
  ┌─────────────────────┐     ┌──────────────────────────────┐
  │  Write business data │ ──► │  Write event to outbox table  │
  └─────────────────────┘     └──────────────────────────────┘

Separate worker:
  Poll outbox table → publish to message queue → mark as delivered
```

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

## 10. Key Principles Summary

1. **Domain layer has no concrete implementation dependencies** — no frameworks, ORMs, drivers, or protocol clients; general-purpose libraries are allowed when they don't couple Domain to an external system
2. **Vertical slicing** — organize by bounded context, not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces; Application defines read QueryRepository interfaces; Infrastructure implements both
4. **Aggregate boundary** — Repository operates on aggregate roots only, never on child entities directly
5. **State encapsulation** — all state changes go through domain methods; direct field mutation from outside is prohibited
6. **ID generation in Domain** — use infrastructure-independent ID schemes (UUID, ULID, Snowflake); never rely on database auto-increment
7. **Disciplined cross-context communication** — use one of: domain events (default for state propagation), cross-context queries (read-only), ACL (external/legacy), protocol contracts (cross-service schemas); direct calls into another context's Domain model or Application Service are prohibited; event payloads use Rich Event style (ID + minimum necessary fields), never embed full entities or aggregate objects
8. **Event collection** — aggregates collect events internally; Application drains via `collect_events()` after persist and dispatches
9. **CQRS** — Commands go through the domain model; Queries go directly to the database via QueryRepository and return DTOs
10. **Transaction boundary** — one Command Handler owns one transaction; one transaction modifies one aggregate only
11. **Repository collection semantics** — `Save()` covers create, update, and state-driven soclauft delete; never split by database operation type
12. **Soft delete** — business-driven deletion is modeled as domain state; `deleted_at` is always an Infrastructure concern
13. **Optimistic locking** — Infrastructure increments `version` via SQL; domain holds `Version` as a read-only token; always reload after `Save()` before further operations
14. **Event dispatch timing** — dispatch events after a successful persist, never before
15. **Event reliability** — choose in-memory bus / Outbox Pattern / message queue based on reliability requirements

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