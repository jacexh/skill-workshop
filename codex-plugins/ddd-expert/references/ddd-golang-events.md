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
`application/eventhandler/`. An event is a Domain value type with an
`OccurredAt` field and a value-receiver `Kind()` that returns a package constant
such as `EventKindUserCreated event.Kind = "user.created"`.

The Aggregate holds an `event.Events` field, changes state, then calls `Add`
with the accepted fact. Reconstitution records no creation event.

## Request-scoped Dispatch Shape

For an accepted request-scoped post-commit reaction, Application uses:

```text
Repository.Save -> Aggregate.Events.Drain -> Dispatcher.DispatchAll
```

Drain once after successful persistence. The loaded request-scoped Aggregate
may supply that command's result and drained events, then is stale. A handler
that changes state enters a fresh Application command and transaction.

The Application method returns or classifies a `DispatchAll` error through the
ordinary Application error convention.

A handler type-asserts its concrete event, ignores any other type, and
delegates to one Application method:

```go
// internal/business/user/application/eventhandler/user_created.go
type UserCreatedHandler struct{ app *application.Application }

var _ event.Handler = (*UserCreatedHandler)(nil)

func (*UserCreatedHandler) Listening() []event.Kind {
	return []event.Kind{domain.EventKindUserCreated}
}

func (h *UserCreatedHandler) Handle(ctx context.Context, fact event.Event) {
	created, ok := fact.(domain.UserCreated)
	if !ok {
		return
	}
	if err := h.app.PrepareProfile(ctx, application.PrepareProfile{UserID: created.UserID}); err != nil {
		// suppressed result: log once under the Application logging convention
	}
}
```

A handler owns any result it suppresses and logs it once under the
Application logging convention. Trace propagation into its ctx follows
[ddd-golang-observability.md](ddd-golang-observability.md). Domain event
payloads carry business correlation only; technical trace context stays outer.

When the accepted design needs per-Aggregate order, the event implements
`event.Keyed` with the Aggregate identity, or Runtime supplies
`event.WithKeyFunc`.

For a producer-owned published fact, the handler shape continues in
[ddd-golang-messages.md](ddd-golang-messages.md).

## Registration and Verification

The Bounded Context module registers every handler before serving work. Test
state change and event recording with real Aggregates, then test dispatch and
handler mapping with the real event value. Composition evidence proves that
every accepted handler is registered and reachable.
