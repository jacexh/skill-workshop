---
name: ddd-golang-infrastructure
description: Executable Go House Style for xorm/MySQL persistence, DO conversion, Repository and QueryRepository adapters, outbound adapters, and provider-boundary errors.
---

# Go Infrastructure Layer

## Applies When

Infrastructure implements Domain/Application ports and owns external mechanisms. For MySQL persistence in this House Style, use `xorm.io/xorm` with `github.com/go-sql-driver/mysql`. Use `github.com/samber/oops` when an external error first enters controlled code.

## Responsibility And File Shape

```text
internal/business/<context>/infrastructure/
  do.go                    # private xorm Data Objects
  convert.go               # pure DO <-> exported Domain/read-model mapping
  <aggregate>_repository.go
  <read_model>_query_repository.go
  <capability>_adapter.go  # ACL or outbound provider adapter
```

- Data Objects describe persistence, not Domain behavior. Mandatory columns and physical types follow [database.md](database.md); this guide owns their Go mapping.
- `convert.go` performs pure mechanical mapping. It does no I/O, logging, transaction control, authorization, or business decisions.
- A Domain Repository adapter persists one Aggregate Root and its owned state.
- A QueryRepository adapter implements an Application-owned read port and returns Application read models.
- Compile-time assertions make the implemented inward contract visible.
- Shared engines and provider clients arrive from `internal/pkg`; a bounded-context adapter does not load config or open process-wide clients.
- When the confirmed multi-Root exception exists, every participating Repository automatically resolves the current transaction executor from the callback context; Domain and Application never receive an xorm session.

Use [database.md](database.md) for mandatory schema fields, physical types, indexes, locking, and migrations.

## Data Object

Keep xorm tags and storage-only fields private to Infrastructure. The example follows the mandatory database profile; do not weaken or reinterpret that profile from a Go mapping guide.

```go
// internal/business/user/infrastructure/do.go
package infrastructure

import "example/internal/pkg/database"

type userDO struct {
    ID        string             `xorm:"id pk"`
    Name      string             `xorm:"name"`
    Password  []byte             `xorm:"password"`
    Email     string             `xorm:"email"`
    Version   int                `xorm:"version"`
    CreatedAt database.Timestamp `xorm:"created_at"`
    UpdatedAt database.Timestamp `xorm:"updated_at"`
    DeletedAt database.Timestamp `xorm:"deleted_at"`
}

func (userDO) TableName() string { return "user_account" }
```

Use the timestamp representation required by [database.md](database.md) and keep its converter in the shared database package. Do not make the Domain import a storage timestamp type.

## Exported Domain Mapping

Exported Domain fields are an intentional mapping surface. They permit a converter to construct rehydrated state; they do not permit Application, Transport, or Infrastructure to mutate an existing Aggregate or make business decisions from its fields.

```go
// internal/business/user/infrastructure/convert.go
package infrastructure

import (
	"example/internal/business/user/application/query"
	"example/internal/business/user/domain"
    "github.com/samber/oops"
)

func userToDO(user *domain.User) *userDO {
    return &userDO{
        ID:       user.ID,
        Name:     user.Name,
        Password: append([]byte(nil), user.HashedPassword...),
        Email:    user.Email,
        Version:  user.Version,
    }
}

func userFromDO(data *userDO) (*domain.User, error) {
    if data.Version < 1 {
        return nil, oops.With("version", data.Version).
            With("source", "persistence").
            Wrap(domain.ErrInvalidUser)
    }
    user := &domain.User{
        ID:             data.ID,
        Name:           data.Name,
        HashedPassword: append([]byte(nil), data.Password...),
		Email:          data.Email,
		Version:        data.Version,
	}
    if err := user.Validate(); err != nil {
        return nil, err
    }
    return user, nil
}

func userReadModelFromDO(data *userDO) query.User {
    return query.User{ID: data.ID, Name: data.Name, Email: data.Email}
}
```

Conversion restores already-existing state. New Aggregate creation calls the
Domain factory. When the accepted Aggregate records events, initialize its
collection as specified by [ddd-golang-events.md](ddd-golang-events.md).
Mapping remains explicit and uses no reflection or unsafe setters.

## Local Transaction Participation

Ordinary one-Root commands need no shared transaction abstraction. When the confirmed same-BC, one-resource exception exists, `internal/pkg/transaction` owns only the provider-neutral `Transactor` contract and `internal/pkg/database` owns its xorm implementation plus one executor resolver shared by every Repository adapter.

Runtime constructs one resolver and one database Transactor over the same engine/resource identity, supplies the resolver to Repository adapters, and binds the adapter as `transaction.Transactor` for Command Handlers. Do not create one transaction implementation per bounded context.

For one-statement operations, the local resolver exposes a shape equivalent to `Resolve(context.Context) (xorm.Interface, error)`. It returns `engine.Context(ctx)` when no Application transaction is active and the current `*xorm.Session` inside the matching callback scope. Keep the typed context key, xorm session, and resource identity private to `internal/pkg/database`.

For a one-Root adapter operation that needs several statements, the same resolver exposes a shape equivalent to `WithinOrJoin(context.Context, func(xorm.Interface) error) error`. It joins the current Application transaction without owning its lifecycle or creates one adapter-local transaction when no scope is active. `WithinOrJoin` is Infrastructure-only participation, not a nested Application `Within`.

The xorm Transactor implementation:

- creates one session, begins once, installs the private transaction declaration, and passes the derived context to the callback;
- invokes the callback exactly once;
- commits after a nil callback result;
- rolls back after a callback error; and
- closes the owned session when the callback scope ends.

The callback context is a scoped capability: pass it unchanged, use it sequentially, and never retain it or use it from a goroutine.

## xorm Repository Adapter — Conditional Resolver Form

The code below is the conditional form for a project where the confirmed multi-Root exception has activated the shared resolver. Without that authority, keep the ordinary `*xorm.Engine` constructor and `engine.Context(ctx)` operations; do not create `transaction`, Transactor, or resolver machinery preemptively. In either form, always bind external values, select intentional columns, filter accepted deletion state, and wrap provider errors at this first controlled boundary.

```go
package infrastructure

import (
    "context"
    "database/sql"
    "errors"
    "time"

    "example/internal/business/user/domain"
    "example/internal/pkg/database"
    "github.com/samber/oops"
)

type userRepository struct{ executors *database.ExecutorResolver }

var _ domain.Repository = (*userRepository)(nil)

func NewUserRepository(executors *database.ExecutorResolver) domain.Repository {
    return &userRepository{executors: executors}
}

func (r *userRepository) Get(ctx context.Context, userID string) (*domain.User, error) {
    executor, err := r.executors.Resolve(ctx)
    if err != nil {
        return nil, oops.With("operation", "user.get.executor").Wrap(err)
    }
    data := new(userDO)
    found, err := executor.
        Cols("id", "name", "password", "email", "version").
        Where("id = ? AND deleted_at = 0", userID).
        Get(data)
    if err != nil {
        return nil, oops.With("operation", "user.get").
            With("user_id", userID).
            Wrap(err)
    }
    if !found {
        return nil, oops.With("operation", "user.get").
            With("user_id", userID).
            Wrap(domain.ErrUserNotFound)
    }
    user, err := userFromDO(data)
    if err != nil {
        return nil, oops.With("operation", "user.rehydrate").
            With("user_id", userID).
            Wrap(err)
    }
    return user, nil
}

func (r *userRepository) Save(ctx context.Context, user *domain.User) error {
    if user == nil {
        return oops.With("operation", "user.save").
            Wrap(errors.New("nil aggregate"))
    }

    executor, err := r.executors.Resolve(ctx)
    if err != nil {
        return oops.With("operation", "user.save.executor").Wrap(err)
    }

    data := userToDO(user)
    now := time.Now().UTC()
    if user.Version == 0 {
        data.Version = 1
        data.CreatedAt = database.NewTimestamp(now)
        data.UpdatedAt = database.NewTimestamp(now)
        data.DeletedAt = database.NewTimestamp(database.UnixEpoch)
        affected, err := executor.Insert(data)
        if err != nil {
            return oops.With("operation", "user.insert").
                With("user_id", user.ID).
                Wrap(err)
        }
        if affected != 1 {
            return oops.With("operation", "user.insert").
                With("user_id", user.ID).
                Wrap(sql.ErrNoRows)
        }
        return nil
    }

    data.UpdatedAt = database.NewTimestamp(now)
    affected, err := executor.
        Cols("name", "password", "email", "updated_at").
        Incr("version").
        Where("id = ? AND version = ? AND deleted_at = 0", user.ID, user.Version).
        Update(data)
    if err != nil {
        return oops.With("operation", "user.update").
            With("user_id", user.ID).
            With("version", user.Version).
            Wrap(err)
    }
    if affected != 1 {
        return oops.With("operation", "user.update").
            With("user_id", user.ID).
            With("version", user.Version).
            Wrap(domain.ErrConcurrentModification)
    }
    return nil
}
```

This adapter example implements the request-scoped optimistic lifecycle: new
Aggregates have in-memory `Version == 0`, stored rows begin at `1`, and updates
compare and increment the loaded version atomically. `Save` leaves that loaded
instance stale; the caller may map its already-produced result and reloads for
a later mutation. A resident-checkpoint adapter instead accepts the immutable
snapshot and checkpoint token defined by its accepted design while the live
Aggregate remains authoritative.

When one accepted Aggregate maps to several tables, wrap its statements with the shared database `WithinOrJoin`: it joins an active Application scope or owns the complete local lifecycle when no scope exists. Do not let the Repository inspect ownership or call `Begin`, `Commit`, `Rollback`, or `Close` directly. A session is persistence machinery, not evidence that independent Aggregates share one consistency boundary.

## QueryRepository Adapter

An accepted Go read side follows
[ddd-golang-cqrs.md](ddd-golang-cqrs.md). Its xorm adapter receives the same
ExecutorResolver form as the write adapter when an Application transaction
scope exists; otherwise it receives the shared Engine. It selects explicit
columns, uses stable indexed ordering, and maps directly to Application read
types.
## Outbound Adapters

Infrastructure maps semantic Application ports to external APIs, Kafka, cache, taskqueue, or other providers. Keep generated clients, credentials, topics, retry settings, and serialization here.

## Error And Logging Boundary

- At the first controlled boundary, enrich and wrap once with `oops.With(...).Wrap(providerErr)`; use `oops.Wrap(providerErr)` only when there is no owned context. Never wrap an already wrapped provider error again.
- Preserve `errors.Is/As` and stable Domain/Application errors. Later layers add context only when they add new semantics.
- Do not log and return the same error. Transport or Runtime owns the Execution Completion Log.
- Infrastructure logs only when it suppresses/retries an error or owns a terminal provider operation.
- Never attach passwords, DSNs, tokens, message payloads, or unbounded SQL values to errors or logs.

## Verification

Use MySQL-backed integration tests for the selected Repository lifecycle and QueryRepository behavior. For request-scoped optimistic persistence, cover insert version `1`, comparison/increment, conflict mapping, rollback, and stale Save behavior. For resident checkpoints, cover snapshot persistence, token conflict, and continued live authority. Also cover applicable filtering, conversion, deterministic query ordering, and first-boundary error preservation.

Prove commit and rollback with the real Repository adapters and MySQL, observing durable state from a fresh observer after the transaction boundary; static checks and fake Repository tests do not prove atomicity or enlistment. For the multi-Root exception, prove both writes commit and a later Repository error rolls both back through the real Handler path.
