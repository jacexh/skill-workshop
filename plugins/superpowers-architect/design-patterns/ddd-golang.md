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

> **Cross-reference convention**: every section number below mirrors the corresponding `ddd-core.md` section (e.g., §3.2 here ↔ ddd-core.md §3.2). The Go guide adds only what is implementation-specific; for the full language-agnostic rationale, jump to the matching ddd-core section.

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
          │      Domain Layer ◄─── Core. Zero external deps.
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
- Domain Layer has zero dependencies (no `import` of infrastructure, database, or HTTP packages)
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
│   │       ├── pkg/             # Domain-scoped utilities (if needed)
│   │       └── <module>.go      # Module assembly (fx Module)
│   └── pkg/                     # Infrastructure adapters — third-party libs wrapped + fx providers
│       ├── eventbus/            # mediator wrapper + lifecycle hooks
│       ├── database/            # XORM driver wrapper + config
│       ├── httpsrv/             # HTTP server wrapper + lifecycle hooks
│       ├── grpcsrv/             # gRPC server wrapper + lifecycle hooks
│       └── module.go            # Aggregates the above into a single fx.Module("internal.pkg")
├── pkg/                         # Public utilities (consumable by external projects)
│   └── gen/                     # Generated code (proto, etc.)
├── proto/                       # Protobuf definitions
└── scripts/
    └── sql/                     # Database migration scripts
```

**`internal/business/` vs `internal/pkg/`** — `business/` holds bounded contexts (the DDD four-layer structure); `pkg/` holds infrastructure adapters (DB, HTTP/gRPC server, event bus, validator …). Business may depend on `pkg/`; `pkg/` must never import `internal/business/*`.

### 2.2 Bounded Context Internal Structure

```
internal/business/user/          # User bounded context
├── domain/                      # Domain layer - PURE, zero external dependencies
│   ├── user.go                  # Aggregate Root + Entity
│   ├── valueobject.go           # Value Objects (Email, Password, etc.)
│   ├── event.go                 # Domain event definitions
│   ├── repository.go            # Write repository interface
│   └── service.go               # Domain service (if needed)
│
├── application/                 # Application layer - orchestrates domain objects
│   ├── application.go           # App Service constructor + gRPC/ConnectRPC stub
│   ├── command.go               # Command definitions + Command Handlers
│   ├── query.go                 # Query definitions + Query Handlers
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
│       └── handler.go           # REST Handler (manual routing, request/response mapping)
│
├── infrastructure/              # Infrastructure layer - external system integrations ONLY
│   ├── persistence/
│   │   ├── repository.go        # Repository implementation
│   │   ├── do.go                # Database models (XORM/GORM)
│   │   └── converter.go         # DO <-> Entity conversion
│   └── messaging/
│       └── publisher.go         # Event publisher implementation
│
├── pkg/                         # Domain-scoped utilities (non-infrastructure tools)
│
└── user.go                      # Module assembly (fx Module)
```

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
- Zero external dependencies (no `import` of infrastructure, database, or HTTP packages)
- Must not depend on other bounded contexts' domain layers (communicate via events)
- All state changes go through domain methods — direct field mutation is prohibited
- **Version is a read-only concurrency token** — Domain does not increment Version; Infrastructure increments it via SQL
- **IDs are generated in the Domain layer** (inside Factory Methods) using UUID/ULID — database auto-increment IDs are prohibited

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

// Repository Interface (write repository, defined in Domain layer)
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
  - `pkg/` — public utilities consumable by external projects
  - `internal/business/<domain>/pkg/` — utilities scoped to a single domain

**Constraints**:
- Implements Repository interfaces (Domain layer) and QueryRepository interfaces (Application layer)
- No business logic
- Handles technical details (SQL, caching, retries, etc.)
- **Version is incremented by SQL** (`version = version + 1`) — Domain layer does not increment it

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
    "github.com/example/project/internal/pkg/database"
)

// Data Object - XORM model
type UserDO struct {
    ID        string             `xorm:"id pk"`
    Name      string             `xorm:"name"`
    Password  []byte             `xorm:"password"`  // maps to HashedPassword
    Email     string             `xorm:"email"`
    Status    int                `xorm:"status"`
    Version   int                `xorm:"version"`
    CreatedAt database.Timestamp `xorm:"created_at"`
    UpdatedAt database.Timestamp `xorm:"updated_at"`
    DeletedAt database.Timestamp `xorm:"deleted_at deleted"`
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

// Constructor returns interface
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

Producer side: nothing special — after `Save()`, the producing context's Application Service calls `order.Events.Raise(mediator.Default())` (canonical 4-step flow, §3.3). Consumer side lives in the **subscribing** context's `application/handler.go`:

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
    "github.com/example/project/internal/pkg/database"
    "github.com/example/project/internal/pkg/grpcsrv"
    "github.com/example/project/internal/pkg/httpsrv"
    "go.uber.org/fx"
)

// Option holds all infrastructure configuration.
// fx.Out enables automatic distribution — each field is injected
// into the component that declares a matching type dependency.
type Option struct {
    fx.Out
    Logger     sloghelper.Options `json:"logger" toml:"logger" yaml:"logger"`
    MySQL      database.Option    `json:"mysql" toml:"mysql" yaml:"mysql"`
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

Components that have **in-flight work** at shutdown time must register `fx.Lifecycle` hooks to drain gracefully. Components that are pure connection pools do not need them — the OS reclaims connections on process exit.

**Needs OnStop** (has in-flight work):

| Component | In-flight work | OnStop action |
|-----------|---------------|---------------|
| HTTP Server | HTTP requests being processed | `srv.Shutdown(ctx)` — stop accepting, drain in-flight requests |
| gRPC Server | RPC calls being processed | `server.GracefulStop()` — stop accepting, drain in-flight calls |
| EventBus (Mediator) | Event handler goroutines running | `GracefulShutdown(ctx)` — reject new events, wait for handlers |
| Message queue consumer | Messages being processed | Stop consuming, finish current batch |

Pure connection pools (Database, Redis, HTTP Client) do not need OnStop — they have no in-flight work of their own, and the OS reclaims connections on process exit.

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
  EventBus → Database → Application → Server

Stop order (automatic reverse):
  Server.OnStop        → drain in-flight requests
                          (last requests may call Events.Raise(), dispatching final events)
  EventBus.OnStop      → drain in-flight handler goroutines
                          (handlers can still access Database — it has no OnStop)
  Process exits        → OS reclaims all connections
```

Database has no OnStop hook, so it remains available throughout the entire shutdown sequence. This is by design — as long as all consumers (Server, EventBus handlers) finish their work before the process exits, the database connection pool does not need explicit cleanup.

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
