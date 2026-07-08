---
name: ddd-python
description: Python implementation guide for DDD + Clean Architecture. Use when a phase skill needs Python backend services with aggregates, repositories, domain events, CQRS, module assembly, dependency-injector wiring, or Python package boundaries.
---

# Python Web System Architecture Guide
## DDD + Clean Architecture — Python Implementation

**Version**: v2.4
**Date**: 2026-05-21
**Scope**: Team backend service architecture standard
**Phase routing**:
- **Phase skill**: Start from [`domain-modeling`](../skills/domain-modeling/SKILL.md), [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), or [`review`](../skills/review/SKILL.md). Load this file only when the active phase needs Python-specific DDD placement, package, naming, testing, or module-assembly rules.
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) — Load when the phase needs task classification, stop protocol, prohibited actions, or completion self-checks.
- **Domain modeling rule cards**: [`ddd-modeling.md`](ddd-modeling.md) — Load only when the phase routes to bounded-context, aggregate, Architecture Gate, technical-capability, or port-granularity decisions.
- **Architecture rule cards**: [`ddd-core.md`](ddd-core.md) — Load only when the phase routes to layer ownership, dependency direction, Domain Events / Integration Messages, CQRS, cross-context contracts, or review checklist rules.
- This document is the Python implementation guide layered on accepted Domain Modeling Brief / design decisions and the rule cards above.
**Python Version**: 3.12+

> **Cross-reference convention**: major architecture sections align with the corresponding `ddd-core.md` sections where applicable. This guide adds Python-specific workflow, placement, event/message, testing, and module-assembly guidance.

> **Code blocks in this guide are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

---

## 0. Python DDD Planning Workflow

When the active phase needs Python-specific planning detail, apply the gates defined in [ddd-modeling.md §7](ddd-modeling.md). For each gate level, the plan/spec must additionally state these **Python-specific** items.

Every Python backend plan must also include the `Architecture Gate` block from [ddd-modeling.md §0](ddd-modeling.md). For technical-facing packages, explicitly classify the capability before choosing between `domain`, `application`, `interfaces`, `infrastructure`, `shared`, or a distributable package.

### Level 1 (Local Change)

Plan must additionally state:

- the Python module being changed (e.g., `src/<project>/user/domain/`)
- why the module path matches the bounded context and layer responsibility
- whether tests live alongside the module or in a separate `tests/` tree (§11)

### Level 2 (New Use Case)

Plan must additionally state:

- file placement under the bounded context (`command.py`, `query.py`, `subscriber.py`, `query_repository.py` — see §6.2)
- new Pydantic DTOs and assemblers required (§3.2)
- import-boundary impact: generated stubs, FastAPI, SQLAlchemy, broker clients, and framework imports stay out of Domain
- mock or protocol requirements for Application-layer tests (§11)
- dependency-injector container wiring changes (§9)

### Level 3 (New Bounded Context or Aggregate)

Spec must additionally state:

- planned package layout under `src/<project>/<context>/` (§2.2)
- shared object placement decisions (§2.3) — what stays in the owning context, what goes in `shared/`, what goes in generated/shared contract packages, and what belongs in a separate distributable package
- shared infrastructure provider ownership (DB session factory, event bus, cache client — see §9)

### Cross-Context Change Without a New Context

Follow the multi-side planning rule in [ddd-modeling.md §7.4](ddd-modeling.md). The Python-side plan must list:

- producing context's Application handler / event publisher path
- consuming context's `subscriber.py` and its idempotency strategy
- generated / shared contract package updates if a new protocol contract or Integration Message payload is introduced

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
                    │      Interface Layer                │
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
                    │        Domain Layer ◄───────────────┼── Core. No implementation deps.
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

- Interface Layer depends on Application and Domain layers
- Application Layer depends only on Domain Layer
- Domain Layer has no concrete implementation dependencies (no `import` of SQLAlchemy, FastAPI, HTTP clients, message queue clients, or generated protocol packages). Pydantic, when used inside Domain, must be confined to internal validation helpers — its tags must not become a public contract; standard library, `uuid`, `dataclasses`, and similar implementation-independent libraries are allowed
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
│       │   ├── interfaces/             # Interface layer
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
├── domain/                            # Domain layer - pure business logic, no implementation deps
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
├── interfaces/                        # Interface layer - adapts external protocols
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

### 2.3 Shared Object Placement

When a Python type is needed by multiple bounded contexts, first decide what it represents:

1. **Domain concept owned by one bounded context**: keep it in the owning context. Other contexts must not import it directly; exchange through Integration Messages, cross-context query facades, ACL, or protocol contracts (see §5).
2. **Cross-context / cross-service data contract**: define it in `proto/`, OpenAPI, JSON Schema, or another contract-first source and consume generated bindings from a contracts package. Keep derivation rules in the owning context.
3. **Shared technical capability**: place it in `src/<project>/shared/<capability>/` when it adapts databases, message brokers, HTTP clients, telemetry, clocks, IDs, transactions, or other implementation mechanisms.
4. **General-purpose library intended for external reuse**: only then place it in a separate distributable package.

Do not use `shared/` as a dumping ground for internal business DTOs, read models, constants, or domain concepts. If a type carries business meaning, name its owner before moving it.

Generated stubs and Pydantic DTOs are boundary shapes, not Domain entities. Domain methods, Value Objects, Repository interfaces, and Domain Events use Domain-owned types; generated/protocol DTOs are mapped at Application, Interface, or Infrastructure boundaries.

### 2.4 Python Boundary Checklist

Use this checklist before accepting a package layout or import graph:

- A package path ending in `/domain` contains only domain concepts: aggregates, entities, value objects, domain services, write repository ABCs, domain events, and domain errors.
- Domain packages do not import FastAPI, Starlette, SQLAlchemy, Alembic, generated stubs, broker/cache clients, `shared/` adapters, `infrastructure/`, or another bounded context's Domain package.
- Application packages may import Domain and protocol/generated DTO packages when they implement service stubs or map boundary DTOs, but they must not import concrete storage, queue, cache, or network clients.
- Infrastructure packages may import Domain/Application interfaces they implement, generated/protocol packages, and external clients.
- `shared/<capability>` is only for shared technical adapters. It must not import bounded-context packages or own business/domain rules.
- A generated type in a method signature is boundary evidence, not layer-ownership evidence. If the method represents a Domain capability, keep the ABC in `domain/` with Domain types and map at the boundary.
- Package names and module names must agree with the bounded context and layer they represent. A `dispatcher`, `registry`, `router`, `scheduler`, or `connector` module must still declare whether it is Domain-facing policy, Application orchestration, or Infrastructure adapter.

### 2.5 Technical Coordination Placement

Technical coordination code often exposes domain rules indirectly. Place it by rule ownership, not by mechanism:

| Example | Place the rule | Place the mechanism |
|---------|----------------|---------------------|
| Connection registration with naming, ownership, admission, or lifecycle rules | `src/<project>/<context>/domain` as a policy, service, value object, or aggregate behavior | Storage/lease/CAS implementation in `infrastructure/` or `shared/` |
| Dispatch routing with semantic destinations, priorities, or retry eligibility | Domain policy when destinations, priorities, or retry rules are stable language and testable without a queue; Application orchestration when it merely selects among Domain-defined ports | Queue/client/server adapter in Infrastructure |
| Scheduler with business-visible states or deadlines | Domain state/policy plus Application orchestration | Timer, worker, lock backend, or APScheduler/Celery adapter in Infrastructure |
| Observability or audit derivation with business meaning | Domain event or Domain-facing projection rule | Telemetry/export backend in Infrastructure |

If the rule can be unit-tested without SQLAlchemy, Redis, a queue, FastAPI, or generated protocol types, keep that rule inward and adapt the mechanism outward.

### 2.6 Mechanized Review Checks

These checks operationalize the P1-P4 self-checks in [ddd-agent-contract.md §5.1](ddd-agent-contract.md). Treat the shell commands below as local smoke checks unless they are replaced by AST-aware Ruff/custom rules; they surface review targets, not architectural proof.

**P1 — Port eligibility: suspicious naming smoke scan**

Python ports are typically `Protocol`, `ABC` subclass, or `abc.ABCMeta`-using classes. Scan the abstract-class declarations:

```bash
rg -n --type py \
  '^class [A-Z][A-Za-z]+(Policy|Specification|Allocator|Generator|Resolver|Finalizer|Terminator|Closer|Calculator|Scorer|Pricer|Decider|Authorizer|Validator|Sink|Hook|Observer)\b.*(Protocol|ABC|ABCMeta)' \
  src/*/application/ src/*/domain/
```

Hits require a written placement answer in the Architecture Gate's `Domain mechanism placement before Application ports` field. The answer must say whether the need belongs to an Aggregate, Domain Repository, Domain Service, Domain Event handler, Integration Message, ACL, Infrastructure adapter, QueryRepository/read facade, or a return-to-modeling Application command-side port decision. The Python-idiomatic Domain Service form is a `@dataclass(frozen=True)` or plain class in `<context>/domain/service.py` whose methods take aggregates / value objects and return decisions.

```bash
rg -n --type py \
  '^class [A-Z][A-Za-z]+(Client|Directory|Router|Forwarder)\b.*(Protocol|ABC|ABCMeta)' \
  src/*/application/ src/*/domain/
```

Strong review signal in Application/Domain. Move mechanism-shaped names to `<context>/infrastructure/`, re-shape cross-context calls as ACL/read facades, or document why the word is part of the ubiquitous language and excludes routing/topology details.

**Audit-only R3 — Domain mechanism parity smoke scan (Level 3 or periodic review)**

```bash
for ctx in src/*/; do
  [ -d "${ctx}application" ] || continue
  app_ports=$(rg -c --type py '^class [A-Z][A-Za-z]+\b.*(Protocol|ABC)' "${ctx}application" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  domain_svc=$( [ -f "${ctx}domain/service.py" ] && echo 1 || echo 0 )
  domain_events=$(rg -c --type py 'class [A-Z][A-Za-z]+Event\b' "${ctx}domain" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
  if [ "${app_ports:-0}" -gt 5 ] && [ "$domain_svc" -eq 0 ] && [ "${domain_events:-0}" -eq 0 ]; then
    echo "WARN: ${ctx} has ${app_ports} application ports, no domain/service.py, and no domain events"
  fi
done
```

A warning here triggers audit-only R3: list the BC's command-side Application ports, Domain Repositories, Domain Services, Domain Events, Integration Messages, and Saga/Process Managers. Add a missing mechanism only when the domain need exists; do not add a service/event merely to satisfy a ratio.

**P2 — Handler pressure**

Count constructor parameters typed as `Protocol` / `ABC` on each Command Handler class:

```bash
rg -n --type py '^class [A-Z][A-Za-z]+CommandHandler\b' src/*/application/command/
```

Manually open hits with ≥4 typed dependencies and apply [`ddd-core.md §3.2`](ddd-core.md) "Command Handler Port-Pressure Heuristic". A Ruff custom rule (`ruff_pylint` or a per-project plugin) can mechanize this by counting `__init__` parameters whose annotations are `Protocol` subclasses.

**P3 — Read-side DTO check**

```bash
rg -n --type py \
  'def [a-z_]+\(.*\) -> (list\[)?[A-Z][A-Za-z]*\b' \
  src/*/application/query/ src/*/application/*read*.py 2>/dev/null \
  | rg '-> (list\[)?(domain|.*\.domain)\.'
```

Any reader/query method annotated `-> domain.X` or `-> list[domain.X]` from Application is rejected; return a DTO (`Pydantic` model, `@dataclass(frozen=True)`, or `TypedDict`) defined in `application/query/dto.py`.

**P4 — Event/message extraction (manual)**

When two or more handlers/subscribers react to the same same-BC state change, collapse the reaction behind one Domain Event and one same-BC handler. When the fact crosses a bounded-context boundary, publish an Integration Message instead of subscribing to another context's Domain Event. Long-running lifecycle coordination conflict returns to modeling; accepted coordination belongs in a Saga/Process Manager or compensating flow, not in a cluster of command-side Application ports.

**P1 semantic fake sub-check (manual)**

For every new inward `Protocol` or `ABC` introduced, write a `_Fake<Port>` or `_InMemory<Port>` test double whose backing state is a `dict`, `list`, or `dataclass` and that preserves the observable contract. If business/use-case tests can pass against it, continue the placement gate; this still does not automatically justify an Application command-side port. If the only meaningful fake is "pretend the external side effect succeeded", hide that implementation behind a Repository, QueryRepository, Saga/Process Manager, ACL, event/message publisher, or Infrastructure implementation ([modeling §0.1.1](ddd-modeling.md)).

**Ruff / lint wiring**

P1 naming and P3 DTO checks can be encoded as per-project Ruff custom rules or as `pytest` collection-time assertions; keep the shell forms as smoke checks. Audit-only R3 is best run nightly or on Level 3 changes as a structural smell check. P2 handler pressure, P4 event/message extraction, and the P1 semantic fake sub-check remain review-time prose checks captured in the PR description.

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
- No concrete implementation dependencies (no `import` of SQLAlchemy, Alembic, FastAPI, Starlette, HTTP clients, message queue clients, cache clients, generated protocol packages, `shared/` adapters, `infrastructure/`, or another bounded context's Domain package)
- Implementation-independent libraries (Python standard library, `uuid`, `dataclasses`, `typing`, Pydantic when used as an internal validation helper) are allowed; they must not couple Domain to a specific external system
- Must not depend on other bounded contexts' domain layers (communicate via events / queries / ACL / protocol contracts — see §5)
- All state changes go through domain methods — direct attribute mutation from outside is prohibited
- **No anemic aggregates.** An Aggregate Root that is a Pydantic `BaseModel` / dataclass with public attributes and no behavior, while the rules live in `application/handler.py`, is prohibited. Every state transition is a method on the Aggregate Root (or Value Object). Use `__slots__` + leading-underscore fields + `@property` for read access; mutation only via named domain methods (`change_password`, `activate`, …)
- **Version is a read-only concurrency token** — Domain does not increment Version; Infrastructure increments it via SQL
- **IDs are generated in the Domain layer** (inside Factory Methods) using a time-sortable identifier — database auto-increment IDs are prohibited. On Python 3.12 / 3.13 use a third-party UUIDv7 / ULID library (e.g., `uuid7`, `python-ulid`) or fall back to `uuid.uuid4()`; on Python 3.14+ use the stdlib `uuid.uuid7()`

**Factory Design**:
- Simple cases: use the Aggregate Root's own class method (`User.create(...)`)
- Complex cases (assembling multiple Value Objects, cross-entity validation): extract an independent Domain Factory class within the domain package

**Domain Event Collection**:
- Aggregate Root holds a `_events: list[DomainEvent]` internal list
- Domain methods append events via `_record_event(event)` — they never dispatch directly
- Application layer is the sole drainer. After a successful `save()` returns, Application calls `collect_events()` exactly once and dispatches the returned events. Repository must not drain.
- `collect_events()` returns the event list and clears it — calling it twice in a row returns an empty list on the second call. After `save()` succeeds, the in-memory aggregate is stale; if the use case needs further mutations, reload via `get()` first.
- Domain Events are bounded-context-internal facts. Cross-context state propagation uses Integration Messages through an explicit port/adapter (see §5.2), not direct subscription to another context's Domain Events.

> This is the Python implementation of the language-agnostic event collection pattern described in [ddd-core.md §3.1 "Domain Event Collection"](ddd-core.md).

**Validation Contract** — implements [ddd-core.md §3.1 "Validation Contract"](ddd-core.md). Python-specific notes:

- `def validate(self) -> None: ...` (raising `DomainError` subclasses) is the canonical method signature
- Inside `validate()`, you may use Pydantic models for declarative field rules, hand-written checks, or a mix. Pydantic models used as Domain helpers must stay **inside** `validate()` — the Aggregate Root / Entity must not itself be a `BaseModel`, and external layers must never call `Model.model_validate(domain_obj.__dict__)` to validate a Domain object
- Use explicit code for cross-field rules, state transitions, and invariants that cannot be expressed cleanly with Pydantic field validators

**Domain Rules in Technical Capabilities** — see [ddd-core.md §3.1 "Domain Rules in Technical Capabilities"](ddd-core.md). The rule applies to Python projects exactly as written.

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
            # ID generator: stdlib uuid.uuid7() on 3.14+; on 3.12/3.13 use a third-party
            # UUIDv7/ULID library (e.g. `uuid7`, `python-ulid`) or fall back to uuid.uuid4().
            id=str(uuid.uuid4()),
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

> For the full specification, see [ddd-core.md §3.1, §3.2](ddd-core.md).

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
- **Default transaction boundary: one transaction modifies one aggregate only.** To coordinate other lifecycle owners, prefer Domain Events / Integration Messages, a Saga / Process Manager, or compensating actions. If a same transaction appears to write several aggregate candidates, return to `domain-modeling`; do not implement one merely because SQLAlchemy session APIs, semantic repository transaction, lifecycle transaction, or cross-table transaction look convenient. If the accepted aggregate is clear but Repository API shape, CQRS split, or adapter mapping is wrong, return to `design`.
- Application is the sole drainer of Domain Events: after a successful `save()` it calls `collect_events()` exactly once. Repository never drains.
- Domain events are dispatched after a successful persist via `collect_events()`. Dispatch/publish admission failure after persistence does not imply persistence rollback; choose the explicit error policy from [ddd-core.md §5.3](ddd-core.md).
- After `save()`, the in-memory aggregate is stale — reload via `get()` if further operations are needed
- **File organization**: start with flat files (`command.py`, `query.py`, `handler.py`); when handlers grow numerous, promote to sub-packages (`command/`, `query/`, `handler/`, one file per handler). A context module/container remains the single entry point that wires them.

**Domain Event Handler Contract**:
- Lives in the **same bounded context** as the Domain Event producer, usually in the Application layer
- Handles repeated same-BC reactions to a domain fact after the aggregate is saved and events are drained
- Each handler owns its own transaction; failures do not roll back the producing command
- Error handling: log and continue, retry, or route to adapter-specific failure handling; never propagate handler execution errors back to the Domain Event producer
- Write handlers so repeated execution is harmless when practical: prefer set/update operations, deterministic business keys, and guards on externally visible side effects

**Integration Message Subscriber Contract**:
- Lives in the consuming bounded context's Application layer
- Handles stable cross-context Integration Message payloads, never another context's internal Domain Event type
- Owns idempotency and transaction boundaries for the consuming context

**Query Handler: When the Class Is Optional**:

For trivial reads, skip a dedicated `FindXxxHandler` class and let the Interface/Application entry point call `QueryRepository` directly. Keep an explicit Query Handler when the read path composes multiple calls, decodes cursors, filters/masks data, authorizes read-specific behavior, or applies a named cache/read policy.

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

### 3.3 Interface Layer

**Role**: Adapt external protocols (HTTP/gRPC); handle input/output transformation.

> For the full specification, see [ddd-core.md §3.3 "Interface Layer"](ddd-core.md).

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
# interfaces/http.py
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
- `save()` is the single method covering create, update, and state-driven soft delete; do not split Repository ports into `insert()` / `update()` / `delete()` based on SQL operation. `version == 0` means insert; `version > 0` means version-guarded update. The repository implementation determines the SQL operation internally based on aggregate state.
- Adding a technical client (`redis-py`, `aiocache`, `httpx`, an MQ SDK) does not justify a new ABC in `domain/` or `application/`. If Redis only accelerates a SQLAlchemy-backed repository, compose it inside `infrastructure/persistence/`; do not introduce a separate `Cacher` ABC. Define a new ABC only for a named use-case capability (distributed lock, lease ownership, explicit cache invalidation, rate limiting, event publication)
- Infrastructure implements technical mechanisms for Domain rules, but it must not be the only place where those rules are expressed
- Shared clients/session factories are initialized in `shared/` or composition-root providers; bounded-context Infrastructure receives initialized clients and does not read global config or open shared connections unless it owns that adapter

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
| **Application Service** (Command/Query Handler) | Application | Handler classes (`<Action><Target>Handler` for commands, `Find<Target>Handler` for queries) | Coordinates aggregates/services, owns transaction boundary |
| **DTO** | Application / Interface | Pydantic `BaseModel` | Decouples internal and external models |
| **Factory** | Domain | `@classmethod` or independent Factory class | Complex object creation logic |
| **CQRS** | Application | Command + Query separation | Command and Query responsibility segregation |

---

## 5. Cross-Context Communication

> For the full specification (four legitimate mechanisms, payload rules, ACL), see [ddd-core.md §5](ddd-core.md). This section shows the Python forms.

### 5.1 Direct Domain Coupling Is Prohibited

Bounded contexts must not import another context's Domain model or call its Application Service / Domain Service / Repository directly:

```python
# ❌ Wrong: Order context imports User's Domain model
from src.modules.user.domain.user import User

class CreateOrderHandler:
    async def handle(self, cmd: CreateOrderCommand) -> User:
        # Prohibited — Order is now coupled to User's Domain shape
        ...
```

Cross-context queries through a **port the owning context explicitly publishes** **are** allowed (see [ddd-core.md §5.5](ddd-core.md)). The port is a small read-side facade that returns DTOs — *not* the User context's internal `UserQueryRepository` (which is a CQRS read-side concern within the User context itself):

```python
# src/modules/user/api/reader.py — published facade exported by the User context
from typing import Protocol
from pydantic import BaseModel


class UserSummary(BaseModel):
    id: str
    name: str
    is_active: bool


class UserReader(Protocol):
    """Read-side facade for other bounded contexts.

    Exposes only fields other contexts are allowed to depend on.
    Implementation lives in the User context's application/ or infrastructure/ layer
    and may delegate to the internal QueryRepository — but consumers depend on this
    port, never on the internal QueryRepository class directly.
    """

    async def find_summary(self, user_id: str) -> UserSummary | None: ...


# src/modules/order/application/handler.py — Order context depends on the port
class CreateOrderHandler:
    def __init__(
        self,
        repo: OrderRepository,
        users: UserReader,   # ← published facade, not User's internal QueryRepository
        event_bus: EventBus,
    ) -> None:
        self._repo = repo
        self._users = users
        self._event_bus = event_bus

    async def handle(self, cmd: CreateOrderCommand) -> str:
        snapshot = await self._users.find_summary(cmd.user_id)
        if snapshot is None or not snapshot.is_active:
            raise UserNotFoundError(cmd.user_id)
        ...
```

### 5.2 Communicate via Integration Messages (default for cross-context state propagation)

Integration Messages are cross-context semantic contracts. The default lifecycle follows [ddd-core.md §5.3](ddd-core.md): a Domain method records Domain Events inside the producing bounded context; the Application command handler saves the aggregate and drains those Domain Events; a same-context boundary translator / publisher selects publishable facts and maps them to Integration Message payloads; the publish port submits the message to the selected adapter. Adapter success means the adapter accepted the message according to its own semantics, not that any consumer has handled it.

Keep concept, contract, port, and delivery mechanism separate:

- **Concept**: the cross-context fact another bounded context may depend on.
- **Contract**: the stable payload schema, message kind/name, versioning, and compatibility rules.
- **Port**: the implementation-independent publish / subscribe API exposed to Application code.
- **Mechanism**: broker, queue, retry, DLQ, ordering, and other adapter-specific delivery concerns.

```python
# Order context persists the aggregate and dispatches internal Domain Events.
class CreateOrderHandler:
    def __init__(self, repo: OrderRepository, event_bus: EventBus) -> None:
        self._repo = repo
        self._event_bus = event_bus

    async def handle(self, cmd: CreateOrderCommand) -> str:
        order = Order.create(user_id=cmd.user_id, items=cmd.items)
        await self._repo.save(order)
        await self._event_bus.publish(order.collect_events())
        return order.id


# Same Order context: boundary translator publishes selected facts as Integration Messages.
class OrderCreatedPublisher:
    def __init__(self, publisher: MessagePublisher) -> None:
        self._publisher = publisher

    async def handle(self, event: OrderCreatedEvent) -> None:
        msg = OrderCreatedMessage(
            order_id=event.order_id,
            user_id=event.user_id,
            total_amount=event.total_amount,
            occurred_at=event.occurred_at,
        )
        await self._publisher.publish(msg)


# User context subscribes to the Integration Message
class UserPointsSubscriber:
    def __init__(self, repo: UserRepository) -> None:
        self._repo = repo

    async def handle(self, msg: OrderCreatedMessage) -> None:
        user = await self._repo.get(msg.user_id)
        user.add_points(msg.total_amount // 10)
        await self._repo.save(user)
```

Publication failures follow [ddd-core.md §5.3](ddd-core.md)'s policy table: ordinary notifications may log and keep the original command successful, command-visible publication should return the publish-port error explicitly, and pre-publish loss intolerance requires an explicit reliability design rather than a technology-shaped port.

### 5.3 ACL and Protocol Contracts

For external/legacy integrations use an Anti-Corruption Layer ([ddd-core.md §5.6](ddd-core.md)); for cross-service structured contracts use Protobuf / OpenAPI generated code ([ddd-core.md §5.7](ddd-core.md)). Python bindings live under `shared/` or a dedicated `packages/contracts/`-style location; Domain layers must not import generated types directly.

Generated stubs are DTOs / contracts, not Domain entities. Do not place a port in `application/` just because its request/response are generated proto/OpenAPI types — decide port ownership from the semantic capability ([ddd-modeling.md §0.2](ddd-modeling.md)). When the capability is Domain-facing, keep the ABC in `domain/` with Domain-typed signatures and map `Proto ↔ Domain` in `application/` (handler or assembler module) or in an Infrastructure inbound adapter.

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
| `interfaces/http.py` | FastAPI router |
| `interfaces/grpc.py` | gRPC servicer |
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
| Validation (Interface) | `pydantic` >= 2.0 | Request/response schemas, DTOs |
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
| Interface | Convert to HTTP status codes via `match` statement (see §3.3 error mapping). |

### 8.2 Error Hierarchy

```python
# shared/errors.py — Base error types shared across contexts

class DomainError(Exception):
    """Base for all domain errors. Represents business rule violations.
    Translated to 4xx at the Interface layer. Never logged."""
    pass


class InfrastructureError(Exception):
    """Base for all infrastructure errors. Represents technical failures.
    Logged at the Application layer. Translated to 5xx at the Interface layer."""
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

Interface layer:
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
from .user.interfaces.http import create_routes


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

    Domain Events stay inside one bounded context. Cross-context facts are
    Integration Messages published through an explicit port / adapter; see
    ddd-core.md §5.3 and §6.2.
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
| **Domain** | Pure unit tests | Language runtime + the same implementation-independent libraries Domain depends on (see §3.1 Constraints) | `pytest` |
| **Application** | Unit tests + mocks | Mocked Repository / QueryRepository | `pytest` + `unittest.mock` |
| **Infrastructure** | Integration tests | Real database (test containers) | `pytest-asyncio` + `testcontainers` |
| **Interface** | End-to-end tests | FastAPI test client | `httpx` + `pytest-asyncio` |

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

> These are the Python-specific implementations of the principles summarized in [ddd-core.md §10](ddd-core.md). For review workflow and layer baseline, see [`../skills/review/SKILL.md`](../skills/review/SKILL.md).

1. **Domain layer has no concrete implementation dependencies** — no `import` of SQLAlchemy, FastAPI, HTTP/MQ clients, or generated protocol packages; standard library, `uuid`, `dataclasses`, and Pydantic-as-internal-validation-helper are allowed when they don't couple Domain to an external system
2. **Vertical slicing** — organize by bounded context, not by technical layer
3. **Dependency inversion** — Domain defines write Repository interfaces (`ABC`); Application defines product/application read QueryRepository interfaces (`ABC`) after capability classification; Infrastructure implements both
4. **Port granularity** — define ports by caller semantics, not implementation technology; cache/database/queue clients stay inside Infrastructure unless they are a named use-case capability ([ddd-modeling.md §0.2](ddd-modeling.md))
5. **Aggregate boundary** — Repository operates on aggregate roots only, not child entities
6. **State encapsulation** — all state changes go through domain methods; use `__slots__` and `@property` to prevent external mutation
7. **ID generation in Domain** — use a time-sortable identifier (stdlib `uuid.uuid7()` on Python 3.14+; third-party UUIDv7 / ULID library or `uuid.uuid4()` on 3.12 / 3.13); database auto-increment IDs are prohibited
8. **Disciplined cross-context communication** — Integration Messages (default for cross-context state propagation), cross-context queries (read-only DTOs through a published facade port, never another context's internal `QueryRepository`), ACL, or protocol contracts; direct imports of another context's Domain model are prohibited; Integration Message payloads carry the ID plus minimum necessary facts
9. **Event collection** — aggregates collect events in `_events` list; Application calls `collect_events()` after successful `save()` to drain and dispatch
10. **CQRS** — Commands go through the Domain model; product/application Queries go through product-read QueryRepository/reader ports and return Pydantic DTOs. Default to adding query methods to the existing QueryRepository for the same bounded-context read-model family; split only for distinct read-model/runtime semantics. Routing/topology lookup is not a CQRS query port
11. **Transaction boundary** — one Command Handler owns one transaction; one transaction modifies one aggregate only
12. **Repository collection semantics** — `save()` covers create, update, and state-driven soft delete; never split by SQL operation type
13. **Soft delete** — business-driven deletion is modeled as Domain state; `deleted_at` is always an Infrastructure concern
14. **Optimistic locking** — Infrastructure increments `version` via SQL; Domain holds `version` as a read-only token; always reload after `save()`
15. **Event dispatch timing** — dispatch after successful persist, never before
16. **Event reliability** — Domain Event delivery is bounded-context-internal and implementation-specific; cross-context Integration Messages default to adapter delivery semantics plus consumer-side idempotency, with explicit reliability design only when pre-publish loss is unacceptable
17. **Technical capability classification** — classify dispatchers, registries, schedulers, routers, projections, and ownership managers before interface ownership; they are Domain-facing when they own stable language, states, policies, or invariants, while routing/transport/topology mechanics stay Infrastructure ([ddd-modeling.md §0.1](ddd-modeling.md), [ddd-core.md §3.1, §3.2](ddd-core.md))
18. **Type safety** — full type annotations, `mypy --strict`, Pydantic validation at boundaries
19. **Async I/O** — all infrastructure operations are `async`; domain methods remain synchronous

---

**References:**
- [ddd-modeling.md](ddd-modeling.md) — Domain modeling rule cards for BCs, aggregates, Architecture Gate, capability classification, and port granularity
- [ddd-core.md](ddd-core.md) — Architecture rule cards for dependency direction, layer ownership, events/messages, CQRS, cross-context contracts, and review checks
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
