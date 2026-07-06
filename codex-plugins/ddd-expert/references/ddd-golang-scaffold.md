---
name: ddd-golang-scaffold
description: Go / go-jimu scaffold and layout reference. Use when implementing or reviewing project layout, bounded-context package structure, internal/business roots, internal/pkg shared clients, pkg/gen generated code, module assembly, test placement, or Go package boundary conventions.
---

# Go Scaffold and Layout Reference

Use this file for physical layout decisions after bounded context and layer ownership are known. Do not create layers or packages merely because this scaffold names them; calibrate to the repository's existing layout first.

## 0. Go / go-jimu Scaffold Building Block Lookup

| Object | Start here |
|---|---|
| Project layout | §0.1 Project Layout Card |
| Bounded-context package | §0.2 Bounded Context Package Card |
| Module assembly | §0.3 Module Assembly Card |
| Generated code / proto | §0.4 Generated Code Card |
| Test layout | §0.5 Test Layout Card |
| Shared package ownership | §0.6 Shared Package Card |

### 0.1 Project Layout Card

Default layout for services that adopt this guide:

```text
cmd/<service>/main.go
configs/<service>/defaults.yml
internal/business/<context>/
internal/business/<context>/domain/
internal/business/<context>/application/
internal/business/<context>/interfaces/
internal/business/<context>/infrastructure/
internal/business/<context>/api/
internal/pkg/<capability>/
pkg/gen/
proto/
scripts/sql/ or migrations/
```

Rules:

- `cmd/<service>/main.go` loads config, selects modules, sets process options, and calls `app.Run()`. It does not construct business internals.
- Bounded-context code lives under `internal/business/<context>`.
- Shared technical clients live under `internal/pkg/<capability>`.
- Generated code lives under `pkg/gen/**`; schema sources live under `proto/**`.
- Database migrations live in the repository's existing migration path and must route to [`database.md`](database.md).

### 0.2 Bounded Context Package Card

Default bounded-context shape:

```text
internal/business/<context>/
  domain/
  application/
    command/
    query/
    eventhandler/
    messagepublisher/
    messagehandler/
    taskprocessor/
  interfaces/
  infrastructure/
  api/
  module.go
```

Layer use:

- `domain`: Aggregate, Entity, Value Object, Domain Service, Repository interface, Domain Event type.
- `application`: use-case orchestration, QueryRepository interface, event/message/task handlers, optional generated RPC shortcut.
- `interfaces`: hand-written REST/HTTP/WebSocket adapters or repo-specific protocol adapters.
- `infrastructure`: Repository implementations, external clients, ACLs, DO/converters.
- `api`: explicitly published same-process facade/read APIs for other bounded contexts.

Physical `interfaces/` is optional. Do not add it solely because a generic architecture diagram names an Interface layer.

### 0.3 Module Assembly Card

Bounded-context module assembly normally lives in `internal/business/<context>/module.go`.

Rules:

- Module files wire constructors and register handlers; they do not implement business behavior.
- `cmd` imports module variables, not inner Repository/handler constructors.
- Register Domain Event handlers and Boundary Publishers through event subscriber wiring described in [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md).
- Runtime process modules, lifecycle hooks, config, and shutdown order route to [`ddd-golang-runtime.md`](ddd-golang-runtime.md).

### 0.4 Generated Code Card

Sources:

- `proto/**` owns schema.
- `pkg/gen/**` owns generated Go code.

Rules:

- Domain never imports generated code.
- Generated RPC handler implementations are thin adapters. Use the repository's accepted convention: `application/application.go` shortcut, `interfaces/**`, or another existing adapter package.
- Do not create `interfaces/grpc` or `interfaces/connectrpc` solely to satisfy a generic layer name.
- Mapping from generated DTOs to Domain/Application types happens at Application, Interface, or Infrastructure boundaries.

### 0.5 Test Layout Card

- Go tests live in `*_test.go`.
- Prefer tests beside the package under test.
- Domain tests directly instantiate Domain objects and need no mocks.
- Application tests mock Repository/QueryRepository/external boundary interfaces only.
- Infrastructure tests may use real dependencies, migrations, test containers, or repository-local integration harnesses.
- Generated mocks must be test-only, such as `mock_<name>_test.go` with `mockery --inpackage --testonly`, or a test-support package that production code cannot import.

### 0.6 Shared Package Card

Use `internal/pkg/<capability>` for shared technical infrastructure:

- DB client/session factory;
- Kafka/message runner adapter;
- taskqueue runtime adapter;
- config/logging/runtime helpers;
- Redis/cache client;
- external SDK wrapper used by multiple bounded contexts.

Do not put shared Domain objects, cross-context DTOs, business rules, or read models in `internal/pkg`. If multiple bounded contexts need a concept, choose one owner and publish a facade, Integration Message, ACL, or protocol contract.

## Layout Review Checks

- A bounded context imports another context's `domain/` or `application/`.
- `cmd` constructs repositories, handlers, generated routes, raw clients, or lifecycle loops directly.
- `internal/pkg` contains Domain language or product read models.
- Generated DTOs appear in Domain package APIs.
- Test helpers or mocks are imported by production code.
