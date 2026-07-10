---
name: ddd-core
description: Integrated DDD and Clean Architecture baseline for layers, dependency direction, tactical building blocks, Repository, and conditional CQRS.
---

# DDD and Clean Architecture Core

This Knowledge Leaf integrates tactical DDD with Layered Architecture, the
Dependency Rule, and ports-and-adapters boundaries. It distinguishes broadly
accepted DDD meanings from this plugin's architecture House Style.

## Rule Strength

- **[DDD Principle]** A durable DDD meaning or boundary. Apply it through the accepted domain model rather than as a mechanical code rule.
- **[House Rule]** A conditional implementation or architecture constraint. It does not apply before its stated condition is true; once applicable, it is mandatory.
- **[Heuristic]** A question or pressure signal. It invites investigation and never proves a conclusion alone.

Unless a rule states a narrower condition, its House Rule applies to backend
code governed by `ddd-expert` whenever its facts are present; it does not
require a separate rule-by-rule opt-in. A design-changing mechanism still needs
an accepted design decision.

## Navigation

| Need | Section |
|---|---|
| Dependency direction and layer ownership | Layered Architecture; Layer Responsibilities |
| Entity, Value Object, Aggregate, Domain Service, Domain Event | Tactical Building Blocks |
| Write-side collection semantics | Repository |
| Read-model separation | Conditional CQRS |
| Semantic names and error ownership | Naming and Errors |

## 1. Layered Architecture and Dependency Rule

Layer names describe responsibilities, not mandatory directories. The Go House
Style names its physical Interface layer `transport`.

| Layer | Owns |
|---|---|
| Domain | Business language, behavior, invariants, lifecycle, policies, Domain facts, write Repository contracts |
| Application | Use-case orchestration, transaction boundary, Application DTOs, QueryRepository and other semantic outbound ports |
| Interface | Protocol translation, actor extraction, one Application delegation, response and error mapping |
| Infrastructure | Persistence, external-service, broker, framework, generated-client/SDK, runtime, and outbound adapter mechanisms |

- **[DDD Principle]** Domain behavior and language do not depend on UI, protocol, generated contract, database, broker, SDK, or framework concerns.
- **[House Rule]** In backend code governed by this House Style, source dependencies point inward: Interface calls Application; Application uses Domain; Infrastructure implements contracts owned by Domain or Application.
- **[House Rule]** Keep Application and Interface responsibilities distinct. Physical colocation does not permit protocol handlers to become use-case implementations.
- **[House Rule]** Organize business code by Bounded Context before technical layer. Cross-context code must use an accepted collaboration contract rather than importing another context's internal Domain.
- **[Heuristic]** Package names and import direction are useful evidence, but behavior and ownership determine whether a boundary is sound.

## 2. Layer Responsibilities

### Domain

- **[DDD Principle]** Domain objects protect invariants through behavior; callers do not assign state to perform business transitions.
- **[DDD Principle]** Domain signatures use Domain-owned language and types.
- **[House Rule]** When creating a new Domain object, use a Domain Factory or creation function that establishes a valid initial state. Persistence restoration and mapping of already-valid state are separate concerns.
- **[House Rule]** Domain code must not own logging, transactions, retries, goroutines, protocol mapping, persistence mapping, or provider calls.

### Application

- **[DDD Principle]** Application coordinates a use case and delegates business decisions to the Domain owner.
- **[House Rule]** A command coordinates required facts, Domain behavior, persistence, and accepted reactions without reimplementing Domain rules.
- **[House Rule]** A query returns an Application read result without mutating business state.
- **[House Rule]** When a use case needs an external capability, Application may own a semantic outbound port; its contract must not expose provider, SDK, protocol, topology, or storage vocabulary.
- **[Heuristic]** Many unrelated collaborators may indicate missing Domain behavior, an over-broad use case, or durable process coordination. No dependency count proves this alone.

### Interface

- **[House Rule]** Interface translates between an external contract and an Application contract.
- **[House Rule]** An inbound adapter decodes and maps input, delegates once to Application, and maps the result or error; it does not introduce a second set of Domain validation rules.
- **[House Rule]** Interface must not own Domain decisions, repositories, transactions, Aggregate mutation, or outbound mechanism orchestration.
- **[House Rule]** Generated request and response types stop at Interface; Domain and Application use their own semantic types.

### Infrastructure

- **[House Rule]** Infrastructure implements inner contracts without moving mechanism vocabulary or business decisions inward.
- **[House Rule]** Persistence rows, generated contracts, provider responses, Application DTOs, and Domain objects remain distinct when their owners or evolution rules differ; Infrastructure owns the required persistence and outbound translations.
- **[House Rule]** Provider retry, topology, connection lifecycle, framework wiring, and runtime configuration remain in Infrastructure or the runtime platform boundary.

## 3. Tactical Building Blocks

### Entity and Value Object

- **[DDD Principle]** An Entity is distinguished by identity across change.
- **[DDD Principle]** A Value Object is distinguished by its attributes, has no independent identity, and is replaced as a whole.
- **[House Rule]** When a value has structural validity rules, establish them at Domain construction and prevent partially valid values from circulating.
- **[Heuristic]** Importance, mutability, independent storage, or a table identifier does not by itself make an object an Entity or Aggregate Root.

### Aggregate

- **[DDD Principle]** An Aggregate is a consistency and mutation boundary with one root.
- **[DDD Principle]** External callers and Repositories address the root; the root protects invariants of owned Entities and Value Objects.
- **[House Rule]** Reference another Aggregate Root by identity rather than retaining a mutable object graph across Aggregate boundaries.
- **[House Rule]** Unless the accepted model requires a stronger atomic boundary, one command transaction mutates one Aggregate Root.
- **[Heuristic]** A shared ORM session, foreign key, or multi-table write is persistence evidence, not Aggregate-boundary evidence.

### Domain Service

- **[DDD Principle]** A Domain Service expresses an important named Domain operation that does not naturally belong to an Entity or Value Object.
- **[DDD Principle]** A Domain Service may involve one Aggregate, several Aggregates, or no Aggregate; crossing Aggregate boundaries is not a requirement.
- **[House Rule]** When a Domain Service is used, keep it mostly stateless, name it in the Ubiquitous Language, accept Domain values or snapshots, and return a decision, value, error, or fact.
- **[House Rule]** Application normally supplies required facts and time. A Domain Service may use a narrowly defined Domain-owned semantic collaborator, including a required Repository query capability, only when reducing the interaction to primitive precomputed data would erase Domain meaning. A query does not remove a time-of-check/time-of-use race; correctness that depends on concurrent state requires an accepted constraint, lock, isolation, or other consistency mechanism outside the Domain Service's control.
- **[House Rule]** A Domain Service never saves Aggregates or controls a transaction. A cross-Aggregate decision does not authorize atomic persistence of several roots.
- **[Heuristic]** Durable progress, timeout, retry, and compensation point toward an Application coordinator or Process Manager rather than a Domain Service.

### Domain Event

- **[DDD Principle]** A Domain Event is a selected past-tense fact in one Bounded Context's language.
- **[DDD Principle]** Not every observed business fact needs to become a Domain Event, and a Domain Event is not automatically an external contract.
- **[House Rule]** When Domain behavior records an event, record it with the state transition that establishes the fact and keep its payload in Domain language.
- **[Heuristic]** Dispatch timing and reliability follow the accepted consistency model; DDD does not prescribe one universal before-commit or after-commit sequence.

## 4. Repository

- **[DDD Principle]** A Repository presents collection-like access to Aggregate Roots and hides persistence mapping.
- **[House Rule]** Define a write Repository contract for one Aggregate Root; persist owned children through that root's boundary.
- **[House Rule]** Use `Get` and `Save` as the minimal shape when they satisfy the accepted Domain use cases. Add retrieval by Domain criteria only when it preserves Aggregate collection semantics.
- **[House Rule]** Product lists, reports, histories, summaries, and presentation projections do not belong on the write Repository.
- **[Heuristic]** Workflow verbs, provider-shaped methods, product reads, and multi-root saves are pressure to inspect the model or placement; a method name alone is not proof.
Whether a saved in-memory Aggregate remains usable is part of the concrete Repository and event-collection contract, not a universal DDD rule.

## 5. Conditional CQRS

- **[DDD Principle]** DDD does not require CQRS, separate data stores, asynchronous projections, or Event Sourcing.
- **[House Rule]** When a read needs lists, pagination, history, reporting, cross-Aggregate composition, partial fields, presentation-specific shape, or distinct performance, freshness, authorization, or source semantics, use an Application-owned QueryRepository/read facade that returns an Application read model.
- **[House Rule]** When a read only returns one Aggregate's existing state, may load the complete Aggregate at acceptable cost, and has no distinct composition, presentation, performance, freshness, authorization, or source semantics, Application may use the Domain Repository and map a read-only result. It must not expose the Aggregate.
- **[House Rule]** Interface never calls either Repository directly; every command and query enters through Application.
- **[House Rule]** When CQRS is applicable, command-side Aggregate loading remains on the Domain Repository and read-side models remain on QueryRepository/read facades even if one table or adapter supports both.
- **[Heuristic]** Create read ports around cohesive consumer semantics, not one interface per screen, RPC method, SQL statement, or minor filter.

## 6. Naming and Errors

- **[DDD Principle]** Names express the owning context's Ubiquitous Language.
- **[House Rule]** Commands use imperative intent, events use past-tense facts, and read models are named for consumer meaning.
- **[DDD Principle]** Domain errors express rejected business decisions or preconditions without protocol or storage codes.
- **[House Rule]** Interface maps semantic outcomes to public protocol responses; outer execution boundaries add technical context and log according to the language House Style.

## Related References

- [ddd-modeling.md](ddd-modeling.md) for language, authority, lifecycle, and Aggregate-boundary reasoning.
- [ddd-collaboration.md](ddd-collaboration.md) for published APIs, events, Integration Messages, Process Managers, and reliable delivery choices.
- [database.md](database.md) for Persistence House Style, schema, query, migration, and concurrency rules.
