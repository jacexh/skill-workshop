---
name: ddd-python-domain
description: Python House Style for accepted Aggregate Roots, Entities, Value Objects, Domain Services, and Repository contracts.
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

```python
from dataclasses import dataclass
from enum import Enum
from typing import Self
from uuid import UUID, uuid7


class InvalidUserError(Exception):
    pass


class UserStatus(Enum):
    PENDING = 1
    ACTIVE = 2


@dataclass(frozen=True, slots=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        normalized = self.value.strip().lower()
        if not normalized or "@" not in normalized:
            raise InvalidUserError("invalid email")
        object.__setattr__(self, "value", normalized)


class User:
    __slots__ = ("_id", "_name", "_email", "_status", "_version")

    def __init__(
        self,
        *,
        user_id: UUID,
        name: str,
        email: Email,
        status: UserStatus,
        version: int,
    ) -> None:
        self._id = user_id
        self._name = name
        self._email = email
        self._status = status
        self._version = version
        self._validate()

    @classmethod
    def register(cls, name: str, email: Email) -> Self:
        return cls(
            user_id=uuid7(),
            name=name.strip(),
            email=email,
            status=UserStatus.PENDING,
            version=0,
        )

    @classmethod
    def reconstitute(
        cls,
        *,
        user_id: UUID,
        name: str,
        email: Email,
        status: UserStatus,
        version: int,
    ) -> Self:
        return cls(
            user_id=user_id,
            name=name,
            email=email,
            status=status,
            version=version,
        )

    @property
    def id(self) -> UUID:
        return self._id

    @property
    def name(self) -> str:
        return self._name

    @property
    def email(self) -> Email:
        return self._email

    @property
    def status(self) -> UserStatus:
        return self._status

    @property
    def version(self) -> int:
        return self._version

    def activate(self) -> None:
        if self._status is UserStatus.ACTIVE:
            return
        self._status = UserStatus.ACTIVE

    def _validate(self) -> None:
        if not self._name or self._version < 0:
            raise InvalidUserError("invalid user")
```

Sample validation is illustrative; production rules come from the accepted
model. Pydantic and SQLAlchemy types remain outside Domain.

## Lifecycle Realization

For an accepted request-scoped optimistic lifecycle, a new Root has version
`0`, Infrastructure inserts stored version `1`, and `save()` leaves the loaded
instance stale. Reload before a later mutation.

For an accepted resident lifecycle, the live instance remains authoritative and
persistence receives an immutable snapshot/checkpoint. Serialize live behavior
through the accepted single-owner mechanism; a checkpoint token is a persistence
detail.

## Domain Service and Repository

Domain Services are synchronous and mostly stateless. They accept Domain values,
snapshots, time, and accepted semantic collaborators, then return Domain values,
decisions, errors, or facts. Application supplies external facts and concrete
collaborators.

```python
from typing import Protocol
from uuid import UUID


class UserRepository(Protocol):
    def get(self, user_id: UUID) -> User: ...

    def save(self, user: User) -> None: ...
```

Use plain `Enum` for closed Domain values and translate via `.value` at mapping
boundaries. Use `IntEnum` or `StrEnum` only when primitive substitutability is
part of the accepted model.

## Verification

Test factories, reconstitution, invariants, transitions, Value Object equality,
Domain Service decisions, and accepted event recording with real Domain
objects. A focused fake is reserved for an accepted semantic Domain
collaborator.
