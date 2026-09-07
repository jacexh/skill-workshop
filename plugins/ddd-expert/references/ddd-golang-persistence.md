# Go Persistence Mapping and Repositories

## Applies When

Load for changed xorm persistence, Data Objects, or persistence conversion.
Use [database.md](database.md) for the affected schema, SQL, and lifecycle rules.
The [Infrastructure guide](ddd-golang-infrastructure.md) owns common adapter and
error boundaries. An outbound-only adapter does not need this leaf.

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

## Ordinary One-Root Repository

The example uses an initialized `*xorm.Engine` and one statement per operation.
Bind external values, select intentional columns, filter accepted deletion
state, and wrap provider errors at the first controlled boundary.

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

This adapter example implements the request-scoped optimistic lifecycle: new
Aggregates have in-memory `Version == 0`, stored rows begin at `1`, and updates
compare and increment the loaded version atomically. `Save` leaves that loaded
instance stale; the caller may map its already-produced result and reloads for
a later mutation. A resident-checkpoint adapter instead accepts the immutable
snapshot and checkpoint token defined by its accepted design while the live
Aggregate remains authoritative.

When one Aggregate maps to several tables, its Repository owns a local session
and transaction around all statements, rolling back on failure and closing the
session. When a confirmed multi-Root Application scope exists, load
[transaction participation](ddd-golang-transactions.md) and use its resolver
and `WithinOrJoin` form so the Repository joins that scope.

## QueryRepository Adapter

An accepted Go read side follows
[ddd-golang-cqrs.md](ddd-golang-cqrs.md). Its xorm adapter receives the same
ExecutorResolver form as the write adapter when an Application transaction
scope exists; otherwise it receives the shared Engine. It selects explicit
columns, uses stable indexed ordering, and maps directly to Application read
types.
