---
name: ddd-python-application
description: Python House Style for Application methods, assemblers, commands, queries, and local transaction scopes.
---

# Python Application Layer

## Applies When

Load this leaf when a Python use case, Application DTO, entry, assembler,
QueryRepository, semantic outbound port, or transaction scope is touched.

## Placement

Use `business/<context>/application/` with `application.py`, `assembler.py`,
and conditional `queries/`, `eventhandlers/`, `task/`, or `ports/` directories.
Application imports Domain and semantic inner contracts. Provider clients,
protocol models, active loops, and SQLAlchemy sessions remain outer.

## Application Entry and Assembler

Use one `Application` class in `application.py`, following the
[shared Application shape](ddd-core.md#application-and-transport-shape).
Its named methods implement use cases directly. Keep cohesive coordination
helpers in responsibility-named modules when extraction earns its cost.

Application DTOs are frozen slotted dataclasses. `assembler.py` maps existing
DTO/Domain state and uses Domain reconstitution; creation calls the Domain
Factory directly.

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class UserDTO:
    id: UUID
    name: str
    email: str
    status: int
    version: int


def assemble_user_dto(dto: UserDTO) -> User:
    return User.reconstitute(
        user_id=dto.id,
        name=dto.name,
        email=Email(dto.email),
        status=UserStatus(dto.status),
        version=dto.version,
    )


def assemble_user_entity(user: User) -> UserDTO:
    return UserDTO(
        id=user.id,
        name=user.name,
        email=user.email.value,
        status=user.status.value,
        version=user.version,
    )
```

Assemblers are pure mapping functions with no I/O, transaction control,
external mapping, or business branch.

## Command and Transaction Shape

Commands and results are immutable values. An Application method loads required
facts, calls named Domain behavior, saves the accepted Root set, coordinates accepted
reactions, and returns a minimal result.

```python
class Application:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def create_user(self, command: CreateUser) -> CreateUserResult:
        user = User.register(command.name, Email(command.email))
        self._repository.save(user)
        return CreateUserResult(user_id=user.id)
```

For an accepted multi-Root local transaction, Application owns a semantic
transaction callback/Unit of Work contract. Infrastructure supplies every
participating Repository from the same concrete SQLAlchemy transaction. Domain
types remain transaction-unaware.

When accepted Domain Events exist, use the flow in
[ddd-python-events-messages.md](ddd-python-events-messages.md). When accepted
tasks exist, use [ddd-python-taskqueue.md](ddd-python-taskqueue.md).

## Query Shape

An Application query method or cohesive query object returns an immutable read
model. A focused accepted one-Root read may load the complete Aggregate and map it. Accepted
lists, pages, histories, reports, partial fields, and projections use an
Application-owned `QueryRepository` Protocol returning frozen read DTOs.

## Verification

Exercise real use cases and Domain objects with small typed semantic fakes.
Verify mapping, call order that carries business meaning, transaction
participation for every accepted Root, and immutable results. Provider behavior
belongs to the Infrastructure integration test.
