---
name: ddd-python-domain
description: Python House Style for accepted Aggregate Roots, Entities, Value Objects, Domain Services, Domain-owned Ports, and Repository contracts.
---

# Python Domain Layer

## Applies When

Load this leaf when Python Domain objects or their write Repository contracts
are touched. The accepted domain-object design supplies names, facts, lifecycle,
behavior, invariants, capabilities, and Domain Events.

## Placement

Place Domain code under `src/<service>/business/<context>/domain/`. Use semantic
filenames such as `subscription.py` or `pricing.py`; put one Root's write
Repository `Protocol` beside that Root. Domain modules import the standard
library and Domain-focused packages only.

## Aggregate and Value Shape

- Mutable Aggregates and Entities use normal classes with leading-underscore
  state and read-only mapping properties.
- Factories establish valid new state. `reconstitute()` restores valid existing
  state and records no creation behavior.
- Named methods own business transitions; outer layers read properties only for
  mapping, identity, and safe result construction.
- Value Objects use frozen slotted dataclasses, normalize in `__post_init__`,
  and have value equality.
- Business datetimes are timezone-aware and normalized to UTC.
- Aggregates declare `__slots__`, take keyword-only constructor arguments, and
  validate in the constructor, so Factories and `reconstitute()` both validate.
  A Factory assigns new identity with `uuid7()`.

Pydantic and SQLAlchemy types remain outside Domain.

## Lifecycle Realization

For an accepted request-scoped optimistic lifecycle, a new Root has version
`0`, Infrastructure inserts stored version `1`, and `save()` leaves the loaded
instance stale. Reload before a later mutation.

For an accepted resident lifecycle, the live instance remains authoritative and
persistence receives an immutable snapshot/checkpoint. Serialize live behavior
through the accepted single-owner mechanism; a checkpoint token is a persistence
detail.

## Domain Service

Domain Services are synchronous and mostly stateless. They accept Domain values,
snapshots, authoritative facts, and time, then return Domain values, decisions,
errors, or facts.

## Domain-owned Port

Declare each accepted Domain-owned Port as a narrow `Protocol` beside its direct
Domain owner. Use idiomatic signatures and injection for its accepted sparse
Methods.

## Repository

The write Repository `Protocol` exposes `get(root_id) -> Root` and
`save(root) -> None`.

Use plain `Enum` for closed Domain values and translate via `.value` at mapping
boundaries. Use `IntEnum` or `StrEnum` only when primitive substitutability is
part of the accepted model.

## Verification

Test factories, reconstitution, invariants, transitions, Value Object equality,
Domain Service decisions, and accepted event recording with real Domain
objects. A focused fake is reserved for an accepted Domain-owned Port.
