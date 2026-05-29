---
name: ddd-golang-events-messages
description: Go DDD events and messages patterns. Use when adding or reviewing Domain Events, event.Collection, Domain Event Handlers, Boundary Publishers, Integration Messages, message.Publisher/Handler/Subscriber, Kafka message adapters, application/eventhandler, application/messagepublisher, application/messagehandler, async handler granularity, idempotency, or event/message failure semantics in Go DDD services. Complements ddd-golang.md.
---

# Go Events and Messages Patterns for DDD
## Domain Events, Boundary Publishers, and Integration Messages

**Version**: v1.1
**Date**: 2026-05-28
**Scope**: Go event/message patterns complementing [`ddd-golang.md`](ddd-golang.md)
**Prerequisites**:
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) - Code agents must read this first.
- **DDD core**: [`ddd-core.md`](ddd-core.md) - Language-neutral Domain Event vs Integration Message boundaries.
- **Go implementation**: [`ddd-golang.md`](ddd-golang.md) - Layer responsibilities, package layout, naming, module assembly.
- **Go runtime**: [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Load only when editing shared eventbus/message adapter lifecycle, config, or graceful shutdown wiring.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Adding or changing Domain Events, `event.Collection`, `event.Dispatcher`, `event.Subscriber`, or same-BC Domain Event handlers.
> - Adding a Boundary Publisher that maps Domain Events to Integration Messages.
> - Adding or changing Integration Message payloads, `message.Kind`, `message.Publisher`, `message.Handler`, `message.Subscriber`, or Kafka adapter wiring.
> - Editing `application/eventhandler`, `application/messagepublisher`, `application/messagehandler`, or event/message registration in a bounded-context module.
> - Reviewing async handler role isolation, handler granularity, idempotency, delivery/failure semantics, or pre-publish-loss behavior.

---

## 1. Vocabulary and Ownership

Keep these roles separate:

| Role | Meaning | Go placement |
|---|---|---|
| Domain Event | Bounded-context-internal fact recorded by an aggregate or Domain service | `internal/business/<context>/domain/event.go` |
| Domain Event Handler | Same-BC Application reaction to a Domain Event after the aggregate has been saved | `application/eventhandler/<event>.go` |
| Boundary Publisher | Same-BC Application translator from selected Domain Events to Integration Messages | `application/messagepublisher/<event>_publisher.go` |
| Integration Message | Cross-context or cross-service stable published-language contract | Payload schema in `proto/**`; Go envelope via `ddd/message` |
| Integration Message Handler | Consuming-context Application reaction to an Integration Message | `application/messagehandler/<message>.go` |
| Message adapter | Provider implementation: Kafka records, topics, commits, retries, failure policy | Infrastructure or `internal/pkg/<middleware>` |

Hard rules:

- Domain Events are not Integration Messages. Same struct shape does not make them the same concept.
- Cross-context consumers never subscribe to another context's Domain Events.
- A Boundary Publisher may consume same-BC Domain Events and publish Integration Messages; it must not consume Integration Messages, mutate aggregates, or advance workflow state.
- Application code depends on `github.com/go-jimu/components/ddd/event` and `github.com/go-jimu/components/ddd/message` ports; Kafka/provider mechanics live in Infrastructure.
- Kafka topics, partitions, offsets, commits, retries, and dead-letter behavior are adapter concerns, not Domain or Application vocabulary.

---

## 2. Domain Event Collection

Use `github.com/go-jimu/components/ddd/event` for in-process Domain Events.

Contract:

- Aggregate Root holds an `event.Collection`, preferably in an unexported field.
- Domain methods append events via the aggregate's collection; they never dispatch directly.
- The Application layer is the sole drainer. After a successful `Save()` returns, Application calls a narrow drain accessor such as `dispatcher.DispatchAll(aggregate.DrainEvents())` exactly once.
- Repository must not drain events.
- `Drain()` is one-shot. A second call on the same in-memory instance returns nil.
- After `Save()` succeeds, the in-memory aggregate is stale. If the use case needs further mutations, reload via `Repository.Get()` first. Never retry `Save()` on an already-drained aggregate instance.

The in-memory dispatcher is same-process, best-effort delivery. `Dispatch` / `DispatchAll` only report admission/enqueue errors such as `event.ErrDispatcherClosed` during shutdown; they do not report handler execution failure, handler panic, or unhandled-event outcomes. Handlers own their own failure policy.

Example Domain Event shape:

```go
// domain/event.go
package domain

import "github.com/go-jimu/components/ddd/event"

const (
    EventKindUserCreated     event.Kind = "user.created"
    EventKindPasswordChanged event.Kind = "user.password_changed"
)

type EventUserCreated struct {
    ID    string
    Name  string
    Email string
}

func (e EventUserCreated) Kind() event.Kind { return EventKindUserCreated }

type EventPasswordChanged struct{ ID string }

func (e EventPasswordChanged) Kind() event.Kind { return EventKindPasswordChanged }
```

Example aggregate method:

```go
func (u *User) ChangePassword(oldRaw, newRaw string) error {
    if u.status != UserStatusActive {
        return ErrUserNotActive
    }
    if !verifyPassword(oldRaw, u.hashedPassword) {
        return errors.New("old password incorrect")
    }

    hashed, err := hashPassword(newRaw)
    if err != nil {
        return err
    }
    u.hashedPassword = hashed
    u.updatedAt = time.Now()
    u.events.Add(EventPasswordChanged{ID: u.id})
    return nil
}

func (u *User) DrainEvents() []event.Event {
    return u.events.Drain()
}
```

---

## 3. Application Event Handlers

### 3.1 Command-side Dispatch

Command handlers follow the ordinary four-step orchestration:

1. Load aggregate.
2. Invoke domain method.
3. Save aggregate.
4. Drain and dispatch Domain Events once.

```go
// application/command/change_password.go
package command

type CommandChangePasswordHandler struct {
    repo       domain.Repository
    dispatcher event.Dispatcher
    logger     *slog.Logger
}

func (h *CommandChangePasswordHandler) Handle(ctx context.Context, cmd *CommandChangePassword) error {
    user, err := h.repo.Get(ctx, cmd.ID)
    if err != nil {
        return err
    }
    if err = user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
        return err
    }
    if err = h.repo.Save(ctx, user); err != nil {
        return err
    }

    if err := h.dispatcher.DispatchAll(user.DrainEvents()); err != nil {
        h.logger.WarnContext(ctx, "domain event dispatch skipped",
            slog.String("operation", "user.change_password"),
            slog.String("user_id", cmd.ID),
            sloghelper.Error(err))
    }
    return nil
}
```

`DispatchAll` admission error policy:

- Best-effort follow-up only: log the admission/enqueue error and continue.
- Caller or operator must observe missed follow-up dispatch: return the admission/enqueue error after adding useful context.
- Returning this error after `Save()` never implies persistence rollback; it only reports that follow-up dispatch was not accepted.
- Handler execution failures are not reported by `DispatchAll`; handlers own their own failure policy.

### 3.2 Domain Event Handler Contract

Domain Event Handlers:

- implement `event.Handler`: `Listening() []event.Kind` and `Handle(context.Context, event.Event)`;
- live in the same bounded context as the Domain Event producer, under `application/eventhandler/`;
- handle repeated same-BC reactions to a domain fact after the aggregate is saved and events are drained;
- own their own transaction; failures do not roll back the producing command;
- use lightweight failure behavior by default: best-effort, log-and-continue, return subscriber/adapter error, or `n/a`;
- register during module initialization through `event.Subscriber.Subscribe(handler)`.

Inject `event.Subscriber` for same-BC subscription and `event.Dispatcher` for dispatch. The in-memory dispatcher returned by the project eventbus wrapper implements both faces.

### 3.3 Boundary Publisher Contract

Boundary Publishers:

- live in the producing bounded context's `application/messagepublisher/` package;
- implement `event.Handler`;
- register only with the same-BC `event.Subscriber`;
- may import both `ddd/event` and `ddd/message` because their job is boundary translation;
- map selected Domain Events to Integration Message payloads and call `message.Publisher`;
- must not consume Integration Messages, mutate aggregates, advance workflow state, or mix unrelated local side effects with publication.

### 3.4 Integration Message Handler Contract

Integration Message Handlers:

- live in the consuming bounded context's `application/messagehandler/` package;
- implement `message.Handler`;
- handle stable cross-context Integration Message payloads, never another context's internal Domain Event type;
- own idempotency and transaction boundaries for the consuming context.

### 3.5 Handler Role and Granularity

Name concrete types after the inbound fact or contract family: `ExecutorConnectedHandler`, `OrderCompletedHandler`, `OrderCompletedPublisher`. Avoid umbrella names such as `EventHandler`, `MessageHandler`, or `Handler`.

Default: one `Listening()` kind per concrete handler. Multiple kinds are allowed only when they share the same role, source context or contract family, target side effect / projection / published contract, transaction boundary, failure policy, and dependency set. Write that reason in the Architecture Gate or review note.

Do not implement both `event.Handler` and `message.Handler` on the same concrete type. Boundary Publisher is the allowed bridge, and it is still an `event.Handler`, not a `message.Handler`.

Do not dispatch unrelated event/message variants with a large `switch` or a chain of type assertions inside one `Handle`; create named handlers instead.

### 3.6 Event Handler Idempotency

The in-memory `event.Dispatcher` is best-effort only: it has no persistence, no retry, and no at-least-once guarantee. Do not introduce deduplication tables or other delivery machinery for ordinary Domain Event handlers by default.

Still write handlers so repeated execution is harmless when practical: prefer set/update operations, deterministic business keys, and guards on externally visible side effects. If a handler is later moved to a stronger delivery path, design the idempotency key and storage mechanism as part of that adapter-backed flow rather than assuming `event.Event` has a standard global ID.

---

## 4. Integration Messages

Cross-context state propagation publishes Integration Messages through `github.com/go-jimu/components/ddd/message`.

Integration Message means a cross-context fact with a stable contract payload. It is not a Domain Event. The Go library names this layer `message`; use "Integration Message" to avoid overloading "Event" across two semantic layers.

Keep four layers separate:

- **Concept**: Integration Message means a cross-context fact with a stable published-language payload.
- **Contract**: protobuf payload type, `message.Kind`, versioning, and compatibility rules.
- **Port**: `message.Publisher`, `message.Handler`, `message.Subscriber`, and `message.Message`.
- **Adapter**: `github.com/go-jimu/contrib/message/kafka` maps the port to Kafka records, topics, commits, retry, and delivery failure behavior.

`message.Kind` is the semantic contract identifier used for handler routing and payload resolution. Default: derive Kind from the protobuf full name with `message.KindOf(&pb.MessageType{})` so the contract identifier and the schema cannot drift apart. A semantic string literal such as `"orders.paid"` is also valid for simple setups or migration paths; pick one form per integration.

`message.Kind` is not a Kafka topic, partition, or routing key. Those are provider-side concerns and may be remapped through `kafka.WithTopicResolver`.

### 4.1 Producer Side

The command handler stays ordinary Application orchestration. It saves the aggregate and dispatches drained Domain Events inside the bounded context. A separate Boundary Publisher translates selected Domain Events into Integration Messages.

```go
// domain/event.go
package domain

import (
    "time"

    "github.com/go-jimu/components/ddd/event"
)

const EventKindOrderCompleted event.Kind = "order.completed"

type EventOrderCompleted struct {
    OrderID     string
    UserID      string
    TotalAmount int64
    OccurredAt  time.Time
}

func (e EventOrderCompleted) Kind() event.Kind { return EventKindOrderCompleted }
```

```go
// application/messagepublisher/order_completed_publisher.go
package messagepublisher

type OrderCompletedPublisher struct {
    publisher message.Publisher
    logger    *slog.Logger
}

func (p *OrderCompletedPublisher) Listening() []event.Kind {
    return []event.Kind{domain.EventKindOrderCompleted}
}

func (p *OrderCompletedPublisher) Handle(ctx context.Context, evt event.Event) {
    completed, ok := evt.(domain.EventOrderCompleted)
    if !ok {
        return
    }

    msg, err := message.New(
        message.KindOf(&orderv1.OrderCompletedV1{}),
        &orderv1.OrderCompletedV1{
            OrderId:     completed.OrderID,
            UserId:      completed.UserID,
            TotalAmount: completed.TotalAmount,
            OccurredAt:  timestamppb.New(completed.OccurredAt),
        },
        message.WithKey(completed.OrderID),
    )
    if err != nil {
        p.logger.WarnContext(ctx, "integration message build failed",
            slog.String("event_kind", string(completed.Kind())),
            slog.String("error", err.Error()))
        return
    }
    if err := p.publisher.Publish(ctx, msg); err != nil {
        p.logger.WarnContext(ctx, "integration message publish failed",
            slog.String("message_kind", string(msg.Kind())),
            slog.String("message_id", msg.ID()),
            slog.String("error", err.Error()))
    }
}
```

Mapping a Domain Event into an Integration Message payload is a boundary translation, not a Domain rule. Keep payload conversion in a same-context Application handler or Infrastructure adapter. If the mapping starts making business decisions (whether the event is valid, whether to publish, what transition happened), move that decision back into Domain or Application policy.

`message.Publisher.Publish` returns the publisher adapter's admission/delivery error and respects context cancellation. In the in-memory Domain Event path, publish failure cannot roll back the original command. If pre-publish loss is unacceptable, use an explicit stronger-delivery design rather than hiding that requirement in the command handler.

### 4.2 Consumer Side

The consuming context implements `message.Handler` and registers it with a `message.Subscriber`.

```go
// internal/business/user/application/messagehandler/order_completed.go
package messagehandler

type OrderCompletedHandler struct{ /* deps */ }

func (h *OrderCompletedHandler) Listening() []message.Kind {
    return []message.Kind{message.KindOf(&orderv1.OrderCompletedV1{})}
}

func (h *OrderCompletedHandler) Handle(ctx context.Context, msg message.Message) error {
    payload, ok := msg.Payload().(*orderv1.OrderCompletedV1)
    if !ok {
        return fmt.Errorf("unexpected payload kind=%s", msg.Kind())
    }
    _ = payload
    return nil
}
```

Check the selected subscriber adapter's delivery semantics. When it can redeliver the same Integration Message, the handler must be idempotent through natural convergence, deterministic business keys, or an application-level dedup mechanism chosen for that use case. Do not add a processed-message table by default.

### 4.3 Kafka Adapter Wiring

Application code depends only on `message.Publisher`, `message.Handler`, and `message.Subscriber`. The Kafka adapter lives in Infrastructure or shared runtime wiring:

```go
// infrastructure/order_publisher.go
package infrastructure

func NewOrderPublisher(client *kgo.Client) message.Publisher {
    return kafka.NewPublisher(client)
}

func NewKafkaConsumer(client *kgo.Client, handlers []message.Handler) (*kafka.Consumer, error) {
    registry := message.NewPayloadRegistry()
    if err := registry.Register(
        message.KindOf(&orderv1.OrderCompletedV1{}),
        func() proto.Message { return &orderv1.OrderCompletedV1{} },
    ); err != nil {
        return nil, err
    }

    consumer := kafka.NewConsumer(client, kafka.WithPayloadResolver(registry))
    for _, h := range handlers {
        if err := consumer.Subscribe(h); err != nil {
            return nil, err
        }
    }
    return consumer, nil
}
```

Operational facts that come with the adapter:

- Default Kafka topic equals `Kind`; override with `kafka.WithTopicResolver` when topic naming differs from semantic kinds.
- Consumer requires `kgo.DisableAutoCommit()`; the adapter commits offsets manually after handler success or the adapter's configured failure handling accepts the record.
- Handler errors use the adapter's configured retry/failure policy; tune it in Infrastructure, not in Application handlers.
- `Message.Key()` maps to the Kafka record key; use it for per-key partition affinity and ordering when the consumer relies on per-aggregate sequence.

Do not reimplement these adapter behaviors in Application.

---

## 5. Module Assembly

Bounded-context modules register event/message handlers and boundary publishers, but provider lifecycle belongs to runtime packages.

```go
var Module = fx.Module(
    "domain.user",
    fx.Provide(infrastructure.NewUserRepository),
    fx.Provide(infrastructure.NewUserQueryRepository),
    fx.Provide(infrastructure.NewOrderPublisher),
    fx.Provide(eventhandler.NewWelcomeEmailHandler),
    fx.Provide(messagepublisher.NewOrderCompletedPublisher),
    fx.Provide(application.NewApplication),
    fx.Invoke(func(sub event.Subscriber, h *eventhandler.WelcomeEmailHandler) {
        sub.Subscribe(h)
    }),
    fx.Invoke(func(sub event.Subscriber, h *messagepublisher.OrderCompletedPublisher) {
        sub.Subscribe(h)
    }),
)
```

Repeat registration for each concrete handler the context owns. Do not build a generic handler registry that discovers unrelated handlers by reflection or switches over unrelated event/message kinds.

---

## 6. Testing and Review

Layer-specific testing:

- Domain tests assert aggregate methods record the right Domain Events and do not dispatch them.
- Application command tests assert events are drained once after successful `Save()`.
- Domain Event Handler tests exercise the handler with real Domain Event structs and fake/mocked dependencies.
- Boundary Publisher tests assert the Integration Message kind, payload, and key.
- Integration Message Handler tests assert idempotency and transaction behavior for duplicate or redelivered messages.
- Kafka adapter tests belong to Infrastructure and may use real adapter/test-container infrastructure when the repository supports it.

Review checklist:

- [ ] Domain Events stay inside one bounded context.
- [ ] Cross-context facts use Integration Messages, not another context's Domain Events.
- [ ] Application drains events once after `Save()`; Repository never drains.
- [ ] Each concrete handler defaults to one inbound kind.
- [ ] No concrete type implements both `event.Handler` and `message.Handler`.
- [ ] Boundary Publishers only translate and publish; they do not mutate aggregates or advance workflow.
- [ ] Message payload schemas and `message.Kind` values are stable contracts.
- [ ] Kafka topics/retries/commits/dead-letter behavior stay in the adapter.
- [ ] Idempotency strategy matches the selected delivery semantics.

---

## 7. Anti-patterns

Reject these in review:

1. Reusing a Domain Event struct as an Integration Message payload.
2. A consumer context importing a producer context's `domain/` package.
3. Repository drains Domain Events or dispatches them.
4. A command handler dispatches Domain Events before persistence succeeds.
5. One umbrella handler switches over unrelated event/message kinds.
6. A Boundary Publisher consumes Integration Messages.
7. A Boundary Publisher mutates aggregates or advances workflow state.
8. Application code knows Kafka topics, partitions, commits, offsets, or retry knobs.
9. A processed-message table is added by default without delivery semantics requiring it.
10. Publish reliability requirements are hidden in an ordinary command handler instead of an explicit stronger-delivery design.

---

**References:**
- [`ddd-agent-contract.md`](ddd-agent-contract.md) - Agent execution contract (read first)
- [`ddd-core.md`](ddd-core.md) - Language-agnostic Domain Event / Integration Message rules
- [`ddd-golang.md`](ddd-golang.md) - Go DDD implementation (layers, aggregates, repositories, naming, file organization)
- [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Go runtime: config, lifecycle, graceful shutdown
