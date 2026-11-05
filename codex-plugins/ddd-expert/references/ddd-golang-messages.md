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

`message.KindOf(payload)` uses the Protobuf full name. `message.Message.Key`
is the provider-neutral ordering/routing group. Treat contract package/message
renames under the repository's breaking-change policy.

## Published Fact Handler

The producing Application maps explicitly from its local event into its own
generated contract, builds it with
`message.New(message.KindOf(payload), payload, ...)`, sets
`message.WithKey` to the accepted ordering identity and
`message.WithOccurredAt` to the fact's occurrence time, and calls `Publish`.
The payload contains the stable identities and facts promised by the contract.
Envelope metadata carries message identity, occurrence time, and accepted
correlation/trace fields.

## Subscriber Shape

A subscriber under `transport/messagesubscriber/` holds the
`*application.Application`, asserts `message.Handler` at compile time, lists
`message.KindOf` of its generated payload in `Listening`, type-asserts that
payload, and maps its getters to one Application command. An unexpected
payload type returns an error naming the kind and the type.

Return the local use-case result to Runtime/provider code. The subscriber emits
a log only for a separate business-semantic fact.

## Registration

Register the generated payload factory under its `message.KindOf` kind, then
subscribe the handler, before the consumer loop starts.

## Verification

Use real generated Protobuf values and `message.Message`. Test contract
compatibility, event/intent mapping, payload registration, listening kind,
one Application delegation, and returned semantic disposition. Provider
delivery evidence belongs to its provider leaf.
