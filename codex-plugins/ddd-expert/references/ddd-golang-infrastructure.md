---
name: ddd-golang-infrastructure
description: Executable Go House Style for xorm/MySQL persistence, DO conversion, Repository and QueryRepository adapters, outbound adapters, and provider-boundary errors.
---

# Go Infrastructure Layer

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
    "github.com/go-jimu/components/ddd/event"
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
        Events:         event.NewCollection(),
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

Conversion restores already-existing state. New Aggregate creation calls the Domain factory so initial invariants and creation events remain Domain-owned. Do not add reflection, unsafe setters, `Restore`, or `Rehydrate` only to hide explicit mapping.

## xorm Repository Adapter

Use an initialized `*xorm.Engine`. Always bind external values, select intentional columns, filter accepted deletion state, and wrap provider errors at this first controlled boundary.

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
    "xorm.io/xorm"
)

type userRepository struct{ engine *xorm.Engine }

var _ domain.Repository = (*userRepository)(nil)

func NewUserRepository(engine *xorm.Engine) domain.Repository {
    return &userRepository{engine: engine}
}

func (r *userRepository) Get(ctx context.Context, userID string) (*domain.User, error) {
    data := new(userDO)
    found, err := r.engine.Context(ctx).
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

    data := userToDO(user)
    now := time.Now().UTC()
    if user.Version == 0 {
        data.Version = 1
        data.CreatedAt = database.NewTimestamp(now)
        data.UpdatedAt = database.NewTimestamp(now)
        data.DeletedAt = database.NewTimestamp(database.UnixEpoch)
        affected, err := r.engine.Context(ctx).Insert(data)
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
    affected, err := r.engine.Context(ctx).
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

New Aggregates have in-memory `Version == 0` and are inserted with stored version `1`. Updates compare the loaded version and increment it atomically. `Save` does not refresh the Aggregate. After success, the caller may assemble a result and drain events already recorded by that transaction, but it must not expose the stale Version as the newly persisted concurrency token, mutate, or save that instance again; the next transaction reloads a fresh Aggregate and event collection.

When one accepted Aggregate maps to several tables, keep `*xorm.Session` inside the adapter: `NewSession`, `defer Close`, `Begin`, rollback on error, then `Commit`. A session is persistence machinery, not evidence that independent Aggregates share one consistency boundary.

Prefer small Aggregates. When an accepted Aggregate nevertheless owns several Entity collections and commands usually change only a small subset, its root may maintain a non-persisted mutation journal keyed by Entity kind and identity so `Save` writes only the recorded changes; an Entity-level `Dirty` flag is a simpler update-only variant. This is an optional write-amplification optimization, not a Domain fact or concurrency mechanism; every owned change still advances the root version and commits atomically.

## QueryRepository Adapter

Product lists, pages, history, reports, projections, and optimized partial reads use an Application-owned QueryRepository. A focused read of exactly one reasonably sized Aggregate may use the Domain Repository only when the confirmed Model and request do not introduce distinct read semantics.

```go
package infrastructure

import (
    "context"

    "example/internal/business/user/application/query"
    "example/internal/business/user/domain"
    "github.com/samber/oops"
    "xorm.io/xorm"
)

type userQueryRepository struct{ engine *xorm.Engine }

var _ query.Repository = (*userQueryRepository)(nil)

func NewUserQueryRepository(engine *xorm.Engine) query.Repository {
    return &userQueryRepository{engine: engine}
}

func (r *userQueryRepository) Get(ctx context.Context, userID string) (query.User, error) {
    data := new(userDO)
    found, err := r.engine.Context(ctx).
        Cols("id", "name", "email").
        Where("id = ? AND deleted_at = 0", userID).
        Get(data)
    if err != nil {
        return query.User{}, oops.With("operation", "user.query.get").
            With("user_id", userID).
            Wrap(err)
    }
    if !found {
        return query.User{}, oops.With("operation", "user.query.get").
            With("user_id", userID).
            Wrap(domain.ErrUserNotFound)
    }
    return userReadModelFromDO(data), nil
}

func (r *userQueryRepository) List(ctx context.Context, filter query.ListFilter) (query.UserPage, error) {
    rows := make([]userDO, 0, filter.PageSize)
    session := r.engine.Context(ctx).
        Cols("id", "name", "email").
        Where("deleted_at = 0")
    if filter.NamePrefix != "" {
        session = session.Where("name LIKE ?", filter.NamePrefix+"%")
    }
    err := session.Desc("created_at", "id").
        Limit(filter.PageSize, (filter.Page-1)*filter.PageSize).
        Find(&rows)
    if err != nil {
        return query.UserPage{}, oops.With("operation", "user.query.list").
            Wrap(err)
    }

    users := make([]query.User, len(rows))
    for index := range rows {
        users[index] = userReadModelFromDO(&rows[index])
    }
    return query.UserPage{Users: users, Page: filter.Page, PageSize: filter.PageSize}, nil
}
```

Count and page queries may use separate xorm sessions. Use stable ordering with a tie-breaker and design indexes from the actual filter/order path.

## Outbound Adapters And Outbox

Infrastructure maps semantic Application ports to external APIs, Kafka, cache, taskqueue, or other providers. Keep generated clients, credentials, topics, retry settings, and serialization here.

If accepted state and publish intent must commit atomically, persist an outbox record in the same local xorm transaction and run the relay from Runtime. This is conditional: do not introduce an outbox when best-effort loss is accepted or no durable handoff is required. The message flow guide owns envelope and delivery details.

## Error And Logging Boundary

- At the first controlled boundary, enrich and wrap once with `oops.With(...).Wrap(providerErr)`; use `oops.Wrap(providerErr)` only when there is no owned context. Never wrap an already wrapped provider error again.
- Preserve `errors.Is/As` and stable Domain/Application errors. Later layers add context only when they add new semantics.
- Do not log and return the same error. Transport or Runtime owns the Execution Completion Log.
- Infrastructure logs only when it suppresses/retries an error or owns a terminal provider operation.
- Never attach passwords, DSNs, tokens, message payloads, or unbounded SQL values to errors or logs.

## Verification

Use MySQL-backed integration tests for Repository and QueryRepository behavior. Cover insert version `1`, update version comparison/increment, affected-row conflict mapping, soft-delete filtering when applicable, DO conversion validation, owned-row rollback, stale Save behavior, deterministic query ordering, and first-boundary error preservation. Outbox tests cover atomic state/message insertion and relay retry only when that design is active.
