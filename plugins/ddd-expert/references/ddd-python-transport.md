---
name: ddd-python-transport
description: Python House Style for FastAPI, gRPC, message-subscriber, and task-processor adapters.
---

# Python Transport Layer

## Applies When

Load this leaf when a Python inbound HTTP/RPC endpoint, Integration Message
subscriber, or task processor is touched.

## Adapter Contract

Transport decodes one external contract, extracts accepted actor/correlation
facts, maps it to one Application contract, delegates once, and maps the result
or error. Pydantic and generated contracts remain in Transport. Domain
construction owns business validity; Transport schemas own external shape and
parsing.

## FastAPI Shape

Use ordinary `def` endpoints and create each `APIRouter` inside its factory.
`Depends` supplies request concerns such as authentication input; Runtime
supplies the Application registry to the router factory.

```python
from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict


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

Each endpoint has an explicit return type and response schema. Error mapping
uses stable public codes and safe details.

## Other Inbound Adapters

- A `grpcio` servicer maps generated request/context values to one Application
  call and returns a generated response. Generated servicer and message types
  stay in `transport/grpc/`.
- A subscriber lives in `transport/messagesubscriber/`, decodes one generated
  contract, and delegates once. Runtime owns Consumer polling and disposition.
- A Celery processor lives in `transport/taskprocessor/`, decodes one task
  payload, and delegates once. Runtime owns registration and worker lifecycle.

Large generated-response mappings may use a Transport assembler. It remains
separate from `application/assembler.py`, which maps Application/Domain state.

## Verification

Use the real framework decoder or generated request type. Verify external shape,
actor/correlation extraction, one Application delegation, result mapping, and
non-leaking error mapping. Subscriber and processor tests return the semantic
result to a separately tested Runtime/provider boundary.
