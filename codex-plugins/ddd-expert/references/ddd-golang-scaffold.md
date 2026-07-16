---
name: ddd-golang-scaffold
description: Go multi-bounded-context House Style for project layout, package ownership, generated contracts, Fx modules, and test placement.
---

# Go Scaffold and Package Layout

Use this Platform Guide after bounded contexts and responsibilities are accepted. The tree shows ownership, not a requirement to create empty packages. Conditional packages appear only when the service implements that capability.

## Multi-BC Service Layout

```text
cmd/
  <service>/
    main.go

configs/
  <service>/
    defaults.yml

docs/
  ddd-expert/
    context-map.md
    context/
      <context>/
        model.md

proto/
  <contract-owner>/
    v1/                         # RPC contracts, when present
    integration/v1/             # Integration Messages, when present

gen/                            # generated; never edit by hand
  <contract-owner>/
    v1/
    integration/v1/

internal/
  business/
    <context-a>/
      domain/                    # only when this BC owns a Domain model
        <aggregate>.go
        event.go                 # when Domain Events exist
        repository.go            # when Aggregate persistence exists
        errors.go

      application/
        application.go           # mandatory Commands/Queries registry
        assembler.go             # mandatory Application DTO <-> Domain mapping
        command/                  # when Commands exist
          <use_case>.go
        query/                    # when Queries exist
          <use_case>.go
          repository.go          # when a QueryRepository is required
          dto.go
        eventhandler/             # when same-BC reactions exist
          <fact>.go
        task/                     # only when background execution is required
          <task>.go

      transport/                 # only for accepted inbound adapters
        connectrpc/
          handler.go
          assembler.go            # generated contract <-> Application types
          error.go
        http/                     # hand-written HTTP, use Chi
          handler.go
        messagesubscriber/
          <contract>.go
        taskprocessor/
          <task>.go

      infrastructure/            # only when outbound/persistence adapters exist
        do.go
        convert.go                # DO <-> Domain Entity
        <aggregate>_repository.go
        <read_model>_query_repository.go
        <receiver>_acl.go

      <context-a>.go              # mandatory BC Fx module

    <context-b>/                  # sibling BC; same ownership rules
      application/
        application.go
        assembler.go
      transport/
      <context-b>.go

  pkg/
    module.go                     # shared Runtime module selection
    connectrpc/                   # ConnectRPC/Chi server and interceptors
    database/                     # xorm engine and MySQL lifecycle
    eventbus/                     # in-memory Domain Event dispatcher
    messagebus/                   # Kafka publisher/consumer Runtime
    taskqueue/                    # Asynq client/worker/scheduler Runtime
    telemetry/                    # only when OpenTelemetry is accepted

migrations/
  001_<change>.sql
```

Do not add `api/`, `service.go`, `policy.go`, `state.go`, `processmanager/`, Outbox/Inbox folders, or provider directories merely because a future change might need them. Use Domain-language filenames and create conditional mechanisms only when confirmed semantics or accepted project constraints require their responsibility.

## Required BC Files

Every bounded context has:

- `application/application.go`, whose `Application` groups all Command Handlers under `Commands` and all Query Handlers under `Queries`;
- `application/assembler.go`, which owns only existing Application DTO/Domain Entity conversion;
- `<context>.go`, which exposes the context's Fx module and registration wiring.

A BC may have Application and Transport without a Domain or Infrastructure package. Conversely, a model-only package does not gain Transport until it has an inbound contract. Mandatory files establish a stable entry point; optional directories express real responsibilities rather than architectural ceremony.

## Package Ownership

| Path | Responsibility |
|---|---|
| `domain` | model behavior, Domain validation, Domain Events, write Repository contract |
| `application` | protocol-neutral use cases, DTOs, assemblers, same-BC reactions, internal task contracts |
| `transport` | inbound protocol/message/task decoding, mapping, delegation, disposition |
| `infrastructure` | persistence, QueryRepository, ACL/external implementation and mechanical conversion |
| `<context>.go` | constructors and registrations for this BC only |
| `internal/pkg` | shared technical clients, active loops, provider config and process lifecycle |

One context never imports another context's `domain`, `application`, `transport`, or `infrastructure`. A same-process deployment does not erase a bounded-context boundary. Use an accepted published contract, Integration Message, or ACL.

## Application Registry

`application/application.go` is a type-safe use-case registry, not a generated service implementation:

```go
package application

import (
	"example/internal/business/user/application/command"
	"example/internal/business/user/application/query"
)

type Commands struct {
	Create         *command.CreateUserHandler
	ChangePassword *command.ChangePasswordHandler
}

type Queries struct {
	Get  *query.GetUserHandler
	List *query.ListUsersHandler
}

type Application struct {
	Commands Commands
	Queries  Queries
}

func NewApplication(
	create *command.CreateUserHandler,
	changePassword *command.ChangePasswordHandler,
	get *query.GetUserHandler,
	list *query.ListUsersHandler,
) *Application {
	return &Application{
		Commands: Commands{Create: create, ChangePassword: changePassword},
		Queries:  Queries{Get: get, List: list},
	}
}
```

It does not import ConnectRPC, HTTP, protobuf, xorm, Fx, Kafka, or Asynq. Transport selects one Handler from the registry and delegates once; do not add facade methods whose only body calls the same Handler.

## Bounded-context Module

`<context>.go` assembles the four layers and contributes registrations. It contains no use-case behavior:

```go
package user

import (
	connect "connectrpc.com/connect"
	"example/gen/user/v1/userv1connect"
	"example/internal/business/user/application"
	"example/internal/business/user/application/command"
	"example/internal/business/user/infrastructure"
	userconnectrpc "example/internal/business/user/transport/connectrpc"
	sharedconnectrpc "example/internal/pkg/connectrpc"
	"go.uber.org/fx"
)

var Module = fx.Module(
	"business.user",
	fx.Provide(
		infrastructure.NewUserRepository,
		command.NewCreateUserHandler,
		application.NewApplication,
		userconnectrpc.NewHandler,
	),
	fx.Invoke(func(
		handler userv1connect.UserServiceHandler,
		server sharedconnectrpc.Server,
	) {
		server.Register(userv1connect.NewUserServiceHandler(
			handler,
			connect.WithInterceptors(server.GetGlobalInterceptors()...),
		))
	}),
)
```

The same module may register Domain Event handlers, message payload factories/subscribers, task schemas/processors, and periodic task definitions. It does not construct Kafka/Asynq clients or start servers, consumers, workers, schedulers, and relays; those loops belong to `internal/pkg` Runtime modules.

## Contracts and Generated Code

- RPC source lives under `proto/<context>/v1`; its generated Go and Connect stubs live under `gen/<context>/v1`.
- Integration Message source lives under `proto/<semantic-owner>/integration/v1`; generated code mirrors that path under `gen/`.
- A Published Fact Contract is producer-owned. An Asynchronous Intent Contract is receiver-owned.
- Internal tasks are Go/JSON contracts under `application/task`, not proto contracts and not cross-context APIs.
- Domain never imports `gen`. Producing Application may import only its own generated Integration Message contract. Transport may import generated inbound contracts. Infrastructure may import generated external client contracts for an ACL.
- Generated files are regenerated by the repository's Buf command and never patched by hand.

## Shared Runtime Packages

`internal/pkg/<capability>` owns a reusable technical resource only when multiple contexts or the process composition need it. It may expose an initialized xorm engine, ConnectRPC server, event dispatcher, message publisher/subscriber, task worker, logger, or telemetry provider. It does not contain Domain objects, product DTOs, published language, ACL mapping, or context-specific persistence.

Avoid `common`, `shared`, `utils`, and `models`. A package name states the technical capability and owns its configuration, constructor, lifecycle, and shutdown.

## Tests

- Put Go tests beside the package under test; do not create a parallel Java-style test tree.
- Domain tests use real Domain objects and no infrastructure mocks.
- Application tests use real Domain behavior plus focused fakes for accepted Repository/QueryRepository/external contracts.
- Transport tests exercise the real generated/message/task contract, mapping, one-call delegation, and error/disposition behavior.
- Infrastructure tests use xorm plus the real migration/database semantics when mapping, locking, transaction, or SQL behavior matters.
- Runtime tests verify Fx registration, duplicate registration failure, reachability, start/drain/shutdown, and redacted configuration behavior.
- Test helpers and generated mocks stay in `*_test.go` or test-only packages that production cannot import.

## Boundary Failures

Reject these shapes:

- generated RPC implementation in `application.go`;
- Integration Message subscriber or task processor under Application;
- `pkg/gen` instead of top-level `gen`;
- BC-level `module.go` instead of `<context>.go`;
- `converter.go` when the House Style filename is `convert.go`;
- another BC's internal package import;
- context-specific business mapping under `internal/pkg`;
- empty layer/mechanism directories added for a hypothetical future use.
