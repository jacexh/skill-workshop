---
name: ddd-golang-application
description: Go house style for the bounded-context Application entry point, command/query orchestration, DTO assembly, semantic transactions, Domain Event reactions and outbound ports.
---

# Go Application Layer

Application implements use cases. It coordinates Domain behavior and semantic ports without knowing whether a caller is ConnectRPC, HTTP, an Integration Message or a task processor.

## Boundary and Allowed Exceptions

Application owns transport-neutral commands, queries, results and DTOs. It must not import ConnectRPC/Chi, RPC generated types, xorm sessions, Kafka, Asynq, Redis, Fx or server lifecycle APIs.

Two accepted, narrow exceptions do not collapse the layer boundary:

- a producer-side `application/eventhandler` may map its own Domain Event to the same bounded context's generated Published Fact Contract under `gen/<context>/integration/...` and publish it through `github.com/go-jimu/components/ddd/message.Publisher`;
- after Task Queue has been accepted, `application/task` may define the provider-neutral task contract and use `github.com/go-jimu/components/taskqueue` types such as `Definition` and `Enqueuer`.

Generated RPC types remain Transport. Kafka and Asynq types remain Runtime. A sender of an asynchronous intent calls a local semantic port; Infrastructure/ACL maps that intent to the receiving context's generated contract.

## Mandatory `application.go`

Every bounded context has `application/application.go`. It groups all Command and Query handlers exposed to inbound Transport adapters:

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

`NewApplication` only groups dependencies. It performs no I/O, transaction, event dispatch, runtime registration or forwarding facade work, and it does not import Fx. Domain Event handlers, message subscribers and task processors are registered separately by `<context>.go`.

## Mandatory `assembler.go`

`application/assembler.go` owns pure mapping between existing Application DTO state and Domain Entity state. Use the house naming consistently:

```go
package application

import (
	"github.com/go-jimu/components/ddd/event"
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
		Events: event.NewCollection(),
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

The assembler has no logging, I/O, transaction or business branch. It does not map protobuf or DO types. DTO-to-Entity assembly is for existing data and is followed by Domain validation before behavior. A create-user use case calls `domain.NewUser(...)`; it never calls `AssembleUserDTO` to bypass Factory rules or creation events. After `Save`, an assembled `Version` is the stale in-memory value and must not be returned as the current persistence concurrency token.

Persistence mapping belongs in `infrastructure/convert.go` and follows the analogous `DO <-> Domain Entity` shape.

## Command Handler

Place a command in `application/command/<use_case>.go`. The handler constructs or loads Domain state, calls Domain behavior and persists the accepted Aggregate. Do not repeat Domain validation on the command DTO.

The following shape applies when confirmed recovery semantics permit post-commit best-effort Domain Event dispatch:

```go
package command

import (
	"context"
	"log/slog"
	"time"

	"github.com/go-jimu/components/ddd/event"
	"github.com/go-jimu/components/sloghelper"
	"example/internal/business/user/domain"
)

type CreateUser struct {
	Name  string
	Email string
}

type CreatedUser struct {
	ID, Name, Email string
}

type CreateUserHandler struct {
	repository domain.Repository
	dispatcher event.Dispatcher
}

func NewCreateUserHandler(
	repository domain.Repository,
	dispatcher event.Dispatcher,
) *CreateUserHandler {
	return &CreateUserHandler{repository: repository, dispatcher: dispatcher}
}

func (h *CreateUserHandler) Handle(
	ctx context.Context,
	cmd CreateUser,
) (CreatedUser, error) {
	user, err := domain.NewUser(cmd.Name, cmd.Email, time.Now().UTC())
	if err != nil {
		return CreatedUser{}, err
	}
	if err = h.repository.Save(ctx, user); err != nil {
		return CreatedUser{}, err
	}

	// Save makes user stale; only result mapping and this transaction's drain remain.
	result := CreatedUser{ID: user.ID, Name: user.Name, Email: user.Email}
	if err = h.dispatcher.DispatchAll(user.Events.Drain()); err != nil {
		// The state is committed. This best-effort failure is swallowed and logged here.
		sloghelper.FromContext(ctx).WarnContext(
			ctx, "domain event dispatch rejected",
			slog.String("operation", "user.events.dispatch"),
			slog.String("user_id", user.ID),
			sloghelper.Error(err),
		)
	}
	return result, nil
}
```

Without confirmed best-effort follow-up semantics, omit the dispatcher. When durable handoff is required, use the prescribed outbox/task/process mechanism rather than adding a second direct-publish path.

A normal command changes one Aggregate. If correctness appears to require saving several independent roots atomically, return to the collaboration design instead of hiding the conflict in a transaction or Repository method.

## Query Handler

All inbound reads delegate through `Application.Queries`. A focused read of one Aggregate may use the Domain Repository when full reconstitution is reasonable and no distinct read semantics result. A read that has a different model, composition, performance, freshness, source or authorization uses an Application QueryRepository. See [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md).

Transport never calls a Domain Repository or QueryRepository directly.

## Domain Event Handler and Published Fact

A same-context reaction lives in `application/eventhandler/<fact>.go` and implements `event.Handler`. It is a follow-up transaction; it cannot roll back the producing command.

When it publishes this context's accepted fact, Application may use the producer-owned generated contract and provider-neutral publisher directly:

```go
payload := &userintegrationv1.UserRegisteredV1{
	UserId: created.UserID,
	Name: created.Name,
	Email: created.Email,
}
integrationMessage, err := message.New(
	message.KindOf(payload),
	payload,
	message.WithKey(created.UserID),
	message.WithOccurredAt(created.OccurredAt),
)
if err == nil {
	err = h.publisher.Publish(ctx, integrationMessage)
}
```

The full implementation imports `github.com/go-jimu/components/ddd/event`, `github.com/go-jimu/components/ddd/message` and its own `example/gen/user/integration/v1` package. It must not import Kafka. Because `event.Handler.Handle` has no error result, this handler owns logging for a failure it cannot return. Do not treat direct publication as reliable delivery; use [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) for the mechanism Codify derives from confirmed delivery semantics and project constraints.

## Application Services, Ports and Transactions

Use a named Application service only for meaningful use-case orchestration. It may coordinate Domain behavior, authorization, a read model, ACL, published fact or accepted background-work capability. It must not classify Domain state or become a provider facade.

Place an outbound port beside the use case that consumes it. Name the semantic capability (`EligibilityProvider`, `ReserveCredit`, `CustomerIntentSender`), not the mechanism (`HTTPClient`, `BrokerPublisher`, `RedisStore`, `TxManager`). Do not wrap an already accepted provider-neutral go-jimu port with a same-shape local interface.

Application owns what must commit together; Infrastructure owns how. A single-Aggregate Repository may hide its storage transaction. Confirmed state-plus-outbox atomicity needs an explicit semantic capability; raw `xorm.Session` never enters Application.

## Errors, Logging and Tests

- Preserve stable Domain error identity with `errors.Is/As`; add `oops` context only when this layer contributes new diagnostics.
- Command and Query handlers do not duplicate the Transport completion log.
- Application logs a business-semantic fact only when it has independent operational value. Durable evidence is a Domain Event, audit record or persisted state, not a log line.
- Application becomes the execution logger only for a terminal flow with no outer observer or when it deliberately swallows a best-effort failure.

Test handlers with real Domain objects and focused fakes for Repository, QueryRepository, ACL and outbound ports. Cover orchestration, stable errors, persistence-before-dispatch and committed-but-not-delivered behavior. Do not reimplement Domain rules in Application tests.

## File Shape

```text
application/
  application.go
  assembler.go
  command/<use_case>.go
  query/<use_case>.go
  eventhandler/<fact>.go       # when same-BC reaction exists
  task/<task>.go               # only when background execution is required
```

ConnectRPC handlers, Integration Message subscribers and task processors belong to Transport, not Application.
