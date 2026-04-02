---
name: ddd-golang
description: Go implementation guide for DDD + Clean Architecture. Use when implementing backend services in Go with domain-driven design, including aggregates, repositories, domain events, CQRS, and module assembly with fx. Complements ddd-core specification.
---

# Go Web System Architecture Guide
## DDD + Clean Architecture — Go Implementation

**Version**: v2.0  
**Date**: 2026-04-02  
**Scope**: Team backend service architecture standard  
**Prerequisite**: This document is the Go implementation guide for [`ddd-core.md`](ddd-core.md). All architecture principles defer to `ddd-core.md`.

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

Four layers with the **Domain Layer as the core** (innermost):

```
                    ┌─────────────────────────────────────┐
                    │       Interface Layer               │
                    │  (HTTP Handler / gRPC Server)       │
                    │  - Input validation, protocol       │
                    │    transformation, routing          │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │      Application Layer              │
                    │  - Use-case orchestration,          │
                    │    transaction management, DTOs     │
                    │  - QueryRepository interfaces (read)│
                    │  - Cross-aggregate coordination,    │
                    │    authorization checks             │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │        Domain Layer ◄───────────────┼── Core. Zero external deps.
                    │  - Entities, Value Objects,         │
                    │    Domain Services                  │
                    │  - Write Repository interfaces,     │
                    │    Domain Events                    │
                    └─────────────────────────────────────┘
                                    ▲
                    ┌───────────────┘
                    │ implements
        ┌───────────┴─────────────────────────────────────┐
        │       Infrastructure Layer                      │
        │  - Repository implementations, DB access,      │
        │    external API clients                         │
        │  - Message queues, cache implementations       │
        └─────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer depends on Application and Domain layers
- Application Layer depends only on Domain Layer
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
│   └── default.yml              # Configuration, supports env var overrides
├── internal/
│   ├── <module>/                # Bounded context (vertical slice)
│   │   ├── domain/              # Domain layer - core business logic
│   │   ├── application/         # Application layer - use-case orchestration
│   │   ├── interfaces/          # Interface layer - protocol adaptation
│   │   ├── infrastructure/      # Infrastructure layer - technical implementation
│   │   └── <module>.go          # Module assembly (fx Module)
│   └── pkg/                     # Shared infrastructure (use sparingly)
│       ├── eventbus/
│       ├── database/
│       ├── httpsrv/
│       └── grpcsrv/
├── pkg/
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
│   ├── application.go           # App Service constructor
│   ├── command.go               # Command definitions (ChangePassword, etc.)
│   ├── query.go                 # Query definitions
│   ├── query_repository.go      # Read repository interface (CQRS, returns DTOs)
│   ├── handler.go               # Command/Query Handlers
│   ├── dto.go                   # DTO definitions
│   └── assembler.go             # DTO <-> Domain conversion
│
├── interfaces/                  # Interface layer - adapts external protocols
│   ├── http/
│   │   └── handler.go           # HTTP Handler (if using REST)
│   └── grpc/
│       └── server.go            # gRPC Server implementation
│
├── infrastructure/              # Infrastructure layer - technical implementation
│   ├── persistence/
│   │   ├── repository.go        # Repository implementation
│   │   ├── do.go                # Database models (XORM/GORM)
│   │   └── converter.go         # DO <-> Entity conversion
│   └── messaging/
│       └── publisher.go         # Event publisher implementation
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
- **Command/Query**: Explicit modeling of operation intent
- **Command/Query Handler**: Concrete logic handling
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

```go
// application/command.go
package application

// Command: Change password
type CommandChangePassword struct {
    ID          string
    OldPassword string
    NewPassword string
}

// application/handler.go
package application

import (
    "context"
    "log/slog"

    "github.com/go-jimu/components/mediator"
    "github.com/go-jimu/components/sloghelper"
    "github.com/samber/oops"
)

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

### 3.3 Interface Layer

**Role**: Adapt external protocols (HTTP/gRPC); handle input/output transformation.

> For the full specification, see [ddd-core.md §3.3 "Adapter Layer"](ddd-core.md). In Go, this layer is named `interfaces/` rather than `adapter/`.

**Contents**:
- **HTTP Handler**: REST API handling
- **gRPC Server**: RPC service implementation
- **Request/Response**: Protocol-specific data structures
- **Input validation**: Basic format validation (business validation belongs in Domain)

**Constraints**:
- Depends only on Application and Domain layers
- No business logic
- Handles protocol details (HTTP status codes, gRPC error codes, etc.)

```go
// interfaces/grpc/server.go
package grpc

import (
    "context"

    "connectrpc.com/connect"
    userv1 "example.com/proto/user/v1"
)

type UserServer struct {
    app *application.Application
}

func NewUserServer(app *application.Application) *UserServer {
    return &UserServer{app: app}
}

func (s *UserServer) ChangePassword(
    ctx context.Context,
    req *connect.Request[userv1.ChangePasswordRequest],
) (*connect.Response[userv1.ChangePasswordResponse], error) {
    // Construct command
    cmd := &application.CommandChangePassword{
        ID:          req.Msg.UserId,
        OldPassword: req.Msg.OldPassword,
        NewPassword: req.Msg.NewPassword,
    }

    // Execute
    if err := s.app.Commands.ChangePassword.Handle(ctx, logger, cmd); err != nil {
        // Convert error to gRPC error code
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

### 3.4 Infrastructure Layer

**Role**: Implement Domain-layer interfaces; provide technical capabilities.

> For the full specification, see [ddd-core.md §3.4](ddd-core.md).

**Contents**:
- **Repository Implementation**: Database access implementation
- **Data Object (DO)**: ORM models
- **Converter**: DO ↔ Domain Entity conversion
- **External Client**: External service clients
- **Event Publisher**: Event publishing implementation

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
| **Repository** | Domain (interface) + Infra (impl) | Interface + Impl | Write repository, aggregate persistence |
| **Query Repository** | Application (interface) + Infra (impl) | Interface + Impl | Read repository, returns DTOs, bypasses Domain |
| **Domain Event** | Domain | `Event` struct implementing `mediator.Event` | Records significant domain occurrences |
| **Application Service** | Application | Use-case orchestration | Coordinates aggregates/services, owns transaction boundary |
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
| `application/command.go` | Command definitions |
| `application/query.go` | Query definitions |
| `application/query_repository.go` | Read repository interface (returns DTOs) |
| `application/handler.go` | Handler implementations |
| `application/dto.go` | DTO definitions |
| `application/assembler.go` | Object conversion |
| `application/application.go` | App Service + module assembly |
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

## 9. Complete Example: Module Assembly

```go
// user.go - Module assembly
package user

import (
    "go.uber.org/fx"

    "github.com/example/project/internal/user/application"
    "github.com/example/project/internal/user/infrastructure/persistence"
    userv1 "github.com/example/project/pkg/gen/proto/user/v1"
    "github.com/example/project/internal/pkg/connectrpc"
)

var Module = fx.Module(
    "domain.user",
    // Infrastructure layer
    fx.Provide(persistence.NewRepository),
    fx.Provide(persistence.NewQueryRepository),

    // Application layer
    fx.Provide(application.NewApplication),

    // Interface layer registration
    fx.Invoke(func(
        srv userv1connect.UserAPIHandler,
        c *connectrpc.ConnectServer,
    ) {
        c.Register(userv1connect.NewUserAPIHandler(
            srv,
            connect.WithInterceptors(c.GetGlobalInterceptors()...),
        ))
    }),
)
```

---

## 10. Key Principles Summary

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

---

**References:**
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
