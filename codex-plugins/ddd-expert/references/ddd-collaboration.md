---
name: ddd-collaboration
description: Language-neutral House Style for realizing accepted published APIs, Domain Events, and Integration Messages.
---

# Collaboration Code Realization

## Applies When

Load this leaf only when the accepted design already contains a published
synchronous API, a local Domain Event, a Published Fact Contract, or an
Asynchronous Intent Contract. EventStorming and Tactical Design decide which
collaboration exists and what it means. This leaf fixes ownership, placement,
mapping, and verification of its code realization.

## Placement

| Accepted concern | Code owner |
|---|---|
| Published request/response contract | Owning context's contract source; generated types end in Transport |
| Record a local Domain Event | Producing Domain behavior |
| Dispatch a local Domain Event | Producing Application boundary |
| Handle a same-context Domain Event | Producing context's Application event handler |
| Translate a Published Fact Contract | Producing context's Application event handler |
| Send an Asynchronous Intent | Sending Application semantic port plus Infrastructure ACL |
| Decode an Integration Message | Receiving Transport subscriber |
| Broker clients, polling, acknowledgement, registration, and lifecycle | Infrastructure / Runtime |

Local Domain Event types stay inside their Bounded Context. Published contracts
use their owning context's generated namespace. Provider envelopes and metadata
remain outside Domain and Application contracts.

## Published Synchronous API Shape

- Contract operations use the published language of the owning context.
- Commands express intent and return the accepted admission or use-case result.
- Queries return immutable read contracts.
- Transport maps generated request values and trusted actor context into one
  Application call, then maps stable outcomes to the public response.
- Authorization, timeout, error, consistency, and version semantics are
  represented by the published contract or its adjacent public documentation.
- Each consuming context translates the published language at its boundary;
  generated service types do not enter Domain.

## Local Domain Event Shape

- Use a past-tense Domain name and an immutable payload containing the Domain
  facts required by accepted local reactions.
- Record the event in the same Domain operation that establishes the fact.
- Keep transport names, topics, provider headers, offsets, trace identifiers,
  retry state, and log fields outside the event.
- Application drains or captures events at the accepted transaction boundary
  and dispatches each accepted reaction through its registered handler.
- A same-context handler maps the event to one named Domain intent or to one
  producer-owned fact contract.

## Integration Message Shape

### Published Fact Contract

- The producer owns the schema and generated namespace.
- A producing Application event handler maps the selected local fact into the
  published payload.
- The payload contains stable identities and the occurrence-time facts promised
  to consumers, rather than an Aggregate snapshot.

### Asynchronous Intent Contract

- The receiver owns the schema and generated namespace.
- The sender's Application calls a local semantic port.
- The sender's Infrastructure ACL maps local intent to the receiver-owned
  generated contract.

### Consuming Adapter

- Decode the envelope and generated payload in Transport.
- Extract stable message identity and accepted correlation metadata.
- Map to one local Application command and delegate once.
- Return the semantic processing result to Runtime so the provider adapter can
  apply its configured acknowledgement policy.

The active-language message leaf defines envelope construction, registry,
provider API, and exact disposition behavior.

## Contract Evolution

- Prefer additive compatible fields and tolerate unknown fields.
- Treat a contract name, generated namespace, message kind, field number, or
  semantic reinterpretation according to the repository's compatibility policy.
- Remove a field or version only with consumer evidence recorded through the
  project's contract-change process.
- Keep internal Domain refactoring independent from the published contract by
  retaining explicit boundary mapping.

## Verification

- Contract tests prove generation and compatibility checks for the owning
  schema.
- Mapping tests use real Domain/Application values and generated contract types.
- Subscriber tests decode a real envelope, delegate once, and return the
  expected semantic disposition.
- Provider integration evidence proves registration and delivery only when the
  touched implementation includes that provider boundary.

## Related Leaves

- [ddd-core.md](ddd-core.md) for cross-language layer and object realization.
- Use the active-language router for concrete event, message, and transport
  leaves.
