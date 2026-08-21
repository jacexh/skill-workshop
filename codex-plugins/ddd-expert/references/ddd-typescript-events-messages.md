---
name: ddd-typescript-events-messages
description: TypeScript House Style for accepted local Domain Events, Integration Messages, and Kafka adapters.
---

# TypeScript Events and Integration Messages

## Applies When

Load this leaf only when the accepted implementation contains a local Domain
Event or Integration Message. Load
[ddd-collaboration.md](ddd-collaboration.md) for the cross-language ownership
and mapping contract.

## Local Event Shape

Domain Events are readonly Domain values and remain inside their producing
context. The Aggregate records the event with its transition. For an accepted
request-scoped post-commit flow, Application captures/drains events within the
Unit of Work and dispatches after `execute` resolves.

Place same-context handlers under `application/event-handlers/`. A producing
handler may import its own producer-owned generated fact type and maps fields
explicitly.

```ts
export type UserRegistered = Readonly<{
  userId: string;
  name: string;
  email: string;
  occurredAtMillis: number;
}>;

export class PrepareProfileOnUserRegistered {
  constructor(private readonly prepareProfile: PrepareProfileHandler) {}

  async execute(event: UserRegistered): Promise<void> {
    await this.prepareProfile.execute({
      userId: event.userId,
      name: event.name,
    });
  }
}
```

Composition registers the handler against the concrete event type. Provider
envelopes remain outside this local handler.

## Integration Contract Shape

- Source contracts live under `proto/<owner>/`; generated Protobuf-ES output
  lives under root `gen/`.
- Published facts use the producer namespace.
- Asynchronous intents use the receiver namespace and are reached through a
  local sender port plus Infrastructure mapping.
- A receiver subscriber decodes one generated payload and delegates to one
  Application command.

Use a stable message key for the accepted ordering scope. Propagate message ID,
contract kind/version, occurrence time, accepted correlation identity, and W3C
trace context in the envelope or headers. Payloads contain the promised facts.

## Kafka Adapter

Use the `@confluentinc/kafka-javascript` promisified API. Platform owns
connection, producer/consumer registration, polling, provider disposition,
group configuration, and shutdown.

The adopted Node 24/pnpm combination requires an explicit compatibility check
in the target image before Kafka code is accepted: locked install, real
producer/consumer smoke, and clean worker shutdown. Record that evidence with
the change.

## Verification

Test event recording, Application mapping with real generated types,
subscriber one-call delegation, and contract compatibility. Use the real Kafka
boundary when serialization, registration, keying, disposition, or lifecycle is
touched.
