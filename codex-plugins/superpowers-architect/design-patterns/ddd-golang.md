---
name: ddd-golang
description: Go implementation guide for DDD + Clean Architecture. Use when implementing backend services in Go with domain-driven design, including aggregates, repositories, domain events, CQRS, and module assembly with fx. Complements ddd-core specification.
---

# Go Web System Architecture Guide
## DDD + Clean Architecture — Go Implementation

**Version**: v2.2  
**Date**: 2026-04-16  
**Scope**: Team backend service architecture standard  
**Prerequisites**:
- **Strategic modeling**: [`ddd-modeling.md`](ddd-modeling.md) — Complete this first to identify bounded contexts and aggregate boundaries from business requirements
- **Architecture spec**: [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture rules. All architecture principles defer to `ddd-core.md`; in particular, the consolidated principles checklist lives at [ddd-core.md §10](ddd-core.md).
- This document is the Go implementation guide that builds on both.

> **Cross-reference convention**: major architecture sections align with the corresponding `ddd-core.md` sections where applicable. The Go guide also adds Go-specific workflow, placement, configuration, and runtime sections.

---

## 0. Go DDD Planning Workflow

Use this workflow before writing an implementation plan. It connects `ddd-modeling.md` strategic modeling, `ddd-core.md` tactical rules, and this Go implementation guide.

Choose the smallest gate that fits the change.

### Level 1 — Local Change

Use for changes inside an existing bounded context that do not add a new aggregate, repository, QueryRepository, domain event, or external integration.

Plan must state:
- bounded context and layer changed
- aggregate or use case affected
- write path or read path
- tests for the changed layer

Check against the relevant rules in §3: Domain keeps business rules, Application only orchestrates, Infrastructure stays technical, and Repository / QueryRepository responsibilities remain separate.

### Level 2 — New Use Case

Use for a new command, query, event handler, repository method, QueryRepository, DTO, assembler, or external integration inside an existing bounded context.

Plan must state:
- use case kind: Command, Query, or Event Handler
- aggregate root and invariants involved
- Repository / QueryRepository interfaces needed
- DTO and assembler changes
- external integration boundary, if any
- Infrastructure implementation
- domain events produced or consumed
- transaction boundary and event dispatch timing

Check against §3.1-§3.4, §5, and §6 before implementation.

### Level 3 — New Bounded Context or Aggregate

Use for a new bounded context, aggregate root, domain event family, repository, or cross-context communication.

Spec must include:
- bounded context, business capability, ubiquitous language, and data authority
- aggregate root, entities, value objects, and guarded invariants
- domain events and minimum required payload fields
- cross-context communication mechanism (domain events, queries, ACL, or protocol contracts — see §2.3)
- planned Go packages under `internal/business/<module>/...`

Check aggregate boundaries against `ddd-modeling.md §3`, tactical rules against `ddd-core.md`, and Go placement rules against §2-§11 of this guide.

### Cross-Context Change Without a New Context

If a change adds or modifies cross-context communication (a new domain event with new subscribers in another context, a new query exposed across contexts, an ACL adapter, etc.) but does not introduce a new bounded context or aggregate, treat it as **Level 2 on each affected side** and produce one plan per side:

- Producing side: the new domain event, its payload contract, and dispatch timing
- Consuming side: the event handler, idempotency strategy, and transaction boundary

If the change crosses three or more contexts, or if the contract itself is unstable, escalate to Level 3 and treat the contract as a first-class design artifact.

Do not treat existing code as precedent when it conflicts with the dependency rules in §1.3 and §3.

If the plan cannot answer the required items for its level, stop and complete the missing DDD design before writing code.

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This guide combines **Domain-Driven Design (DDD)** with **Clean Architecture**, targeting:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code organized by bounded context, not by technical layer
4. **Testability** — Business logic testable without external infrastructure

### 1.2 Layered Architecture

Three or four layers with the **Domain Layer as the core** (innermost):

```
          ┌─────────────────────────────────────────────┐
          │   Interface Layer (optional — see §3.3)     │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Application Layer                      │
          │  Use-case orchestration, transactions,      │
          │  DTOs, QueryRepository interfaces,          │
          │  RPC handler (implements generated stub)    │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Domain Layer ◄─── Core. No implementation deps.
          │  Entities, VOs, Domain Services,            │
          │  Write Repository interfaces, Events        │
          └─────────────────────────────────────────────┘
                             ▲ implements
  ┌──────────────────────────┴──────────────────────────┐
  │       Infrastructure Layer                          │
  │  Repository impls, external API clients, MQs,       │
  │  caches — external system integrations ONLY         │
  └─────────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer (if present) depends on Application and Domain layers
- Application Layer depends only on Domain Layer (and implements generated RPC stubs when applicable)
- Domain Layer has no concrete implementation dependencies (no `import` of Infrastructure packages, ORM/database drivers, HTTP clients/servers, message queue clients, or generated protocol packages)
- Infrastructure Layer depends on Domain Layer (implements Repository interfaces) and Application Layer (implements QueryRepository interfaces)

> For full dependency rules and common violations, see [ddd-core.md §1.3](ddd-core.md). Concrete Go code shown in §3.1 / §3.2 / §3.4.

---

## 2. Directory Structure

### 2.1 Overall Layout

```
project/
├── cmd/
│   ├── server/
│   │   └── main.go              # HTTP/gRPC service entry point
│   └── client/
│       └── main.go              # CLI client (if applicable)
├── configs/
│   ├── default.yml              # Default configuration
│   └── default_prod.yml         # Profile-specific overrides (optional, see §9)
├── internal/
│   ├── business/                # Business code — bounded contexts (vertical slices)
│   │   └── <module>/            # One bounded context
│   │       ├── domain/          # Domain layer - core business logic
│   │       ├── application/     # Application layer - use-case orchestration
│   │       ├── interfaces/      # Interface layer (optional, see §3.3)
│   │       ├── infrastructure/  # Infrastructure layer - external system integrations ONLY
│   │       ├── pkg/             # Bounded-context private utilities (if needed)
│   │       └── <module>.go      # Module assembly (fx Module)
│   └── pkg/                     # Infrastructure adapters — third-party libs wrapped + fx providers
│       ├── eventbus/            # mediator wrapper + lifecycle hooks
│       ├── mysql/               # MySQL / XORM client wrapper + config
│       ├── redis/               # Redis client wrapper + config
│       ├── kafka/               # Kafka producer/consumer wrapper + config
│       ├── httpsrv/             # HTTP server wrapper + lifecycle hooks
│       ├── grpcsrv/             # gRPC server wrapper + lifecycle hooks
│       └── module.go            # Aggregates the above into a single fx.Module("internal.pkg")
├── pkg/                         # Generated code + stable libraries for external consumers
│   └── gen/                     # Generated protocol code (proto, etc.)
├── proto/                       # Protobuf definitions
└── scripts/
    └── sql/                     # Database migration scripts
```

**`internal/business/` vs `internal/pkg/`** — `business/` holds bounded contexts (the DDD four-layer structure); `internal/pkg/` holds shared technical adapters (DB, HTTP/gRPC server, event bus, validator …). Business may depend on `internal/pkg/`; `internal/pkg/` must never import `internal/business/*`.

Root `pkg/` has only two valid uses:
1. `pkg/gen/` — code generated from `proto/` or other schemas
2. Stable, hand-written libraries intended to be imported by repositories outside this one

Root `pkg/` is **not** an internal shared/common directory. Do not place internal cross-context DTOs, read models, domain concepts, or business constants there merely because multiple internal modules use them. If multiple internal contexts need to share a type, follow §2.3.

### 2.2 Bounded Context Internal Structure

```
internal/business/user/          # User bounded context
├── domain/                      # Domain layer - pure business logic, no implementation deps
│   ├── user.go                  # Aggregate Root + Entity
│   ├── user_test.go             # Aggregate behavior tests
│   ├── valueobject.go           # Value Objects (Email, Password, etc.)
│   ├── valueobject_test.go      # Value Object validation tests
│   ├── event.go                 # Domain event definitions
│   ├── repository.go            # Write repository interface
│   └── service.go               # Domain service (if needed)
│
├── application/                 # Application layer - orchestrates domain objects
│   ├── application.go           # App Service constructor + gRPC/ConnectRPC stub
│   ├── command.go               # Command definitions + Command Handlers
│   ├── command_test.go          # Command Handler orchestration tests
│   ├── query.go                 # Query definitions + Query Handlers
│   ├── query_test.go            # Query Handler orchestration tests
│   ├── query_repository.go      # Read repository interface (CQRS, returns DTOs)
│   ├── handler.go               # Event Handlers (domain event consumers)
│   ├── dto.go                   # DTO definitions
│   ├── assembler.go             # DTO/Proto <-> Domain conversion
│   │
│   │   # When handlers grow numerous, promote to sub-directories:
│   │   # application/command/     — one file per Command + Handler
│   │   # application/query/       — one file per Query + Handler
│   │   # application/handler/     — one file per Event Handler
│   │   # application.go remains the single entry point that wires them all.
│
├── interfaces/                  # Interface layer (OPTIONAL — only for hand-written protocols)
│   └── http/
│       ├── handler.go           # REST Handler (manual routing, request/response mapping)
│       └── handler_test.go      # Protocol mapping tests
│
├── infrastructure/              # Infrastructure layer - external system integrations ONLY
│   ├── persistence/
│   │   ├── repository.go        # Repository implementation
│   │   ├── repository_test.go   # Repository integration tests
│   │   ├── do.go                # Database models (XORM/GORM)
│   │   └── converter.go         # DO <-> Entity conversion
│   └── messaging/
│       └── publisher.go         # Event publisher implementation
│
├── pkg/                         # Bounded-context private utilities (not imported by other contexts)
│
└── user.go                      # Module assembly (fx Module)
```

### 2.3 Shared Object Placement

When a type is needed by multiple modules, first decide what it represents:

1. **Domain concept owned by one bounded context**: keep it in the owning bounded context. Other contexts must not import it directly; exchange through domain events, queries, ACL, or protocol contracts.
2. **Cross-context / cross-service data contract**: define it in `proto/<capability>/v1/*.proto` and consume generated code from `pkg/gen/proto/...`. Keep business derivation rules in the owning context.
3. **Shared technical capability**: place it in `internal/pkg/<capability>`. Examples: `mysql`, `redis`, `kafka`, `activitystore`, `activitystream`.
4. **General-purpose library intended for external reuse**: only then place hand-written code in root `pkg/`.

Use protobuf for cross-boundary contracts, not for internal Domain models. Generated proto types may be used by Interface/Application boundary code, Infrastructure adapters, message publishers/consumers, and read-model contracts. Domain layer must not depend on generated proto packages; if Domain logic needs an internal representation, define a Domain type and convert at the boundary.

Example: Activity read model
- Preferred: `proto/activity/v1/activity.proto` defines `ExecutionActivity`, activity type/status, and cursor fields; `pkg/gen/proto/activity/v1` contains generated code.
- `internal/dispatcher/domain/activityprojection` owns derivation, classification, and state semantics.
- `internal/pkg/activitystore` and `internal/pkg/activitystream` adapt the generated contract to storage and streaming.
- Avoid `pkg/activity` as a hand-written internal shared model package.

---

## 3. Layer Responsibilities

### 3.1 Domain Layer

**Role**: Core business logic, independent of frameworks, databases, and UI.

**Contents**:
- **Aggregate Root**: Guardian of business invariants
- **Entity**: Object with unique identity
- **Value Object**: Defined by attributes, no identity, immutable
- **Domain Service**: Cross-aggregate logic that doesn't belong to a single entity
- **State Machine** (optional): Lifecycle management for aggregates with complex state transitions
- **Repository Interface**: Persistence abstraction (write operations only)
- **Domain Event**: Records significant domain occurrences

**Constraints**:
- No concrete implementation dependencies (no `import` of Infrastructure packages, ORM/database drivers, HTTP clients/servers, message queue clients, or generated protocol packages)
- General-purpose, implementation-independent libraries are allowed when they do not couple Domain to an external system
- Must not depend on other bounded contexts' domain layers (communicate via events)
- All state changes go through domain methods — direct field mutation is prohibited
- **Version is a read-only concurrency token** — Domain does not increment Version; Infrastructure increments it via SQL
- **IDs are generated in the Domain layer** (inside Factory Methods) using UUID/ULID — database auto-increment IDs are prohibited

**Business Field Validation**:
- Every Domain type with validation requirements (Aggregate Root, Entity, Value Object) exposes them through a domain method — typically `Validate() error`. Validation is part of the type's own behavior contract
- External layers (Application, Interface, Infrastructure) call `obj.Validate()`. They must never call `validator.Struct(obj)` on a Domain type from outside — reflection-based validation is an implementation detail of `Validate()`, not part of the public API
- Constructors and factory functions call `Validate()` before returning, so a Domain object is never observed in an invalid state
- Domain mutation methods call or preserve `Validate()` before persisting state changes
- Inside `Validate()`, the implementation may use `github.com/go-playground/validator/v10` (reflecting over tags on the type's own fields), hand-written checks, or a mix. Tags on Domain fields are an implementation choice of `Validate()`, not a contract
- Use explicit code for cross-field rules, state transitions, and invariants that cannot be expressed cleanly with validator tags
- Application layer constructs Domain inputs, invokes Domain constructors / methods / `Validate()`, and maps domain errors outward — it does not implement validation logic itself

**Domain Rules in Technical Capabilities**:
- A bounded context may own technical-facing capabilities such as runtime coordination, routing, scheduling, delivery, or observability. These are still domain concerns when they have stable ubiquitous language, state transitions, errors, or invariants
- Do not assume a capability is Infrastructure merely because it is technical or not directly visible to end users
- State transition rules, admission policies, semantic naming, and domain-visible derivation rules belong in Domain methods, Value Objects, or Domain Services
- Infrastructure may enforce these rules mechanically through storage constraints, locks, leases, CAS, or external APIs, but the rule itself must be named and testable outside Infrastructure

**Factory Design**:
- Simple cases: use the Aggregate Root's own constructor (`NewXxx`)
- Complex cases (assembling multiple Value Objects, cross-entity validation): extract an independent Domain Factory struct within the domain package

**Domain Event Collection Contract** (using `mediator.EventCollection`):
- Aggregate Root holds an `Events mediator.EventCollection` field
- Domain methods append events via `Events.Add(event)` — they never dispatch directly
- Application layer calls `Events.Raise(mediator)` once after a successful `Save()` to dispatch all collected events
- `Raise` guarantees idempotency internally, preventing duplicate dispatch

> This is the Go-specific implementation of the language-agnostic event collection pattern described in [ddd-core.md §3.1 "Domain Event Collection"](ddd-core.md). The `mediator.EventCollection` provides `Add`/`Raise`/`AsyncRaise` with an atomic one-time-raise guarantee via `sync/atomic.CompareAndSwap`.

**State Machine Contract** (optional, using `github.com/go-jimu/components/fsm`):

Not every aggregate needs a state machine. Use the following criteria to decide:

| Scenario | Recommended Approach |
|----------|---------------------|
| Few states (2-3), simple transition logic | Enum + guards in domain methods, no FSM needed |
| Many states (4+), complex rules, conditional guards | Use FSM |
| Multiple roles/actions driving one entity (approval, ticket) | Use FSM |
| Need visualization or dynamic transition configuration | Use FSM |

When an Aggregate Root has a complex lifecycle with multiple state transitions and guard conditions (e.g., Order, Task, Approval), use a finite state machine to enforce transition rules.

- **States, Actions, Conditions** are all defined in the Domain layer — they are business invariants
- **Aggregate Root implements `fsm.StateContext`** — the entity itself is the state context
- **`Condition`** functions are business guards (e.g., "only allow checkout if cart has items"), belong in Domain
- **StateMachine is a shared, read-only definition** — registered globally during module initialization via `fsm.RegisterStateMachine()`; retrieved at runtime via `fsm.MustGetStateMachine()`
- **Domain methods call `sm.TransitionToNext(aggregate, action)`** — never manipulate state directly
- **Transitions can trigger domain events** — append events inside `TransitionTo()` when state changes
- **Infrastructure only persists `fsm.StateLabel`** — it does not know about transition rules or conditions

```go
// domain/order.go — minimal viable shape; replicate the same idiom for additional states / transitions
package domain

import "github.com/go-jimu/components/fsm"

const (
    OrderStatePending fsm.StateLabel = "pending"
    OrderStatePaid    fsm.StateLabel = "paid"
    OrderActionPay    fsm.Action     = "pay"
)

func NewOrderStateMachine() fsm.StateMachine {
    sm := fsm.NewStateMachine("order")
    sm.RegisterStateBuilder(OrderStatePending, func() fsm.State { return fsm.NewSimpleState(OrderStatePending) })
    sm.RegisterStateBuilder(OrderStatePaid, func() fsm.State { return fsm.NewSimpleState(OrderStatePaid) })

    // Transition with a business guard
    sm.AddTransition(OrderStatePending, OrderStatePaid, OrderActionPay, func(sc fsm.StateContext) bool {
        return sc.(*Order).TotalAmount > 0
    })
    if err := sm.Check(); err != nil {
        panic(err) // Fail fast on invalid definition
    }
    return sm
}

// Order Aggregate Root implements fsm.StateContext
type Order struct {
    ID          string
    Status      fsm.State
    TotalAmount int64
    Events      mediator.EventCollection
    Version     int
}

func (o *Order) CurrentState() fsm.State { return o.Status }

func (o *Order) TransitionTo(next fsm.State, by fsm.Action) error {
    prev := o.Status.Label()
    next.SetContext(o)
    o.Status = next
    o.Events.Add(EventOrderStatusChanged{ID: o.ID, From: string(prev), To: string(next.Label())})
    return nil
}

// Domain method drives transition via the FSM — never mutates Status directly
func (o *Order) Pay() error {
    return fsm.MustGetStateMachine("order").TransitionToNext(o, OrderActionPay)
}
```

```go
// domain/event.go
package domain

import "github.com/go-jimu/components/mediator"

// Event kind constants
const (
    EventKindUserCreated     mediator.EventKind = "user.created"
    EventKindPasswordChanged mediator.EventKind = "user.password_changed"
)

// Domain events implement mediator.Event (Kind() method).
// Rich Event style: carry ID + minimum necessary fields.
type EventUserCreated struct {
    ID    string
    Name  string
    Email string
}

func (e EventUserCreated) Kind() mediator.EventKind { return EventKindUserCreated }

type EventPasswordChanged struct{ ID string }

func (e EventPasswordChanged) Kind() mediator.EventKind { return EventKindPasswordChanged }
```

```go
// domain/user.go
package domain

import (
    "errors"
    "time"

    "github.com/go-jimu/components/mediator"
    "github.com/google/uuid"
)

var (
    ErrInvalidEmail    = errors.New("invalid email format")
    ErrWeakPassword    = errors.New("password too weak")
    ErrUserNotActive   = errors.New("user is not active")
)

// User Aggregate Root
type User struct {
    ID             string
    Name           string
    Email          Email          // Value Object
    HashedPassword Password       // Value Object
    Status         UserStatus     // Value Object
    Events         mediator.EventCollection  // Domain event collection
    Version        int            // Optimistic lock version (read-only; Infrastructure increments)
    CreatedAt      time.Time
    UpdatedAt      time.Time
}

// Value Object: Email
type Email string

func (e Email) Validate() error {
    if !strings.Contains(string(e), "@") {
        return ErrInvalidEmail
    }
    return nil
}

// Value Object: Password (hashed)
type Password []byte

// Value Object: UserStatus
type UserStatus int

const (
    UserStatusInactive UserStatus = iota
    UserStatusActive
    UserStatusSuspended
)

// Factory Method — ID generated in Domain layer, Version starts at 0
func NewUser(name, rawPassword string, email Email) (*User, error) {
    if err := email.Validate(); err != nil {
        return nil, err
    }

    hashed, err := hashPassword(rawPassword)
    if err != nil {
        return nil, err
    }

    user := &User{
        ID:             uuid.Must(uuid.NewV7()).String(),  // ID generated in Domain
        Name:           name,
        Email:          email,
        HashedPassword: hashed,
        Status:         UserStatusInactive,
        Events:         mediator.NewEventCollection(),
        Version:        0,  // 0 = new object, not yet persisted
        CreatedAt:      time.Now(),
    }

    user.Events.Add(EventUserCreated{
        ID:    user.ID,
        Name:  name,
        Email: string(email),
    })

    return user, nil
}

// Domain Method: Change password
// Note: does not increment Version — Infrastructure handles that via SQL
func (u *User) ChangePassword(oldRaw, newRaw string) error {
    if u.Status != UserStatusActive {
        return ErrUserNotActive
    }

    if !verifyPassword(oldRaw, u.HashedPassword) {
        return errors.New("old password incorrect")
    }

    hashed, err := hashPassword(newRaw)
    if err != nil {
        return err
    }

    u.HashedPassword = hashed
    u.UpdatedAt = time.Now()

    u.Events.Add(EventPasswordChanged{ID: u.ID})
    return nil
}

// Repository Interface (write repository, defined in Domain layer).
// Generated mocks are test-only; see §6.3 "Generated mocks" for placement rules.
//go:generate mockery --name=Repository --case=snake
type Repository interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}
```

### 3.2 Application Layer

**Role**: Orchestrate domain objects to fulfill use cases; define transaction boundaries.

**Contents**:
- **Application Service**: Use-case orchestration, coordinating multiple aggregates/domain services
- **Command + Command Handler** (`command.go`): Write operation intent and handling
- **Query + Query Handler** (`query.go`): Read operation intent and handling
- **Event Handler** (`handler.go`): Subscribes to domain events and executes side-effect logic (e.g., send notification, update read model, trigger cross-context workflow)
- **QueryRepository Interface**: Defined in Application layer, returns DTOs, bypasses Domain model
- **DTO**: Data Transfer Objects, decoupling internal and external models
- **Assembler**: DTO ↔ Domain object conversion

**Constraints**:
- No business rules (those belong in the Domain layer)
- Application must not implement business field validation; it constructs domain inputs, calls domain constructors/methods/`Validate()`, and maps domain errors outward
- Application must not become the owner of domain rules for technical-facing capabilities; it orchestrates Domain methods/services and Infrastructure implementations
- Depends only on the Domain layer
- Transaction boundaries are controlled here
- **One transaction modifies one aggregate only.** To modify multiple aggregates, use domain events to trigger subsequent aggregate modifications (eventual consistency)
- Domain events are dispatched after a successful persist via `Events.Raise(mediator)`
- After `Save()`, the in-memory aggregate is stale — reload via `Get()` if further operations are needed
- **File organization**: start with flat files (`command.go`, `query.go`, `handler.go`); when handlers grow numerous, promote to sub-directories (`command/`, `query/`, `handler/`, one file per handler). `application.go` remains the single entry point that wires everything.

**Event Handler Contract**:
- Implements `mediator.EventHandler` interface: `Listening() []mediator.EventKind` + `Handle(ctx, event)`
- Lives in the **consuming** bounded context's Application layer, not the producing context
- Each EventHandler owns its own transaction — failures do not roll back the producing side
- Must be idempotent: the same event delivered twice must not produce duplicate side effects
- Error handling: log and continue (or retry); never propagate errors back to the event producer
- Registered during module initialization via `mediator.Subscribe(handler)`

```go
// application/command.go
package application

// Command definition
type CommandChangePassword struct {
    ID          string
    OldPassword string
    NewPassword string
}

// Command Handler — canonical 4-step orchestration:
// Load aggregate → invoke domain method → Save → dispatch events.
type CommandChangePasswordHandler struct {
    repo domain.Repository
}

func (h *CommandChangePasswordHandler) Handle(ctx context.Context, cmd *CommandChangePassword) error {
    // 1. Load aggregate
    user, err := h.repo.Get(ctx, cmd.ID)
    if err != nil {
        return err
    }

    // 2. Execute business logic (in Domain layer)
    if err = user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
        return err
    }

    // 3. Persist
    if err = h.repo.Save(ctx, user); err != nil {
        return err
    }

    // 4. Dispatch domain events after successful persist
    user.Events.Raise(mediator.Default())
    return nil
}
```

### 3.3 Interface Layer (Optional)

**Role**: Adapt external protocols that require hand-written routing and request/response mapping (e.g., REST with chi/gin/echo, custom WebSocket handlers). In Go this layer is named `interfaces/` rather than ddd-core's `adapter/`.

**Skip this layer for gRPC / ConnectRPC.** The code generator emits a handler interface (e.g., `userv1connect.UserServiceHandler`) — the `Application` struct implements it directly, and a separate `interfaces/` directory only adds indirection.

**Contents (when used)**: HTTP handler, request/response structs, input format validation (business validation belongs in Domain).
**Constraints**: depends only on Application and Domain; no business logic; owns protocol details (status codes, error mapping).

#### gRPC/ConnectRPC: Application struct implements the generated stub directly

```go
// application/application.go
package application

import (
    "context"

    "connectrpc.com/connect"
    userv1 "github.com/example/project/pkg/gen/proto/user/v1"
)

// Thin protocol adapter — translate request, delegate to the §3.2
// Command handler, map errors back to connect codes.
func (app *Application) ChangePassword(
    ctx context.Context,
    req *connect.Request[userv1.ChangePasswordRequest],
) (*connect.Response[userv1.ChangePasswordResponse], error) {
    err := app.changePasswordHandler.Handle(ctx, &CommandChangePassword{
        ID:          req.Msg.UserId,
        OldPassword: req.Msg.OldPassword,
        NewPassword: req.Msg.NewPassword,
    })
    if err != nil {
        return nil, convertError(err)
    }
    return connect.NewResponse(&userv1.ChangePasswordResponse{}), nil
}

func convertError(err error) error {
    switch {
    case errors.Is(err, domain.ErrUserNotActive):
        return connect.NewError(connect.CodeFailedPrecondition, err)
    case errors.Is(err, domain.ErrInvalidEmail):
        return connect.NewError(connect.CodeInvalidArgument, err)
    default:
        return connect.NewError(connect.CodeInternal, err)
    }
}
```

#### REST: Interface layer handles manual routing

```go
// interfaces/http/handler.go — only needed for hand-written REST controllers
package http

type UserHandler struct {
    app *application.Application
}

func (h *UserHandler) RegisterRoutes(r chi.Router) {
    r.Post("/users", h.CreateUser)
    r.Put("/users/{id}/password", h.ChangePassword)
}
```

### 3.4 Infrastructure Layer

**Role**: Implement Domain/Application-layer interfaces that integrate with **external systems** (databases, caches, message queues, third-party APIs).

**Contents** (external system integrations ONLY):
- **Repository Implementation**: Database access implementation
- **Data Object (DO)**: ORM models
- **Converter**: DO ↔ Domain Entity conversion
- **External API Client**: Third-party service clients (payment gateway, email service, etc.)
- **Event Publisher**: Message queue publishing implementation
- **Cache Implementation**: Redis, Memcached, etc.

**What does NOT belong in Infrastructure**:
- Utility/tool packages (CLI wrappers, parsers, helpers) — these are not external system integrations
- Place them according to scope:
  - `internal/pkg/` — cross-domain shared infrastructure adapters
  - `pkg/` — generated protocol code or stable public libraries consumable by external projects; not internal shared DTOs/read models
  - `internal/business/<domain>/pkg/` — utilities scoped to a single bounded context; must not be imported by other contexts or hold shared DTOs/read models/domain concepts

**Constraints**:
- Implements Repository interfaces (Domain layer) and QueryRepository interfaces (Application layer)
- No business logic
- Handles technical details (SQL, caching, retries, etc.)
- **Version is incremented by SQL** (`version = version + 1`) — Domain layer does not increment it
- Infrastructure implements technical mechanisms for domain rules, but it must not be the only place where those rules are expressed
- Shared middleware clients are initialized in `internal/pkg/<middleware>`; bounded-context Infrastructure receives already constructed clients

**Soft Delete**:
- **Business-driven logical deletion**: Domain has a status field (e.g., `Status = Cancelled`); `Save()` internally sets `deleted_at` based on the status
- **Technical soft delete**: Domain is unaware; Infrastructure transparently manages `deleted_at`
- In both cases, `deleted_at` is an Infrastructure concern — Domain never knows about this field

> For the full soft delete specification, see [ddd-core.md §3.4 "Soft Delete"](ddd-core.md).

```go
// infrastructure/persistence/do.go
package persistence

import (
    "xorm.io/xorm"
    "github.com/example/project/internal/pkg/mysql"
)

// Data Object - XORM model
type UserDO struct {
    ID        string             `xorm:"id pk"`
    Name      string             `xorm:"name"`
    Password  []byte             `xorm:"password"`  // maps to HashedPassword
    Email     string             `xorm:"email"`
    Status    int                `xorm:"status"`
    Version   int                `xorm:"version"`
    CreatedAt mysql.Timestamp `xorm:"created_at"`
    UpdatedAt mysql.Timestamp `xorm:"updated_at"`
    DeletedAt mysql.Timestamp `xorm:"deleted_at deleted"`
}

func (u UserDO) TableName() string {
    return "user"
}

// infrastructure/persistence/repository.go
package persistence

import (
    "context"

    "github.com/jinzhu/copier"
    "xorm.io/xorm"
    "github.com/samber/oops"

    "github.com/example/project/internal/business/user/domain"
)

// Compile-time interface check
var _ domain.Repository = (*userRepository)(nil)

type userRepository struct {
    db *xorm.Engine
}

// Constructor returns interface. The MySQL client is constructed in internal/pkg/mysql
// and injected here; this package does not read config or open connections.
func NewRepository(db *xorm.Engine) domain.Repository {
    return &userRepository{db: db}
}

func (r *userRepository) Get(ctx context.Context, id string) (*domain.User, error) {
    var do UserDO
    has, err := r.db.Context(ctx).ID(id).Get(&do)
    if err != nil {
        return nil, oops.Wrap(err)
    }
    if !has {
        return nil, oops.With("id", id).Wrap(sql.ErrRecordNotFound)
    }
    return convertToEntity(&do)
}

func (r *userRepository) Save(ctx context.Context, user *domain.User) error {
    do := convertToDO(user)

    if user.Version == 0 {
        // New object: INSERT, version starts at 1
        do.Version = 1
        _, err := r.db.Context(ctx).Insert(do)
        return oops.Wrap(err)
    }

    // Existing object: UPDATE (optimistic lock: version incremented by SQL)
    do.Version = user.Version + 1
    affected, err := r.db.Context(ctx).
        Where("version = ?", user.Version).
        ID(user.ID).
        Update(do)
    if err != nil {
        return oops.Wrap(err)
    }
    if affected == 0 {
        return domain.ErrConcurrentModification
    }
    // After Save(), the in-memory user is stale — caller must re-Get() if needed
    return nil
}

// converter.go
func convertToEntity(do *UserDO) (*domain.User, error) {
    user := new(domain.User)
    if err := copier.Copy(user, do); err != nil {
        return nil, oops.Wrap(err)
    }
    user.Events = mediator.NewEventCollection()  // Initialize event collection when loading from DB
    return user, nil
}

func convertToDO(user *domain.User) *UserDO {
    do := new(UserDO)
    copier.Copy(do, user)
    return do
}
```

---

## 4. DDD Tactical Design Reference

| DDD Concept | Layer | Go Implementation |
|-------------|-------|-------------------|
| **Aggregate** | Domain | `struct` + domain methods + `mediator.EventCollection` |
| **Entity** | Domain | `struct` with ID |
| **Value Object** | Domain | Immutable `struct` |
| **Domain Service** | Domain | Stateless function / struct |
| **State Machine** | Domain (definition) | `fsm.StateMachine` + `fsm.StateContext` |
| **Repository** | Domain (interface) + Infra (impl) | Interface + Impl |
| **Query Repository** | Application (interface) + Infra (impl) | Interface + Impl |
| **Domain Event** | Domain | `Event` struct implementing `mediator.Event` |
| **Application Service** | Application | Use-case orchestration |
| **Event Handler** | Application | `mediator.EventHandler` impl |
| **DTO** | Application / Interface | Data transfer struct |
| **Factory** | Domain | Constructor / independent Factory struct |
| **CQRS** | Application | Command + Query separation |

---

## 5. Cross-Context Communication

### 5.1 Direct Calls Are Prohibited

Bounded contexts must **never** directly call another context's Application Service or Repository.

```go
// ❌ Wrong: Order context directly calls User context
func (s *OrderAppService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) error {
    // Prohibited!
    user, err := s.userApp.GetUser(ctx, cmd.UserID)
    ...
}
```

### 5.2 Communicate via Domain Events

Producer side: nothing special — after `Save()`, the producing context's Application Service calls `order.Events.Raise(mediator.Default())` (canonical 4-step flow, §3.2). Consumer side lives in the **subscribing** context's `application/handler.go`:

```go
// internal/business/user/application/handler.go — User context subscribes to Order's event
type UserPointsHandler struct{ repo domain.Repository }

func (h *UserPointsHandler) Listening() []mediator.EventKind {
    return []mediator.EventKind{orderdomain.EventKindOrderCompleted}
}

func (h *UserPointsHandler) Handle(ctx context.Context, event mediator.Event) {
    // Idempotent side effect; owns its own transaction; logs and returns on failure
    // — never propagates errors back to the producer.
}

// Wire in the module's NewApplication: ev.Subscribe(NewUserPointsHandler(repo))
```

---

## 6. Naming Conventions

### 6.1 General Rules

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Domain Event Constant | `EventKind` + Name | `EventKindUserCreated` |
| Domain Event Struct | `Event` + Name | `EventUserCreated` |
| Command | `Command` + Action | `CommandChangePassword` |
| Command Handler | `Command` + Action + `Handler` | `CommandChangePasswordHandler` |
| Query | `Query` + Name | `QueryFindUserList` |
| Query Handler | Name + `Handler` | `FindUserListHandler` |
| Event Handler | Event name + `Handler` | `UserCreatedHandler` |
| State Label | Entity + `State` + Name | `OrderStatePending` |
| State Action | Entity + `Action` + Verb | `OrderActionPay` |
| Repository Interface | `Repository` | `Repository` |
| Repository Implementation | lowercase + `Repository` | `userRepository` |
| Data Object | Entity name + `DO` | `UserDO` |
| DTO | Purpose + `DTO` | `UserListDTO` |

### 6.2 File Organization

Production files only. Test file placement is governed by §6.3 and is not required to mirror this table 1:1.

| File | Contents |
|------|----------|
| `domain/<entity>.go` | Aggregate Root + Entity |
| `domain/valueobject.go` | Value Object definitions |
| `domain/event.go` | Domain event definitions |
| `domain/repository.go` | Write repository interface |
| `domain/service.go` | Domain service |
| `application/application.go` | App Service constructor + gRPC/ConnectRPC stub implementation |
| `application/command.go` | Command definitions + Command Handlers |
| `application/query.go` | Query definitions + Query Handlers |
| `application/query_repository.go` | Read repository interface (returns DTOs) |
| `application/handler.go` | Event Handlers (domain event consumers) |
| `application/dto.go` | DTO definitions |
| `application/assembler.go` | Object conversion (DTO ↔ Domain, Proto ↔ Domain) |
| `interfaces/http/handler.go` | REST handler (optional, hand-written protocols only) |
| `infrastructure/persistence/do.go` | Database models |
| `infrastructure/persistence/repository.go` | Repository implementation |
| `infrastructure/persistence/converter.go` | Conversion functions |

### 6.3 Test File Organization

Go test cases must live in `*_test.go` files. Do not place test-only code, fixtures, fakes, mocks, or assertions in production files.

Do not collect all tests into a separate top-level test module by default. Keep tests beside the package under test; use a separate test suite directory only for service-level integration or end-to-end tests that span multiple bounded contexts.

Both same-package tests (`package <name>`) and external test packages (`package <name>_test`) are acceptable. Use the external `_test` package when you need to break an import cycle (e.g., a test that imports a sibling package which itself imports the package under test) or when you want to verify the package compiles cleanly against its public API alone. In all cases, tests must exercise behavior rather than implementation trivia.

Test helpers and generated mocks must be test-only:
- keep them in `*_test.go`, or
- place them in a clearly named test-support package that production code never imports.

Layer-specific placement:
- Domain tests live beside the Domain package and instantiate aggregates/value objects directly.
- Application tests live beside the Application package and mock only Repository / QueryRepository / external boundary interfaces.
- Infrastructure tests live beside Infrastructure implementations and may use real external dependencies or test containers.
- Interface tests live beside Interface handlers and verify protocol transformation and error mapping.

**Generated mocks**:
- Prefer `mockery --inpackage --testonly` so mocks are emitted as `mock_<name>_test.go` in the same package — they are physically test-only and cannot be imported by production code
- If using a separate output directory (e.g., `<package>/mocks/`), keep it out of production import paths and enforce the boundary with a depguard / golangci-lint rule that bans `*/mocks` imports outside `*_test.go`
- Mock files are never the source of truth for behavior; the interface in `domain/repository.go` (or `application/query_repository.go`) is

---

## 7. Technology Stack

| Purpose | Recommended Library |
|---------|---------------------|
| Dependency Injection | `go.uber.org/fx` |
| RPC/HTTP | `connectrpc.com/connect` |
| HTTP Router | `github.com/go-chi/chi/v5` |
| ORM | `xorm.io/xorm` |
| Validation | `github.com/go-playground/validator/v10` |
| Logging | `log/slog` + `github.com/go-jimu/components/sloghelper` |
| Error Handling | `github.com/samber/oops` |
| Event Bus | `github.com/go-jimu/components/mediator` |
| State Machine | `github.com/go-jimu/components/fsm` |
| Configuration | `github.com/go-jimu/components/config` + `config/loader` |
| Object Copying | `github.com/jinzhu/copier` |

---

## 8. Error Handling

### 8.1 Per-Layer Strategy

| Layer | Approach |
|-------|----------|
| Domain / Infrastructure | Use `oops.With("key", val).Wrap(err)` to attach context |
| Application | Log then return: `logger.ErrorContext(...)`; `return err` |
| Interface | Convert to protocol error: `connect.NewError(connect.CodeNotFound, err)` |

### 8.2 Error Definitions

```go
// domain/errors.go
package domain

import "errors"

var (
    // Domain errors
    ErrUserNotFound            = errors.New("user not found")
    ErrInvalidEmail            = errors.New("invalid email format")
    ErrWeakPassword            = errors.New("password too weak")
    ErrUserNotActive           = errors.New("user is not active")
    ErrConcurrentModification  = errors.New("concurrent modification detected")
)
```

---

## 9. Configuration Management

### 9.1 Option Declaration Convention

Each component owns its `Option`; the top-level `main` only aggregates and distributes. Three rules:

1. **Component-owned `Option`** — Every fx-provided component declares its own `Option` struct in **its own package** (alongside `NewXxx`, or in a sibling `option.go`). Fields carry `json/yaml/toml` tags so the loader can map config files into them.
2. **Constructor consumes `Option` directly** — Signature pattern: `NewXxx(lc fx.Lifecycle, opt Option, ...) (*Xxx, error)`. The component does not know where `Option` came from; `fx` injects it.
3. **Top-level only aggregates** — `cmd/server/main.go` declares one `Option` struct embedding `fx.Out`, with **one field per component**. Field tags map to top-level YAML keys. Never inline a component's leaf fields (host, port, dsn …) into the top-level struct — those belong inside the component's package.

**Business modules follow the same rule.** If a bounded context needs runtime config (e.g., `user.MaxLoginAttempts`), declare `user.Option` in `internal/business/user/option.go` and add a `User user.Option` field to the top-level `Option`.

**Shared Middleware Client Ownership**:
- Initialize shared middleware clients in `internal/pkg/<middleware>`: `internal/pkg/mysql`, `internal/pkg/redis`, `internal/pkg/kafka`, etc.
- Each middleware package owns its `Option`, constructor, health/lifecycle hooks, and fx provider.
- Bounded-context Infrastructure packages must not read shared middleware config, open connections, or close clients.
- Repository / QueryRepository / Publisher / Consumer constructors receive initialized clients and adapt them to Domain/Application interfaces.
- Example: `internal/pkg/mysql.NewClient(...) -> *xorm.Engine`, then `internal/business/user/infrastructure/persistence.NewRepository(db *xorm.Engine)`.

**Example — adding a Redis client.** Declare `Option` next to the constructor:

```go
// internal/pkg/redis/redis.go
package redis

import (
    "context"

    "github.com/redis/go-redis/v9"
    "go.uber.org/fx"
)

type Option struct {
    Addr     string `json:"addr" yaml:"addr" toml:"addr"`
    Password string `json:"password" yaml:"password" toml:"password"`
    DB       int    `json:"db" yaml:"db" toml:"db"`
}

func NewClient(lc fx.Lifecycle, opt Option) *redis.Client {
    client := redis.NewClient(&redis.Options{
        Addr: opt.Addr, Password: opt.Password, DB: opt.DB,
    })
    lc.Append(fx.Hook{
        OnStop: func(ctx context.Context) error { return client.Close() },
    })
    return client
}
```

Then: register `fx.Provide(redis.NewClient)` in `internal/pkg/module.go`, add a `Redis redis.Option` field (with `yaml:"redis"` tag) to the top-level `Option` in `cmd/server/main.go` (see §9.2), and add a `redis:` block to `configs/default.yml`. The component never imports anything from `cmd/`, and `main` never imports `redis.Client` — `fx` wires both ends through the typed `Option`.

### 9.2 Aggregate Configuration in `main`

The aggregate `Option` lives in `cmd/server/main.go`. It embeds `fx.Out` so each field is automatically injected into the component declaring a matching type dependency. Load it once at startup, log it (success or failure), and hand it to `fx.Supply` — no helper function needed. Always log the resolved config so problems are diagnosable from a single line.

```go
// cmd/server/main.go
package main

import (
    "log/slog"
    "os"

    "github.com/go-jimu/components/config/loader"
    "github.com/go-jimu/components/mediator"
    "github.com/go-jimu/components/sloghelper"
    "github.com/example/project/internal/pkg/grpcsrv"
    "github.com/example/project/internal/pkg/httpsrv"
    "github.com/example/project/internal/pkg/mysql"
    "go.uber.org/fx"
)

// Option holds all infrastructure configuration.
// fx.Out enables automatic distribution — each field is injected
// into the component that declares a matching type dependency.
type Option struct {
    fx.Out
    Logger     sloghelper.Options `json:"logger" toml:"logger" yaml:"logger"`
    MySQL      mysql.Option       `json:"mysql" toml:"mysql" yaml:"mysql"`
    HTTPServer httpsrv.Option     `json:"http-server" toml:"http-server" yaml:"http-server"`
    GRPCServer grpcsrv.Option     `json:"grpc" toml:"grpc" yaml:"grpc"`
    Eventbus   mediator.Options   `json:"eventbus" toml:"eventbus" yaml:"eventbus"`
}

func main() {
    var opt Option
    err := loader.Load(&opt)
    // Always log the resolved config — even on partial failure it helps diagnose.
    slog.Info("load config", slog.Any("config", opt))
    if err != nil {
        slog.Error("load config failed", slog.Any("error", err))
        os.Exit(1)
    }

    app := fx.New(
        fx.Supply(opt),  // distributes every field via fx.Out
        // ... other providers and modules (see §10.1)
    )
    app.Run()
}
```

> The bootstrap log uses slog's default handler (the configured logger from `sloghelper.NewLog` is not yet wired). That is expected — keep it; it is the only signal you have if `fx` itself fails to start.

### 9.3 Configuration Files & Profiles

Configuration files are stored in the `configs/` directory. `loader.Load` automatically discovers and merges them:

```
configs/
├── default.yml          # Base configuration (always loaded)
└── default_prod.yml     # Profile override (loaded when JIMU_PROFILES_ACTIVE=prod)
```

Profile switching via environment variable:

```bash
export JIMU_PROFILES_ACTIVE=prod   # Loads default.yml, then default_prod.yml overrides
```

Supported formats: YAML, TOML, JSON. The file extension determines the codec.

### 9.4 Environment Variable Override

Environment variables do **not** automatically map to nested config keys (unlike Spring Boot's convention). Instead, use **placeholder syntax** `${VAR:default}` in config files to reference environment variables:

```yaml
# configs/default.yml
logger:
  level: "${LOG_LEVEL:info}"

mysql:
  dsn: "${MYSQL_DSN:root:123456@tcp(localhost:3306)/mydb}"

http-server:
  addr: "${HTTP_ADDR::8080}"

grpc:
  addr: "${GRPC_ADDR::9090}"

eventbus:
  timeout: "30s"
  concurrent: 100
```

Loading and resolution order:

1. `default.yml` — base configuration
2. `default_<profile>.yml` — profile-specific overrides (merged on top)
3. Environment variables — collected into a flat key-value pool
4. **Resolve phase** — `${VAR:default}` placeholders in the merged config are expanded using the environment variable pool; if the variable is unset, the default value after `:` is used

---

## 10. Entry Point & Graceful Shutdown

### 10.1 Entry Point

Use `app.Run()` as the standard entry point — it encapsulates Start → Wait for SIGINT/SIGTERM → Stop → Exit. The full `main()` (with config loading and bootstrap logging) is in §9.2; the module wiring inside `fx.New` is what differs per service:

```go
app := fx.New(
    fx.Supply(opt),                  // distributes every field via fx.Out (see §9.2)
    fx.Provide(sloghelper.NewLog),
    fx.Provide(eventbus.NewMediator),
    pkg.Module,                      // infrastructure adapters (internal/pkg)
    user.Module,                     // bounded contexts (internal/business/<module>)
    fx.StopTimeout(30*time.Second),
    fx.NopLogger,
)
app.Run()
```

`Run()` internally uses `app.Wait()` (not `app.Done()`), which returns `ShutdownSignal{Signal, ExitCode}` — properly propagating exit codes when a component triggers shutdown via `fx.Shutdowner`.

**When to use manual Start/Wait/Stop instead**: only when you need post-shutdown logic before exit (e.g., flushing telemetry). For most services, `app.Run()` is sufficient.

### 10.2 Lifecycle Hooks

Components that have **in-flight work** at shutdown time must register `fx.Lifecycle` hooks to drain gracefully. Pure connection clients do not need drain-style hooks, but they may register `Close` hooks for cleanup when the library exposes one.

**Needs OnStop** (has in-flight work):

| Component | In-flight work | OnStop action |
|-----------|---------------|---------------|
| HTTP Server | HTTP requests being processed | `srv.Shutdown(ctx)` — stop accepting, drain in-flight requests |
| gRPC Server | RPC calls being processed | `server.GracefulStop()` — stop accepting, drain in-flight calls |
| EventBus (Mediator) | Event handler goroutines running | `GracefulShutdown(ctx)` — reject new events, wait for handlers |
| Message queue consumer | Messages being processed | Stop consuming, finish current batch |

Pure connection clients (MySQL, Redis, HTTP Client) do not need drain-style OnStop hooks — they have no in-flight work of their own. They may still register cleanup hooks such as `client.Close()`.

#### Server: Listen/Serve Separation

Separate `net.Listen` (synchronous, in OnStart) from `Serve` (asynchronous, in goroutine). Startup errors (e.g., port already in use) are caught immediately and cause `app.Start` to fail. OnStop drains in-flight requests before returning.

```go
// internal/pkg/httpsrv/server.go
func NewHTTPServer(lc fx.Lifecycle, opt Option) *http.Server {
    srv := &http.Server{Addr: opt.Addr, Handler: mux}

    lc.Append(fx.Hook{
        OnStart: func(ctx context.Context) error {
            ln, err := net.Listen("tcp", srv.Addr)
            if err != nil {
                return err
            }
            go srv.Serve(ln)
            return nil
        },
        OnStop: func(ctx context.Context) error {
            return srv.Shutdown(ctx)
        },
    })
    return srv
}
```

gRPC Server follows the same pattern: OnStart binds listener + `go server.Serve(ln)`; OnStop calls `server.GracefulStop()`.

#### EventBus: Drain Handler Goroutines

```go
// internal/pkg/eventbus/eventbus.go
func NewMediator(lc fx.Lifecycle, opt mediator.Options) mediator.Mediator {
    m := mediator.NewInMemMediator(opt)
    lc.Append(fx.Hook{
        OnStop: func(ctx context.Context) error {
            // marks mediator closed, waits for in-flight handler goroutines,
            // honors fx.StopTimeout via ctx
            return m.(*mediator.InMemMediator).GracefulShutdown(ctx)
        },
    })
    return m
}
```

### 10.3 Shutdown Ordering

`fx` executes OnStop hooks in **reverse order of OnStart**. The dependency graph naturally produces the correct shutdown sequence:

```
Start order (determined by dependency graph):
  EventBus → MySQL → Application → Server

Stop order (automatic reverse):
  Server.OnStop        → drain in-flight requests
                          (last requests may call Events.Raise(), dispatching final events)
  EventBus.OnStop      → drain in-flight handler goroutines
                          (handlers can still access MySQL)
  Process exits        → OS reclaims all connections
```

MySQL has no in-flight work to drain, so it remains available while Server and EventBus handlers finish. If the MySQL package registers a `Close` cleanup hook, it must run after consumers have stopped.

### 10.4 Kubernetes Deployment

When deploying to Kubernetes, there is a **race condition** between SIGTERM delivery to the Pod and kube-proxy removing the Pod from the Service's Endpoints. During this window (typically a few seconds), new requests may still be routed to a Pod that is already shutting down.

This is a **network-layer concern, not an application-layer concern**. The recommended solution is a `preStop` hook that delays SIGTERM delivery, giving kube-proxy time to complete the endpoint update:

```yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["sleep", "5"]
```

The sequence becomes:

```
Kubernetes initiates Pod deletion
  ├─ async: kube-proxy starts removing Pod from Endpoints
  ├─ sync:  preStop executes → sleep 5s (app still serving normally)
  └─ after preStop: SIGTERM → app.Run() triggers OnStop hooks → graceful shutdown
```

> **Note**: For low-traffic internal services, the impact of this race condition is minimal (a few connection-refused errors, retried by clients). The `preStop` hook is most important for high-traffic, user-facing services.

---

## 11. Complete Example: Module Assembly

```go
// user.go - Module assembly
package user

import (
    "go.uber.org/fx"

    "github.com/example/project/internal/business/user/application"
    "github.com/example/project/internal/business/user/infrastructure/persistence"
    userv1connect "github.com/example/project/pkg/gen/proto/user/v1/userv1connect"
)

var Module = fx.Module(
    "domain.user",
    fx.Provide(persistence.NewRepository),
    fx.Provide(persistence.NewQueryRepository),
    fx.Provide(application.NewApplication),
    fx.Invoke(func(app *application.Application, mux *http.ServeMux) {
        path, handler := userv1connect.NewUserServiceHandler(app)
        mux.Handle(path, handler)
    }),
)
```

---

**References:**
- [ddd-modeling.md](ddd-modeling.md) — Strategic domain modeling (bounded context discovery, aggregate design)
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
