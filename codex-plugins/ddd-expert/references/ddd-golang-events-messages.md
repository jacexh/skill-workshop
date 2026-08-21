---
name: ddd-golang-events-messages
description: Go House Style for Domain Events, event handlers, published facts, asynchronous intents, inbound message adapters, and Kafka runtime.
---

# Go Events and Integration Messages

This Flow Guide owns the end-to-end event and message flow. The Layer Guides
remain authoritative for each layer's general responsibilities.

For an accepted local Domain Event, use the event component and same-context
handler flow. For an accepted cross-context message, use the message component
and only the provider sections touched by that collaboration.

## Adopted Components

| Concern | Mandatory component when applicable |
|---|---|
| Same-context Domain Events | `github.com/go-jimu/components/ddd/event` |
| Integration Message envelope and ports | `github.com/go-jimu/components/ddd/message` |
| Kafka adapter | `github.com/go-jimu/contrib/message/kafka` |
| Kafka runtime implementation | `github.com/twmb/franz-go`, only under `internal/pkg/messagebus` |

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
by same-context reactions, not protobuf messages, Kafka topics, or provider
metadata.

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

## Post-commit In-process Dispatch

For an accepted same-context reaction dispatched after persistence, use:

```text
Domain behavior -> Repository.Save -> Events.Drain -> Dispatcher.DispatchAll
```

Rules:

- Drain only after `Save` succeeds.
- This flow assumes the request-scoped lifecycle. After successful `Save`, that
  loaded instance is stale: it may supply the result and be drained once, but
  cannot be mutated or saved again. A resident Aggregate requires a separately
  accepted event/checkpoint flow; do not transplant this sequence into it.
- `DispatchAll` submits the drained batch to the in-memory dispatcher. Each
  `event.Handler` runs as a separate Application follow-up.
- Handle a `DispatchAll` error at the Application boundary according to the
  use case's ordinary error and logging convention.

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

## Same-context Event Handlers

An Application event handler implements the real go-jimu contract:

```go
type Handler interface {
	Listening() []event.Kind
	Handle(context.Context, event.Event)
}
```

There is no error return. The handler therefore owns its error handling. One
concrete handler normally listens to one event kind; keep unrelated reactions in
separate handlers.

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

Because `event.Handler` has no error result, the producing handler owns the
publisher error according to the Application error and logging convention.

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
exactly once. Application owns the business transaction and Domain validation.

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

Return the local use-case result to Runtime/provider code. The subscriber logs
only a separate business-semantic fact with independent value; Runtime owns
provider acknowledgement and the execution-completion record.

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
`jimukafka.FailurePolicy`; configure it from the accepted project settings. Pass the shared registry with
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
and `kgo` options remain in Runtime/provider code.

## Ordering and Observability

- Do not promise global ordering. When order matters per Aggregate, use a stable
  key and a monotonic version/sequence, then define stale, duplicate, and gap
  behavior.
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
  provider configuration, offset behavior, and graceful shutdown.
