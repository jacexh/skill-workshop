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

An accepted focused read uses a named Application method, loads the full
Aggregate through its Domain Repository, and maps an immutable result with the
assembler, such as `AssembleUserEntity`. Transport receives the result rather
than the Aggregate.

## QueryRepository Contract

Place the contract and its read models under `application/query/` or
`application/queries/`. Group cohesive operations by consumer semantics.

Each operation takes a filter value, such as `ListUsersFilter`, and returns a
consumer-named read model, such as `UserPage` with its `Items` and
`NextCursor`.

Application query methods or cohesive query objects depend on that interface
and return read models.
Transport maps external filters/cursors to the Application filter, delegates
once, and maps the result.

## Infrastructure Adapter

Implement the contract in `infrastructure/query_repository.go` with xorm. Select
explicit columns, aliases, filters, and stable indexed order. Map query rows
directly into read models; do not reconstitute an Aggregate on this
path.

Read `Limit+1` rows to derive the next cursor, filter accepted deletion state,
and wrap a provider error once with `oops` and an `operation` attribute.

Projection writers, when accepted, live in Infrastructure and consume the
accepted event/message contract. The read store and freshness behavior follow
the accepted implementation authority.

## Verification

Application tests use a focused typed fake and verify immutable results.
Transport tests prove filter/cursor mapping and one delegation. MySQL integration
tests apply root migrations and prove explicit columns, filters, stable order,
cursor boundaries, runtime value types, DTO mapping, and the representative
query plan/index from [database.md](database.md).
