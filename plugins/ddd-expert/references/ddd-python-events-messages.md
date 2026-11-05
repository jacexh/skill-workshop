---
name: ddd-python-events-messages
description: Python House Style for accepted local Domain Events, Integration Messages, and synchronous Kafka adapters.
---

# Python Events and Integration Messages

## Applies When

Load this leaf only when the accepted design contains a local Domain Event or an
Integration Message. Load [ddd-collaboration.md](ddd-collaboration.md) for the
cross-language ownership and mapping contract.

## Local Event Shape

Place immutable event values in the producing Domain and handlers under the
same context's `application/eventhandlers/`. An event carries the affected
identities, the established facts, and its occurrence time.

The Aggregate records the event with the accepted transition. For an accepted
request-scoped post-commit reaction, Application uses
`save -> drain_events -> dispatch_all`. A state-changing handler enters a fresh
Application command and transaction. A resident Aggregate follows its accepted
live event/checkpoint flow.

One handler consumes one concrete event and delegates to one named Application
use case. Name it `<Reaction>On<Event>`, such as
`PrepareProfileOnUserRegistered`.

Runtime/composition registers the handler explicitly. The handler does not
inspect provider envelopes or reach into an Aggregate's state.

## Integration Contract Shape

- Contract source lives in `proto/<owner>/`; generated Python code lives in
  root `gen/<owner>/`.
- A producing Application handler may import its producer-owned Published Fact
  generated type and maps from the local event explicitly.
- An intent sender calls a local Application Port; Infrastructure imports and
  maps the receiver-owned generated type.
- A receiver subscriber under `transport/messagesubscriber/` decodes one
  generated type and delegates to one Application command.

The envelope carries stable message identity, contract kind/version,
occurrence time, and accepted correlation/trace headers. The payload carries
the promised facts.

## Kafka Adapter

Use synchronous `confluent-kafka` clients. Runtime owns Producer delivery
callbacks, Consumer polling, group/offset policy, registration, readiness, and
shutdown. Consumers use explicit serializers and a stable message key for the
accepted ordering scope. The subscriber returns its semantic result to Runtime,
which applies the configured provider disposition.

Kafka consumers run in dedicated worker processes. FastAPI request workers
serve HTTP only.

## Verification

- Domain tests prove state change and the exact recorded event.
- Application tests prove event-to-intent or event-to-generated-contract
  mapping with a typed fake port.
- Contract tests use real generated types and the repository compatibility
  command.
- Provider tests use the real Kafka boundary when registration, serialization,
  keying, or disposition changes.
