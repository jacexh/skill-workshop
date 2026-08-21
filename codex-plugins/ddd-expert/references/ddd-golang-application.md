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
- after Task Queue has been accepted, `application/task` may import its own generated `gen/<context>/task/v1` payload schema and use `github.com/go-jimu/components/taskqueue` types such as `Definition` and `Enqueuer` to construct protobuf-backed tasks.

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

The assembler has no logging, I/O, transaction or business branch. It does not map protobuf or DO types. DTO-to-Entity assembly is for existing data and is followed by Domain validation before behavior. A create-user use case calls `domain.NewUser(...)`; it never calls `AssembleUserDTO` to bypass Factory rules or creation events. Under the request-scoped lifecycle, an assembled post-`Save` `Version` is stale and must not be returned as the current persistence concurrency token.

Persistence mapping belongs in `infrastructure/convert.go` and follows the analogous `DO <-> Domain Entity` shape.

## Command Handler

Place a command in `application/command/<use_case>.go`. The handler constructs or loads Domain state, calls Domain behavior and persists the accepted Aggregate. Do not repeat Domain validation on the command DTO.

The following shape applies when the accepted use case includes post-commit Domain Event dispatch:

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

	// This example uses the request-scoped lifecycle: Save makes user stale.
	result := CreatedUser{ID: user.ID, Name: user.Name, Email: user.Email}
	if err = h.dispatcher.DispatchAll(user.Events.Drain()); err != nil {
		// The state is committed. This handler owns the dispatcher error.
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

When no accepted same-context reaction exists, omit the dispatcher.

A normal command changes one Aggregate. Only a confirmed Model may authorize one Application use case to save several independent Aggregate Roots atomically, and only within one bounded context and one local transactional resource. Without that complete authority, expose the missing consistency decision instead of hiding it in a transaction or multi-Root Repository.

For the confirmed exception, define the provider-neutral contract once for the project rather than once per bounded context:

```go
// internal/pkg/transaction/transactor.go
package transaction

import "context"

type Transactor interface {
	Within(context.Context, func(context.Context) error) error
}
```

The Command Handler receives `transaction.Transactor` and calls `Within`. Inside its callback it:

1. passes the derived context unchanged to every participating Repository;
2. loads and locks roots in stable identity order when locking is required;
3. invokes the named Domain Service, which applies business rules through public Aggregate behavior;
4. saves each root through its own Repository; and
5. returns an error for any failed decision or save so Infrastructure rolls back the whole scope.

Application defines the transaction scope; Infrastructure owns begin, enlistment, commit, and rollback. The callback contains no RPC, Kafka, file operation, event publication, or goroutine.

Publish Domain Events and return the successful result only after `Within` commits. Request-scoped Aggregate instances and staged events belong to that transaction scope. A resident Aggregate follows its accepted checkpoint policy rather than acting as a transactional working copy.

## Query Handler

All inbound reads delegate through `Application.Queries`. A focused read of one Aggregate may use the Domain Repository when full reconstitution is reasonable and no distinct read semantics result. A read that has a different model, composition, performance, freshness, source or authorization uses an Application QueryRepository. See [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md).

Transport never calls a Domain Repository or QueryRepository directly.

## Domain Event Handler and Published Fact

A same-context reaction lives in `application/eventhandler/<fact>.go` and implements `event.Handler`. It is a follow-up transaction; it cannot roll back the producing command.

When it publishes this context's accepted fact, Application may use the
producer-owned generated contract and provider-neutral publisher directly.
`UserCreated` remains the internal Domain Event; `UserRegisteredV1` is the
producer-owned Published Fact Contract. It is an Integration Message contract
whose protobuf value is used as the payload of `message.Message`:

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

The full implementation imports `github.com/go-jimu/components/ddd/event`, `github.com/go-jimu/components/ddd/message` and its own `example/gen/user/integration/v1` package. It must not import Kafka. Because `event.Handler.Handle` has no error result, this handler owns the publisher error. Use [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) for the complete event and message flow.

## Application Services, Ports and Transactions

Use a named Application service only for meaningful use-case orchestration. It may coordinate Domain behavior, authorization, a read model, ACL, published fact or accepted background-work capability. It must not classify Domain state or become a provider facade.

When Application owns the use-case continuation, place its outbound port beside the consuming use case. Name the semantic capability (`EligibilityProvider`, `ReserveCredit`, `CustomerIntentSender`), not the mechanism (`HTTPClient`, `BrokerPublisher`, `RedisStore`, `TxManager`). When Domain owns the call timing, keep the collaborator contract in Domain and let Application supply its implementation instead of duplicating it as an Application port. Do not wrap an already accepted provider-neutral go-jimu port with a same-shape local interface.

The conditional `internal/pkg/transaction.Transactor` above is a shared technical execution contract, not a semantic outbound port. Do not duplicate it under each BC's `application`, call it `UnitOfWork`, expose Repository factories through it, or pass options, `*xorm.Session`, or another provider handle inward. Add isolation controls only when the accepted local transaction contract defines them.

Application owns what must commit together; Infrastructure owns how. A single-Aggregate Repository may hide its storage transaction only when no Application scope is active; under an active scope it joins the current transaction. Raw `xorm.Session` never enters Application.

## Errors, Logging and Tests

- Preserve stable Domain error identity with `errors.Is/As`; add `oops` context only when this layer contributes new diagnostics.
- Command and Query handlers do not duplicate the Transport completion log.
- Application logs a business-semantic fact only when it has independent operational value. Durable evidence is a Domain Event, audit record or persisted state, not a log line.
- Application becomes the execution logger only for a terminal flow with no outer observer or when it deliberately swallows a best-effort failure.

Test handlers with real Domain objects and focused fakes for Repository, QueryRepository, ACL and outbound ports. Cover orchestration and stable errors. Only when an accepted request-scoped post-commit dispatch flow exists, cover persistence-before-dispatch. For a confirmed multi-Root use case, verify that one `Within` callback encloses every load, Domain decision, and save, but do not claim a fake Transactor proves physical enlistment or rollback. Do not reimplement Domain rules in Application tests.

## File Shape

```text
application/
  application.go
  assembler.go
  command/<use_case>.go
  query/<use_case>.go
  eventhandler/<fact>.go       # when same-BC reaction exists
  task/<task>.go               # TaskType, Definition, protobuf-backed constructor
```

ConnectRPC handlers, Integration Message subscribers and task processors belong to Transport, not Application.
