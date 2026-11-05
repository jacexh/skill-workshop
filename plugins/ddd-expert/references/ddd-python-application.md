---
name: ddd-python-application
description: Python House Style for Application methods, assemblers, commands, queries, and local transaction scopes.
---

# Python Application Layer

## Applies When

Load this leaf when a Python use case, Application DTO, entry, assembler,
QueryRepository, semantic outbound port, or transaction scope is touched.

## Placement

Use `business/<context>/application/` with `application.py` and conditional
`assembler.py`, `queries/`, `eventhandlers/`, `task/`, or `ports/` directories.
Application imports Domain and semantic inner contracts. Provider clients,
protocol models, active loops, and SQLAlchemy sessions remain outer.

## Application Entry and Assembler

Use one `Application` class in `application.py`, following the
[shared Application shape](ddd-core.md#application-and-transport-shape).
Its named methods implement use cases directly. Keep cohesive coordination
helpers in responsibility-named modules when extraction earns its cost.

Application DTOs are frozen slotted dataclasses. When the
[shared assembler rule](ddd-core.md#application-and-transport-shape) applies,
`assembler.py` maps existing DTO/Domain state and uses Domain reconstitution;
creation calls the Domain Factory directly. Name the functions
`assemble_<object>_dto()` (DTO to Domain) and `assemble_<object>_entity()`
(Domain to DTO).

Assemblers are pure mapping functions with no I/O, transaction control,
external mapping, or business branch.

## Command and Transaction Shape

Commands and results are immutable values. An Application method loads required
facts, calls named Domain behavior, saves the accepted Root set, coordinates accepted
reactions, and returns a minimal result.

For an accepted multi-Root local transaction, Application owns a semantic
transaction callback/Unit of Work contract. Infrastructure supplies every
participating Repository from the same concrete SQLAlchemy transaction. Domain
types remain transaction-unaware.

When accepted Domain Events exist, use the flow in
[ddd-python-events-messages.md](ddd-python-events-messages.md). When accepted
tasks exist, use [ddd-python-taskqueue.md](ddd-python-taskqueue.md).

## Query Shape

An Application query method, or a query object chosen by the
[shared read-side rule](ddd-core.md#application-and-transport-shape), returns an
immutable read model. A focused accepted one-Root read may load the complete Aggregate and map it. Accepted
lists, pages, histories, reports, partial fields, and projections use an
Application-owned `QueryRepository` Protocol returning frozen read models.

## Verification

Exercise real use cases and Domain objects with small typed semantic fakes.
Verify mapping, call order that carries business meaning, transaction
participation for every accepted Root, and immutable results. Provider behavior
belongs to the Infrastructure integration test.
