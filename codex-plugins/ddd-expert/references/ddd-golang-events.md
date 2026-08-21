---
name: ddd-golang-events
description: Go House Style for accepted local Domain Events, collections, dispatch, and same-context handlers.
---

# Go Domain Events

## Applies When

Load this leaf only when the accepted design contains a local Domain Event or a
same-context event reaction. Use
`github.com/go-jimu/components/ddd/event`.

## Placement and Event Shape

Place event types in the producing Domain and handlers under the same context's
`application/eventhandler/`.

```go
// internal/business/user/domain/event.go
package domain

import (
	"time"

	"github.com/go-jimu/components/ddd/event"
)

const EventKindUserCreated event.Kind = "user.created"

type UserCreated struct {
	UserID     string
	Name       string
	Email      string
	OccurredAt time.Time
}

func (UserCreated) Kind() event.Kind { return EventKindUserCreated }
```

The Aggregate owns an `event.Collection`, changes state, then calls `Add` with
the accepted fact. Reconstitution initializes `event.NewCollection()` and
records no creation event.

## Request-scoped Dispatch Shape

For an accepted request-scoped post-commit reaction, Application uses:

```text
Repository.Save -> Aggregate.Events.Drain -> Dispatcher.DispatchAll
```

Drain once after successful persistence. The loaded request-scoped Aggregate
may supply that command's result and drained events, then is stale. A handler
that changes state enters a fresh Application command and transaction.

`event.Dispatcher.DispatchAll` returns an error. The command handler returns or
classifies that error through the ordinary Application error convention.

```go
type UserCreatedHandler struct {
	app *application.Application
}

var _ event.Handler = (*UserCreatedHandler)(nil)

func (*UserCreatedHandler) Listening() []event.Kind {
	return []event.Kind{domain.EventKindUserCreated}
}

func (h *UserCreatedHandler) Handle(fact event.Event) {
	created, ok := fact.(domain.UserCreated)
	if !ok {
		return
	}
	h.app.Commands.PrepareProfile.Handle(context.Background(), command.PrepareProfile{
		UserID: created.UserID,
	})
}
```

Because `event.Handler` has no error result or caller context, a handler owns
any result it suppresses and logs it once under the Application logging
convention. Domain event payloads carry business correlation only; technical
trace context stays outer.

For a producer-owned published fact, the handler shape continues in
[ddd-golang-messages.md](ddd-golang-messages.md).

## Registration and Verification

The Bounded Context module registers every handler before serving work. Test
state change and event recording with real Aggregates, then test dispatch and
handler mapping with the real event value. Composition evidence proves that
every accepted handler is registered and reachable.
