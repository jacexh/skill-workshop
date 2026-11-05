---
name: ddd-typescript-infrastructure
description: TypeScript House Style for Kysely persistence, QueryRepositories, Units of Work, and outbound ACLs.
---

# TypeScript Infrastructure Layer

## Applies When

Load this leaf when TypeScript persistence, a read adapter, local transaction
implementation, or outbound provider/ACL is touched. Load
[database.md](database.md) for MySQL schema and SQL shape.

## Placement and Conversion

Use `src/business/<context>/infrastructure/persistence/` for Kysely database
types, conversion, Repository, and QueryRepository adapters. Runtime creates one
Kysely/mysql2 pool per database and injects it.

Kysely table interfaces describe adapter types; ordered `migrations/*.sql` are
the schema authority. DECIMAL and unsafe BIGINT values remain strings until an
explicit boundary conversion.

Conversion performs explicit mechanical mapping, copies mutable values, and
calls Domain reconstitution for existing state. The row type `<Object>DO` is a
`Pick` of the selected `Selectable` columns; `convert<Object>DO()` maps a row to
Domain and `convert<Object>Entity()` maps Domain to writable columns.

## Repository and Unit of Work

The Repository accepts an executor typed `Kysely<Database> |
Transaction<Database>`: the pool, or the transaction supplied by the Unit of
Work. For the request-scoped optimistic lifecycle, `save()` inserts when the
in-memory version is `0`; otherwise it runs a version-guarded update that
increments the stored version and raises the stable concurrency error unless
exactly one row changed. Column values follow the [database.md](database.md)
version and timestamp rules, with timestamps from an injected clock.

An accepted Unit of Work uses `db.transaction().execute` and constructs every
participating Repository on the callback's `Transaction<Database>`.

QueryRepositories select explicit columns, apply stable indexed order, and
return readonly Application DTOs. Outbound adapters fulfill Domain-owned Ports and
Application Ports through one or more provider/generated contracts. The
adapter owns source composition and any accepted fulfillment policy; Platform
owns credentials, client lifecycle, and policy configuration. Preserve the
first external error in `cause` while translating to a stable inner error.

## Verification

For changed MySQL persistence or query behavior, apply root migrations and use
Testcontainers MySQL to cover the affected mapping, version/conflict,
transaction, filtering, runtime-type, ordering/cursor, or error-translation
behavior.

For a changed outbound adapter, verify its Domain result, contract translation,
and affected fulfillment policy at that provider boundary. An outbound-only
change does not require MySQL evidence. Reuse unaffected evidence; Guard reviews
available results without executing this verification.
