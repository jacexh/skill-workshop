---
name: ddd-golang-cqrs
description: Go House Style for an accepted QueryRepository, Application read model, focused Aggregate read, and projection adapter.
---

# Go Read Side

## Applies When

Load this leaf when the accepted implementation contains an Application read
model, QueryRepository, read projection, or focused one-Aggregate query. This
leaf fixes Go placement and code shape; it does not decide whether a separate
read side exists.

## Focused Aggregate Read

An accepted focused read enters through `Application.Queries`, loads the full
Aggregate through its Domain Repository, and maps an immutable result. Transport
receives the result rather than the Aggregate.

```go
type GetUser struct {
	repository domain.Repository
}

func (h *GetUser) Handle(ctx context.Context, id string) (UserDTO, error) {
	user, err := h.repository.Get(ctx, id)
	if err != nil {
		return UserDTO{}, err
	}
	return AssembleUserEntity(user), nil
}
```

## QueryRepository Contract

Place the contract and readonly DTOs under `application/query/` or
`application/queries/`. Group cohesive operations by consumer semantics.

```go
type UserListItem struct {
	ID     string
	Name   string
	Status int
}

type UserPage struct {
	Items      []UserListItem
	NextCursor string
}

type QueryRepository interface {
	ListUsers(context.Context, ListUsersFilter) (UserPage, error)
}
```

Query handlers depend on that interface and return Application read types.
Transport maps external filters/cursors to the Application filter, delegates
once, and maps the result.

## Infrastructure Adapter

Implement the contract in `infrastructure/query_repository.go` with xorm. Select
explicit columns, aliases, filters, and stable indexed order. Map query rows
directly into Application read DTOs; do not reconstitute an Aggregate on this
path.

```go
func (r *QueryRepository) ListUsers(
	ctx context.Context,
	filter query.ListUsersFilter,
) (query.UserPage, error) {
	rows := make([]userListRow, 0, filter.Limit+1)
	err := r.executor(ctx).Table("user").
		Cols("id", "name", "status").
		Where("deleted_at = 0").
		Asc("id").Limit(filter.Limit+1).
		Find(&rows)
	if err != nil {
		return query.UserPage{}, oops.With("operation", "user.list").Wrap(err)
	}
	return mapUserPage(rows, filter.Limit), nil
}
```

Projection writers, when accepted, live in Infrastructure and consume the
accepted event/message contract. The read store and freshness behavior follow
the accepted implementation authority.

## Verification

Application tests use a focused typed fake and verify immutable results.
Transport tests prove filter/cursor mapping and one delegation. MySQL integration
tests apply root migrations and prove explicit columns, filters, stable order,
cursor boundaries, runtime value types, DTO mapping, and the representative
query plan/index from [database.md](database.md).
