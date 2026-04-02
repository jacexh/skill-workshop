---
name: ddd-python
description: Python implementation guide for DDD + Clean Architecture. Use when implementing backend services in Python with domain-driven design, including aggregates, repositories, domain events, CQRS, and module assembly with dependency-injector. Complements ddd-core specification.
---

# Python Web System Architecture Guide
## DDD + Clean Architecture — Python Implementation

**Version**: v1.0
**Date**: 2026-04-02
**Scope**: Team backend service architecture standard
**Prerequisite**: This document is the Python implementation guide for [`ddd-core.md`](ddd-core.md). All architecture principles defer to `ddd-core.md`.
**Python Version**: 3.12+

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This guide combines **Domain-Driven Design (DDD)** with **Clean Architecture**, targeting:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code organized by bounded context, not by technical layer
4. **Testability** — Business logic testable without external infrastructure

> For the full rationale, see [ddd-core.md §1.1](ddd-core.md).

### 1.2 Layered Architecture

Four layers with the **Domain Layer as the core** (innermost):

```
                    ┌─────────────────────────────────────┐
                    │       Adapter Layer                 │
                    │  (FastAPI Router / gRPC Servicer)   │
                    │  - Input validation, protocol       │
                    │    transformation, routing          │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │      Application Layer              │
                    │  - Use-case orchestration,          │
                    │    transaction management, DTOs     │
                    │  - QueryRepository interfaces (read)│
                    │  - Cross-aggregate coordination,    │
                    │    authorization checks             │
                    └───────────────┬─────────────────────┘
                                    │ depends on
                    ┌───────────────▼─────────────────────┐
                    │        Domain Layer ◄───────────────┼── Core. Zero external deps.
                    │  - Entities, Value Objects,         │
                    │    Domain Services                  │
                    │  - Write Repository interfaces,     │
                    │    Domain Events                    │
                    └─────────────────────────────────────┘
                                    ▲
                    ┌───────────────┘
                    │ implements
        ┌───────────┴─────────────────────────────────────┐
        │       Infrastructure Layer                      │
        │  - Repository implementations, DB access,      │
        │    external API clients                         │
        │  - Message queues, cache implementations       │
        └─────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Adapter Layer depends on Application and Domain layers
- Application Layer depends only on Domain Layer
- Domain Layer has zero dependencies (no `import` of infrastructure, database, or HTTP packages)
- Infrastructure Layer depends on Domain Layer (implements Repository interfaces) and Application Layer (implements QueryRepository interfaces)

> For full dependency rules and common violations, see [ddd-core.md §1.3](ddd-core.md).

```python
# ✅ Correct: Domain defines write repository interface (domain/repository.py)
from abc import ABC, abstractmethod

class Repository(ABC):
    @abstractmethod
    async def get(self, id: str) -> "User": ...

    @abstractmethod
    async def save(self, user: "User") -> None: ...

# ✅ Correct: Application defines read repository interface (application/query_repository.py)
class QueryRepository(ABC):
    @abstractmethod
    async def find_by_email(self, email: str) -> "UserDetailDTO | None": ...

    @abstractmethod
    async def list(self, query: "QueryFindUserList") -> tuple[list["UserListDTO"], int]: ...

# ✅ Correct: Infrastructure implements both interfaces
class UserRepository(Repository):           # implements domain.Repository
    def __init__(self, session_factory: async_sessionmaker) -> None: ...

class UserQueryRepository(QueryRepository): # implements application.QueryRepository
    def __init__(self, session_factory: async_sessionmaker) -> None: ...
```

---

## 2. Directory Structure

### 2.1 Overall Layout

> Corresponds to [ddd-core.md §2.1](ddd-core.md). Python-specific conventions applied.

```
project/
├── src/
│   └── <project_name>/
│       ├── __init__.py
│       ├── main.py                    # Application entry point (Uvicorn)
│       ├── container.py               # DI container (dependency-injector)
│       ├── settings.py                # Configuration (pydantic-settings)
│       ├── <context>/                 # Bounded context (vertical slice)
│       │   ├── __init__.py
│       │   ├── domain/                # Domain layer
│       │   ├── application/           # Application layer
│       │   ├── adapter/               # Adapter layer
│       │   └── infrastructure/        # Infrastructure layer
│       └── shared/                    # Shared infrastructure (use sparingly)
│           ├── __init__.py
│           ├── event_bus.py           # In-process event bus
│           ├── database.py            # Database engine / session factory
│           └── errors.py              # Base error types
├── tests/
│   ├── unit/
│   │   └── <context>/
│   │       ├── test_domain.py
│   │       └── test_handler.py
│   └── integration/
│       └── <context>/
│           └── test_repository.py
├── alembic/                           # Database migrations
│   └── versions/
├── alembic.ini
├── proto/                             # Protobuf definitions (if using gRPC)
├── pyproject.toml                     # Project metadata, dependencies, tool config
└── uv.lock                           # Lock file (uv)
```

### 2.2 Bounded Context Internal Structure

> Corresponds to [ddd-core.md §2.2](ddd-core.md).

```
src/<project_name>/user/               # User bounded context
├── __init__.py
├── domain/                            # Domain layer - PURE, zero external dependencies
│   ├── __init__.py
│   ├── user.py                        # Aggregate Root + Entity
│   ├── value_object.py                # Value Objects (Email, Password, etc.)
│   ├── event.py                       # Domain event definitions
│   ├── repository.py                  # Write repository interface (ABC)
│   ├── service.py                     # Domain service (if needed)
│   └── error.py                       # Domain errors
│
├── application/                       # Application layer - orchestrates domain objects
│   ├── __init__.py
│   ├── command.py                     # Command definitions (ChangePassword, etc.)
│   ├── query.py                       # Query definitions
│   ├── query_repository.py            # Read repository interface (CQRS, returns DTOs)
│   ├── handler.py                     # Command/Query Handlers
│   ├── dto.py                         # DTO definitions (Pydantic models)
│   └── assembler.py                   # DTO <-> Domain conversion
│
├── adapter/                           # Adapter layer - adapts external protocols
│   ├── __init__.py
│   ├── http.py                        # FastAPI router
│   └── grpc.py                        # gRPC servicer (if applicable)
│
└── infrastructure/                    # Infrastructure layer - technical implementation
    ├── __init__.py
    ├── persistence/
    │   ├── __init__.py
    │   ├── repository.py              # Repository implementation
    │   ├── query_repository.py        # Query repository implementation
    │   ├── model.py                   # SQLAlchemy ORM models
    │   └── converter.py               # ORM model <-> Entity conversion
    └── messaging/
        ├── __init__.py
        └── publisher.py               # Event publisher implementation
```

---

## 3. Layer Responsibilities

### 3.1 Domain Layer

**Role**: Core business logic, independent of frameworks, databases, and UI.

> For the full specification, see [ddd-core.md §3.1](ddd-core.md).

**Contents**:
- **Aggregate Root**: Guardian of business invariants
- **Entity**: Object with unique identity
- **Value Object**: Defined by attributes, no identity, immutable
- **Domain Service**: Cross-aggregate logic that doesn't belong to a single entity
- **Repository Interface**: Persistence abstraction (write operations only)
- **Domain Event**: Records significant domain occurrences

**Constraints**:
- Zero external dependencies (only Python standard library + `uuid` module)
- Must not depend on other bounded contexts' domain layers (communicate via events)
- All state changes go through domain methods — direct attribute mutation from outside is prohibited
- **Version is a read-only concurrency token** — Domain does not increment Version; Infrastructure increments it via SQL
- **IDs are generated in the Domain layer** (inside Factory Methods) using `uuid.uuid7()` (Python 3.12+ native) — database auto-increment IDs are prohibited

**Factory Design**:
- Simple cases: use the Aggregate Root's own class method (`User.create(...)`)
- Complex cases (assembling multiple Value Objects, cross-entity validation): extract an independent Domain Factory class within the domain package

**Domain Event Collection**:
- Aggregate Root holds a `_events: list[DomainEvent]` internal list
- Domain methods append events via `_record_event(event)` — they never dispatch directly
- Application layer calls `collect_events()` after a successful `save()` to drain and dispatch all collected events
- `collect_events()` returns the event list and clears it — calling it twice in a row returns an empty list on the second call

> This is the Python implementation of the language-agnostic event collection pattern described in [ddd-core.md §3.1 "Domain Event Collection"](ddd-core.md).

**Enforcing attribute encapsulation**:
- Use `__slots__` to explicitly declare allowed attributes
- Mark internal fields with a leading underscore (`_events`, `_status`)
- Expose read-only access via `@property` where needed
- Provide dedicated domain methods for all state mutations

```python
# domain/event.py
from dataclasses import dataclass
from datetime import datetime, UTC


class DomainEvent:
    """Base class for all domain events."""

    @property
    def occurred_at(self) -> datetime:
        return self._occurred_at

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)


@dataclass(frozen=True, slots=True)
class UserCreatedEvent(DomainEvent):
    """Rich Event: carry ID + minimum necessary fields."""
    user_id: str
    name: str
    email: str
    occurred_at: datetime


@dataclass(frozen=True, slots=True)
class PasswordChangedEvent(DomainEvent):
    user_id: str
    occurred_at: datetime


@dataclass(frozen=True, slots=True)
class UserActivatedEvent(DomainEvent):
    user_id: str
    occurred_at: datetime
```

```python
# domain/error.py

class DomainError(Exception):
    """Base class for all domain errors."""


class UserNotFoundError(DomainError):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"user not found: {user_id}")
        self.user_id = user_id


class InvalidEmailError(DomainError):
    def __init__(self, email: str) -> None:
        super().__init__(f"invalid email format: {email}")


class WeakPasswordError(DomainError):
    def __init__(self) -> None:
        super().__init__("password too weak")


class UserNotActiveError(DomainError):
    def __init__(self) -> None:
        super().__init__("user is not active")


class ConcurrentModificationError(DomainError):
    def __init__(self, entity_id: str) -> None:
        super().__init__(f"concurrent modification detected: {entity_id}")
        self.entity_id = entity_id
```

```python
# domain/value_object.py
from __future__ import annotations

import hashlib
import re
import secrets
from dataclasses import dataclass

from .error import InvalidEmailError, WeakPasswordError


@dataclass(frozen=True, slots=True)
class Email:
    """Value Object: validated email address."""
    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", self.value):
            raise InvalidEmailError(self.value)

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True, slots=True)
class HashedPassword:
    """Value Object: hashed password with salt."""
    hash_value: bytes
    salt: bytes

    @classmethod
    def from_plain(cls, raw: str) -> HashedPassword:
        if len(raw) < 8:
            raise WeakPasswordError()
        salt = secrets.token_bytes(32)
        hash_value = hashlib.scrypt(raw.encode(), salt=salt, n=16384, r=8, p=1)
        return cls(hash_value=hash_value, salt=salt)

    def verify(self, raw: str) -> bool:
        computed = hashlib.scrypt(raw.encode(), salt=self.salt, n=16384, r=8, p=1)
        return secrets.compare_digest(computed, self.hash_value)


class UserStatus:
    """Value Object: user status (enum-like with domain semantics)."""
    INACTIVE = 0
    ACTIVE = 1
    SUSPENDED = 2

    _VALID = {INACTIVE, ACTIVE, SUSPENDED}

    __slots__ = ("_value",)

    def __init__(self, value: int) -> None:
        if value not in self._VALID:
            raise ValueError(f"invalid user status: {value}")
        self._value = value

    @property
    def value(self) -> int:
        return self._value

    def __eq__(self, other: object) -> bool:
        if isinstance(other, UserStatus):
            return self._value == other._value
        if isinstance(other, int):
            return self._value == other
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self._value)

    def __repr__(self) -> str:
        return f"UserStatus({self._value})"
```

```python
# domain/user.py
from __future__ import annotations

import uuid
from datetime import datetime, UTC

from .error import UserNotActiveError
from .event import (
    DomainEvent,
    PasswordChangedEvent,
    UserActivatedEvent,
    UserCreatedEvent,
)
from .value_object import Email, HashedPassword, UserStatus


class User:
    """User Aggregate Root.

    All state changes go through domain methods.
    Version is a read-only optimistic concurrency token — Infrastructure increments it.
    """

    __slots__ = (
        "_id",
        "_name",
        "_email",
        "_hashed_password",
        "_status",
        "_version",
        "_created_at",
        "_updated_at",
        "_events",
    )

    # ── Properties (read-only access) ──────────────────────────

    @property
    def id(self) -> str:
        return self._id

    @property
    def name(self) -> str:
        return self._name

    @property
    def email(self) -> Email:
        return self._email

    @property
    def hashed_password(self) -> HashedPassword:
        return self._hashed_password

    @property
    def status(self) -> UserStatus:
        return self._status

    @property
    def version(self) -> int:
        return self._version

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    # ── Construction (private) ─────────────────────────────────

    def __init__(
        self,
        *,
        id: str,
        name: str,
        email: Email,
        hashed_password: HashedPassword,
        status: UserStatus,
        version: int,
        created_at: datetime,
        updated_at: datetime,
    ) -> None:
        """Private constructor — use `create()` for new instances
        or `reconstitute()` when loading from persistence."""
        self._id = id
        self._name = name
        self._email = email
        self._hashed_password = hashed_password
        self._status = status
        self._version = version
        self._created_at = created_at
        self._updated_at = updated_at
        self._events: list[DomainEvent] = []

    # ── Factory Method ─────────────────────────────────────────

    @classmethod
    def create(cls, *, name: str, raw_password: str, email: Email) -> User:
        """Factory Method — creates a new User aggregate.

        ID is generated here (Domain layer), Version starts at 0.
        Validates all business rules at creation time.
        """
        hashed = HashedPassword.from_plain(raw_password)
        now = datetime.now(UTC)

        user = cls(
            id=str(uuid.uuid7()),
            name=name,
            email=email,
            hashed_password=hashed,
            status=UserStatus(UserStatus.INACTIVE),
            version=0,  # 0 = new object, not yet persisted
            created_at=now,
            updated_at=now,
        )
        user._record_event(
            UserCreatedEvent(
                user_id=user._id,
                name=name,
                email=str(email),
                occurred_at=now,
            )
        )
        return user

    @classmethod
    def reconstitute(
        cls,
        *,
        id: str,
        name: str,
        email: Email,
        hashed_password: HashedPassword,
        status: UserStatus,
        version: int,
        created_at: datetime,
        updated_at: datetime,
    ) -> User:
        """Reconstitute an aggregate from persistence.

        No business rules are checked — the data is assumed valid.
        No events are emitted — this is not a new business action.
        """
        return cls(
            id=id,
            name=name,
            email=email,
            hashed_password=hashed_password,
            status=status,
            version=version,
            created_at=created_at,
            updated_at=updated_at,
        )

    # ── Domain Methods ─────────────────────────────────────────

    def change_password(self, old_raw: str, new_raw: str) -> None:
        """Change password. Requires active status and correct old password."""
        if self._status != UserStatus.ACTIVE:
            raise UserNotActiveError()

        if not self._hashed_password.verify(old_raw):
            raise ValueError("old password incorrect")

        self._hashed_password = HashedPassword.from_plain(new_raw)
        self._updated_at = datetime.now(UTC)
        self._record_event(
            PasswordChangedEvent(user_id=self._id, occurred_at=self._updated_at)
        )

    def activate(self) -> None:
        """Activate the user. Idempotent if already active."""
        if self._status == UserStatus.ACTIVE:
            return

        self._status = UserStatus(UserStatus.ACTIVE)
        self._updated_at = datetime.now(UTC)
        self._record_event(
            UserActivatedEvent(user_id=self._id, occurred_at=self._updated_at)
        )

    # ── Event Collection ───────────────────────────────────────

    def _record_event(self, event: DomainEvent) -> None:
        self._events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        """Drain and return all collected events. Idempotent — second call returns []."""
        events = self._events.copy()
        self._events.clear()
        return events
```

```python
# domain/repository.py
from abc import ABC, abstractmethod

from .user import User


class Repository(ABC):
    """Write repository interface for User aggregate.

    Defined in the Domain layer. Implemented in Infrastructure.
    """

    @abstractmethod
    async def get(self, user_id: str) -> User:
        """Load an aggregate by ID. Raises UserNotFoundError if not found."""
        ...

    @abstractmethod
    async def save(self, user: User) -> None:
        """Persist an aggregate. Handles create (version==0) and update (version>0).

        Raises ConcurrentModificationError on optimistic lock failure.
        After save(), the in-memory aggregate is stale — caller must re-get() if needed.
        """
        ...
```

### 3.2 Application Layer

**Role**: Orchestrate domain objects to fulfill use cases; define transaction boundaries.

> For the full specification, see [ddd-core.md §3.2](ddd-core.md).

**Contents**:
- **Command/Query**: Explicit modeling of operation intent — use `dataclass(frozen=True, slots=True)`
- **Command/Query Handler**: Concrete logic handling
- **QueryRepository Interface**: Defined in Application layer, returns DTOs, bypasses Domain model
- **DTO**: Pydantic `BaseModel` — decouples internal and external models
- **Assembler**: DTO <-> Domain object conversion

**Constraints**:
- No business rules (those belong in the Domain layer)
- Depends only on the Domain layer
- Transaction boundaries are controlled here
- **One transaction modifies one aggregate only.** To modify multiple aggregates, use domain events to trigger subsequent aggregate modifications (eventual consistency)
- Domain events are dispatched after a successful persist via `collect_events()`
- After `save()`, the in-memory aggregate is stale — reload via `get()` if further operations are needed

```python
# application/command.py
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ChangePasswordCommand:
    user_id: str
    old_password: str
    new_password: str


@dataclass(frozen=True, slots=True)
class CreateUserCommand:
    name: str
    email: str
    password: str


@dataclass(frozen=True, slots=True)
class ActivateUserCommand:
    user_id: str
```

```python
# application/query.py
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FindUserByIdQuery:
    user_id: str


@dataclass(frozen=True, slots=True)
class FindUserListQuery:
    keyword: str | None = None
    page: int = 1
    page_size: int = 20
```

```python
# application/dto.py
from datetime import datetime

from pydantic import BaseModel


class UserDetailDTO(BaseModel):
    """Read model for user detail — returned by QueryRepository."""
    model_config = {"from_attributes": True}

    id: str
    name: str
    email: str
    status: int
    created_at: datetime
    updated_at: datetime


class UserListDTO(BaseModel):
    """Read model for user list."""
    model_config = {"from_attributes": True}

    id: str
    name: str
    email: str
    status: int
```

```python
# application/query_repository.py
from abc import ABC, abstractmethod

from .dto import UserDetailDTO, UserListDTO
from .query import FindUserListQuery


class QueryRepository(ABC):
    """Read repository interface — defined in Application layer (CQRS read side).

    Returns DTOs directly. Bypasses the domain model.
    Implemented in Infrastructure.
    """

    @abstractmethod
    async def find_by_id(self, user_id: str) -> UserDetailDTO | None: ...

    @abstractmethod
    async def list(
        self, query: FindUserListQuery
    ) -> tuple[list[UserListDTO], int]: ...
```

```python
# application/handler.py
import logging

from ..domain.event import DomainEvent
from ..domain.repository import Repository
from ..domain.user import User
from ..domain.value_object import Email
from .command import ActivateUserCommand, ChangePasswordCommand, CreateUserCommand
from .dto import UserDetailDTO, UserListDTO
from .query import FindUserByIdQuery, FindUserListQuery
from .query_repository import QueryRepository

logger = logging.getLogger(__name__)


# ── Event Bus Protocol ─────────────────────────────────────────
# Defined here as a protocol so Application layer has no dependency
# on the concrete event bus implementation in shared/.

from typing import Protocol


class EventBus(Protocol):
    async def publish(self, events: list[DomainEvent]) -> None: ...


# ── Command Handlers ───────────────────────────────────────────


class CreateUserHandler:
    def __init__(self, repo: Repository, event_bus: EventBus) -> None:
        self._repo = repo
        self._event_bus = event_bus

    async def handle(self, cmd: CreateUserCommand) -> str:
        user = User.create(
            name=cmd.name,
            raw_password=cmd.password,
            email=Email(cmd.email),
        )
        await self._repo.save(user)

        # Dispatch domain events after successful persist
        await self._event_bus.publish(user.collect_events())
        return user.id


class ChangePasswordHandler:
    def __init__(self, repo: Repository, event_bus: EventBus) -> None:
        self._repo = repo
        self._event_bus = event_bus

    async def handle(self, cmd: ChangePasswordCommand) -> None:
        # 1. Load aggregate
        user = await self._repo.get(cmd.user_id)

        # 2. Execute business logic (in Domain layer)
        user.change_password(cmd.old_password, cmd.new_password)

        # 3. Persist
        await self._repo.save(user)

        # 4. Dispatch domain events after successful persist
        await self._event_bus.publish(user.collect_events())


class ActivateUserHandler:
    def __init__(self, repo: Repository, event_bus: EventBus) -> None:
        self._repo = repo
        self._event_bus = event_bus

    async def handle(self, cmd: ActivateUserCommand) -> None:
        user = await self._repo.get(cmd.user_id)
        user.activate()
        await self._repo.save(user)
        await self._event_bus.publish(user.collect_events())


# ── Query Handlers ─────────────────────────────────────────────


class FindUserByIdHandler:
    def __init__(self, query_repo: QueryRepository) -> None:
        self._query_repo = query_repo

    async def handle(self, query: FindUserByIdQuery) -> UserDetailDTO | None:
        return await self._query_repo.find_by_id(query.user_id)


class FindUserListHandler:
    def __init__(self, query_repo: QueryRepository) -> None:
        self._query_repo = query_repo

    async def handle(
        self, query: FindUserListQuery
    ) -> tuple[list[UserListDTO], int]:
        return await self._query_repo.list(query)
```

### 3.3 Adapter Layer

**Role**: Adapt external protocols (HTTP/gRPC); handle input/output transformation.

> For the full specification, see [ddd-core.md §3.3 "Adapter Layer"](ddd-core.md).

**Contents**:
- **FastAPI Router**: REST API handling
- **gRPC Servicer**: RPC service implementation (if applicable)
- **Request/Response Schemas**: Pydantic models for protocol-level validation
- **Input validation**: Basic format validation (business validation belongs in Domain)
- **Error mapping**: Domain/Infrastructure errors → HTTP status codes

**Constraints**:
- Depends only on Application and Domain layers
- No business logic
- Handles protocol details (HTTP status codes, gRPC error codes, etc.)

```python
# adapter/http.py
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..application.command import (
    ActivateUserCommand,
    ChangePasswordCommand,
    CreateUserCommand,
)
from ..application.handler import (
    ActivateUserHandler,
    ChangePasswordHandler,
    CreateUserHandler,
    FindUserByIdHandler,
    FindUserListHandler,
)
from ..application.query import FindUserByIdQuery, FindUserListQuery
from ..domain.error import (
    ConcurrentModificationError,
    DomainError,
    InvalidEmailError,
    UserNotActiveError,
    UserNotFoundError,
    WeakPasswordError,
)

router = APIRouter(prefix="/users", tags=["users"])


# ── Request / Response Schemas ─────────────────────────────────

class CreateUserRequest(BaseModel):
    name: str
    email: str
    password: str


class CreateUserResponse(BaseModel):
    id: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ── Error Mapping ──────────────────────────────────────────────

def _map_domain_error(err: DomainError) -> HTTPException:
    """Map domain errors to HTTP status codes.

    See ddd-core.md §3.3 Error Code Mapping.
    """
    match err:
        case UserNotFoundError():
            return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err))
        case InvalidEmailError() | WeakPasswordError():
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
            )
        case UserNotActiveError():
            return HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(err)
            )
        case ConcurrentModificationError():
            return HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=str(err)
            )
        case _:
            return HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="internal error"
            )


# ── Route Handlers ─────────────────────────────────────────────
# Handler instances are injected via FastAPI's dependency injection.
# See §9 "Module Assembly" for DI container wiring.


def create_routes(
    create_user: CreateUserHandler,
    change_password: ChangePasswordHandler,
    activate_user: ActivateUserHandler,
    find_user_by_id: FindUserByIdHandler,
    find_user_list: FindUserListHandler,
) -> APIRouter:
    """Wire route handlers to the FastAPI router."""

    @router.post("", status_code=status.HTTP_201_CREATED, response_model=CreateUserResponse)
    async def create_user_route(req: CreateUserRequest) -> CreateUserResponse:
        try:
            user_id = await create_user.handle(
                CreateUserCommand(name=req.name, email=req.email, password=req.password)
            )
            return CreateUserResponse(id=user_id)
        except DomainError as e:
            raise _map_domain_error(e) from e

    @router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
    async def change_password_route(user_id: str, req: ChangePasswordRequest) -> None:
        try:
            await change_password.handle(
                ChangePasswordCommand(
                    user_id=user_id,
                    old_password=req.old_password,
                    new_password=req.new_password,
                )
            )
        except DomainError as e:
            raise _map_domain_error(e) from e

    @router.post("/{user_id}/activate", status_code=status.HTTP_204_NO_CONTENT)
    async def activate_user_route(user_id: str) -> None:
        try:
            await activate_user.handle(ActivateUserCommand(user_id=user_id))
        except DomainError as e:
            raise _map_domain_error(e) from e

    @router.get("/{user_id}")
    async def find_user_route(user_id: str):
        dto = await find_user_by_id.handle(FindUserByIdQuery(user_id=user_id))
        if dto is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
        return dto

    @router.get("")
    async def list_users_route(keyword: str | None = None, page: int = 1, page_size: int = 20):
        items, total = await find_user_list.handle(
            FindUserListQuery(keyword=keyword, page=page, page_size=page_size)
        )
        return {"items": items, "total": total}

    return router
```

### 3.4 Infrastructure Layer

**Role**: Implement Domain-layer interfaces; provide technical capabilities.

> For the full specification, see [ddd-core.md §3.4](ddd-core.md).

**Contents**:
- **Repository Implementation**: Database access via SQLAlchemy async
- **ORM Model**: SQLAlchemy declarative models
- **Converter**: ORM model <-> Domain Entity conversion
- **External Client**: External service clients
- **Event Publisher**: Event publishing implementation

**Constraints**:
- Implements Repository interfaces (Domain layer) and QueryRepository interfaces (Application layer)
- No business logic
- Handles technical details (SQL, caching, retries, etc.)
- **Version is incremented by SQL** — Domain layer does not increment it

**Soft Delete**:
- **Business-driven logical deletion**: Domain has a status field (e.g., `Status = Cancelled`); `save()` internally sets `deleted_at` based on the status
- **Technical soft delete**: Domain is unaware; Infrastructure transparently manages `deleted_at`
- In both cases, `deleted_at` is an Infrastructure concern — Domain never knows about this field

> For the full soft delete specification, see [ddd-core.md §3.4 "Soft Delete"](ddd-core.md).

```python
# infrastructure/persistence/model.py
from datetime import datetime

from sqlalchemy import String, Integer, LargeBinary, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserModel(Base):
    """SQLAlchemy ORM model — maps to the `user` table."""

    __tablename__ = "user"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[bytes] = mapped_column(LargeBinary)
    password_salt: Mapped[bytes] = mapped_column(LargeBinary)
    status: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

```python
# infrastructure/persistence/converter.py
from ...domain.user import User
from ...domain.value_object import Email, HashedPassword, UserStatus
from .model import UserModel


def to_entity(model: UserModel) -> User:
    """Convert ORM model to Domain entity (reconstitute)."""
    return User.reconstitute(
        id=model.id,
        name=model.name,
        email=Email(model.email),
        hashed_password=HashedPassword(
            hash_value=model.password_hash,
            salt=model.password_salt,
        ),
        status=UserStatus(model.status),
        version=model.version,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def to_model(entity: User) -> dict:
    """Convert Domain entity to a dict for SQLAlchemy insert/update."""
    return {
        "id": entity.id,
        "name": entity.name,
        "email": str(entity.email),
        "password_hash": entity.hashed_password.hash_value,
        "password_salt": entity.hashed_password.salt,
        "status": entity.status.value,
        # version is handled by SQL, not by the converter
    }
```

```python
# infrastructure/persistence/repository.py
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ...domain.error import ConcurrentModificationError, UserNotFoundError
from ...domain.repository import Repository
from ...domain.user import User
from .converter import to_entity, to_model
from .model import UserModel


class UserRepository(Repository):
    """Write repository implementation using SQLAlchemy async."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: str) -> User:
        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.id == user_id,
                UserModel.deleted_at.is_(None),
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                raise UserNotFoundError(user_id)
            return to_entity(model)

    async def save(self, user: User) -> None:
        data = to_model(user)
        async with self._session_factory() as session:
            async with session.begin():
                if user.version == 0:
                    # New object: INSERT, version starts at 1
                    model = UserModel(**data, version=1)
                    session.add(model)
                else:
                    # Existing object: UPDATE with optimistic lock
                    stmt = (
                        update(UserModel)
                        .where(
                            UserModel.id == user.id,
                            UserModel.version == user.version,
                        )
                        .values(**data, version=user.version + 1)
                    )
                    result = await session.execute(stmt)
                    if result.rowcount == 0:
                        raise ConcurrentModificationError(user.id)
        # After save(), the in-memory user is stale — caller must re-get() if needed
```

```python
# infrastructure/persistence/query_repository.py
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ...application.dto import UserDetailDTO, UserListDTO
from ...application.query import FindUserListQuery
from ...application.query_repository import QueryRepository
from .model import UserModel


class UserQueryRepository(QueryRepository):
    """Read repository implementation — returns DTOs directly, bypasses Domain model."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def find_by_id(self, user_id: str) -> UserDetailDTO | None:
        async with self._session_factory() as session:
            stmt = select(UserModel).where(
                UserModel.id == user_id,
                UserModel.deleted_at.is_(None),
            )
            result = await session.execute(stmt)
            model = result.scalar_one_or_none()
            if model is None:
                return None
            return UserDetailDTO.model_validate(model)

    async def list(
        self, query: FindUserListQuery
    ) -> tuple[list[UserListDTO], int]:
        async with self._session_factory() as session:
            base = select(UserModel).where(UserModel.deleted_at.is_(None))
            if query.keyword:
                base = base.where(UserModel.name.contains(query.keyword))

            # Count
            count_stmt = select(func.count()).select_from(base.subquery())
            total = (await session.execute(count_stmt)).scalar_one()

            # Paginate
            offset = (query.page - 1) * query.page_size
            data_stmt = base.offset(offset).limit(query.page_size)
            result = await session.execute(data_stmt)
            items = [UserListDTO.model_validate(row) for row in result.scalars().all()]

            return items, total
```

---

## 4. DDD Tactical Design Reference

> Corresponds to [ddd-core.md §4](ddd-core.md).

| DDD Concept | Layer | Python Implementation | Notes |
|-------------|-------|----------------------|-------|
| **Aggregate** | Domain | Class with `__slots__` + domain methods + `_events` list | Aggregate root, enforces business invariants |
| **Entity** | Domain | Class with unique `id` | Unique identity, mutable via domain methods |
| **Value Object** | Domain | `@dataclass(frozen=True, slots=True)` | Equality by value, immutable |
| **Domain Service** | Domain | Stateless class or function | Cross-aggregate logic |
| **Repository** | Domain (ABC) + Infra (impl) | `ABC` + concrete class | Write repository, aggregate persistence |
| **Query Repository** | Application (ABC) + Infra (impl) | `ABC` + concrete class | Read repository, returns DTOs, bypasses Domain |
| **Domain Event** | Domain | `@dataclass(frozen=True, slots=True)` | Records significant domain occurrences |
| **Application Service** | Application | Handler classes | Coordinates aggregates/services, owns transaction boundary |
| **DTO** | Application / Adapter | Pydantic `BaseModel` | Decouples internal and external models |
| **Factory** | Domain | `@classmethod` or independent Factory class | Complex object creation logic |
| **CQRS** | Application | Command + Query separation | Command and Query responsibility segregation |

---

## 5. Cross-Context Communication

> For the full specification, see [ddd-core.md §5](ddd-core.md).

### 5.1 Direct Calls Are Prohibited

Bounded contexts must **never** directly call another context's handler or repository.

```python
# ❌ Wrong: Order context directly calls User context
class CreateOrderHandler:
    async def handle(self, cmd: CreateOrderCommand) -> None:
        # Prohibited!
        user = await self._user_query_repo.find_by_id(cmd.user_id)
        ...
```

### 5.2 Communicate via Domain Events

```python
# ✅ Correct: Decoupled via event bus

# Order context publishes event
class CreateOrderHandler:
    def __init__(self, repo: OrderRepository, event_bus: EventBus) -> None:
        self._repo = repo
        self._event_bus = event_bus

    async def handle(self, cmd: CreateOrderCommand) -> str:
        order = Order.create(user_id=cmd.user_id, items=cmd.items)
        await self._repo.save(order)
        # Dispatch events after successful persist
        await self._event_bus.publish(order.collect_events())
        return order.id


# User context subscribes to event
class UserPointsSubscriber:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def handle(self, event: OrderCompletedEvent) -> None:
        user = await self._repo.get(event.user_id)
        user.add_points(event.total_amount // 10)
        await self._repo.save(user)
```

---

## 6. Naming Conventions

> Applies Python casing conventions (snake_case for functions/variables, PascalCase for classes) to the conceptual names defined in [ddd-core.md §7](ddd-core.md).

### 6.1 General Rules

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Domain Event | `<Name>Event` | `UserCreatedEvent` |
| Command | `<Action><Target>Command` | `ChangePasswordCommand` |
| Command Handler | `<Action><Target>Handler` | `ChangePasswordHandler` |
| Query | `Find<Target>Query` | `FindUserByIdQuery` |
| Query Handler | `Find<Target>Handler` | `FindUserByIdHandler` |
| Repository Interface (write) | `Repository` | `Repository` (in `domain/repository.py`) |
| Repository Implementation | `<Aggregate>Repository` | `UserRepository` |
| Query Repository Interface (read) | `QueryRepository` | `QueryRepository` (in `application/query_repository.py`) |
| Query Repository Implementation | `<Aggregate>QueryRepository` | `UserQueryRepository` |
| ORM Model | `<Entity>Model` | `UserModel` |
| DTO | `<Purpose>DTO` | `UserDetailDTO`, `UserListDTO` |
| Value Object | Business name directly | `Email`, `HashedPassword`, `Money` |
| Domain Error | `<Description>Error` | `UserNotActiveError` |
| Domain method | `snake_case` verb phrase | `change_password()`, `activate()` |

### 6.2 File Organization

| File | Contents |
|------|----------|
| `domain/<entity>.py` | Aggregate Root + Entity |
| `domain/value_object.py` | Value Object definitions |
| `domain/event.py` | Domain event definitions |
| `domain/repository.py` | Write repository interface (ABC) |
| `domain/service.py` | Domain service |
| `domain/error.py` | Domain error classes |
| `application/command.py` | Command definitions |
| `application/query.py` | Query definitions |
| `application/query_repository.py` | Read repository interface (returns DTOs) |
| `application/handler.py` | Handler implementations |
| `application/dto.py` | DTO definitions (Pydantic models) |
| `application/assembler.py` | Object conversion |
| `adapter/http.py` | FastAPI router |
| `adapter/grpc.py` | gRPC servicer |
| `infrastructure/persistence/model.py` | SQLAlchemy ORM models |
| `infrastructure/persistence/repository.py` | Write repository implementation |
| `infrastructure/persistence/query_repository.py` | Read repository implementation |
| `infrastructure/persistence/converter.py` | ORM model <-> Entity conversion |

---

## 7. Technology Stack

| Purpose | Recommended Library | Notes |
|---------|---------------------|-------|
| Package Manager | `uv` | Fast, modern Python package manager |
| HTTP Framework | `fastapi` + `uvicorn` | Async, type-safe, OpenAPI generation |
| gRPC | `grpcio` + `grpcio-tools` + `betterproto` | If gRPC is needed |
| ORM | `sqlalchemy[asyncio]` >= 2.0 | Async support, declarative mapping |
| Async DB Driver | `asyncpg` (PostgreSQL) / `aiomysql` (MySQL) | Match your database |
| Migration | `alembic` | SQLAlchemy-native migration tool |
| Validation (Adapter) | `pydantic` >= 2.0 | Request/response schemas, DTOs |
| Configuration | `pydantic-settings` | Env-based config with type safety |
| Dependency Injection | `dependency-injector` | Explicit wiring, supports async |
| Logging | `structlog` | Structured, async-friendly logging |
| Error Context | Standard `Exception` chaining (`raise ... from e`) | No third-party needed |
| Testing | `pytest` + `pytest-asyncio` | Async test support |
| Test Containers | `testcontainers-python` | Real DB for integration tests |
| Linting & Formatting | `ruff` | All-in-one, replaces flake8 + black + isort |
| Type Checking | `mypy` (strict mode) | Static type verification |

---

## 8. Error Handling

> For the full specification, see [ddd-core.md §8](ddd-core.md).

### 8.1 Per-Layer Strategy

| Layer | Approach |
|-------|----------|
| Domain | Define error classes inheriting from `DomainError`. Raise when business rules are violated. |
| Infrastructure | Wrap technical errors with context: `raise InfraError("...") from original`. Log only at Application layer. |
| Application | Log infrastructure errors via `structlog`; propagate domain errors silently (no logging). |
| Adapter | Convert to HTTP status codes via `match` statement (see §3.3 error mapping). |

### 8.2 Error Hierarchy

```python
# shared/errors.py — Base error types shared across contexts

class DomainError(Exception):
    """Base for all domain errors. Represents business rule violations.
    Translated to 4xx at the Adapter layer. Never logged."""
    pass


class InfrastructureError(Exception):
    """Base for all infrastructure errors. Represents technical failures.
    Logged at the Application layer. Translated to 5xx at the Adapter layer."""
    pass
```

```python
# Per-context domain errors inherit from DomainError
# domain/error.py
from ...shared.errors import DomainError

class UserNotFoundError(DomainError): ...
class UserNotActiveError(DomainError): ...
class ConcurrentModificationError(DomainError): ...
```

### 8.3 Error Propagation Rules

```
Domain layer:
  Define domain error classes.
  Raise them when business rules are violated.

Infrastructure layer:
  Wrap technical errors with context (entity ID, operation name).
  Use exception chaining: `raise ... from original_error`.

Application layer:
  Infrastructure errors → log + propagate
  Domain errors        → propagate silently (no logging)

Adapter layer:
  All errors → match statement → HTTP status codes → return to caller
```

---

## 9. Module Assembly with dependency-injector

```python
# container.py — Top-level DI container
from dependency_injector import containers, providers
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from .settings import Settings
from .user.application.handler import (
    ActivateUserHandler,
    ChangePasswordHandler,
    CreateUserHandler,
    FindUserByIdHandler,
    FindUserListHandler,
)
from .user.infrastructure.persistence.repository import UserRepository
from .user.infrastructure.persistence.query_repository import UserQueryRepository
from .shared.event_bus import InMemoryEventBus


class Container(containers.DeclarativeContainer):
    config = providers.Configuration()

    # ── Shared Infrastructure ──────────────────────────────────

    db_engine = providers.Singleton(
        create_async_engine,
        url=config.database_url,
        echo=config.debug,
    )

    session_factory = providers.Singleton(
        async_sessionmaker,
        bind=db_engine,
        expire_on_commit=False,
    )

    event_bus = providers.Singleton(InMemoryEventBus)

    # ── User Context: Infrastructure ───────────────────────────

    user_repository = providers.Singleton(
        UserRepository,
        session_factory=session_factory,
    )

    user_query_repository = providers.Singleton(
        UserQueryRepository,
        session_factory=session_factory,
    )

    # ── User Context: Application (Command Handlers) ──────────

    create_user_handler = providers.Factory(
        CreateUserHandler,
        repo=user_repository,
        event_bus=event_bus,
    )

    change_password_handler = providers.Factory(
        ChangePasswordHandler,
        repo=user_repository,
        event_bus=event_bus,
    )

    activate_user_handler = providers.Factory(
        ActivateUserHandler,
        repo=user_repository,
        event_bus=event_bus,
    )

    # ── User Context: Application (Query Handlers) ────────────

    find_user_by_id_handler = providers.Factory(
        FindUserByIdHandler,
        query_repo=user_query_repository,
    )

    find_user_list_handler = providers.Factory(
        FindUserListHandler,
        query_repo=user_query_repository,
    )
```

```python
# main.py — Application entry point
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .container import Container
from .settings import Settings
from .user.adapter.http import create_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    container = app.state.container
    container.init_resources()
    yield
    # Shutdown
    engine = container.db_engine()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = Settings()
    container = Container()
    container.config.from_dict(settings.model_dump())

    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.state.container = container

    # Wire user context routes
    user_router = create_routes(
        create_user=container.create_user_handler(),
        change_password=container.change_password_handler(),
        activate_user=container.activate_user_handler(),
        find_user_by_id=container.find_user_by_id_handler(),
        find_user_list=container.find_user_list_handler(),
    )
    app.include_router(user_router, prefix="/api/v1")

    return app
```

```python
# settings.py — Configuration via pydantic-settings
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "APP_"}

    app_name: str = "my-service"
    debug: bool = False
    database_url: str = "mysql+aiomysql://user:pass@localhost:3306/mydb"
```

---

## 10. Shared Event Bus

```python
# shared/event_bus.py
import logging
from collections import defaultdict
from collections.abc import Callable, Coroutine
from typing import Any

from ..user.domain.event import DomainEvent  # Use a Protocol instead for multi-context

logger = logging.getLogger(__name__)

EventHandler = Callable[[DomainEvent], Coroutine[Any, Any, None]]


class InMemoryEventBus:
    """Simple in-memory event bus for intra-process event dispatch.

    For production cross-service scenarios, replace with an Outbox Pattern
    or message queue implementation. See ddd-core.md §6.2.
    """

    def __init__(self) -> None:
        self._handlers: dict[type[DomainEvent], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: type[DomainEvent], handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, events: list[DomainEvent]) -> None:
        for event in events:
            handlers = self._handlers.get(type(event), [])
            for handler in handlers:
                try:
                    await handler(event)
                except Exception:
                    logger.exception(
                        "Event handler failed",
                        extra={"event_type": type(event).__name__},
                    )
```

---

## 11. Testing Strategy

> For the full specification, see [ddd-core.md §9](ddd-core.md).

### 11.1 Per-Layer Approach

| Layer | Test Type | Dependencies | Tool |
|-------|-----------|--------------|------|
| **Domain** | Pure unit tests | Standard library only | `pytest` |
| **Application** | Unit tests + mocks | Mocked Repository / QueryRepository | `pytest` + `unittest.mock` |
| **Infrastructure** | Integration tests | Real database (test containers) | `pytest-asyncio` + `testcontainers` |
| **Adapter** | End-to-end tests | FastAPI test client | `httpx` + `pytest-asyncio` |

### 11.2 Domain Layer Test Example

```python
# tests/unit/user/test_domain.py
import pytest

from myproject.user.domain.error import UserNotActiveError, WeakPasswordError
from myproject.user.domain.event import PasswordChangedEvent, UserCreatedEvent
from myproject.user.domain.user import User
from myproject.user.domain.value_object import Email


class TestUserCreation:
    def test_create_user_emits_event(self) -> None:
        user = User.create(name="Alice", raw_password="strong_pass_123", email=Email("alice@example.com"))

        assert user.name == "Alice"
        assert user.version == 0

        events = user.collect_events()
        assert len(events) == 1
        assert isinstance(events[0], UserCreatedEvent)
        assert events[0].user_id == user.id

    def test_collect_events_drains_list(self) -> None:
        user = User.create(name="Alice", raw_password="strong_pass_123", email=Email("alice@example.com"))

        first = user.collect_events()
        second = user.collect_events()
        assert len(first) == 1
        assert len(second) == 0

    def test_weak_password_rejected(self) -> None:
        with pytest.raises(WeakPasswordError):
            User.create(name="Alice", raw_password="short", email=Email("alice@example.com"))


class TestChangePassword:
    def test_change_password_requires_active_status(self) -> None:
        user = User.create(name="Alice", raw_password="strong_pass_123", email=Email("alice@example.com"))
        # User is INACTIVE by default
        with pytest.raises(UserNotActiveError):
            user.change_password("strong_pass_123", "new_strong_pass_456")

    def test_change_password_emits_event(self) -> None:
        user = User.create(name="Alice", raw_password="strong_pass_123", email=Email("alice@example.com"))
        user.collect_events()  # drain creation event

        user.activate()
        user.collect_events()  # drain activation event

        user.change_password("strong_pass_123", "new_strong_pass_456")

        events = user.collect_events()
        assert len(events) == 1
        assert isinstance(events[0], PasswordChangedEvent)
```

### 11.3 Application Layer Test Example (Mocked Repository)

```python
# tests/unit/user/test_handler.py
from unittest.mock import AsyncMock

import pytest

from myproject.user.application.command import ChangePasswordCommand
from myproject.user.application.handler import ChangePasswordHandler
from myproject.user.domain.error import UserNotActiveError
from myproject.user.domain.user import User
from myproject.user.domain.value_object import Email


@pytest.fixture
def active_user() -> User:
    user = User.create(name="Alice", raw_password="old_pass_123", email=Email("alice@example.com"))
    user.activate()
    user.collect_events()  # drain
    return user


@pytest.fixture
def mock_repo(active_user: User) -> AsyncMock:
    repo = AsyncMock()
    repo.get.return_value = active_user
    return repo


@pytest.fixture
def mock_event_bus() -> AsyncMock:
    return AsyncMock()


@pytest.mark.asyncio
async def test_change_password_success(
    mock_repo: AsyncMock, mock_event_bus: AsyncMock, active_user: User
) -> None:
    handler = ChangePasswordHandler(repo=mock_repo, event_bus=mock_event_bus)

    await handler.handle(
        ChangePasswordCommand(
            user_id=active_user.id,
            old_password="old_pass_123",
            new_password="new_pass_456",
        )
    )

    mock_repo.save.assert_awaited_once()
    mock_event_bus.publish.assert_awaited_once()
```

### 11.4 Infrastructure Layer Test Example (Real Database)

```python
# tests/integration/user/test_repository.py
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from testcontainers.mysql import MySqlContainer

from myproject.user.domain.user import User
from myproject.user.domain.value_object import Email
from myproject.user.domain.error import ConcurrentModificationError
from myproject.user.infrastructure.persistence.model import Base
from myproject.user.infrastructure.persistence.repository import UserRepository


@pytest.fixture(scope="module")
def mysql_container():
    with MySqlContainer("mysql:8.0") as container:
        yield container


@pytest.fixture
async def session_factory(mysql_container):
    url = mysql_container.get_connection_url().replace("pymysql", "aiomysql")
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest.fixture
def repo(session_factory) -> UserRepository:
    return UserRepository(session_factory=session_factory)


@pytest.mark.asyncio
async def test_save_and_get(repo: UserRepository) -> None:
    user = User.create(name="Alice", raw_password="strong_pass_123", email=Email("alice@example.com"))

    await repo.save(user)

    loaded = await repo.get(user.id)
    assert loaded.id == user.id
    assert loaded.name == "Alice"
    assert loaded.version == 1  # version incremented by infrastructure


@pytest.mark.asyncio
async def test_optimistic_locking(repo: UserRepository) -> None:
    user = User.create(name="Bob", raw_password="strong_pass_123", email=Email("bob@example.com"))
    await repo.save(user)

    user1 = await repo.get(user.id)
    user2 = await repo.get(user.id)

    user1.activate()
    await repo.save(user1)

    user2.activate()
    with pytest.raises(ConcurrentModificationError):
        await repo.save(user2)
```

---

## 12. Python Coding Conventions

### 12.1 Type Annotations

- **All** function signatures must have complete type annotations (parameters and return type)
- Use Python 3.12+ syntax: `list[str]` instead of `List[str]`, `str | None` instead of `Optional[str]`
- Use `from __future__ import annotations` only when required for forward references in older patterns
- Run `mypy --strict` in CI

```python
# ✅ Correct
async def get(self, user_id: str) -> User: ...
def find(self, keyword: str | None = None) -> list[UserDTO]: ...

# ❌ Wrong
async def get(self, user_id): ...           # missing annotations
def find(self, keyword: Optional[str]): ...  # use str | None
```

### 12.2 Immutability Conventions

| Concept | Implementation |
|---------|----------------|
| Value Object | `@dataclass(frozen=True, slots=True)` |
| Command / Query | `@dataclass(frozen=True, slots=True)` |
| Domain Event | `@dataclass(frozen=True, slots=True)` |
| DTO | Pydantic `BaseModel` (immutable by default via `model_config`) |
| Entity / Aggregate | Mutable class with `__slots__`, state changes through domain methods only |

### 12.3 Async/Await

- All I/O-bound operations (database, HTTP, message queue) must be `async`
- Domain layer methods are **synchronous** (pure business logic, no I/O)
- Repository interfaces declare `async` methods
- Handlers are `async` (they call async repositories)

```python
# Domain: synchronous (no I/O)
def change_password(self, old_raw: str, new_raw: str) -> None: ...

# Application: async (calls async repository)
async def handle(self, cmd: ChangePasswordCommand) -> None: ...

# Infrastructure: async (database I/O)
async def save(self, user: User) -> None: ...
```

### 12.4 Import Order (enforced by Ruff)

```python
# 1. Standard library
import logging
from datetime import datetime, UTC

# 2. Third-party
from fastapi import APIRouter
from sqlalchemy import select

# 3. Local application
from .domain.user import User
from .application.handler import CreateUserHandler
```

### 12.5 Ruff Configuration

```toml
# pyproject.toml
[tool.ruff]
target-version = "py312"
line-length = 120

[tool.ruff.lint]
select = [
    "E",     # pycodestyle errors
    "W",     # pycodestyle warnings
    "F",     # pyflakes
    "I",     # isort
    "N",     # pep8-naming
    "UP",    # pyupgrade
    "B",     # flake8-bugbear
    "A",     # flake8-builtins
    "SIM",   # flake8-simplify
    "TCH",   # flake8-type-checking
    "RUF",   # Ruff-specific rules
]

[tool.ruff.lint.isort]
known-first-party = ["myproject"]

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
```

### 12.6 Project Metadata

```toml
# pyproject.toml
[project]
name = "myproject"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "sqlalchemy[asyncio]>=2.0",
    "aiomysql>=0.2",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "dependency-injector>=4.42",
    "structlog>=24.0",
    "alembic>=1.14",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "testcontainers[mysql]>=4.0",
    "httpx>=0.27",
    "ruff>=0.8",
    "mypy>=1.13",
]
```

---

## 13. Key Principles Summary

> These are the Python-specific implementations of the principles defined in [ddd-core.md §10](ddd-core.md).

1. **Domain layer has zero dependencies** — only Python standard library; no `import` of SQLAlchemy, FastAPI, Pydantic, or any third-party package
2. **Vertical slicing** — organize by bounded context, not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces (`ABC`); Application defines read QueryRepository interfaces (`ABC`); Infrastructure implements both
4. **Aggregate boundary** — Repository operates on aggregate roots only, not child entities
5. **State encapsulation** — all state changes go through domain methods; use `__slots__` and `@property` to prevent external mutation
6. **ID generation in Domain** — use `uuid.uuid7()` (Python 3.12+); database auto-increment IDs are prohibited
7. **Event-driven cross-context communication** — via domain events; direct calls prohibited; Rich Event style (ID + minimum necessary fields)
8. **Event collection** — aggregates collect events in `_events` list; Application calls `collect_events()` after successful `save()` to drain and dispatch
9. **CQRS** — Commands go through the Domain model; Queries go through QueryRepository directly to the DB and return Pydantic DTOs
10. **Transaction boundary** — one Command Handler owns one transaction; one transaction modifies one aggregate only
11. **Repository collection semantics** — `save()` covers create, update, and state-driven soft delete; never split by SQL operation type
12. **Soft delete** — business-driven deletion is modeled as Domain state; `deleted_at` is always an Infrastructure concern
13. **Optimistic locking** — Infrastructure increments `version` via SQL; Domain holds `version` as a read-only token; always reload after `save()`
14. **Event dispatch timing** — dispatch after successful persist, never before
15. **Type safety** — full type annotations, `mypy --strict`, Pydantic validation at boundaries
16. **Async I/O** — all infrastructure operations are `async`; domain methods remain synchronous

---

**References:**
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
