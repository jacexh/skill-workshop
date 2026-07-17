---
name: ddd-golang-events-messages
description: Go House Style for Domain Event timing, published facts, asynchronous intents, inbound message adapters, Kafka runtime, ordering, idempotency, and conditional outbox adoption.
---

# Go Events and Integration Messages

This Flow Guide owns the end-to-end event and message flow. The Layer Guides
remain authoritative for each layer's general responsibilities.

Do not introduce Integration Messages, Kafka, outbox, inbox, retry topics, or a
DLQ merely because a use case is asynchronous. Once confirmed recovery semantics
or accepted project constraints require a mechanism, use the prescribed go-jimu
component and the flow below.

## Adopted Components

| Concern | Mandatory component when applicable |
|---|---|
| Same-context Domain Events | `github.com/go-jimu/components/ddd/event` |
| Integration Message envelope and ports | `github.com/go-jimu/components/ddd/message` |
| Kafka adapter | `github.com/go-jimu/contrib/message/kafka` |
| Kafka runtime implementation | `github.com/twmb/franz-go`, only under `internal/pkg/messagebus` |
| Transactional outbox | `github.com/go-jimu/components/ddd/message/outbox` |

## Responsibility and Placement

| Responsibility | Owner | Placement |
|---|---|---|
| Record an internal business fact | Domain | `domain/event.go` or a semantic Domain file |
| Run a same-context follow-up | Application | `application/eventhandler/<fact>.go` |
| Translate a Domain Event into the producer's Published Fact Contract | Application | `application/eventhandler/<fact>.go` |
| Consume an Integration Message and delegate to one use case | Transport | `transport/messagesubscriber/<message>.go` |
| Map a local outbound intent to the receiver-owned contract | Infrastructure/ACL | `infrastructure/<receiver>_acl.go` |
| Construct Kafka clients, publisher, subscriber, policy, and lifecycle | Runtime | `internal/pkg/messagebus/` |
| Register one BC's payloads and subscribers | BC assembly | `internal/business/<context>/<context>.go` |

Domain Events and Integration Messages are different contracts. Never publish
a Domain Event struct across a bounded-context boundary, and never import
another context's `internal/domain` package.

## Domain Event Shape

A Domain Event is an internal, past-tense fact. It contains Domain values needed
by same-context reactions, not protobuf messages, Kafka topics, retry metadata,
or provider headers.

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

An Aggregate owns an `event.Collection`, mutates its state, then records the
fact with `Add`. Domain code never drains, dispatches, publishes, logs, or starts
a goroutine. `event.Collection.Drain` is destructive: after the first drain,
subsequent drains return nothing and `Add` returns `false`.

## Conditional Best-effort Dispatch

Use the following flow only for a same-context, post-commit follow-up whose loss
has been explicitly accepted:

```text
Domain behavior -> Repository.Save -> Events.Drain -> Dispatcher.DispatchAll
```

Rules:

- Do not drain if `Save` fails.
- After successful `Save`, the Aggregate instance is stale. It may be read for
  the result and drained once, but it cannot be mutated or saved again.
- `DispatchAll` confirms only that the in-memory dispatcher accepted the batch.
  It does not report handler completion, handler failure, or handler panic.
- The original command is already committed. A dispatch admission failure is
  logged where it is deliberately swallowed and the command still returns
  success under this best-effort design.
- Each `event.Handler` runs as an independent follow-up transaction. It cannot
  repair an invariant that must hold when the original command commits.

```go
// internal/business/user/application/command/register_user.go
package command

import (
	"context"
	"log/slog"
	"time"

	"github.com/go-jimu/components/ddd/event"
	"github.com/go-jimu/components/sloghelper"
	"example.com/service/internal/business/user/domain"
)

type RegisterUserHandler struct {
	repository domain.Repository
	dispatcher event.Dispatcher
	logger     *slog.Logger
}

func (h *RegisterUserHandler) Handle(ctx context.Context, cmd RegisterUser) error {
	user, err := domain.NewUser(cmd.Name, cmd.Email, time.Now().UTC())
	if err != nil {
		return err
	}
	if err := h.repository.Save(ctx, user); err != nil {
		return err
	}

	if err := h.dispatcher.DispatchAll(user.Events.Drain()); err != nil {
		h.logger.WarnContext(ctx, "domain event dispatch rejected",
			slog.String("operation", "user.register"),
			slog.String("user_id", user.ID),
			sloghelper.Error(err))
	}
	return nil
}
```

This is not the default for a required or recoverable reaction. If loss is not
acceptable, require confirmed durable-delivery semantics or an accepted project constraint before adding an outbox,
persistent task, reconciler, or Process Manager.

## Same-context Event Handlers

An Application event handler implements the real go-jimu contract:

```go
type Handler interface {
	Listening() []event.Kind
	Handle(context.Context, event.Event)
}
```

There is no error return. The handler therefore owns any error it cannot make
durable or propagate. One concrete handler normally listens to one event kind.
Do not combine unrelated reactions in a type switch.

### Publishing a Fact

The producing BC owns a Published Fact Contract. Put its protobuf source under
`proto/<producer>/integration/v1/` and generated Go under
`gen/<producer>/integration/v1/`.

The producing Application may import that generated contract. This is the
narrow exception for a producer-owned Published Language; it does not permit
Application to import RPC stubs, another BC's intent contract, or Kafka types.
`UserCreated` is the local Domain Event. `UserRegisteredV1` is the
producer-owned Published Fact Contract. It is an Integration Message contract;
its generated protobuf value is the payload carried by `message.Message`. The
Published Language name does not need to repeat the internal Domain Event name.

```go
// internal/business/user/application/eventhandler/user_created.go
package eventhandler

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-jimu/components/ddd/event"
	"github.com/go-jimu/components/ddd/message"
	"github.com/go-jimu/components/sloghelper"
	userintegrationv1 "example.com/service/gen/user/integration/v1"
	"example.com/service/internal/business/user/domain"
)

type UserCreatedHandler struct {
	publisher message.Publisher
	logger    *slog.Logger
}

var _ event.Handler = (*UserCreatedHandler)(nil)

func NewUserCreatedHandler(
	publisher message.Publisher,
	logger *slog.Logger,
) *UserCreatedHandler {
	return &UserCreatedHandler{publisher: publisher, logger: logger}
}

func (h *UserCreatedHandler) Listening() []event.Kind {
	return []event.Kind{domain.EventKindUserCreated}
}

func (h *UserCreatedHandler) Handle(ctx context.Context, raw event.Event) {
	startedAt := time.Now()
	fact, ok := raw.(domain.UserCreated)
	if !ok {
		h.logger.ErrorContext(ctx, "unexpected domain event",
			slog.String("operation", "user.publish_registered"),
			slog.String("outcome", "failed"),
			slog.String("event_kind", string(raw.Kind())),
			slog.String("payload_type", fmt.Sprintf("%T", raw)),
			slog.Int64("duration_ms", time.Since(startedAt).Milliseconds()))
		return
	}

	// UserRegisteredV1 is the Published Fact Contract payload type.
	payload := &userintegrationv1.UserRegisteredV1{
		UserId: fact.UserID,
		Name:   fact.Name,
		Email:  fact.Email,
	}
	msg, err := message.New(
		message.KindOf(payload),
		payload,
		message.WithKey(fact.UserID),
		message.WithOccurredAt(fact.OccurredAt),
	)
	if err == nil {
		err = h.publisher.Publish(ctx, msg)
	}
	if err != nil {
		h.logger.ErrorContext(ctx, "published fact delivery failed",
			slog.String("operation", "user.publish_registered"),
			slog.String("outcome", "failed"),
			slog.String("user_id", fact.UserID),
			slog.Int64("duration_ms", time.Since(startedAt).Milliseconds()),
			sloghelper.Error(err))
		return
	}
	h.logger.InfoContext(ctx, "published fact delivery completed",
		slog.String("operation", "user.publish_registered"),
		slog.String("outcome", "success"),
		slog.String("user_id", fact.UserID),
		slog.String("message_id", msg.ID()),
		slog.Int64("duration_ms", time.Since(startedAt).Milliseconds()))
}
```

Since `event.Handler` cannot return publication failure and the event was
dispatched after commit, this route is best-effort. Do not describe it as
reliable publication.

## Integration Contract Ownership

Ownership follows semantic authority:

- A Published Fact Contract is owned by the BC authoritative for the fact. Its
  Application maps its internal Domain Event to its own generated contract and
  calls `message.Publisher`.
- An Asynchronous Intent Contract is owned by the receiving BC, which defines
  what the request means and whether it may be admitted. A sender's Application
  calls a local semantic port; the sender's Infrastructure/ACL imports the
  receiver-owned contract, maps the local intent, and calls `message.Publisher`.
- `message.KindOf(payload)` uses the protobuf full name as `message.Kind`. Treat
  a protobuf package/message rename as a breaking contract change.
- `message.Kind` is not a Kafka topic. `message.Message.Key` is a
  transport-neutral ordering/routing group, not a Domain identity substitute.
- Evolve contracts additively when possible. Do not expose secrets or entire
  Aggregate snapshots merely because the protobuf schema permits it.

## Consuming an Integration Message

Inbound consumption is a Transport adapter under
`transport/messagesubscriber/`. It implements `message.Handler`, checks the
generated payload type, maps it to one local Application command, and delegates
exactly once. Application owns the business transaction, Domain validation,
and business idempotency.

```go
// internal/business/notification/transport/messagesubscriber/user_registered.go
package messagesubscriber

import (
	"context"
	"fmt"

	"github.com/go-jimu/components/ddd/message"
	userintegrationv1 "example.com/service/gen/user/integration/v1"
	"example.com/service/internal/business/notification/application"
	"example.com/service/internal/business/notification/application/command"
)

type UserRegisteredSubscriber struct {
	app *application.Application
}

var _ message.Handler = (*UserRegisteredSubscriber)(nil)

func NewUserRegisteredSubscriber(
	app *application.Application,
) *UserRegisteredSubscriber {
	return &UserRegisteredSubscriber{app: app}
}

func (*UserRegisteredSubscriber) Listening() []message.Kind {
	return []message.Kind{
		message.KindOf(&userintegrationv1.UserRegisteredV1{}),
	}
}

func (s *UserRegisteredSubscriber) Handle(ctx context.Context, msg message.Message) error {
	payload, ok := msg.Payload().(*userintegrationv1.UserRegisteredV1)
	if !ok {
		return fmt.Errorf("unexpected payload for %s: %T", msg.Kind(), msg.Payload())
	}
	return s.app.Commands.SendWelcomeNotification.Handle(ctx, command.SendWelcomeNotification{
		UserID: payload.GetUserId(),
		Name:   payload.GetName(),
		Email:  payload.GetEmail(),
	})
}
```

Return `nil` only after the local use case has reached its accepted completion
or stable business no-op. Do not emit a generic completion log in the subscriber:
its return occurs before Kafka commits the source offset. The Runtime/provider
boundary owns the delivery outcome and commit or terminal failure record. A
subscriber logs only a separate business-semantic fact with independent value.
The current go-jimu Kafka consumer exposes failure observation but no per-record
post-commit success hook; a required delivery-completion log therefore needs an
explicit provider-boundary extension, not a `message.Handler` log.
Return a non-nil error for a delivery attempt that must not yet be acknowledged;
the Kafka failure policy, not Application or Transport, decides provider retry,
DLQ, drop, and offset commit behavior.

## Registration and Kafka Runtime

The BC module registers its generated payload factory and subscriber before the
consumer loop starts:

```go
func RegisterUserRegistered(
	registry *message.PayloadRegistry,
	subscriber message.Subscriber,
	handler *messagesubscriber.UserRegisteredSubscriber,
) error {
	kind := message.KindOf(&userintegrationv1.UserRegisteredV1{})
	if err := registry.Register(kind, func() proto.Message {
		return &userintegrationv1.UserRegisteredV1{}
	}); err != nil {
		return err
	}
	return subscriber.Subscribe(handler)
}
```

Imports for the registration code are:

```go
import (
	"github.com/go-jimu/components/ddd/message"
	userintegrationv1 "example.com/service/gen/user/integration/v1"
	"example.com/service/internal/business/notification/transport/messagesubscriber"
	"google.golang.org/protobuf/proto"
)
```

`internal/pkg/messagebus` constructs the provider runtime with
`jimukafka.NewClient`, `jimukafka.NewPublisher`, and
`jimukafka.NewConsumer`. `NewConsumer` requires an explicit
`jimukafka.FailurePolicy`; derive it from confirmed failure semantics and accepted operational constraints rather than
silently enabling retry or DLQ. Pass the shared registry with
`jimukafka.WithPayloadResolver(registry)`.

`message.Subscriber.Subscribe` only registers handlers. The Kafka consumer also
implements `message.Runner`; Runtime starts `Run(ctx)` and owns cancellation and
client shutdown. Only Runtime imports:

```go
import (
	jimukafka "github.com/go-jimu/contrib/message/kafka"
	"github.com/twmb/franz-go/pkg/kgo"
)
```

Kafka brokers, topics, consumer groups, partitions, offsets, commit behavior,
retry/DLQ topics, publish retry, and `kgo` options never enter Domain,
Application, or Transport.

## Conditional Outbox

Use outbox only when confirmed recovery semantics or accepted project constraints require atomic recording of publication intent.
The component currently supplies `outbox.Recorder`, `outbox.Store`,
`outbox.Codec`, and `outbox.Relay`; it does not supply an xorm Store or a
transaction propagation API.

The implementation must therefore provide an Infrastructure
`outbox.Store` whose `Append` participates in the same xorm transaction as
`Repository.Save`. Application constructs the producer-owned
`message.Message`; the transaction records it through `outbox.Recorder` instead
of directly publishing the same fact. Runtime constructs `outbox.Relay`, which
claims records, decodes them, publishes through `message.Publisher`, and marks
them published or failed.

This is at-least-once delivery. Publishing can succeed while
`MarkPublished` fails, so consumers still need a scenario-appropriate
idempotency strategy. Do not claim exactly-once delivery, do not keep a second
direct-publish route for the same fact, and do not invent a go-jimu xorm adapter
that does not exist.

## Ordering, Idempotency, and Observability

- Do not promise global ordering. When order matters per Aggregate, use a stable
  key and a monotonic version/sequence, then define stale, duplicate, and gap
  behavior.
- Repeated delivery is normal for durable messaging. Use natural convergence,
  Aggregate guards, deterministic business keys, or an accepted inbox/dedup
  mechanism. Do not add inbox by default.
- The outer message execution boundary owns the completion log and duration.
  Application does not emit a duplicate completion record; it logs only an
  independently useful business decision or an error it must swallow.
- When OpenTelemetry is already adopted, propagate context through message
  headers and include `trace_id`, `request_id`, `message_id`, and correlation
  fields where available. The in-memory Domain Event dispatcher has no caller
  context and cannot automatically continue the request trace; use business
  correlation or an explicitly started/linked span outside Domain instead of
  putting technical trace fields in Domain Events.

## Verification

- Domain tests assert state change and recorded Domain Events.
- Application event-handler tests use real Domain Events and a fake
  `message.Publisher`.
- Contract tests cover protobuf compatibility and Domain Event-to-contract
  mapping.
- Transport tests build a real `message.Message` and assert one Application
  delegation and error disposition.
- Runtime/provider tests cover payload registration, handler registration,
  failure policy, restart, offset behavior, and graceful shutdown.
- Outbox integration tests, when adopted, prove atomic rollback, claiming,
  duplicate publication, relay restart, and lock expiry using the real database.
