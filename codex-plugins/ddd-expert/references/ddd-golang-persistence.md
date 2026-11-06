# Go Persistence Mapping and Repositories

## Applies When

Load for changed xorm persistence, Data Objects, or persistence conversion.
Use [database.md](database.md) for the affected schema, SQL, and lifecycle rules.
The [Infrastructure guide](ddd-golang-infrastructure.md) owns common adapter and
error boundaries. An outbound-only adapter does not need this leaf.

## Data Object

Keep xorm tags and storage-only fields private to Infrastructure. Mapping follows the mandatory database profile; do not weaken or reinterpret that profile from a Go mapping guide.

Name the Data Object `<aggregate>DO`, unexported, in `do.go`. Tag each field
with its column, such as `xorm:"id pk"`; carry `version`, and `created_at`,
`updated_at`, and `deleted_at` as `database.Timestamp`; return the table name
from `TableName()`.

Use the timestamp representation required by [database.md](database.md) and keep its converter in the shared database package. Do not make the Domain import a storage timestamp type.

## Exported Domain Mapping

Exported Domain fields are an intentional mapping surface. They permit a converter to construct rehydrated state; they do not permit Application, Transport, or Infrastructure to mutate an existing Aggregate or make business decisions from its fields.

Name the converters `userToDO`, `userFromDO`, and `userReadModelFromDO`. They
copy slices, such as a hashed password, in both directions. `userFromDO` rejects
a stored `Version < 1` by wrapping the Domain sentinel error with `oops`
context, then returns the result of `Validate()` on the restored Aggregate.

Conversion restores already-existing state. New Aggregate creation calls the
Domain factory. When the accepted Aggregate records events, initialize its
collection as specified by [ddd-golang-events.md](ddd-golang-events.md).
Mapping remains explicit and uses no reflection or unsafe setters.

## Ordinary One-Root Repository

The adapter uses an initialized `*xorm.Engine` and one statement per operation.
Bind external values, select intentional columns, filter accepted deletion
state, and wrap provider errors at the first controlled boundary.

The unexported `userRepository` asserts `domain.Repository` at compile time,
and `NewUserRepository(engine)` returns that interface. Each wrapped error
carries an `operation` attribute named `<aggregate>.<operation>`, such as
`user.get`, and the Aggregate identity.

- `Get` filters `deleted_at = 0`, wraps the Domain not-found error when no row
  matches, and wraps a conversion failure under its own operation.
- `Save` rejects a `nil` Aggregate. When `Version == 0`, it inserts with stored
  version `1`, UTC `created_at` and `updated_at`, and `deleted_at` at
  `database.UnixEpoch`.
- Otherwise `Save` updates explicit columns and `updated_at`, increments
  `version`, and matches `id`, the loaded `version`, and `deleted_at = 0`.
- An affected-row count other than `1` fails the insert, and on update wraps the
  Domain concurrency-conflict error.

This adapter implements the request-scoped optimistic lifecycle: new
Aggregates have in-memory `Version == 0`, stored rows begin at `1`, and updates
compare and increment the loaded version atomically. `Save` leaves that loaded
instance stale; the caller may map its already-produced result and reloads for
a later mutation. A resident-checkpoint adapter instead accepts the immutable
snapshot and checkpoint token defined by its accepted design while the live
Aggregate remains authoritative.

When one Aggregate maps to several tables, its Repository owns a local session
and transaction around all statements, rolling back on failure and closing the
session. When the database has a transaction Manager, the adapter instead
follows [Repository participation](ddd-golang-transactions.md#repository-participation).

## QueryRepository Adapter

An accepted Go read side follows
[ddd-golang-cqrs.md](ddd-golang-cqrs.md). Its xorm adapter resolves its
session like the write adapter on the same database. It selects explicit
columns, uses stable indexed ordering, and maps directly to Application read
types.
