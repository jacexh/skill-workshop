---
name: ddd-golang-domain
description: Go house style for Aggregate Roots, Entities, Value Objects, Domain Services, Repository contracts, Domain Events, validation and lifecycle behavior.
---

# Go Domain Layer

Use this guide after EventStorming has confirmed the Model and its consistency boundary. Domain code owns business state, rules and language. It does not own use-case coordination, protocol mapping, persistence mechanics or runtime policy.

## Aggregate Shape and Mapping Surface

Place an Aggregate in `internal/business/<context>/domain/<aggregate>.go`. Use semantic filenames such as `pricing.go` or `subscription.go`; do not pre-create generic `service.go`, `policy.go` or `state.go` files.

This house style permits exported Domain fields so hand-written assemblers and converters can mechanically map existing state:

- export is a representation surface, not a business behavior API;
- Application, Transport and Infrastructure must not branch on exported fields to make Domain decisions or assign them to perform a state transition;
- new Aggregates are created through `domain.NewXxx` or another Domain-named Factory, never by copying a DTO into a struct literal;
- `application/assembler.go` may map existing Application DTO state; `infrastructure/convert.go` may reconstitute persisted DO state;
- mutable slices, maps and pointers are copied at the mapping boundary so a caller cannot mutate Aggregate state through an alias;
- Domain structs may carry `validate` tags, but never protobuf, JSON, HTTP or ORM tags.

The Aggregate still exposes intention-revealing methods for every business change:

```go
package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-jimu/components/ddd/event"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

var (
	domainValidator = validator.New()
	ErrInvalidUser  = errors.New("invalid user")
)

const EventKindUserCreated event.Kind = "user.created"

type User struct {
	ID      string `validate:"required,uuid"`
	Name    string `validate:"required,max=24"`
	Email   string `validate:"required,email,max=48"`
	Version int
	Events  event.Collection
}

// NewUser establishes valid initial state and records the creation fact.
func NewUser(name, email string, occurredAt time.Time) (*User, error) {
	user := &User{
		ID:     uuid.Must(uuid.NewV7()).String(),
		Name:   strings.TrimSpace(name),
		Email:  strings.ToLower(strings.TrimSpace(email)),
		Events: event.NewCollection(),
	}
	if err := user.Validate(); err != nil {
		return nil, err
	}
	user.Events.Add(UserCreated{
		UserID:     user.ID,
		Name:       user.Name,
		Email:      user.Email,
		OccurredAt: occurredAt,
	})
	return user, nil
}

func (u *User) Validate() error {
	if err := domainValidator.Struct(u); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidUser, err)
	}
	return nil
}

func (u *User) Rename(name string) error {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 24 {
		return ErrInvalidUser
	}
	u.Name = name
	return nil
}

type UserCreated struct {
	UserID     string
	Name       string
	Email      string
	OccurredAt time.Time
}

func (UserCreated) Kind() event.Kind { return EventKindUserCreated }
```

`validator/v10` is the single validator for business data represented as a Domain Entity or Value Object. Application DTOs and persistence DOs do not duplicate its tags. Cross-field invariants, state transitions, authorization facts and external evidence remain explicit Domain code; tags do not replace them.

An Infrastructure converter may restore an existing Aggregate with a struct literal, initialize a fresh `event.Collection`, then call `Validate()`. It must not replay creation rules or record a creation event. An Application assembler follows the same rule for existing DTO state. These are the only mapping exceptions to Factory creation.

## Mutation and Persistence Lifecycle

- The Aggregate Root controls changes to owned Entities and enforces invariants synchronously.
- Domain methods may change in-memory state and record Domain Events. They never save, publish, enqueue, log, start a goroutine or choose retry/provider policy.
- Persist owned Entities and Value Objects with their root unless the confirmed Model establishes an independent Aggregate.
- Technical audit timestamps stay in the DO. Put time in Domain only when business behavior uses it, and pass the authoritative time into the operation when determinism matters.

A persisted mutable Aggregate uses optimistic locking:

- a new in-memory Aggregate has `Version == 0` and is inserted with stored version `1`;
- an update increments the stored version only when `id`, loaded `version` and non-deleted predicate match;
- an affected-row mismatch maps to a stable concurrency-conflict error;
- `Repository.Save` does not update the in-memory version.

After a successful `Save`, that Aggregate instance is stale. Application may read already-produced result fields, assemble a DTO and drain the events recorded by that transaction. It must not invoke another business mutation or save the instance again. Because its `Version` is also stale, a post-Save result must not present that value as the newly persisted concurrency token; reload when a caller requires the current token. A later transaction reloads a new Aggregate with a fresh `event.Collection`.

## Entity and Value Object

An Entity has identity and a lifecycle within its Aggregate. Its exported fields follow the same mapping-only rule as the root, and its mutations remain behind Domain methods reached through the root.

A Value Object is defined by attributes:

- construct and validate it in Domain;
- prefer immutable values and methods returning a new value;
- compare by value;
- keep protocol and storage representation outside Domain.

If a child is independently loaded, saved or concurrently modified, revisit the Aggregate boundary instead of adding a child Repository mechanically.

## Domain Service

Use a Domain Service for an important named Domain operation that does not naturally belong to an Entity, Value Object or Aggregate. It does not need to span multiple Aggregates.

A responsible Domain Service:

- has a ubiquitous-language name and a semantic filename;
- is stateless and deterministic by default;
- accepts Domain values, snapshots, time and authoritative evidence;
- returns a decision, value, error or fact;
- calls public Aggregate behavior rather than assigning exported state;
- does not save, control transactions, log, retry, schedule or depend on generated/provider APIs.

```go
package domain

type AllocationService struct{}

func (AllocationService) Allocate(
	demand Demand,
	candidates []CapacitySnapshot,
) (Allocation, error) {
	// The decision is Domain logic; Application supplied the facts.
	return chooseCapacity(demand, candidates)
}
```

Application normally loads facts and participants before calling the service. A Domain-owned semantic collaborator, including a narrow Repository query capability, is allowed only when precomputing a primitive would erase Domain meaning. The query does not eliminate a time-of-check/time-of-use race; correctness that depends on concurrent state requires an accepted constraint, lock, isolation, or other consistency mechanism outside the service's control. The service still never calls `Save` or controls the transaction. A cross-Aggregate calculation does not authorize atomic persistence of several roots.

## Repository Contract

Place the write Repository contract in `domain/repository.go`. It represents a collection of Aggregate Roots, not a table API:

```go
package domain

import "context"

type Repository interface {
	Get(context.Context, string) (*User, error)
	Save(context.Context, *User) error
}
```

- Operate on one accepted root; owned child persistence is an implementation detail of that root.
- Keep SQL, xorm sessions, transactions, cache keys and provider options out of the interface.
- Return stable not-found and concurrency errors that outer layers can classify with `errors.Is/As`.
- Command-side loading and a focused single-Aggregate read may use this Repository.
- Lists, pages, history, reports, statistics, cross-Aggregate composition and optimized projections use an Application QueryRepository; see [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md).

Several independent root parameters, workflow verbs or table-shaped methods are model pressure. A shared transaction or table does not prove a shared Aggregate.

## Domain Events

Use `github.com/go-jimu/components/ddd/event`. An internal Domain Event is a past-tense fact in this bounded context and is not an Integration Message contract.

- The Aggregate records accepted facts in `event.Collection`.
- Only Application drains the collection, once, after successful persistence.
- Infrastructure reconstitution initializes `event.NewCollection()` and never drains it.
- Do not expose another bounded context to this event type.

`Save -> Events.Drain() -> event.Dispatcher.DispatchAll()` is used only when confirmed recovery semantics and accepted project constraints permit a same-context, post-commit best-effort follow-up. `DispatchAll` accepts background work; it does not prove that handlers completed. Durable or recoverable delivery requires an appropriate Codify-selected mechanism; do not describe in-memory dispatch as reliable. The complete flow belongs to [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md).

## Lifecycle and FSM

Use enum plus Aggregate methods for a simple lifecycle. When the accepted lifecycle has many states, guarded edges, several actors or genuinely state-specific behavior, use `github.com/go-jimu/components/fsm` instead of duplicating transition switches across callers.

The Aggregate remains the `fsm.StateContext`; callers still invoke business methods:

```go
func (o *Order) CurrentState() fsm.State { return o.state }

func (o *Order) SetState(next fsm.State) error {
	state, ok := next.(orderState)
	if !ok {
		return ErrInvalidOrderState
	}
	o.state = state
	return nil
}

func (o *Order) transition(action fsm.Action) error {
	return fsm.Transit(o, fsm.MustGetStateMachine("order"), action)
}
```

State behavior and guards stay in Domain. Application calls `Pay`, `Cancel` or another business method, not `fsm.Transit`. Infrastructure persists the state label, not transition rules. A state count is evidence of complexity, not a keyword trigger; do not introduce FSM until the facts warrant it.

## Import Boundary and Verification

Domain may import the standard library and the adopted Domain-focused packages such as `validator/v10`, `google/uuid`, `components/ddd/event` and conditional `components/fsm`. It must not import generated contracts under `gen/`, ConnectRPC/Chi, xorm, Kafka, Asynq, Redis, Fx, `internal/pkg`, Infrastructure or another bounded context's internal packages.

Test Factories, `Validate`, Aggregate invariants, state transitions, Domain Service decisions, event recording and no-op/idempotent behavior directly. Domain tests normally need no mocks; a focused fake is justified only for an accepted semantic Domain collaborator.
