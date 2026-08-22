---
name: ddd-golang-domain
description: Go House Style for accepted Aggregate Roots, Entities, Value Objects, Domain Services, Domain-owned Ports, Repository contracts, validation, and lifecycle realization.
---

# Go Domain Layer

## Applies When

Load this leaf when accepted Go Aggregate Roots, Entities, Value Objects,
Domain Services, Domain-owned Ports, or write Repository contracts are touched.
Accepted design supplies their names, facts, lifecycle, behavior, invariants,
and Port Methods.

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

	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

var (
	domainValidator = validator.New()
	ErrInvalidUser  = errors.New("invalid user")
)

type User struct {
	ID      string `validate:"required,uuid"`
	Name    string `validate:"required,max=24"`
	Email   string `validate:"required,email,max=48"`
	Version int
}

// NewUser establishes valid initial state.
func NewUser(name, email string) (*User, error) {
	user := &User{
		ID:    uuid.Must(uuid.NewV7()).String(),
		Name:  strings.TrimSpace(name),
		Email: strings.ToLower(strings.TrimSpace(email)),
	}
	if err := user.Validate(); err != nil {
		return nil, err
	}
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

```

`validator/v10` is the single validator for business data represented as a Domain Entity or Value Object. Application DTOs and persistence DOs do not duplicate its tags. Cross-field invariants, state transitions, authorization facts and external evidence remain explicit Domain code; tags do not replace them.

An Infrastructure converter may restore an existing Aggregate with a struct
literal and then call `Validate()`. An Application assembler follows the same
rule for existing DTO state. These are the mapping exceptions to Factory
creation. When accepted events exist, their collection initialization follows
[`ddd-golang-events.md`](ddd-golang-events.md).

## Mutation and Persistence Lifecycle

- The Aggregate Root controls changes to owned Entities and enforces invariants synchronously.
- Domain methods may change in-memory state and record Domain Events. They never save, publish, enqueue, log, start a goroutine or choose technical retry/provider policy.
- Persist owned Entities and Value Objects with their root unless the confirmed Model establishes an independent Aggregate.
- Technical audit timestamps stay in the DO. Put time in Domain only when business behavior uses it, and pass the authoritative time into the operation when determinism matters.

Implement the lifecycle branch named by accepted project or DDD authority;
persistence technology does not select the branch.

### Request-scoped Aggregate

A Repository-loaded Aggregate may use optimistic locking:

- a new in-memory Aggregate has `Version == 0` and is inserted with stored version `1`;
- an update increments the stored version only when `id`, loaded `version` and non-deleted predicate match;
- an affected-row mismatch maps to a stable concurrency-conflict error;
- `Repository.Save` does not update the in-memory version.

Under this branch, a successful `Save` makes that loaded instance stale. Application may map already-produced results and drain that transaction's events, but must not mutate or save it again. Reload when a later operation or caller requires current state or the new persistence token.

### Resident Aggregate with checkpoint persistence

Under this branch, the long-lived in-memory Aggregate remains the live runtime authority across checkpoints. Serialize its behavior with the accepted mailbox, lock, or single-owner mechanism. Persistence receives an immutable snapshot/checkpoint; writing a checkpoint does not replace or overwrite the resident instance. A database version may be a checkpoint token rather than a Domain version.

## Entity and Value Object

An Entity has identity and a lifecycle within its Aggregate. Its exported fields follow the same mapping-only rule as the root, and its mutations remain behind Domain methods reached through the root.

A Value Object is defined by attributes:

- construct and validate it in Domain;
- prefer immutable values and methods returning a new value;
- compare by value;
- keep protocol and storage representation outside Domain.

Each accepted Aggregate Root has its own Repository; owned children persist
through their Root.

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

## Domain-owned Port

Declare each accepted Domain-owned Port as a narrow interface beside its direct
Domain owner. Use idiomatic signatures and injection for its accepted sparse
Methods.

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

For an accepted `components/fsm` lifecycle, load
[`ddd-golang-fsm.md`](ddd-golang-fsm.md).

## Import Boundary and Verification

Domain imports the standard library and applicable Domain-focused packages such
as `validator/v10`, `google/uuid`, `components/ddd/event`, and `components/fsm`.
Generated contracts, ConnectRPC/Chi, xorm, Kafka, Asynq, Redis, Fx,
`internal/pkg`, Infrastructure, and another context's internals remain outer.

Test Factories, `Validate`, Aggregate invariants, state transitions, Domain
Service decisions, and accepted no-op behavior directly. Domain tests use real
objects; an accepted Domain-owned Port may use one focused fake. Event and
FSM evidence follows their dedicated leaves.
