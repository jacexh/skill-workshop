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
- **Architecture spec**: [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture rules. All architecture principles defer to `ddd-core.md`.
- This document is the Go implementation guide that builds on both.

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This guide combines **Domain-Driven Design (DDD)** with **Clean Architecture**, targeting:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code organized by bounded context, not by technical layer
4. **Testability** — Business logic testable without external infrastructure

> For the full rationale, see [ddd-core.md §1.1](ddd-core.md).

### 1.2 Layered Architecture

Three or four layers with the **Domain Layer as the core** (innermost):

```
          ┌─────────────────────────────────────────────┐
          │   Interface Layer (optional — see §3.3)     │
          │   Only needed for hand-written protocol     │
          │   adaptation (e.g., REST controllers).      │
          │   For gRPC/ConnectRPC with generated stubs, │
          │   Application layer implements the stub     │
          │   interface directly — skip this layer.     │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Application Layer                      │
          │  - Use-case orchestration,                  │
          │    transaction management, DTOs             │
          │  - QueryRepository interfaces (read)        │
          │  - gRPC/ConnectRPC handler (Application      │
          │    struct implements generated stub)        │
          │  - Cross-aggregate coordination,            │
          │    authorization checks                     │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Domain Layer ◄─────────────────────────┼── Core. Zero external deps.
          │  - Entities, Value Objects,                  │
          │    Domain Services                          │
          │  - Write Repository interfaces,             │
          │    Domain Events                            │
          └─────────────────────────────────────────────┘
                             ▲
          ┌──────────────────┘
          │ implements
  ┌───────┴─────────────────────────────────────────────┐
  │       Infrastructure Layer                          │
  │  - Repository implementations (DB access)           │
  │  - External API clients, message queues, caches    │
  │  ⚠ ONLY for external system integrations —         │
  │    utility/tool packages go in pkg/ (see §3.4)     │
  └─────────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer (if present) depends on Application and Domain layers
- Application Layer depends only on Domain Layer (and implements generated RPC stubs when applicable)
- Domain Layer has zero dependencies (no `import` of infrastructure, database, or HTTP packages)
- Infrastructure Layer depends on Domain Layer (implements Repository interfaces) and Application Layer (implements QueryRepository interfaces)

> For full dependency rules and common violations, see [ddd-core.md §1.3](ddd-core.md).

```go
// ✅ Correct: Domain defines write repository interface
type Repository interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}

// ✅ Correct: Application defines read repository interface
type QueryRepository interface {
    FindByEmail(ctx context.Context, email string) (*UserDetailDTO, error)
    List(ctx context.Context, query *QueryFindUserList) ([]*UserListDTO, int64, error)
}

// ✅ Correct: Infrastructure implements both interfaces
type userRepository struct{ db *xorm.Engine }       // implements domain.Repository
type userQueryRepository struct{ db *xorm.Engine }  // implements application.QueryRepository

// ✅ Correct: Assembled via dependency injection
func NewApplication(repo domain.Repository, qr QueryRepository) *Application {
    return &Application{repo: repo, queryRepo: qr}
}
```

---

## 2. Directory Structure

### 2.1 Overall Layout

> Corresponds to [ddd-core.md §2.1](ddd-core.md). Go-specific conventions applied.

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
│   ├── <module>/                # Bounded context (vertical slice)
│   │   ├── domain/              # Domain layer - core business logic
│   │   ├── application/         # Application layer - use-case orchestration
│   │   ├── interfaces/          # Interface layer (optional, see §3.3)
│   │   ├── infrastructure/      # Infrastructure layer - external system integrations ONLY
│   │   ├── pkg/                 # Domain-scoped utilities (if needed)
│   │   └── <module>.go          # Module assembly (fx Module)
│   └── pkg/                     # Cross-domain shared utilities
│       ├── eventbus/
│       ├── database/
│       ├── httpsrv/
│       └── grpcsrv/
├── pkg/                         # Public utilities (consumable by external projects)
│   └── gen/                     # Generated code (proto, etc.)
├── proto/                       # Protobuf definitions
└── scripts/
    └── sql/                     # Database migration scripts
```

### 2.2 Bounded Context Internal Structure

> Corresponds to [ddd-core.md §2.2](ddd-core.md).

```
internal/user/                   # User bounded context
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

> For the full specification, see [ddd-core.md §3.1](ddd-core.md).

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
// domain/order.go
package domain

import "github.com/go-jimu/components/fsm"

// State labels
const (
    OrderStatePending   fsm.StateLabel = "pending"
    OrderStatePaid      fsm.StateLabel = "paid"
    OrderStateShipped   fsm.StateLabel = "shipped"
    OrderStateCancelled fsm.StateLabel = "cancelled"
)

// Actions
const (
    OrderActionPay    fsm.Action = "pay"
    OrderActionShip   fsm.Action = "ship"
    OrderActionCancel fsm.Action = "cancel"
)

// State machine definition — called once during module initialization
func NewOrderStateMachine() fsm.StateMachine {
    sm := fsm.NewStateMachine("order")

    sm.RegisterStateBuilder(OrderStatePending, func() fsm.State {
        return fsm.NewSimpleState(OrderStatePending)
    })
    sm.RegisterStateBuilder(OrderStatePaid, func() fsm.State {
        return fsm.NewSimpleState(OrderStatePaid)
    })
    sm.RegisterStateBuilder(OrderStateShipped, func() fsm.State {
        return fsm.NewSimpleState(OrderStateShipped)
    })
    sm.RegisterStateBuilder(OrderStateCancelled, func() fsm.State {
        return fsm.NewSimpleState(OrderStateCancelled)
    })

    // Transitions
    sm.AddTransition(OrderStatePending, OrderStatePaid, OrderActionPay, nil)
    sm.AddTransition(OrderStatePending, OrderStateCancelled, OrderActionCancel, nil)
    sm.AddTransition(OrderStatePaid, OrderStateShipped, OrderActionShip, func(sc fsm.StateContext) bool {
        order := sc.(*Order)
        return order.ShippingAddress != "" // Guard: must have shipping address
    })
    sm.AddTransition(OrderStatePaid, OrderStateCancelled, OrderActionCancel, nil)

    if err := sm.Check(); err != nil {
        panic(err) // Fail fast on invalid state machine definition
    }
    return sm
}

// Order Aggregate Root implements fsm.StateContext
type Order struct {
    ID              string
    Status          fsm.State               // Current state
    ShippingAddress string
    Events          mediator.EventCollection
    Version         int
}

func (o *Order) CurrentState() fsm.State {
    return o.Status
}

func (o *Order) TransitionTo(next fsm.State, by fsm.Action) error {
    prev := o.Status.Label()
    next.SetContext(o)
    o.Status = next

    // State transition triggers domain event
    o.Events.Add(EventOrderStatusChanged{
        ID:   o.ID,
        From: string(prev),
        To:   string(next.Label()),
    })
    return nil
}

// Domain method: uses state machine, never manipulates Status directly
func (o *Order) Pay() error {
    sm := fsm.MustGetStateMachine("order")
    return sm.TransitionToNext(o, OrderActionPay)
}

func (o *Order) Ship() error {
    sm := fsm.MustGetStateMachine("order")
    return sm.TransitionToNext(o, OrderActionShip)
}
```

```go
// domain/event.go
package domain

import "github.com/go-jimu/components/mediator"

// Event kind constants
const (
    EventKindUserCreated      mediator.EventKind = "user.created"
    EventKindPasswordChanged  mediator.EventKind = "user.password_changed"
    EventKindUserActivated    mediator.EventKind = "user.activated"
)

// Domain events: implement mediator.Event interface (Kind() method)
// Rich Event style: carry ID + minimum necessary fields
type EventUserCreated struct {
    ID    string
    Name  string
    Email string
}

func (e EventUserCreated) Kind() mediator.EventKind { return EventKindUserCreated }

type EventPasswordChanged struct {
    ID string
}

func (e EventPasswordChanged) Kind() mediator.EventKind { return EventKindPasswordChanged }

type EventUserActivated struct {
    ID string
}

func (e EventUserActivated) Kind() mediator.EventKind { return EventKindUserActivated }
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

// Domain Method: Activate user
func (u *User) Activate() error {
    if u.Status == UserStatusActive {
        return nil
    }

    u.Status = UserStatusActive
    u.UpdatedAt = time.Now()

    u.Events.Add(EventUserActivated{ID: u.ID})
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

> For the full specification, see [ddd-core.md §3.2](ddd-core.md).

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

import (
    "context"
    "log/slog"

    "github.com/go-jimu/components/mediator"
    "github.com/samber/oops"
)

// Command definition
type CommandChangePassword struct {
    ID          string
    OldPassword string
    NewPassword string
}

// Command Handler (lives in command.go alongside the command definition)
type CommandChangePasswordHandler struct {
    repo domain.Repository
}

func NewCommandChangePasswordHandler(repo domain.Repository) *CommandChangePasswordHandler {
    return &CommandChangePasswordHandler{repo: repo}
}

func (h *CommandChangePasswordHandler) Handle(
    ctx context.Context,
    logger *slog.Logger,
    cmd *CommandChangePassword,
) error {
    // 1. Load aggregate
    user, err := h.repo.Get(ctx, cmd.ID)
    if err != nil {
        return oops.With("user_id", cmd.ID).Wrap(err)
    }

    // 2. Execute business logic (in Domain layer)
    if err = user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
        return err
    }

    // 3. Persist
    if err = h.repo.Save(ctx, user); err != nil {
        return oops.With("user_id", cmd.ID).Wrap(err)
    }

    // 4. Dispatch domain events after successful persist
    //    (Raise is one-time; internally guarantees no duplicate dispatch)
    user.Events.Raise(mediator.Default())
    return nil
}
```

### 3.3 Interface Layer (Optional)

**Role**: Adapt external protocols that require hand-written routing and request/response mapping (e.g., REST with chi/gin).

> For the full specification, see [ddd-core.md §3.3 "Adapter Layer"](ddd-core.md). In Go, this layer is named `interfaces/` rather than `adapter/`.

**When to use `interfaces/`**:
- REST APIs with hand-written routing (chi, gin, echo)
- Custom WebSocket handlers
- Any protocol where you manually define request/response mapping

**When to skip `interfaces/` (use Application layer instead)**:
- **gRPC / ConnectRPC**: The code generator produces a handler interface (e.g., `ExecutorServiceHandler`). The Application layer struct directly implements this interface — there is no routing or protocol adaptation to write by hand, so a separate `interfaces/` directory adds an unnecessary indirection layer.

**Contents** (when used):
- **HTTP Handler**: REST API handling
- **Request/Response**: Protocol-specific data structures
- **Input validation**: Basic format validation (business validation belongs in Domain)

**Constraints**:
- Depends only on Application and Domain layers
- No business logic
- Handles protocol details (HTTP status codes, etc.)

#### gRPC/ConnectRPC: Application struct implements the generated stub directly

```go
// application/application.go
package application

import (
    "context"

    "connectrpc.com/connect"
    userv1 "github.com/example/project/pkg/gen/proto/user/v1"
)

// Application implements the generated userv1connect.UserServiceHandler interface
// directly — no separate interfaces/ layer or sub-package needed.

func (app *Application) ChangePassword(
    ctx context.Context,
    req *connect.Request[userv1.ChangePasswordRequest],
) (*connect.Response[userv1.ChangePasswordResponse], error) {
    // 1. Load aggregate
    user, err := app.repo.Get(ctx, req.Msg.UserId)
    if err != nil {
        return nil, convertError(err)
    }

    // 2. Execute business logic (in Domain layer)
    if err = user.ChangePassword(req.Msg.OldPassword, req.Msg.NewPassword); err != nil {
        return nil, convertError(err)
    }

    // 3. Persist
    if err = app.repo.Save(ctx, user); err != nil {
        return nil, convertError(err)
    }

    // 4. Dispatch domain events after successful persist
    user.Events.Raise(mediator.Default())
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

> For the full specification, see [ddd-core.md §3.4](ddd-core.md).

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
  - `internal/pkg/` — cross-domain shared utilities
  - `pkg/` — public utilities consumable by external projects
  - `internal/<domain>/pkg/` — utilities scoped to a single domain

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

    "github.com/example/project/internal/user/domain"
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

> Corresponds to [ddd-core.md §4](ddd-core.md).

| DDD Concept | Layer | Go Implementation | Notes |
|-------------|-------|-------------------|-------|
| **Aggregate** | Domain | `struct` + domain methods + `mediator.EventCollection` | Aggregate root, enforces business invariants |
| **Entity** | Domain | `struct` with ID | Unique identity, mutable |
| **Value Object** | Domain | Immutable `struct` | Equality by value, no identity |
| **Domain Service** | Domain | Stateless function / struct | Cross-aggregate logic |
| **State Machine** | Domain (definition) | `fsm.StateMachine` + `fsm.StateContext` | Aggregate lifecycle; global registration; Domain methods drive transitions |
| **Repository** | Domain (interface) + Infra (impl) | Interface + Impl | Write repository, aggregate persistence |
| **Query Repository** | Application (interface) + Infra (impl) | Interface + Impl | Read repository, returns DTOs, bypasses Domain |
| **Domain Event** | Domain | `Event` struct implementing `mediator.Event` | Records significant domain occurrences |
| **Application Service** | Application | Use-case orchestration | Coordinates aggregates/services, owns transaction boundary |
| **Event Handler** | Application | `mediator.EventHandler` impl | Consumes domain events; idempotent; owns its own transaction |
| **DTO** | Application / Interface | Data transfer struct | Decouples internal and external models |
| **Factory** | Domain | Constructor / independent Factory struct | Complex object creation logic |
| **CQRS** | Application | Command + Query separation | Command and Query responsibility segregation |

---

## 5. Cross-Context Communication

> For the full specification, see [ddd-core.md §5](ddd-core.md).

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

```go
// ✅ Correct: Decoupled via event bus

// Order context publishes event
func (s *OrderAppService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) error {
    order, err := domain.NewOrder(cmd.UserID, cmd.Items)
    if err != nil {
        return err
    }

    if err = s.repo.Save(ctx, order); err != nil {
        return err
    }

    // Dispatch events after successful persist
    order.Events.Raise(mediator.Default())
    return nil
}

// User context subscribes to event
func NewUserPointsHandler(repo domain.Repository) *UserPointsHandler {
    return &UserPointsHandler{repo: repo}
}

func (h *UserPointsHandler) Listening() []mediator.EventKind {
    return []mediator.EventKind{domain.EventKindOrderCompleted}
}

func (h *UserPointsHandler) Handle(ctx context.Context, event mediator.Event) {
    ev := event.(domain.EventOrderCompleted)
    // Add user points
    user, err := h.repo.Get(ctx, ev.UserID)
    if err != nil {
        slog.ErrorContext(ctx, "failed to get user", slog.Any("error", err))
        return
    }
    user.AddPoints(ev.TotalAmount / 10)
    if err = h.repo.Save(ctx, user); err != nil {
        slog.ErrorContext(ctx, "failed to save user", slog.Any("error", err))
    }
}

// Subscribe events (during module initialization)
func NewApplication(ev mediator.Mediator, ...) {
    handlers := []mediator.EventHandler{
        NewUserPointsHandler(repo),
    }
    for _, h := range handlers {
        ev.Subscribe(h)
    }
}
```

---

## 6. Naming Conventions

> Applies Go casing conventions (PascalCase for exports) to the conceptual names defined in [ddd-core.md §7](ddd-core.md).

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

> For the full specification, see [ddd-core.md §8](ddd-core.md).

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

### 9.1 Configuration Struct

Define a single configuration struct with `fx.Out` embedding. Each field corresponds to an infrastructure component's configuration. `fx` automatically distributes each field to its consumer via dependency injection.

```go
// cmd/server/main.go
package main

import (
    "github.com/go-jimu/components/config/loader"
    "github.com/go-jimu/components/mediator"
    "github.com/go-jimu/components/sloghelper"
    "github.com/example/project/internal/pkg/database"
    "github.com/example/project/internal/pkg/httpsrv"
    "github.com/example/project/internal/pkg/grpcsrv"
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

func parseOption() (Option, error) {
    opt := new(Option)
    err := loader.Load(opt)
    return *opt, err
}
```

### 9.2 Configuration Files & Profiles

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

### 9.3 Environment Variable Override

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

Use `app.Run()` as the standard entry point. It encapsulates the full lifecycle: Start → Wait for signal (SIGINT/SIGTERM) → Stop → Exit.

```go
// cmd/server/main.go
func main() {
    app := fx.New(
        fx.Provide(parseOption),
        fx.Provide(sloghelper.NewLog),
        fx.Provide(eventbus.NewMediator),
        pkg.Module,
        user.Module,
        fx.StopTimeout(30*time.Second),
        fx.NopLogger,
    )
    app.Run()
}
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

gRPC Server follows the same pattern — OnStart binds listener and calls `go server.Serve(ln)`, OnStop calls `server.GracefulStop()`.

#### EventBus: Drain Handler Goroutines

```go
// internal/pkg/eventbus/eventbus.go
func NewMediator(lc fx.Lifecycle, opt mediator.Options) mediator.Mediator {
    m := mediator.NewInMemMediator(opt)

    lc.Append(fx.Hook{
        OnStop: func(ctx context.Context) error {
            return m.(*mediator.InMemMediator).GracefulShutdown(ctx)
        },
    })
    return m
}
```

`GracefulShutdown` marks the mediator as closed (rejecting new events), waits for all in-flight handler goroutines to complete, and respects the caller's context deadline (`fx.StopTimeout`).

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
// user.go - Module assembly (gRPC/ConnectRPC — no interfaces/ layer)
package user

import (
    "go.uber.org/fx"

    "github.com/example/project/internal/user/application"
    "github.com/example/project/internal/user/infrastructure/persistence"
    userv1connect "github.com/example/project/pkg/gen/proto/user/v1/userv1connect"
)

var Module = fx.Module(
    "domain.user",
    // Infrastructure layer — external system integrations
    fx.Provide(persistence.NewRepository),
    fx.Provide(persistence.NewQueryRepository),

    // Application layer — use-case orchestration + gRPC handler
    // Application directly implements userv1connect.UserServiceHandler
    fx.Provide(application.NewApplication),

    // Route registration
    fx.Invoke(func(app *application.Application, mux *http.ServeMux) {
        path, handler := userv1connect.NewUserServiceHandler(app)
        mux.Handle(path, handler)
    }),
)
```

---

## 12. Key Principles Summary

> These are the Go-specific implementations of the principles defined in [ddd-core.md §10](ddd-core.md).

1. **Domain layer has zero dependencies** — no `import` of infrastructure, database, or HTTP packages
2. **Vertical slicing** — organize by bounded context, not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces; Application defines read QueryRepository interfaces; Infrastructure implements both
4. **Aggregate boundary** — Repository operates on aggregate roots only, not child entities
5. **State encapsulation** — all state changes go through domain methods; direct field mutation is prohibited
6. **ID generation in Domain** — use UUID/ULID; database auto-increment IDs are prohibited
7. **Event-driven cross-context communication** — via domain events; direct calls prohibited; Rich Event style (ID + minimum necessary fields)
8. **Event collection** — aggregates collect events via `mediator.EventCollection`; Application calls `Events.Raise(mediator)` after successful `Save()` to dispatch
9. **CQRS** — Commands go through the Domain model; Queries go through QueryRepository directly to the DB and return DTOs
10. **Transaction boundary** — one Command Handler owns one transaction; one transaction modifies one aggregate only
11. **Repository collection semantics** — `Save()` covers create, update, and state-driven soft delete; never split by SQL operation type
12. **Soft delete** — business-driven deletion is modeled as Domain state; `deleted_at` is always an Infrastructure concern
13. **Optimistic locking** — Infrastructure increments `version` via SQL; Domain holds Version as a read-only token; always reload after `Save()`
14. **Event dispatch timing** — dispatch after successful persist, never before
15. **Program to interfaces** — depend on interfaces; assemble via `fx` dependency injection
16. **Interface layer is optional** — for gRPC/ConnectRPC with generated stubs, `Application` struct implements the handler interface directly in `application.go`; `interfaces/` is only needed for hand-written protocol adaptation (REST controllers, custom WebSocket handlers)
17. **Infrastructure is for external systems only** — `infrastructure/` contains implementations that integrate with databases, caches, message queues, and third-party APIs; utility/tool packages belong in `internal/pkg/` (cross-domain), `pkg/` (public), or `internal/<domain>/pkg/` (domain-scoped)
18. **State machine in Domain (optional)** — for aggregates with complex lifecycle (4+ states, guard conditions, multi-role flows): states, actions, conditions are business invariants defined in Domain; Aggregate Root implements `fsm.StateContext`; domain methods drive transitions via `sm.TransitionToNext()`; Infrastructure only persists `fsm.StateLabel`. Simple 2-3 state aggregates use plain enum + domain method guards instead
19. **Configuration management** — single `Option` struct with `fx.Out` distributes config to consumers; `loader.Load` discovers files in `configs/`, supports profiles via `JIMU_PROFILES_ACTIVE`; environment variables override config values through `${VAR:default}` placeholder syntax, not automatic key mapping
20. **Entry point uses `app.Run()`** — encapsulates Start → Wait → Stop → Exit; manual Start/Wait/Stop only when post-shutdown logic is needed before exit
21. **Lifecycle hooks for in-flight work** — components with in-flight work (HTTP/gRPC Server, EventBus) register `fx.Lifecycle` OnStop hooks to drain gracefully; pure connection pools (Database, Redis) do not need OnStop; `fx` executes OnStop in reverse start order, determined by the dependency graph

---

**References:**
- [ddd-modeling.md](ddd-modeling.md) — Strategic domain modeling (bounded context discovery, aggregate design)
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
