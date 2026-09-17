---
name: ddd-golang-application
description: Go House Style for the bounded-context Application entry, command/query orchestration, DTO assembly, semantic transactions, and outbound ports.
---

# Go Application Layer

## Applies When

Application implements use cases. It coordinates Domain behavior and semantic ports without knowing whether a caller is ConnectRPC, HTTP, an Integration Message or a task processor.

## Boundary and Allowed Exceptions

Application owns transport-neutral commands, queries, results and DTOs. It must not import ConnectRPC/Chi, RPC generated types, xorm sessions, Kafka, Asynq, Redis, Fx or server lifecycle APIs.

Two accepted, narrow exceptions do not collapse the layer boundary:

- a producer-side `application/eventhandler` may map its own Domain Event to the same bounded context's generated Published Fact Contract under `gen/<context>/integration/...` and publish it through `github.com/go-jimu/components/ddd/message.Publisher`;
- after Task Queue has been accepted, `application/task` may import its own generated `gen/<context>/task/v1` payload schema and use `github.com/go-jimu/components/taskqueue` types such as `Definition` and `Enqueuer` to construct protobuf-backed tasks.

Generated RPC types remain Transport. Kafka and Asynq types remain Runtime. A sender of an asynchronous intent calls a local semantic port; Infrastructure/ACL maps that intent to the receiving context's generated contract.

## Application Entry

Keep one `Application` type in `application/application.go`, following the
[shared Application shape](ddd-core.md#application-and-transport-shape).
Put its use-case methods and input/result types in files named for their cohesive
responsibility, all in package `application`.

```go
package application

import "example/internal/business/user/domain"

type Application struct {
	repository domain.Repository
}

func NewApplication(repository domain.Repository) *Application {
	return &Application{repository: repository}
}
```

Add QueryRepository or cohesive query-object dependencies when the read side
needs them. `NewApplication` only assigns dependencies; Runtime owns Fx wiring
and separate event-handler, message-subscriber, and task-processor registration.

## Mandatory `assembler.go`

`application/assembler.go` owns pure mapping between existing Application DTO state and Domain Entity state. Use the house naming consistently:

```go
package application

import (
	"example/internal/business/user/domain"
)

type User struct {
	ID      string
	Name    string
	Email   string
	Version int
}

// AssembleUserDTO maps existing DTO state; it is not a creation path.
func AssembleUserDTO(dto *User) *domain.User {
	if dto == nil {
		return nil
	}
	return &domain.User{
		ID: dto.ID, Name: dto.Name, Email: dto.Email, Version: dto.Version,
	}
}

func AssembleUserEntity(entity *domain.User) *User {
	if entity == nil {
		return nil
	}
	return &User{
		ID: entity.ID, Name: entity.Name, Email: entity.Email, Version: entity.Version,
	}
}
```

The assembler has no logging, I/O, transaction or business branch. It does not map protobuf or DO types. DTO-to-Entity assembly is for existing data and is followed by Domain validation before behavior. A create-user use case calls `domain.NewUser(...)`; it never calls `AssembleUserDTO` to bypass Factory rules or creation events. Under the request-scoped lifecycle, an assembled post-`Save` `Version` is stale and must not be returned as the current persistence concurrency token.

Persistence mapping belongs in `infrastructure/convert.go` and follows the analogous `DO <-> Domain Entity` shape.

## Command Methods

A named Application method constructs or loads Domain state, calls Domain behavior and persists the accepted Aggregate. Domain owns validation of command-side business values.

Use this ordinary one-Root shape:

```go
package application

import (
	"context"

	"example/internal/business/user/domain"
)

type CreateUser struct {
	Name  string
	Email string
}

type CreatedUser struct {
	ID, Name, Email string
}

func (a *Application) CreateUser(
	ctx context.Context,
	cmd CreateUser,
) (CreatedUser, error) {
	user, err := domain.NewUser(cmd.Name, cmd.Email)
	if err != nil {
		return CreatedUser{}, err
	}
	if err = a.repository.Save(ctx, user); err != nil {
		return CreatedUser{}, err
	}

	return CreatedUser{ID: user.ID, Name: user.Name, Email: user.Email}, nil
}
```

When accepted local events exist, add their flow from
[`ddd-golang-events.md`](ddd-golang-events.md). Published contracts use
[`ddd-golang-messages.md`](ddd-golang-messages.md).

A normal command changes one Aggregate. For a confirmed same-context,
one-resource multi-Root atomic change, load
[the transaction guide](ddd-golang-transactions.md) for Application scope and
Infrastructure participation. Domain meaning must establish that consistency
boundary before it is implemented.

## Read Models

Expose reads through named Application methods or a cohesive query object. Return Application read models suited to the consumer. A focused Aggregate read may use the Domain Repository; distinct list, search, report, or projection semantics use a QueryRepository. The [read-side guide](ddd-golang-cqrs.md) owns these shapes; neither a query nor its result requires a per-query Handler.

Transport never calls a Domain Repository or QueryRepository directly.

## Application Services, Ports and Transactions

Use a named Application service only for meaningful use-case orchestration. It may coordinate Domain behavior, authorization, a read model, ACL, published fact or accepted background-work capability. It must not classify Domain state or become a provider facade.

When Application owns the use-case continuation, place its outbound port beside the consuming use case. Name the contract for its semantic role with a `Port` suffix, such as `CreditReservationPort`; keep provider-mechanism names on Infrastructure implementations. When a recorded Domain Behavior owns call timing, use its Domain-owned Port; do not duplicate it here or prefetch its result. Do not wrap an already accepted provider-neutral go-jimu port with a same-shape local interface.

Application owns what must commit together; Infrastructure owns how. A single-Aggregate Repository may hide its storage transaction only when no Application scope is active; under an active scope it joins the current transaction. Raw `xorm.Session` never enters Application.

## Errors, Logging and Tests

- Preserve stable Domain error identity with `errors.Is/As`; add `oops` context only when this layer contributes new diagnostics.
- Application methods do not duplicate the Transport completion log.
- Application logs a business-semantic fact only when it has independent operational value. Durable evidence is a Domain Event, audit record or persisted state, not a log line.
- Application becomes the execution logger only for a terminal flow with no outer observer or when it deliberately swallows a best-effort failure.

Test use cases with real Domain objects and focused fakes for Repository,
QueryRepository, ACL, and outbound ports. Cover orchestration and stable errors.
Changed multi-Root behavior follows the transaction guide. Event behavior
follows the event leaf.

## File Shape

```text
application/
  application.go
  assembler.go
  <responsibility>.go          # Application methods and input/result types
  query/                      # distinct read models/contracts or cohesive queries, when needed
  eventhandler/<fact>.go       # when same-BC reaction exists
  task/<task>.go               # TaskType, Definition, protobuf-backed constructor
```

ConnectRPC handlers, Integration Message subscribers and task processors belong to Transport, not Application.
