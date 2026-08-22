---
name: ddd-python
description: Router and baseline for the Python DDD House Style.
---

# Python DDD House Style Router

## Applies When

Use this router after the accepted design selects Python. Read this baseline,
then load the smallest complete set of leaves covering the code surfaces being
changed. A conditional leaf is irrelevant until that surface exists in the
accepted implementation.

## Baseline

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
Runtime -> composition, configuration, clients, listeners, workers and shutdown
```

Business code is grouped by Bounded Context before layer. Each context owns its
Domain, Application, Transport, and Infrastructure code. Root `proto/` contains
contract source, root `gen/` contains generated code, root `migrations/`
contains ordered SQL, and Runtime owns process entrypoints.

The baseline is synchronous: FastAPI uses ordinary `def` endpoints, SQLAlchemy
uses synchronous `Session`, and Kafka/Celery run in dedicated worker processes.

## Adopted Stack

| Concern | House Style | Applies when |
|---|---|---|
| Python | CPython 3.14.x | Every Python service |
| Project and lockfile | `uv`, `pyproject.toml`, committed `uv.lock` | Every Python service |
| Lint and format | Ruff | Every Python service |
| Static types | mypy strict mode | Every Python service |
| Tests | pytest | Every Python service |
| Configuration | `pydantic-settings` | Runtime exists |
| Logging | `structlog` integrated with standard `logging` | Long-running Runtime exists |
| UUID identity | standard-library `uuid.uuid7()` | A new UUID identity exists |
| HTTP | FastAPI, Uvicorn, Pydantic v2 | HTTP exists |
| MySQL | SQLAlchemy 2 synchronous `Session`, `mysqlclient` | MySQL exists |
| External HTTP | `httpx.Client` | An outbound HTTP adapter exists |
| RPC | `grpcio`, `grpcio-tools` | gRPC exists |
| Contracts | Protobuf generated under root `gen/` | A Protobuf contract exists |
| Kafka | synchronous `confluent-kafka` Producer/Consumer | Kafka exists |
| Task queue | Celery 5.6 with RabbitMQ and non-pickle serialization | Distributed tasks exist |
| State machine | synchronous `python-statemachine` 3.2 | An FSM exists |
| Tracing | OpenTelemetry Python SDK and OTLP | Tracing exists |
| Provider evidence | Testcontainers for the adopted dependency | Physical provider semantics change |

Use the supported version line pinned by the repository. A change to this table
is a project technology decision, not a per-use-case implementation choice.

## Reference Map

| Touched code surface | Load |
|---|---|
| Aggregate, Entity, Value Object, Domain Service, Repository | [ddd-python-domain.md](ddd-python-domain.md) |
| Domain-owned Port contract, implementation, or composition | [ddd-python-domain.md](ddd-python-domain.md), [ddd-python-infrastructure.md](ddd-python-infrastructure.md), and [ddd-python-runtime.md](ddd-python-runtime.md) when composition changes |
| Command, Query, Application registry, assembler, local transaction scope | [ddd-python-application.md](ddd-python-application.md) |
| FastAPI, gRPC, subscriber, task processor | [ddd-python-transport.md](ddd-python-transport.md) |
| SQLAlchemy, MySQL mapping, QueryRepository, outbound ACL | [ddd-python-infrastructure.md](ddd-python-infrastructure.md) and [database.md](database.md) for SQL/schema |
| Local Domain Event or Integration Message | [ddd-python-events-messages.md](ddd-python-events-messages.md) |
| Celery task contract or worker | [ddd-python-taskqueue.md](ddd-python-taskqueue.md) |
| Process composition, configuration, logging, telemetry, shutdown | [ddd-python-runtime.md](ddd-python-runtime.md) |
| `python-statemachine` realization | [ddd-python-fsm.md](ddd-python-fsm.md) |

Load [ddd-core.md](ddd-core.md) for a Domain-owned Port or when cross-language
object/layer shape is also in scope, and [ddd-collaboration.md](ddd-collaboration.md)
only when an accepted collaboration contract is being realized.

## Project Shape

```text
pyproject.toml
uv.lock
proto/<contract-owner>/...
gen/<contract-owner>/...                     # generated
migrations/001_<change>.sql
src/<service>/
  main.py
  business/<context>/
    domain/
    application/{application,assembler}.py
    transport/
    infrastructure/
  infrastructure/
  runtime/
tests/{unit,integration,contract}/
```

Create only directories used by the accepted implementation. Every context has
`application/application.py` and `application/assembler.py`; a context may
contain Application and Transport without a Domain or Infrastructure layer.

## Python Conventions

- Public functions and methods have complete annotations and pass mypy strict.
- Use Python 3.14 syntax such as `list[str]`, `X | None`, and `type Alias = ...`.
- Commands, Queries, results, events, DTOs, and ordinary Value Objects use
  frozen slotted dataclasses.
- Inner semantic contracts use `typing.Protocol`.
- Imports are side-effect free; Runtime starts resources and active loops.
- Run `uv lock --check`, locked sync, `ruff check`, `ruff format --check`, mypy
  strict, and the applicable pytest suites.
