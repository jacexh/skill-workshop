---
name: ddd-core
description: Language-neutral House Style for realizing accepted DDD objects and layer boundaries in backend code.
---

# DDD Code Realization

## Applies When

Load this leaf when accepted DDD objects or cross-language layer boundaries are
being implemented or reviewed. The accepted strategic model and domain-object
design decide what exists and who owns it. This leaf fixes only its software
shape; the active-language router fixes syntax, libraries, filenames, and exact
verification commands.

## Layer Placement

| Accepted responsibility | Code owner |
|---|---|
| Business state, behavior, invariants, lifecycle, Domain facts, write Repository contract, Domain-owned Port contract | Domain |
| Use-case coordination, required context, transaction scope, Application DTO, QueryRepository, Application-owned continuation port | Application |
| External decoding, actor extraction, one Application delegation, public result/error mapping | Transport / Interface |
| Persistence mapping, generated clients, Domain-owned Port implementations, provider adapters, broker and framework mechanisms | Infrastructure |
| Composition, configuration, listeners, workers, shared clients, telemetry, startup and shutdown | Runtime / Platform |

Source dependencies point inward:

```text
Transport -> Application -> Domain
Infrastructure -> Application and Domain contracts
Runtime -> composition of all concrete implementations
```

Organize business code by Bounded Context before technical layer. Generated
contracts, persistence rows, provider responses, Application DTOs, and Domain
objects remain distinct types at their owning boundaries.

## Model-to-code Projection

Use this table only after the corresponding model meaning is accepted.

| Accepted model meaning | House Style realization |
|---|---|
| Bounded Context | One business module/package tree with no imports of another context's internals |
| Aggregate Root | One Domain type exposing intention-revealing behavior and owning mutation of its accepted children |
| Entity | A Domain type with explicit identity, continuity, named behavior, and mapping-safe read access |
| Value Object | A valid-at-construction Domain value with value equality and immutable or defensive-copy semantics |
| Domain Service | A named, mostly stateless Domain operation over Domain values or snapshots |
| Command | One semantic Application entry point; no same-named class is required when the language leaf uses another shape |
| Aggregate Capability | A public Domain method on the accepted owner; private helpers may support it |
| Domain Event | A local Domain fact recorded by the behavior that establishes it |
| Published Fact Contract | A producer-owned generated contract mapped at the producing Application boundary |
| Asynchronous Intent Contract | A receiver-owned generated contract reached through the sender's semantic port and Infrastructure adapter |
| Event-triggered Command | One event/subscriber adapter mapping the established fact to one Application use case |

For implementation evidence, cite the governing artifact clause beside the
production symbols that realize the affected behavior. Keep that projection in
the task or review report, not in DDD artifacts or source comments.

## Domain Object Shape

### Aggregate Root and Entity

- Factories create valid new state and creation facts.
- Reconstitution restores already-existing state, validates it, and records no
  creation behavior or event.
- Named Domain methods perform business transitions. Mapping accessors or
  exported mapping fields expose existing state without becoming an alternate
  mutation API.
- The Root controls changes to owned Entities and retains identity-only
  references to other Aggregate Roots.
- Mutable inputs and outputs are copied at the Domain boundary.
- Technical timestamps, protocol metadata, logging, transactions, and runtime
  lifecycle remain outside the Domain object.

### Value Object

- Construction establishes structural validity and normalization.
- Equality uses the complete accepted value.
- Mutation returns a replacement value; containers expose immutable values or
  defensive copies.
- Protocol and persistence representations are mapped outside Domain.

### Domain Service

- Use the accepted Ubiquitous Language for its type and operation names.
- Accept Domain values, snapshots, authoritative facts, or time.
- Return a Domain decision, value, error, or fact.
- Persistence, transaction control, logging, scheduling, and provider policy
  stay outside the service.

### Domain-owned Port

A port belongs to the layer that owns its invocation. An Application-owned port
continues a use case. Realize an accepted Domain-owned Port as a Domain contract
invoked by its recorded Behavior, with an Infrastructure implementation supplied
by Runtime composition; Application neither prefetches its result nor duplicates
its contract. Name the contract for its Domain role with a `Port` suffix.
Preserve the recorded Behavior as its invoker and each sparse Method's decision
point and Domain result; the language leaf chooses the exact signature and
injection. The implementation may compose
one or more external sources and owns any accepted fulfillment policy. Domain
behavior reasons only over a fulfilled Domain result; technical non-fulfillment
remains an execution outcome unless the accepted model gives it Domain meaning.

### Repository

- Place one write Repository contract beside its Aggregate Root.
- Use collection-shaped `Get` and `Save` operations unless the accepted
  lifecycle and language leaf define a snapshot/checkpoint form.
- Persist owned children through the Root boundary.
- Expose stable not-found and concurrency outcomes in inner-layer language.
- Keep SQL, sessions, transactions, cache keys, provider options, product lists,
  histories, reports, and projections out of the write contract.

## Application and Transport Shape

- A command handler loads required facts, invokes Domain behavior, persists the
  accepted Root set, coordinates accepted reactions, and returns a minimal
  immutable result.
- A query handler returns an immutable Application read result and performs no
  business mutation.
- A focused read of one complete Aggregate may use its write Repository when
  that path is already accepted. Accepted lists, pages, histories, reports,
  partial fields, and composed projections use an Application-owned
  QueryRepository returning Application read types.
- An inbound adapter decodes and maps one external contract, delegates once to
  Application, and maps the result or error. Generated types end at that
  boundary.

## Local Transaction Realization

For an accepted command that saves one Root, the Repository may own one local
transaction. For an accepted same-context command that saves several independent
Roots atomically:

- Application defines the transaction scope;
- Infrastructure owns begin, enlistment, commit, and rollback;
- every participating Repository uses the same physical local transaction;
- each write Repository still owns one Aggregate Root;
- the scope uses one Bounded Context and one local transactional resource;
- Domain code remains transaction-unaware.

The active-language leaf defines the concrete participation mechanism and its
integration evidence.

## Naming and Errors

- Commands use imperative intent; events use past-tense facts; read models use
  consumer-facing meaning.
- Domain errors name rejected business decisions or preconditions.
- Application errors name stable use-case outcomes.
- Transport maps semantic outcomes to public protocol responses.
- Infrastructure translates a provider error once into a stable inner outcome
  while preserving its cause.
- The outer execution owner emits the completion log; inner layers log only an
  independently useful semantic event.

## Related Leaves

- [ddd-collaboration.md](ddd-collaboration.md) for code realization of accepted
  published APIs, Domain Events, and Integration Messages.
- [database.md](database.md) for MySQL schema, SQL, migration, and persistence
  realization.
