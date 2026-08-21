---
name: ddd-golang-messages
description: Go House Style for accepted Integration Message contracts, publishers, subscribers, and provider-neutral registration.
---

# Go Integration Messages

## Applies When

Load this leaf only when an accepted Published Fact Contract or Asynchronous
Intent Contract is implemented in Go. Use
`github.com/go-jimu/components/ddd/message` and load
[ddd-collaboration.md](ddd-collaboration.md) for the shared ownership contract.

## Contract and Placement

Contract source lives under `proto/<owner>/integration/v1/`; generated output
lives under `gen/<owner>/integration/v1/`.

| Responsibility | Placement |
|---|---|
| Map a local event to a producer-owned fact | producing `application/eventhandler/` |
| Send a receiver-owned intent | sender Application port plus Infrastructure ACL |
| Decode and delegate an incoming message | receiver `transport/messagesubscriber/` |
| Register generated payload factory and subscriber | receiver Bounded Context module |
| Provider client and active loop | Runtime; see [ddd-golang-kafka.md](ddd-golang-kafka.md) when Kafka applies |

`message.KindOf(payload)` uses the Protobuf full name. `message.Message.Key`
is the provider-neutral ordering/routing group. Treat contract package/message
renames under the repository's breaking-change policy.

## Published Fact Handler

The producing Application maps explicitly from its local event into its own
generated contract and builds a `message.Message`:

```go
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
```

The payload contains the stable identities and facts promised by the contract.
Envelope metadata carries message identity, occurrence time, and accepted
correlation/trace fields.

## Subscriber Shape

```go
type UserRegisteredSubscriber struct {
	app *application.Application
}

var _ message.Handler = (*UserRegisteredSubscriber)(nil)

func (*UserRegisteredSubscriber) Listening() []message.Kind {
	return []message.Kind{
		message.KindOf(&userintegrationv1.UserRegisteredV1{}),
	}
}

func (s *UserRegisteredSubscriber) Handle(
	ctx context.Context,
	msg message.Message,
) error {
	payload, ok := msg.Payload().(*userintegrationv1.UserRegisteredV1)
	if !ok {
		return fmt.Errorf("unexpected payload for %s: %T", msg.Kind(), msg.Payload())
	}
	return s.app.Commands.SendWelcomeNotification.Handle(
		ctx,
		command.SendWelcomeNotification{
			UserID: payload.GetUserId(),
			Name:   payload.GetName(),
			Email:  payload.GetEmail(),
		},
	)
}
```

Return the local use-case result to Runtime/provider code. The subscriber emits
a log only for a separate business-semantic fact.

## Registration

Register the generated payload factory and subscriber before the consumer loop:

```go
kind := message.KindOf(&userintegrationv1.UserRegisteredV1{})
if err := registry.Register(kind, func() proto.Message {
	return &userintegrationv1.UserRegisteredV1{}
}); err != nil {
	return err
}
return subscriber.Subscribe(handler)
```

## Verification

Use real generated Protobuf values and `message.Message`. Test contract
compatibility, event/intent mapping, payload registration, listening kind,
one Application delegation, and returned semantic disposition. Provider
delivery evidence belongs to its provider leaf.
