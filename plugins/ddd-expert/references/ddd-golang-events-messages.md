---
name: ddd-golang-events-messages
description: Go DDD events and messages patterns. Use when adding or reviewing Domain Events, event.Collection, Domain Event Handlers, Boundary Publishers, Integration Messages, message.Publisher/Handler/Subscriber, Kafka message adapters, application/eventhandler, application/messagepublisher, application/messagehandler, async handler granularity, idempotency, or event/message failure semantics in Go DDD services. Complements ddd-golang.md.
---

# Go Events and Messages Patterns for DDD
## Domain Events, Boundary Publishers, and Integration Messages

**Version**: v1.2
**Date**: 2026-06-01
**Scope**: Go event/message patterns complementing the Go reference router [`ddd-golang.md`](ddd-golang.md)
**Phase routing**:
- **Phase skill**: Start from [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), or [`review`](../skills/review/SKILL.md). Load this file only when the active phase needs Go Domain Event, Boundary Publisher, Integration Message, message adapter, idempotency, or failure-semantics rules.
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) - Load when the phase needs async-work classification, prohibited actions, or self-checks.
- **DDD core**: [`ddd-core.md`](ddd-core.md) - Language-neutral Domain Event vs Integration Message boundaries.
- **Go router**: [`ddd-golang.md`](ddd-golang.md) - Choose Go layer references before loading event/message details.
- **Go Domain/Application**: [`ddd-golang-domain.md`](ddd-golang-domain.md), [`ddd-golang-application.md`](ddd-golang-application.md) - Aggregate event recording and handler placement.
- **Go runtime**: [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Load only when editing shared eventbus/message adapter lifecycle, config, or graceful shutdown wiring.

> **Code blocks are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

> **When to read this file**:
> - Adding or changing Domain Events, `event.Collection`, `event.Dispatcher`, `event.Subscriber`, or same-BC Domain Event handlers.
> - Adding a Boundary Publisher that maps Domain Events to Integration Messages.
> - Adding or changing Integration Message payloads, `message.Kind`, `message.Publisher`, `message.Handler`, `message.Subscriber`, `message.Runner`, or Kafka adapter wiring.
> - Editing `application/eventhandler`, `application/messagepublisher`, `application/messagehandler`, or event/message registration in a bounded-context module.
> - Reviewing async handler role isolation, handler granularity, idempotency, delivery/failure semantics, or pre-publish-loss behavior.

---

## 0. Go / go-jimu Event Building Block Lookup

Use these cards to answer "what must this event/message construct contain?" before reading the longer sections below.

Event Timeline Reconciliation: for lifecycle reviews, compare `spec/design fact | Domain Event type | handler/reconciler/process manager` before saying event coverage is satisfied. Recovery reachability proof means the handler/reconciler/process manager must be wired in production/runtime, not only named in design or tests; handler registration alone is not recovery reachability proof, and a callable command is not recovery reachability proof unless runtime/API/scheduler wiring invokes it after the original command returns. A swallowed or logged dispatch failure after a durable fact requires retry, reconciliation, or command guards before coverage is satisfied. A repository transaction is not a substitute for a missing same-BC Domain Event reaction; if a fact needs repeated same-context reaction and no event/reaction/process owner exists, return to `domain-modeling` for fact/owner ambiguity or `design` for accepted-model placement.

| If the agent is implementing / reviewing... | Start here |
|---|---|
| Domain Event type constants, payload fields, or `Kind()` method | §0.1 Domain Event Type Card |
| Aggregate event collection, drain timing, dispatch policy | §0.2 Event Collection and Dispatch Card |
| Same-BC Domain Event reaction | §0.3 Domain Event Handler Card |
| Domain Event to Integration Message translation | §0.4 Boundary Publisher Card |
| Cross-context Integration Message consumer | §0.5 Integration Message Handler Card |
| Kafka adapter, runner lifecycle, shutdown, DLQ/retry policy | §4.3 plus [`ddd-golang-runtime.md`](ddd-golang-runtime.md) |

### 0.1 Domain Event Type Card

- Place same-BC Domain Event types in `internal/business/<context>/domain/event.go` unless the package already has a narrower event file convention.
- Start from the accepted event-storming/business-fact timeline. Only selected same-BC past-tense facts become Domain Events.
- Define stable `event.Kind` constants such as `EventKindOrderCompleted event.Kind = "order.completed"`.
- Implement `Kind() event.Kind` on each event struct.
- Include only facts the same bounded context needs after the state change. Do not include transport headers, Kafka topic names, retry policy, or generated proto/request types.
- Treat Domain Events as internal facts. Do not publish them directly to other bounded contexts and do not reuse them as Integration Message payloads.

### 0.2 Event Collection and Dispatch Card

- Aggregate Roots hold `Events event.Collection` or an equivalent narrow accessor.
- Domain methods mutate state first, then call `Events.Add(EventXxx{...})`.
- Domain code never dispatches, drains, logs, starts goroutines, or calls a publisher.
- Command handlers dispatch only after `repo.Save(ctx, aggregate)` succeeds.
- Call `dispatcher.DispatchAll(aggregate.Events.Drain())` exactly once per saved aggregate instance.
- Repository implementations never drain or dispatch events.
- After `Save()`, treat the in-memory aggregate as stale; reload before further mutation.
- `DispatchAll` reports admission/enqueue errors only. Handler failures belong to handlers.

### 0.3 Domain Event Handler Card

- Place same-BC reactions in `application/eventhandler/<event>.go`.
- Implement `event.Handler` with `Listening() []event.Kind` and `Handle(context.Context, event.Event)`.
- Default to one inbound event kind per concrete handler; multiple kinds require the same source family, role, side effect, transaction boundary, failure policy, and dependency set.
- Own a separate transaction from the producing command. Handler failure never rolls back the original aggregate save.
- Log one completion summary per handled event with `operation`, `outcome`, `duration_ms`, `event_kind`, relevant business IDs, and `skip_reason` for skipped duplicates/no-ops.
- Keep idempotency local and pragmatic for in-memory delivery; do not add dedup tables by default.

### 0.4 Boundary Publisher Card

- Place Domain Event to Integration Message translators in `application/messagepublisher/<event>_publisher.go`.
- Implement `event.Handler`, not `message.Handler`.
- Register with same-BC `event.Subscriber`.
- Inject `message.Publisher` and map selected Domain Event facts into a stable Integration Message payload.
- Do not mutate aggregates, advance workflow state, consume Integration Messages, or mix unrelated local side effects with publication.
- Log one completion summary per publication attempt with `operation`, `outcome`, `duration_ms`, `event_kind`, `message_kind`, and relevant business IDs.

### 0.5 Integration Message Handler Card

- Place cross-context consumers in `application/messagehandler/<message>.go`.
- Implement `message.Handler`.
- Consume stable Integration Message payloads, never another context's Domain Event type.
- Own idempotency, transaction boundary, and stale/duplicate/missing-target behavior for the consuming context.
- Return errors according to the adapter failure policy; use explicit skip outcomes for permanent non-actionable messages.
- Log one completion summary per consumed message with `operation`, `outcome`, `duration_ms`, `message_kind`, `message_id` or correlation key, business IDs, and `skip_reason` when skipped.

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
- `message.Subscriber` means handler registration only. A provider that actively consumes messages exposes its runtime loop separately through `message.Runner`; lifecycle and shutdown wiring belong to Infrastructure/runtime packages.
- `message.Handler.Handle` errors are message-level failures for one delivered Integration Message. They are not runtime-loop failures by themselves; provider adapters apply an explicit failure policy.

---

## 2. Domain Event Collection

Use `github.com/go-jimu/components/ddd/event` for in-process Domain Events.

Contract:

- Aggregate Root holds an `Events event.Collection` field or equivalent narrow event collection accessor.
- Domain methods append events via `Events.Add(event)`; they never dispatch directly.
- The Application layer is the sole drainer. After a successful `Save()` returns, Application calls `dispatcher.DispatchAll(aggregate.Events.Drain())` exactly once.
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
    if u.Status != UserStatusActive {
        return ErrUserNotActive
    }
    if !verifyPassword(oldRaw, u.HashedPassword) {
        return errors.New("old password incorrect")
    }

    hashed, err := hashPassword(newRaw)
    if err != nil {
        return err
    }
    u.HashedPassword = hashed
    u.UpdatedAt = time.Now()
    u.Events.Add(EventPasswordChanged{ID: u.ID})
    return nil
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

    if err := h.dispatcher.DispatchAll(user.Events.Drain()); err != nil {
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
- log one completion summary for each handled event with `operation`, `outcome`, `duration_ms`, `event_kind`, and relevant aggregate/business IDs; idempotent duplicates, missing targets, and no-op guards use `outcome=skipped` with a stable `skip_reason`;
- register during module initialization through `event.Subscriber.Subscribe(handler)`.

Inject `event.Subscriber` for same-BC subscription and `event.Dispatcher` for dispatch. The in-memory dispatcher returned by the project eventbus wrapper implements both faces.

### 3.3 Boundary Publisher Contract

Boundary Publishers:

- live in the producing bounded context's `application/messagepublisher/` package;
- implement `event.Handler`;
- register only with the same-BC `event.Subscriber`;
- may import both `ddd/event` and `ddd/message` because their job is boundary translation;
- map selected Domain Events to Integration Message payloads and call `message.Publisher`;
- log one completion summary for each publication attempt with `operation`, `outcome`, `duration_ms`, `event_kind`, `message_kind` when built, and relevant aggregate/business IDs;
- must not consume Integration Messages, mutate aggregates, advance workflow state, or mix unrelated local side effects with publication.

### 3.4 Integration Message Handler Contract

Integration Message Handlers:

- live in the consuming bounded context's `application/messagehandler/` package;
- implement `message.Handler`;
- handle stable cross-context Integration Message payloads, never another context's internal Domain Event type;
- own idempotency and transaction boundaries for the consuming context;
- log one completion summary for each consumed message with `operation`, `outcome`, `duration_ms`, `message_kind`, `message_id` or correlation key when available, and relevant aggregate/business IDs; duplicate, stale, missing-target, or not-applicable messages use `outcome=skipped` with `skip_reason`.

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
- **Port**: `message.Publisher`, `message.Handler`, `message.Subscriber`, optional `message.Runner`, and the concrete `message.Message` envelope.
- **Adapter**: `github.com/go-jimu/contrib/message/kafka` maps the port to Kafka records, topics, commits, retry/DLQ, and delivery failure behavior.

`message.Kind` is the semantic contract identifier used for handler routing and payload resolution. Default: derive Kind from the protobuf full name with `message.KindOf(&pb.MessageType{})` so the contract identifier and the schema cannot drift apart. A semantic string literal such as `"orders.paid"` is also valid for simple setups or migration paths; pick one form per integration.

`message.Kind` is not a Kafka topic, partition, or routing key. Those are provider-side concerns and may be remapped through `kafka.WithTopicResolver`.

`message.Message` wraps a non-empty `Kind`, a non-nil protobuf payload, generated or supplied ID, optional key, occurred-at timestamp, and transport-neutral headers. `Payload()` returns `proto.Message`; consumer handlers type assert to the expected generated payload after the adapter resolves and unmarshals it.

`message.Subscriber.Subscribe` only registers handlers. It does not start polling, commit offsets, or join a consumer group. Components that own an active receive loop implement `message.Runner`; wire `Run(ctx)` through `fx.Lifecycle` or the service runtime, not through a bounded-context Application module.

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
        message.WithOccurredAt(completed.OccurredAt),
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

`message.Publisher.Publish` returns the publisher adapter's admission/delivery error and respects context cancellation. Kafka publishing performs one produce attempt by default; tune transient produce retries in Infrastructure with adapter options such as `kafka.WithPublishRetry`. In the in-memory Domain Event path, publish failure cannot roll back the original command. If pre-publish loss is unacceptable, use an explicit stronger-delivery design rather than hiding that requirement in the command handler.

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

Handler return values control message-level handling:

- return `nil` when processing is complete and the provider may mark delivery complete;
- return an error when the provider should apply its configured message failure policy;
- handle ordinary business rejections inside the handler and return `nil` when redelivery, retry, or DLQ is not desired.

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

    consumer, err := kafka.NewConsumer(
        client,
        kafka.RetryThenDLQPolicy(kafka.RetryThenDLQConfig{MaxAttempts: 3}),
        kafka.WithPayloadResolver(registry),
        kafka.WithDefaultFailureTopics(),
    )
    if err != nil {
        return nil, err
    }

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
- Consumers must configure franz-go with `kgo.ConsumerGroup`, `kgo.ConsumeTopics`, and `kgo.DisableAutoCommit()`. The adapter commits offsets manually after handler success, an explicit drop, or a successful retry/DLQ publication.
- `kafka.NewConsumer` requires a `FailurePolicy`. Built-ins are `DropAndCommitPolicy`, `DLQPolicy`, and `RetryThenDLQPolicy`; choose intentionally in Infrastructure/runtime code.
- Retry and DLQ are disabled until the caller configures failure topics through `kafka.WithDefaultFailureTopics`, `kafka.WithRetryTopicResolver`, or `kafka.WithDLQTopicResolver`.
- Handler errors are message-level failures. The consumer applies the configured `FailurePolicy`; `Consumer.Run` returns only when the runtime cannot continue, the context is canceled, commit fails, or failure publishing fails with the stop fallback.
- Use `kafka.WithErrorObserver` for metrics/logging of provider failures. `WithErrorHandler`, `WithRetryPolicy`, and `WithDLQDisabled` are deprecated in new code.
- `Message.Key()` maps to the Kafka record key; use it for per-key partition affinity and ordering when the consumer relies on per-aggregate sequence.
- `Consumer.Close` closes the franz-go client only when created with `kafka.WithCloseClient(true)`; otherwise client ownership remains with the runtime package.

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
    fx.Provide(messagehandler.NewOrderCompletedHandler),
    fx.Provide(application.NewApplication),
    fx.Invoke(func(sub event.Subscriber, h *eventhandler.WelcomeEmailHandler) {
        sub.Subscribe(h)
    }),
    fx.Invoke(func(sub event.Subscriber, h *messagepublisher.OrderCompletedPublisher) {
        sub.Subscribe(h)
    }),
    fx.Invoke(func(sub message.Subscriber, h *messagehandler.OrderCompletedHandler) error {
        return sub.Subscribe(h)
    }),
)
```

Repeat registration for each concrete handler the context owns. Do not build a generic handler registry that discovers unrelated handlers by reflection or switches over unrelated event/message kinds. Do not start provider loops from bounded-context modules; runtime packages wire `message.Runner.Run(ctx)` with lifecycle/shutdown handling.

---

## 6. Testing and Review

Layer-specific testing:

- Domain tests assert aggregate methods record the right Domain Events and do not dispatch them.
- Application command tests assert events are drained once after successful `Save()`.
- Domain Event Handler tests exercise the handler with real Domain Event structs and fake/mocked dependencies.
- Boundary Publisher tests assert the Integration Message kind, payload, and key.
- Integration Message Handler tests assert idempotency and transaction behavior for duplicate or redelivered messages.
- Kafka adapter tests belong to Infrastructure and may use real adapter/test-container infrastructure when the repository supports it; they verify explicit `FailurePolicy`, retry/DLQ topic configuration, commit behavior, and `Runner` lifecycle expectations.

Review checklist:

- [ ] Domain Events stay inside one bounded context.
- [ ] Cross-context facts use Integration Messages, not another context's Domain Events.
- [ ] Application drains events once after `Save()`; Repository never drains.
- [ ] Each concrete handler defaults to one inbound kind.
- [ ] No concrete type implements both `event.Handler` and `message.Handler`.
- [ ] Boundary Publishers only translate and publish; they do not mutate aggregates or advance workflow.
- [ ] Message payload schemas and `message.Kind` values are stable contracts.
- [ ] Kafka topics/retries/commits/dead-letter behavior stay in the adapter.
- [ ] `message.Subscriber` is treated as registration only; `message.Runner` lifecycle is wired in runtime code.
- [ ] Kafka consumers choose an explicit `FailurePolicy`; retry/DLQ topic configuration is not assumed.
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
11. Code calls `Subscribe` and assumes a broker consumer has started polling.
12. New Kafka consumer code uses deprecated `WithRetryPolicy`, `WithDLQDisabled`, or flow-controlling `WithErrorHandler` instead of `FailurePolicy` and `WithErrorObserver`.

---

**References:**
- [`design`](../skills/design/SKILL.md) / [`implement`](../skills/implement/SKILL.md) / [`review`](../skills/review/SKILL.md) - Phase entrypoints
- [`ddd-agent-contract.md`](ddd-agent-contract.md) - Async-work prohibited actions and self-checks
- [`ddd-core.md`](ddd-core.md) - Language-agnostic Domain Event / Integration Message rules
- [`ddd-golang.md`](ddd-golang.md) - Go reference router
- [`ddd-golang-domain.md`](ddd-golang-domain.md) - Aggregate event recording
- [`ddd-golang-application.md`](ddd-golang-application.md) - Handler and publisher placement
- [`ddd-golang-runtime.md`](ddd-golang-runtime.md) - Go runtime: config, lifecycle, graceful shutdown
