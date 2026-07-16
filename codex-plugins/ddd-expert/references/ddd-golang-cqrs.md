---
name: ddd-golang-cqrs
description: Conditional Go read-side house style for focused Aggregate reads, Application read models, QueryRepository ports and projections.
---

# Go CQRS and Read Side

CQRS here is responsibility and model separation, not a requirement for separate services, databases, asynchronous projections or Event Sourcing. Adopt a distinct read side when the read model has actually diverged from Aggregate loading.

## Choose from Read Facts

Do not create a QueryRepository merely because an endpoint or method is named `Get`.

A focused single-Aggregate read may load through the Domain Repository when:

- full Aggregate reconstitution is reasonable;
- the result is a mechanical read-only mapping;
- the query needs no joins, denormalized/display-only state or partial optimized load;
- freshness, authorization, source and performance have not diverged from the write model.

Lists, pages, history, reports, statistics, cross-Aggregate composition, denormalized views, partial optimized reads, projections or independently governed freshness/authorization/source/performance use an Application-owned QueryRepository.

In either case the call path is:

```text
Transport -> Application.Queries.<UseCase>.Handle -> Repository port -> Infrastructure
```

Transport never calls either Repository directly.

## Focused Aggregate Read

A focused read can remain small and use the write Repository without adding product-query methods to that interface:

```go
package query

import (
	"context"

	"example/internal/business/user/domain"
)

type User struct {
	ID, Name, Email string
}

type GetUserHandler struct {
	repository domain.Repository
}

func NewGetUserHandler(repository domain.Repository) *GetUserHandler {
	return &GetUserHandler{repository: repository}
}

func (h *GetUserHandler) Handle(ctx context.Context, id string) (User, error) {
	entity, err := h.repository.Get(ctx, id)
	if err != nil {
		return User{}, err
	}
	return User{ID: entity.ID, Name: entity.Name, Email: entity.Email}, nil
}
```

This is a read-only mechanical mapping. It does not authorize the handler to make business decisions from exported Domain fields. If this path starts polluting the Aggregate API or loading unnecessary state, introduce the read model below.

## QueryRepository and Read Model

Place a cohesive read-family interface and DTOs under `application/query/`; implement the interface in Infrastructure:

```go
package query

import "context"

type User struct {
	ID    string
	Name  string
	Email string
}

type UserPage struct {
    Users    []User
    Page     int
    PageSize int
}

type ListUsers struct {
	NamePrefix string
	Page       int
	PageSize   int
}

type ListFilter struct {
	NamePrefix string
	Page       int
	PageSize   int
}

type Repository interface {
	List(context.Context, ListFilter) (UserPage, error)
}

type ListUsersHandler struct {
	repository Repository
}

func NewListUsersHandler(repository Repository) *ListUsersHandler {
	return &ListUsersHandler{repository: repository}
}

func (h *ListUsersHandler) Handle(
	ctx context.Context,
	input ListUsers,
) (UserPage, error) {
	if input.Page < 1 {
		input.Page = 1
	}
	if input.PageSize < 1 {
		input.PageSize = 20
	}
	if input.PageSize > 100 {
		input.PageSize = 100
	}
	return h.repository.List(ctx, ListFilter(input))
}
```

Read models are Application DTOs, not Aggregates. They may contain denormalized, masked, pagination or display-oriented fields, but no write-side invariant behavior. Query filters and read models do not become Domain Entities and do not carry Domain validator tags; simple pagination/filter semantics stay explicit in the query use case.

One QueryRepository serves one cohesive product read-model family. Add a method when authorization, freshness, source, failure and test-substitute semantics remain aligned. Split when those semantics materially differ, not for every screen or RPC. Name methods in product language; never expose `Select`, `Scan`, SQL strings, xorm sessions or provider cursors.

Infrastructure may map SQL rows or DOs directly to the Application read model. This is the intentional exception to `DO -> Domain Entity`: the read path is not creating or changing Domain state.

## Write and Read Responsibilities

- Domain Repository loads and saves Aggregate Roots for behavior.
- QueryRepository returns read models and never saves an Aggregate.
- Even when both use the same table, their interfaces remain distinct once read-model separation applies.
- Infrastructure may share private SQL fragments, DOs and mapping helpers without merging the two contracts.
- A QueryRepository optimization must not change Application-visible ordering, pagination, masking or freshness semantics silently.

## Cross-Context Reads

Another bounded context does not import the source context's internal QueryRepository, Application package or Domain model. Use an accepted published read contract and an ACL when languages differ. Do not create a baseline `api/` directory without an accepted same-process public contract; cross-process reads use versioned RPC contracts under `proto/` with generated code under `gen/`.

## Projections

A projection is read-side state, not an Aggregate by virtue of being mutable in storage.

- Same-context Domain Event reactions call an Application projection use case from `application/eventhandler`.
- Integration Message reactions enter through `transport/messagesubscriber`.
- Durable repair/backfill enters through an accepted `transport/taskprocessor` flow.
- Define delivery, ordering, replay, rebuild and consistency-window behavior before relying on asynchronous projection state.

## Verification

Application query tests cover result shape, authorization, pagination and composition with focused Repository fakes. Infrastructure integration tests exercise real filtering, ordering, pagination and storage mapping; apply the persistence rules in [`database.md`](database.md). Projection tests cover duplicate, out-of-order, replay and rebuild behavior whenever confirmed delivery semantics permit them.
