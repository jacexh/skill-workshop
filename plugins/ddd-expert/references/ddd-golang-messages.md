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
| Send a receiver-owned intent | sender Application Port plus Infrastructure ACL |
| Decode and delegate an incoming message | receiver `transport/messagesubscriber/` |
| Register generated payload factory and subscriber | receiver Bounded Context module |
| Provider client and active loop | Runtime; see [ddd-golang-kafka.md](ddd-golang-kafka.md) when Kafka applies |

A contract package or message rename changes its `message.KindOf` kind; treat
it under the repository's breaking-change policy.

## Published Fact Handler

The producing Application maps explicitly from its local event into its own
generated contract, builds it with
`message.New(message.KindOf(payload), payload, ...)`, sets
`message.WithKey` to the accepted ordering identity and
`message.WithOccurredAt` to the fact's occurrence time, and calls `Publish`.
The payload contains the stable identities and facts promised by the contract.
Envelope metadata carries message identity, occurrence time, and accepted
correlation/trace fields. A must-run handler sets `message.WithID` to its
delivery key, the same on every retry, so consumers deduplicate by it.

## Subscriber Shape

A subscriber under `transport/messagesubscriber/` maps one generated payload
to one Application command:

```go
// internal/business/notification/transport/messagesubscriber/user_registered.go
type UserRegisteredSubscriber struct{ app *application.Application }

var _ message.Handler = (*UserRegisteredSubscriber)(nil)

func (*UserRegisteredSubscriber) Listening() []message.Kind {
	return []message.Kind{message.KindOf(&userintegrationv1.UserRegisteredV1{})}
}

func (s *UserRegisteredSubscriber) Handle(ctx context.Context, msg message.Message) error {
	payload, ok := msg.Payload().(*userintegrationv1.UserRegisteredV1)
	if !ok {
		return fmt.Errorf("unexpected payload for %s: %T", msg.Kind(), msg.Payload())
	}
	return s.app.SendWelcomeNotification(ctx, application.SendWelcomeNotification{
		UserID: payload.GetUserId(),
	})
}
```

## Verification

Use real generated Protobuf values and `message.Message`. Test contract
compatibility, event/intent mapping, payload registration, listening kind,
one Application delegation, and returned semantic disposition. Provider
delivery evidence belongs to its provider leaf.
