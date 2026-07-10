---
name: ddd-python
description: Compact Python DDD House Style for multi-context layout, the adopted synchronous stack, layers, persistence, conditional messaging/tasks/FSM, Runtime and verification.
---

# Python DDD House Style

Use this reference after the model and Tactical Design are accepted. It does not decide Aggregate boundaries, consistency, durability, or collaboration. It fixes how accepted responsibilities are implemented in Python.

Every rule below is a House Rule: it applies only when its stated concern exists, and it is mandatory once applicable. An existing alternative is a House Style conflict, not an automatic exception. An uncovered concern or explicit exception requires an accepted technology or design decision; do not choose another library ad hoc.

Use [`ddd-modeling.md`](ddd-modeling.md) for discovery, [`ddd-core.md`](ddd-core.md) for the DDD and Clean Architecture baseline, [`ddd-collaboration.md`](ddd-collaboration.md) for cross-context design, and [`database.md`](database.md) for MySQL schema and SQL rules.

## Dependency Direction

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
Runtime -> composition, configuration, clients, loops, servers and shutdown
```

| Layer | Owns | Must not own |
|---|---|---|
| Domain | Aggregates, Entities, Value Objects, Domain Services, Domain Events, semantic validation, write Repository contracts | Pydantic/FastAPI schemas, SQLAlchemy, logging, providers, Runtime |
| Application | Commands, Queries, use cases, `Application` registry, DTO assemblers, same-context reactions, semantic outbound ports | HTTP/gRPC handlers, SQLAlchemy sessions, Kafka/Celery clients, active loops |
| Transport | HTTP/gRPC handlers, Integration Message subscribers, task processors, external mapping and disposition | Repositories, transactions, Aggregate mutation, provider Runtime |
| Infrastructure | Repository/QueryRepository implementations, row conversion, ACLs and outbound adapters | Domain decisions, inbound handling, process lifecycle |
| Runtime | Explicit composition, settings, shared clients, servers, consumers, workers, logging, telemetry and shutdown | business rules and bounded-context language |

Generated inbound shapes stop at Transport. A producing Application event handler may import only its own producer-owned generated Integration Message contract. SQLAlchemy, mysqlclient, HTTPX, Confluent Kafka, Celery, RabbitMQ, Uvicorn and active loops remain outside Application.

## Adopted Stack

The baseline is synchronous: FastAPI uses ordinary `def` endpoints, SQLAlchemy uses `Session`, and Kafka/Celery use dedicated Runtime workers. Do not insert `async def`, `AsyncSession`, an asyncio broker client or `httpx.AsyncClient` into one part. Facts requiring async first need one accepted profile covering Transport, Application ports, persistence, outbound clients, tests, workers and shutdown.

| Concern | Mandatory implementation | Applicability |
|---|---|---|
| Python | CPython 3.14.x; a newer feature line requires a refreshed technology decision | Every Python service |
| Project and lockfile | `uv`, `pyproject.toml`, committed `uv.lock` | Every Python service |
| Lint and format | Ruff: `ruff check` then `ruff format` | Every Python service |
| Static types | mypy strict mode | Every Python service |
| Tests | pytest | Every Python service |
| Configuration | `pydantic-settings` | Every service Runtime |
| Logging | `structlog` integrated with standard `logging` | Every service Runtime |
| UUID identity | standard-library `uuid.uuid7()` | A new UUID identity is required |
| HTTP | FastAPI, Uvicorn and Pydantic v2 | HTTP API exists |
| MySQL adapter | SQLAlchemy 2 synchronous `Session` and `mysqlclient` | MySQL persistence/read model exists |
| External HTTP | `httpx.Client` | An outbound HTTP adapter exists |
| RPC | `grpcio` and `grpcio-tools` | gRPC is accepted |
| Contracts | Protobuf generated into root `gen/` | A Protobuf contract exists |
| Kafka | stable synchronous `confluent-kafka` Producer/Consumer | Kafka delivery is accepted |
| Task queue | Celery 5.6 with RabbitMQ and non-pickle serialization | Distributed deferred work is accepted |
| State machine | `python-statemachine` 3.2 synchronous Domain use | Lifecycle facts warrant an FSM |
| Tracing | OpenTelemetry Python SDK, OTLP and applicable instrumentation | Tracing and a collector are accepted |
| Integration environment | Testcontainers for the real adopted dependency | External semantics require evidence |

Production schema changes are ordered SQL files under root `migrations/` and follow `database.md`. Alembic and `Base.metadata.create_all()` are not production migration authorities.

Do not substitute another DI container, database/Kafka/task/FSM/RPC library for this stack. An absent technology remains uncovered until its choice is accepted.

## Project Layout

The tree shows ownership; create a conditional directory only when its capability exists.

```text
pyproject.toml
uv.lock
proto/<contract-owner>/{v1,integration/v1}/
gen/<contract-owner>/{v1,integration/v1}/    # generated; never edit
migrations/001_<change>.sql                   # schema authority
src/<service>/
  main.py
  business/<context-a>/
      domain/{<aggregate>,repository,errors}.py
      domain/events.py                      # only with accepted Domain Events
      application/
        application.py                     # mandatory registry
        assembler.py                       # mandatory existing-state mapping
        commands/<use_case>.py
        queries/<use_case>.py
        queries/repository.py              # only with QueryRepository
        queries/dto.py
        eventhandlers/<fact>.py             # only with accepted reactions
        task/<task>.py                     # only with task queue
      transport/
        http/{router,schema,errors}.py
        grpc/{handler,assembler}.py
        messagesubscriber/<contract>.py
        taskprocessor/<task>.py
      infrastructure/
        persistence/{model,convert,repository,query_repository}.py
        acl/<external_owner>.py
        messaging/publisher.py
  business/<context-b>/                    # same ownership rules
    application/{application,assembler}.py
  infrastructure/{database,messagebus,taskqueue,logging,telemetry}.py
  runtime/{config,bootstrap,http,workers}.py
tests/{unit,integration,contract}/
```

Every bounded context has `application/application.py` and `application/assembler.py`. It may have Application and Transport without Domain or Infrastructure. Empty architectural packages are prohibited.

One context never imports another context's internal Domain, Application, Transport or Infrastructure. Shared technical packages never own Domain objects, product DTOs, published language or context-specific mapping. Avoid `shared`, `common`, `utils` and undifferentiated `models` packages.

Contract source stays under root `proto/`; root `gen/` must be importable and is never copied or edited. Published facts are producer-owned; asynchronous intents are receiver-owned.

## Domain

Place an Aggregate in `business/<context>/domain/<aggregate>.py`. Use semantic filenames; do not pre-create generic `service.py`, `policy.py` or `state.py`.

- Use a normal class for a mutable Aggregate. Leading-underscore slots/read-only properties expose existing state only for DTO/Domain/persistence conversion and safe result or identity mapping; outer layers must not use them for business branching, validation, or authorization. Changes remain named methods.
- A Factory establishes valid initial state and creation facts. `reconstitute()` restores existing state without creation behavior/events, but still validates it.
- Assemblers/converters reconstitute only existing data. New objects always use the Factory.
- Use explicit Python and Value Objects for semantic validation. Pydantic and SQLAlchemy validation stay outside Domain and do not duplicate business rules.
- Technical audit timestamps stay in persistence. Time belongs in Domain only when business behavior uses it. Business instants crossing Domain/Application boundaries are timezone-aware and normalized to UTC; reject naive datetimes.

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
        value = self.value.strip().lower()
        if not value or "@" not in value:
            raise InvalidUserError("invalid email")
        object.__setattr__(self, "value", value)


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
        self.validate()

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

    def validate(self) -> None:
        if not self._name.strip() or len(self._name) > 64 or self._version < 0:
            raise InvalidUserError("invalid user")

    def activate(self) -> None:
        if self._status is UserStatus.ACTIVE:
            return
        self._status = UserStatus.ACTIVE

```

Rules come from the accepted model; sample limits are not reusable. The bottom constructor validates, so direct construction and reconstitution cannot bypass validity.

### Mutation and Persistence Lifecycle

- The root controls owned Entity changes. Domain methods never save, publish, enqueue, log, start work, retry or choose provider policy.
- A new persisted Aggregate has in-memory version `0`; Infrastructure inserts `1` and increments updates atomically.
- `save()` leaves the instance stale. Application may assemble results/drain events, but cannot mutate or save it again.
- Value Objects use value equality, establish validity at construction and are immutable. Copy mutable inputs and expose immutable values/defensive copies.
- Use plain `Enum` for closed Domain values and translate through `.value` at mapping boundaries. Use `IntEnum` or `StrEnum` only when primitive substitutability is explicitly part of the accepted model.

### Domain Service

A Domain Service is an important named operation that does not naturally belong to an Entity or Value Object; it need not span Aggregates. Keep it synchronous, mostly stateless and deterministic. It accepts Domain facts and returns a decision/value/error/fact; it never saves, controls transactions, logs, retries, schedules or imports providers. A narrow semantic collaborator is allowed only when primitive precomputation would erase meaning; it does not solve races or authorize multi-root persistence.

### Repository

Use `typing.Protocol` for one write contract per Aggregate Root:

```python
from typing import Protocol
from uuid import UUID


class UserRepository(Protocol):
    def get(self, user_id: UUID) -> User: ...

    def save(self, user: User) -> None: ...
```

Keep sessions, SQL, cache keys and provider options out. Return stable not-found/concurrency exceptions. `save()` covers insert, update and state-driven soft delete. A focused command load or one-Aggregate read may use this Repository; lists, history, reports and projections use an Application QueryRepository.

### Conditional FSM

Use enum plus Aggregate methods for a simple lifecycle. When facts show many states, guarded edges, several actors or state-specific behavior, use `python-statemachine` 3.2 synchronously inside Domain.

Define the chart with `allow_event_without_transition = False` and `catch_errors_as_events = False`. Enum-backed charts use `States.from_enum(..., use_enum_instance=True)` so external-model state values match the Aggregate enum field. Construct the verified 3.2 external-model API as `OrderLifecycle(model=order, state_field="_status")` inside an Aggregate business method; catch `TransitionNotAllowed` there and raise a stable Domain error. The Aggregate owns guards and exposes `pay()`/`cancel()`; outer layers never call `send()` or import the library. Async callbacks, delayed events, persistence hooks and side effects are prohibited.

## Application

Application coordinates one use case without reimplementing Domain rules. It imports its Domain and semantic contracts, not inbound protocol models, persistence/provider clients or Runtime. The only generated-contract exception is a producing event handler importing its own producer-owned Integration Message fact contract.

### Mandatory Registry

`application/application.py` groups all handlers without becoming a forwarding facade:

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Commands:
    create_user: CreateUserHandler


@dataclass(frozen=True, slots=True)
class Queries:
    get_user: GetUserHandler
    list_users: ListUsersHandler


@dataclass(frozen=True, slots=True)
class Application:
    commands: Commands
    queries: Queries
```

Runtime constructs the registry. Transport selects one field and calls one handler. Do not add `Application.create_user()` whose only body forwards to `commands.create_user`.

### Mandatory Assembler

Application DTOs are protocol-neutral frozen dataclasses. Pydantic request/response schemas remain in Transport.

```python
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

This maps existing state and invokes Domain validation. Creation calls `User.register()` directly. Assemblers have no business branching, external mapping, I/O, logging or transaction control. A post-save DTO cannot present its stale version as current.

### Command Handler

Commands and results are immutable values. A handler loads facts, invokes Domain behavior, persists one accepted Aggregate and returns a minimal result.

```python
class CreateUserHandler:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def handle(self, command: CreateUser) -> CreateUserResult:
        user = User.register(command.name, Email(command.email))
        self._repository.save(user)
        return CreateUserResult(user_id=user.id)
```

This baseline intentionally has no event machinery. When a post-commit best-effort reaction is accepted, add the Aggregate event buffer and semantic dispatcher conditionally. Its adapter exposes one stable admitted dispatch-failure type; Application catches only that explicitly suppressed outcome, while programming and mapping defects reach the outer boundary. Durable handoff uses an accepted Outbox/process design.

Application owns what must commit together; Infrastructure owns how. A Repository may hide one local transaction. State plus Outbox needs an explicit atomic capability; raw `Session` never enters Application. Multi-root atomic pressure returns to modeling.

### Queries and CQRS

A focused one-Aggregate read may use the Domain Repository when complete reconstitution is reasonable and no distinct read semantics exist. Return an immutable result, never the Aggregate.

Lists, pages, history, reports, statistics, partial columns, cross-Aggregate composition, denormalization and projections use an Application-owned `QueryRepository` Protocol returning frozen Application read DTOs. Group cohesive reads by consumer semantics, not one Protocol per endpoint or SQL statement.

Transport always calls an Application Query Handler. Query paths do not create Domain Entities, so read normalization is explicit; this does not authorize duplicated command/row business validation.

## Transport

Transport decodes one external contract, maps it to one Application contract, delegates once, and maps the result/error. It owns no business rules, Repository, transaction, Aggregate mutation or provider loop.

Pydantic validates required external shape and parsing. Domain construction validates business meaning; do not duplicate invariants as Pydantic field/model validators. Authentication dependencies extract protocol credentials and pass an accepted actor fact inward; Transport does not make the business authorization decision.

### FastAPI

Use ordinary `def` endpoints. `Depends` is limited to Transport request concerns and is not process composition.

```python
class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    email: str


class CreateUserResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str


def create_router(application: Application) -> APIRouter:
    router = APIRouter(prefix="/users", tags=["users"])

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_user(request: CreateUserRequest) -> CreateUserResponse:
        result = application.commands.create_user.handle(
            CreateUser(name=request.name, email=request.email)
        )
        return CreateUserResponse(id=str(result.user_id))

    return router
```

Create the router inside its factory so repeated app construction does not double-register a module-global router. Every endpoint has a return type and explicit response schema. Map semantic errors to stable public codes/safe details; never expose exception text, SQL, provider payloads, credentials or traces.

When accepted, grpcio servicers map generated request/context to one Application call and map the result/error back. Application/Domain never inherit generated servicers or return generated messages.

An Integration Message subscriber lives under `transport/messagesubscriber`; Runtime owns Consumer polling, offsets and shutdown. A Celery task processor lives under `transport/taskprocessor`; Runtime owns task registration, broker and worker. Both map once to a local Application command and never mutate Aggregates directly.

## Infrastructure and Persistence

Infrastructure implements inner contracts using selected mechanisms. It does not own business decisions, inbound handlers or process lifecycle.

Use `persistence/model.py` for SQLAlchemy rows, `convert.py` for existing row/Domain mapping, `repository.py` for Aggregate persistence, and `query_repository.py` only for a separated read path. Service `infrastructure/database.py` owns the Engine/session factory; BC adapters receive it and do not load settings.

SQLAlchemy mappings follow every physical rule in `database.md`: five standard columns, stored version `1`, Unix-millisecond timestamps, `deleted_at == 0`, comments, types, indexes and active predicates. Root SQL migrations declare the authoritative table.

Use typed SQLAlchemy `Mapped` columns with the exact MySQL types/defaults/comments from the migration: UUID text identity, unsigned compact status/version, and `bigint` Unix-millisecond lifecycle columns. Mapping and migration must agree; CI detects drift. Do not call SQLAlchemy metadata creation as migration verification.

### Conversion and Repository

```python
def to_entity(row: UserRow) -> User:
    return User.reconstitute(
        user_id=UUID(row.id),
        name=row.name,
        email=Email(row.email),
        status=UserStatus(row.status),
        version=row.version,
    )


def to_mutable_values(user: User) -> dict[str, object]:
    return {
        "name": user.name,
        "email": user.email.value,
        "status": user.status.value,
    }
```

Conversion is mechanical, calls Domain reconstitution/validation, copies mutable values and performs no I/O/logging/business branching. New objects use a Domain Factory. SQL owns version increments and technical timestamps.

```python
class UserRepositoryAdapter:
    def save(self, user: User) -> None:
        values = to_mutable_values(user)
        now = self._now_millis()
        try:
            with self._sessions.begin() as session:
                if user.version == 0:
                    session.add(
                        UserRow(
                            id=str(user.id),
                            **values,
                            version=1,
                            created_at=now,
                            updated_at=now,
                            deleted_at=0,
                        )
                    )
                    return

                result = session.execute(
                    update(UserRow)
                    .where(
                        UserRow.id == str(user.id),
                        UserRow.version == user.version,
                        UserRow.deleted_at == 0,
                    )
                    .values(
                        **values,
                        version=UserRow.version + 1,
                        updated_at=now,
                    )
                )
                if result.rowcount != 1:
                    raise ConcurrentModificationError(user.id)
        except (IntegrityError, DBAPIError) as error:
            raise PersistenceError("user save failed") from error
```

An update checks identity, loaded version and active-row predicate, increments atomically and requires one matched row. Provider catches must not swallow the stable concurrency exception. `save()` never updates the Aggregate version.

A QueryRepository selects explicit columns and constructs Application DTOs explicitly. It does not reconstitute Aggregates or call `Pydantic.model_validate(row)`. Verify its deterministic order/cursor and corresponding `database.md` index/query plan.

External HTTP adapters receive a process-managed `httpx.Client`. ACLs translate external/generated language into local semantic contracts. Pooling, credentials, provider retry and timeouts remain in Infrastructure/Runtime. Translate provider errors once with `raise StableError(...) from error`; do not leak provider messages inward or duplicate generic completion logs.

## Events and Integration Messages

| Concern | Owner |
|---|---|
| Record and collect a same-context fact | Aggregate |
| Coordinate accepted dispatch | producing Application command |
| React/publish a producer-owned fact | producing `application/eventhandlers` |
| Send a receiver-owned intent | sender semantic port plus Infrastructure ACL |
| Decode consumed contract/delegate | receiver `transport/messagesubscriber` |
| Kafka poll, offsets, retry/DLQ, lifecycle | Infrastructure/Runtime |

A Domain Event is a frozen Domain dataclass, not Pydantic/Protobuf/Kafka, and never imported by another context. Producing Application may import its one producer-owned fact contract. Sender Infrastructure maps local semantics to receiver-owned intent.

Post-commit best effort uses `save -> drain_events -> dispatch_all` only when crash loss is accepted. The Aggregate records the selected fact with its transition; Application drains once after save and catches only the stable admitted dispatch-failure type. Failure cannot roll back persistence; a state-changing handler reloads a fresh Aggregate in a new transaction.

Kafka uses synchronous `confluent-kafka` with explicit serializers. Runtime owns Producer callbacks, `poll()`/bounded `flush()`, Consumer group/rebalance, readiness and shutdown. Consumers set `enable.auto.commit=false` and `enable.auto.offset.store=false`; only after an accepted terminal processor disposition may Runtime either commit the explicit processed message/offsets, or store those accepted offsets locally and then explicitly commit the accepted batch during its bounded batch, rebalance, or shutdown policy. Retryable failure does not advance them. Consumers run in dedicated workers, never FastAPI request workers.

Queue admission, broker delivery and consumer completion are distinct; the adapter states its evidence. The envelope carries stable message identity, contract kind/version, occurrence time, and accepted correlation/trace headers. The payload carries only promised facts; source revision or ordering tokens appear only when accepted consumer semantics require them, never as an Aggregate dump.

### Conditional Outbox and Idempotency

Use Outbox only when state commit and publish intent must not diverge. Write both in one transaction, remove direct publish, follow `database.md`, and run a Runtime relay that waits for broker-delivery evidence. Assume duplicates.

Define idempotency by business effect; add Inbox only when durable receipt/outcome is accepted. Kafka offsets are not atomic with MySQL. Key by the smallest business ordering scope; never promise global order.

## Task Queue

Use Celery only after distributed deferred work is accepted.

- Application defines an immutable local payload and semantic enqueue Protocol under `application/task`; it never imports Celery.
- Transport task processors decode one payload and delegate to one Application handler.
- Runtime owns Celery/RabbitMQ, registration, routing, worker, retry, Beat, health and shutdown.
- Use JSON or accepted Protobuf bytes; pickle and arbitrary Python-object payloads are prohibited.
- Payloads carry stable identifiers/minimum facts, not Domain objects, SQLAlchemy rows, request context, clients or credentials.

Provider retry is for transient failure. Expected business waiting uses a bounded delayed follow-up, not an exception. Beat enqueues the same ordinary task; scheduler code has no business behavior.

Define idempotency, timeout, attempts, exhaustion visibility and recovery before retry. Celery's experimental Kafka broker is prohibited; messages and tasks remain distinct.

## Runtime

Runtime is the only process composition and lifecycle owner. Use plain constructors and typed registries; do not adopt `dependency-injector` or use FastAPI `Depends` as the service container.

`runtime/bootstrap.py` loads one settings object, configures logging/optional tracing, constructs process resources, then BC adapters/handlers/registries and Transport adapters, and returns registrations plus deterministic shutdown. It never logs secrets.

FastAPI lifespan starts/closes resources in dependency order. Kafka/Celery processes reuse composition but start only their loop. Domain/Application constructors perform no I/O.

Create one Engine per database, one shared `httpx.Client` per compatible policy, and explicit bounded provider clients. Never create them per request or at module import.

### Logging and Errors

- The Transport/Runtime execution owner emits one completion log with operation/route/contract, outcome, duration and safe identities.
- Application logs only independently valuable business semantics or an explicitly suppressed terminal outcome through a minimal logger Protocol. Domain never logs.
- Bind `request_id`, `trace_id`, `span_id` and accepted correlation identity where available. Do not duplicate logs merely to repeat these fields.
- At the first controlled boundary, translate/enrich a provider error once and preserve its cause with `raise ... from error`. Later layers add context only when they own new semantics.
- Never log full settings, DSNs, credentials, tokens, SQL parameters, message payloads or unrestricted headers.

When tracing is accepted, Runtime configures OpenTelemetry SDK/OTLP and applicable instrumentation, owns flush/shutdown, and propagates W3C context across accepted boundaries. Domain stays telemetry-free; structlog remains log authority.

Stop inbound work, drain bounded in-flight work, flush Kafka/telemetry, close clients/sessions, dispose Engine, then terminate. Track every background worker and bound every wait.

## Python Conventions

- Use complete annotations on public functions and methods; run mypy strict.
- Use Python 3.14 syntax (`list[str]`, `X | None`, `type Alias = ...`) and do not mechanically add `from __future__ import annotations`.
- Use frozen slotted dataclasses for Commands, Queries, results, events and ordinary Value Objects. Pydantic `BaseModel` is mutable unless `ConfigDict(frozen=True)` is explicit.
- Use `Protocol` for inner semantic contracts. Add `@runtime_checkable` only when runtime instance checks are actually required.
- Keep imports side-effect free. Runtime starts resources; importing a Domain/Application/Transport module must not open connections or register process loops.
- Commit `uv.lock`; CI runs with a locked environment. Run Ruff lint/import fixes before Ruff formatting because the formatter does not sort imports.

## Verification

- Domain: Factory/reconstitution validity, invariants, transitions and services with real objects; add event evidence only when events exist.
- Application: real handler/Domain behavior plus focused semantic fakes; avoid untyped mocks.
- Transport: real external input, mapping, one delegation, errors and disposition; do not mock parsing.
- Persistence: apply root migrations to real MySQL; verify mapping, active rows, version conflict, rollback, query order and stale instances. SQLite/metadata creation are not evidence.
- Messaging/tasks: compatibility, disposition, redelivery/idempotency, delivery failure, exhaustion and worker shutdown; accepted Outbox also verifies rollback and delivery-before-mark recovery.
- Runtime: settings redaction, registrations/reachability, completion log and bounded start/drain/shutdown.

Run `uv lock --check`, locked sync, Ruff, mypy strict and applicable tests. Report unrun external evidence and residual risk instead of a mock-only green check.
