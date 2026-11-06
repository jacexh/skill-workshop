---
name: ddd-golang-events
description: Go House Style for accepted local Domain Events, collections, dispatch, and same-context handlers.
---

# Go Domain Events

## Applies When

Load this leaf only when the accepted design contains a local Domain Event or a
same-context event reaction. Use
`github.com/go-jimu/components/ddd/event`, and
`github.com/go-jimu/components/ddd/event/outbox` for must-run handlers.

## Placement and Event Shape

Place event types in the producing Domain and handlers under the same context's
`application/eventhandler/`. An event is a Domain value type with an
`OccurredAt` field and a value-receiver `Kind()` that returns a package constant
such as `EventKindUserCreated event.Kind = "user.created"`.

The Aggregate holds an `event.Events` field, changes state, then calls `Add`
with the accepted fact. Reconstitution records no creation event.

An event that a must-run handler listens to is stored as JSON until the handler
succeeds, so its `json` tags are a stored contract that evolves by the "Events"
rules of `go doc github.com/go-jimu/components/ddd/event/outbox`. Keep it thin:
identities, plus the occurrence facts the handler cannot read from current
state.

## Handler Kinds

The reacting Policy's failure outcome
([ddd-collaboration.md](ddd-collaboration.md#local-domain-event-shape)) decides
the handler kind:

- **Best-effort**: losing the reaction on a process stop is accepted. The
  handler implements `event.Handler` and subscribes to the in-memory
  `event.InMemoryDispatcher`.
- **Must-run**: the reaction must survive a process stop. The handler
  implements `outbox.Handler` and subscribes to the Outbox. The Relay runs it
  after commit until it succeeds, at least once.

A request-scoped Aggregate dispatches once, after successful persistence:

```text
best-effort only:  Repository.Save -> Aggregate.Events.Drain -> Dispatcher.DispatchAll
with an Outbox:    Within( Repository.Save -> Aggregate.Events.Drain -> Outbox.DispatchAll )
```

Without an Outbox, the Aggregate is already saved when `DispatchAll` runs. A
dispatch error then means only that the follow-ups will not run: the
Application method returns the saved outcome, and the dropped events are
reported once.

Once an Outbox exists, it is the only dispatcher of the use cases on its
database. It hands committed events to best-effort handlers too. A use case that
raises events runs in `Within` ([ddd-golang-transactions.md](ddd-golang-transactions.md)),
and a dispatch error rolls the transaction back and is returned.

The loaded Aggregate may supply that command's result and drained events, then
is stale. A handler that changes state enters a fresh Application command and
transaction.

## Handler Shape

A handler type-asserts its concrete event and delegates to one Application
method. A best-effort handler ignores any other type and logs the result it
suppresses:

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
		// suppressed result: the handler logs it as the caller
	}
}
```

A must-run handler returns its error to the Relay and follows the "Handlers"
contract of the outbox package. Handle may run more than once, so write it as a
reconciler: it reads the Aggregate's current state and applies it with a version
check.

Trace propagation into a handler's ctx follows
[ddd-golang-observability.md](ddd-golang-observability.md). Domain event
payloads carry business correlation only; technical trace context stays outer.

A best-effort handler that needs per-Aggregate order uses `event.Keyed` with the
Aggregate identity, or Runtime supplies `event.WithKeyFunc`. A must-run
reconciler needs no order across transactions.

For a producer-owned published fact, the handler shape continues in
[ddd-golang-messages.md](ddd-golang-messages.md).

## Registration and Verification

The Bounded Context module subscribes every handler, and registers every event
type a must-run handler listens to, before serving work. The Outbox table ships
as a migration.

Test state change and event recording with real Aggregates, then test dispatch
and handler mapping with the real event value. With an Outbox, show that the use
case saves and dispatches in one committed transaction and rolls back on a
dispatch error. On a real database, show that the record commits and rolls back
with the Aggregate, and that a must-run handler's effect is the same on every
attempt. Composition evidence proves that every accepted handler is registered
and reachable.
