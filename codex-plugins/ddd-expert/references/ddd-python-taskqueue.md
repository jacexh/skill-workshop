---
name: ddd-python-taskqueue
description: Python House Style for accepted Celery task contracts, processors, scheduling, and Runtime wiring.
---

# Python Task Queue

## Applies When

Load this leaf only when the accepted implementation contains distributed
deferred or scheduled work implemented with Celery.

## Placement and Contract

- Application owns a frozen provider-neutral task name/payload and semantic
  enqueue `Protocol` under `application/task/`.
- Infrastructure maps that contract to Celery 5.6 and RabbitMQ.
- Transport owns a task processor that decodes one payload and delegates to one
  Application command.
- Runtime owns the Celery app, registration, routes, workers, Beat, health, and
  shutdown.

Payloads use JSON or accepted Protobuf bytes and contain stable identities and
the minimum immutable facts required by the command. They contain no Domain
objects, SQLAlchemy rows, request objects, clients, or credentials.

```python
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class SendWelcomeTask:
    user_id: UUID


class TaskEnqueuer(Protocol):
    def enqueue(self, task: SendWelcomeTask) -> None: ...


class SendWelcomeProcessor:
    def __init__(self, send_welcome: SendWelcomeHandler) -> None:
        self._send_welcome = send_welcome

    def process(self, task: SendWelcomeTask) -> None:
        self._send_welcome.handle(SendWelcome(user_id=task.user_id))
```

Infrastructure converts `SendWelcomeTask` to the Celery payload. Transport
decodes that payload back to this local value before calling the processor.

## Execution Shape

Provider retry settings represent transient execution attempts. Accepted
business waiting is represented by a bounded delayed follow-up task. Beat
enqueues the same ordinary task contract used elsewhere; scheduler callbacks do
not execute Domain behavior directly.

Define task timeout, attempts, routing lane, and terminal visibility in Runtime
configuration. Keep Celery request/retry metadata at the Transport/Runtime
boundary.

## Verification

Test payload construction and processor delegation without importing a Celery
worker. Use RabbitMQ/Celery integration evidence when registration, routing,
serialization, provider retry, Beat scheduling, or worker shutdown is changed.
