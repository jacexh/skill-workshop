---
name: ddd-python-infrastructure
description: Python House Style for SQLAlchemy persistence, QueryRepositories, local transaction adapters, and outbound ACLs.
---

# Python Infrastructure Layer

## Applies When

Load this leaf when Python persistence, read adapters, a local transaction
implementation, or an outbound provider/ACL is touched. Load
[database.md](database.md) as well for MySQL schema and SQL shape.

## Placement and Resources

Use `business/<context>/infrastructure/persistence/{model,convert,repository,query_repository}.py`
and semantic `acl/` or outbound-adapter modules. Runtime creates one SQLAlchemy
Engine per database, one synchronous session factory, and shared provider
clients; adapters receive them through constructors.

SQLAlchemy models are persistence types. Ordered root `migrations/*.sql` remain
the production schema authority.

## Conversion

Conversion is mechanical: select explicit fields, copy mutable values, translate
enums, call Domain reconstitution/validation for existing state, and perform no
I/O, logging, event creation, or business branch. Name the functions
`to_domain()` (row to Domain through `reconstitute()`) and
`to_mutable_values()` (Domain to business-mutable columns).

## Repository Shape

Use synchronous SQLAlchemy 2 `Session`; each `save()` runs in one
`sessions.begin()` block. For the request-scoped optimistic lifecycle, `save()`
inserts when the in-memory version is `0`; otherwise it runs a version-guarded
update that increments the stored version and raises the stable concurrency
error unless exactly one row changed. Column values follow the
[database.md](database.md) version and timestamp rules, with timestamps from an
injected clock.

Translate `IntegrityError`/`DBAPIError` once into stable inner errors while
preserving the cause. Keep the stable concurrency error outside a broad provider
catch. A successful save leaves the in-memory version unchanged.

## Transactions, Reads, and ACLs

An accepted multi-Root Unit of Work opens one `Session.begin()` and constructs
every participating Repository against that same `Session`; the callback never
uses a separately pool-scoped Repository.

A QueryRepository selects explicit columns, applies stable indexed ordering,
and constructs frozen Application DTOs explicitly. It does not reconstitute an
Aggregate or return SQLAlchemy rows.

Outbound ACLs fulfill Domain-owned Ports and Application Ports by translating
local semantic contracts to one or more provider/generated contracts. The
adapter owns source composition and any accepted fulfillment policy. It receives
a process-managed synchronous `httpx.Client` or other adopted client; Runtime
owns credentials, pooling, client lifecycle, and policy configuration.

## Verification

For changed MySQL persistence or query behavior, apply root migrations to real
MySQL and cover the affected conversion, version/conflict, transaction,
filtering, ordering/cursor, runtime-type, or error-translation behavior. Use
Testcontainers when physical provider semantics carry the risk.

For a changed outbound adapter, verify its Domain result, contract translation,
and affected fulfillment policy at that provider boundary. An outbound-only
change does not require MySQL evidence. Reuse unaffected evidence; Guard reviews
available results without executing this verification.
