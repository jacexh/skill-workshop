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

A behavior confirmed under a Root or Entity belongs on that type's receiver. Keep a package function only for construction, an ownerless pure calculation, or a private algorithm called by the owning method. A function whose main argument is one Domain object and whose purpose is to inspect or change that object's state should normally be a method.

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
- Domain methods may change in-memory state and record Domain Events. They never save, publish, enqueue, log, start a goroutine or choose technical retry/provider policy. When they decide a capability is business-required, its collaborator contract is Domain-owned and uses Domain language; Application supplies the implementation and Infrastructure owns provider mechanics.
- Persist owned Entities and Value Objects with their root unless the confirmed Model establishes an independent Aggregate.
- Technical audit timestamps stay in the DO. Put time in Domain only when business behavior uses it, and pass the authoritative time into the operation when determinism matters.

Select one lifecycle from accepted project authority or Tactical Design. Persistence does not select it.

### Request-scoped Aggregate

A Repository-loaded Aggregate may use optimistic locking:

- a new in-memory Aggregate has `Version == 0` and is inserted with stored version `1`;
- an update increments the stored version only when `id`, loaded `version` and non-deleted predicate match;
- an affected-row mismatch maps to a stable concurrency-conflict error;
- `Repository.Save` does not update the in-memory version.

Under this branch, a successful `Save` makes that loaded instance stale. Application may map already-produced results and drain that transaction's events, but must not mutate or save it again. Reload when a later operation or caller requires current state or the new persistence token.

### Resident Aggregate with checkpoint persistence

Under this branch, the long-lived in-memory Aggregate remains the live runtime authority across checkpoints. Serialize its behavior with the accepted mailbox, lock, or single-owner mechanism. Persistence receives an immutable snapshot/checkpoint; a successful checkpoint does not replace the resident instance, and a failed checkpoint does not implicitly roll back or overwrite its live state. A database version may be a checkpoint token rather than a Domain version. Exact durability, retry, recovery, and shutdown behavior belong to the accepted design, not this House Style.

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

When a confirmed same-context use case must change several independent roots atomically, the Domain Service owns the named cross-Aggregate business rule and applies it through those roots' public behavior. Application still loads and saves every root and defines the transaction scope. The presence of a Domain Service does not itself authorize the stronger consistency boundary.

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

Application normally supplies facts, participants, and semantic capabilities. A Domain owner or Domain Service may invoke a narrow Domain-owned collaborator when precomputing a primitive would erase the rule or its required timing. Application supplies that contract's implementation at the use-case boundary; provider vocabulary, context, retry mechanics, and external execution remain outside Domain. A query does not eliminate a time-of-check/time-of-use race, and a Domain collaborator never authorizes atomic persistence by itself.

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
- In an accepted request-scoped post-commit flow, only Application drains the collection, once, after successful persistence. A resident Aggregate follows its separately accepted event/checkpoint policy; House Style does not make checkpoint success the precondition for Domain sequencing or live-state event handling.
- Infrastructure reconstitution initializes `event.NewCollection()` and never drains it.
- Do not expose another bounded context to this event type.

`Save -> Events.Drain() -> event.Dispatcher.DispatchAll()` is used only when confirmed recovery semantics and accepted project constraints permit a same-context, post-commit best-effort follow-up. `DispatchAll` accepts background work; it does not prove that handlers completed. Durable or recoverable delivery requires an appropriate Codify-selected mechanism; do not describe in-memory dispatch as reliable. The complete flow belongs to [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md).

## Lifecycle and FSM

Use enum plus Aggregate methods for a simple lifecycle. When the accepted lifecycle has many states, guarded edges, several actors or genuinely state-specific behavior, use `github.com/go-jimu/components/fsm` instead of duplicating transition switches across callers.

The core model is state polymorphism: the same Aggregate delegates a behavior
to its current state, and each concrete state implements that behavior
differently. Define the business behavior interface in Domain, embed
`*fsm.SimpleState` in a base/default state whose methods return errors, and
override only the behaviors supported by each concrete state:

```go
const (
	StateUnpaid fsm.StateLabel = "order.unpaid"
	StatePaid   fsm.StateLabel = "order.paid"
	ActionPay   fsm.Action     = "pay"
)

var ErrInvalidPaymentAmount = errors.New("payment amount must be positive")

type orderState interface {
	fsm.State
	Pay(amount int) error
	Cancel() error
}

type baseOrderState struct{ *fsm.SimpleState }

func (s *baseOrderState) Pay(int) error {
	return fmt.Errorf("%s cannot pay", s.Label())
}

func (s *baseOrderState) Cancel() error {
	return fmt.Errorf("%s cannot cancel", s.Label())
}

type unpaidOrderState struct{ baseOrderState }

func newUnpaidOrderState() fsm.State {
	return &unpaidOrderState{baseOrderState{
		SimpleState: fsm.NewSimpleState(StateUnpaid),
	}}
}

func (s *unpaidOrderState) Pay(amount int) error {
	if amount <= 0 {
		return ErrInvalidPaymentAmount
	}
	order := s.Context().(*Order)
	order.paidAmount = amount
	return nil
}
```

The Aggregate owns the current concrete state and implements
`fsm.StateContext`. Public business methods call the current state's behavior
first, then use a private `fsm.Transit` helper only after that behavior succeeds:

```go
type Order struct {
	state      orderState
	paidAmount int
}

func NewOrder() *Order {
	initial := newUnpaidOrderState().(orderState)
	order := &Order{state: initial}
	initial.SetContext(order)
	return order
}

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

func (o *Order) Pay(amount int) error {
	if err := o.state.Pay(amount); err != nil {
		return err
	}
	return o.transition(ActionPay)
}
```

Call `RegisterStateBuilder` for every label referenced by an edge, add
transitions, and call `Check` during setup or tests. Register the checked machine through
`RegisterStateMachine`, which freezes it and exposes the read-only
`RuntimeStateMachine` used by `MustGetStateMachine`. Never use
`HasTransition` as the permission check before invoking state behavior: the
concrete state method owns acceptance or rejection.

`Condition` is edge selection after behavior succeeds, not a replacement for
business validation. A nil condition is unconditional; candidates for the same
`from + action` are evaluated in add order and the first match wins. If none
matches, `fsm.Transit` leaves the state unchanged. It builds the selected target,
calls `next.SetContext(o)`, then delegates assignment and any state-change event
recording to `SetState`.

State behavior and guards stay in Domain. Application calls `Pay`, `Cancel` or
another business method, not `fsm.Transit`. Infrastructure persists the state
label and reconstitutes the matching concrete state with its Aggregate context;
it does not persist transition rules. A state count is evidence of complexity,
not a keyword trigger; do not introduce FSM until the facts warrant it.

## Import Boundary and Verification

Domain may import the standard library and the adopted Domain-focused packages such as `validator/v10`, `google/uuid`, `components/ddd/event` and conditional `components/fsm`. It must not import generated contracts under `gen/`, ConnectRPC/Chi, xorm, Kafka, Asynq, Redis, Fx, `internal/pkg`, Infrastructure or another bounded context's internal packages.

Test Factories, `Validate`, Aggregate invariants, state transitions, Domain Service decisions, event recording and no-op/idempotent behavior directly. Domain tests normally need no mocks; a focused fake is justified only for an accepted semantic Domain collaborator.
