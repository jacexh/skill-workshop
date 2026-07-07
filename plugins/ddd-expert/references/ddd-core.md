---
name: ddd-core
description: Compact DDD + Clean Architecture rule cards for backend services. Use when a phase skill or DDD risk card routes to layer ownership, dependency direction, repositories, Domain Events, Integration Messages, CQRS, cross-context contracts, or architecture conformance rules.
---

# Backend Architecture Rule Cards

**Scope**: Language-agnostic DDD/Clean Architecture constraints.
**Routing**: This is not an entrypoint. Start from the active phase skill. Use [`ddd-modeling.md`](ddd-modeling.md) first when the domain model, bounded context, aggregate boundary, or Architecture Gate is unsettled. Load this file when the phase needs tactical architecture rules.

> **Phase routing**: Agent entrypoints are [`domain-modeling`](../skills/domain-modeling/SKILL.md), [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), and [`review`](../skills/review/SKILL.md).

## 1. Architecture Principles

### 1.1 Core Philosophy

- Domain behavior is independent of frameworks, UI, databases, generated protocols, and transport.
- Dependencies point inward. Inner layers define semantic contracts; outer layers adapt mechanisms.
- Organize by bounded context first, technical layer second.
- Test business rules through Domain and Application seams, not through adapter internals.

### 1.2 Layered Architecture

Layer names describe responsibilities, not mandatory directories:

```text
Interface       -> protocol/request/response mapping, format validation
Application     -> use-case orchestration, transaction boundary, auth, DTO/read models
Domain          -> rules, invariants, aggregates, value objects, domain services, write repositories, events
Infrastructure  -> DB/cache/broker/RPC/SDK/framework adapters and generated-code integration
```

Generated RPC shortcuts may place a thin adapter in an existing Application entrypoint when a language guide explicitly allows it. The method must still do only map request -> delegate once -> map response/error.

### 1.3 Dependency Rule

- Domain imports no framework, ORM, DB/queue/cache/RPC/client package, generated protocol package, Infrastructure package, or another bounded context's Domain package.
- Application depends on Domain and on interfaces it owns. It does not depend on Infrastructure implementations.
- Infrastructure implements Domain Repository, Application QueryRepository/read facade, event/message publisher, ACL, and other adapter contracts.
- Interface depends inward and maps protocol types at the boundary.
- General-purpose implementation-independent libraries are allowed in Domain when they do not couple Domain to an external system.

## 2. Directory Structure

### 2.1 Overall Layout

Use vertical bounded-context organization. Flat horizontal `controllers/`, `models/`, `repositories/` layouts are not the target shape.

```text
cmd/ or apps/                 process entrypoints
configs/ or config/           configuration
internal/<context>/            one bounded context
  domain/
  application/
  interfaces/                  optional physical layer
  infrastructure/
proto/ or contracts/           generated protocol/schema sources
```

Language guides choose concrete path names. Do not create a physical `interfaces/` package only because this generic model names an Interface layer; calibrate existing repository conventions first.

### 2.2 Bounded Context Internal Structure

Expected responsibilities:

```text
domain/          Aggregate roots, Entities, Value Objects, Domain Services, write Repository interfaces, Domain Events
application/     Commands, Queries, handlers, DTOs/read models, assemblers, QueryRepository/read facades, coordination services
interfaces/      HTTP/RPC/MQ adapters, protocol validation and mapping
infrastructure/  Repository implementations, data objects, converters, external clients, message/runtime adapters
```

Keep context Infrastructure flat by default. Use semantic capability names, not technology directories, unless multiple implementations coexist. Shared technology components belong in shared technical packages.

## 3. Layer Responsibilities

### 3.1 Domain Layer

Domain owns business facts, state transitions, and invariants.

Use these mechanisms before considering an Application command-side port:

| Need | Default owner |
|---|---|
| Persist/load aggregate collection | Domain Repository |
| Rule over one aggregate | Aggregate method or Value Object |
| Named decision spanning aggregates | Domain Service after ruling out aggregate redesign or decision aggregate |
| Repeated same-BC reaction after state changes | Domain Event + Domain Event Handler |
| Cross-context propagation | Integration Message translated at the boundary |
| External/legacy model translation | ACL |
| Product/API/report read model | Application QueryRepository/read facade |
| DB/cache/broker/RPC/SDK/routing/topology/retry | Infrastructure adapter behind a semantic owner |

Constraints:

- State changes go through Aggregate methods or Domain policies. External field mutation is prohibited.
- Constructors/factories create valid objects and call `Validate()` or equivalent internal validation.
- External layers call Domain validation methods; they do not run external reflection/schema validators directly against Domain types.
- Domain Events are collected by aggregates and drained by Application after successful persistence.
- Domain generates IDs using infrastructure-independent schemes. Database auto-increment IDs must not be required to create a valid aggregate.
- Technical-facing capabilities are Domain-facing when they own stable language, states, admission/routing policy, ownership semantics, or invariants; otherwise use Application or Infrastructure per [`ddd-modeling.md §0.1`](ddd-modeling.md).

Domain Event collection:

```text
aggregate.method()        # collect internal events
repo.Save(aggregate)      # persist succeeds
events = aggregate.DrainEvents()
dispatcher.Dispatch(events)
```

Repository never drains events. Application drains once after `Save()`.

### 3.2 Application Layer

Application owns orchestration, not business rules.

Command flow:

```text
load aggregate -> call Aggregate/Domain Service -> Save -> drain/dispatch events
```

Query flow:

```text
call QueryRepository/read facade -> return DTO/read model
```

Rules:

- Commands modify state; Queries return read models and do not mutate state.
- Application constructs Domain inputs, calls Domain methods/validation, maps Domain errors outward, and manages transaction boundaries.
- Default transaction boundary is one aggregate write per command.
- A Repository is a write-side Aggregate collection. `Save(ctx, aggregate)` saves one mutable Aggregate Root; owned child rows may be persisted with it, but independent Aggregate Roots normally coordinate through Domain Events, process managers, reconcilers, Integration Messages, or compensation.
- A semantic repository method name is not proof; a method saving several candidate Aggregate Roots is presumed modeling pressure until aggregate ownership or event-driven coordination is proven.
- After `Repository.Save()`, the in-memory aggregate is stale. Reload before further operations.
- Query Handler structs are optional when they only delegate once to a QueryRepository.
- Application command-side ports are high-risk deviations. They require the Architecture Gate placement extension and the semantic fake test.

#### Default-First Concept Map

- Aggregate default: one Aggregate owns one consistency boundary and protects invariants through behavior methods.
- Repository default: one Repository is a collection for one write-side Aggregate Root; it does not serve product reads or bundle independent roots.
- Domain Event default: same bounded-context, past-tense business fact recorded after Domain state changes for repeated local reactions.
- Integration Message default: stable cross-context contract derived from a selected Domain fact or explicit published fact.
- Application Port default: QueryRepository/read facade for reads, ACL/Infrastructure adapter for mechanisms, and Domain Repository/Domain Service/Domain Event for command-side domain needs.
- CQRS default: commands mutate Domain aggregates; queries return DTO/read models without loading aggregates for UI history or detail pages.
- Bounded Context default: product language, authority, lifecycle, and invariant ownership define the boundary, not technology nouns.
- FSM default: state-specific behavior lives in state methods and aggregate methods delegate to the current state, not raw state mutation.
- High-risk deviations are not alternatives. They must name the default path rejected, residual coupling/risk, and migration or containment plan.

#### CQRS Port Granularity

Expose ports by caller semantics, not storage operations:

| Caller need | Port shape |
|---|---|
| Same write-side aggregate collection | Extend existing Domain Repository |
| Same product read-model family | Add method to existing QueryRepository |
| Different freshness/auth/pagination/failure/consistency/data-source/test-substitute semantics | New QueryRepository/read facade |
| Cross-context read | Published facade owned by source context |
| Routing, peer lookup, hop headers, queue subjects, retry knobs, topology | Infrastructure, not Application query port |

Do not create one QueryRepository per screen, RPC, SQL statement, or minor filter. Do not create storage-shaped omnibus ports that mix producer writes, UI history, audit lookup, projection bootstrap, and unrelated reads.
When one repository shape mixes aggregate saves with product list/detail/summary/page reads, treat it as CQRS split pressure: keep command-side aggregate loading in the Domain Repository and move product read models to QueryRepository/read facade unless the read is a command-side Domain fact needed to decide a write.

#### Multi-Aggregate Transaction Deviation Gate

Default path is one aggregate per command. If a design still proposes one
transaction writing multiple candidate Aggregate Roots, classify it as a
High-risk deviation, not a normal Repository pattern. It requires all evidence
below and still carries residual risk:

- Same bounded context and same persistence/consistency boundary.
- A named invariant would become non-repairably invalid under temporary inconsistency.
- Aggregate redesign, decision aggregate, Domain Service, database constraint surfaced as Domain error, Domain Event, Integration Message, compensating action, and idempotent consumer options were considered and rejected.
- Lock/optimistic-concurrency, retry, stale-state, failure semantics, and caller-visible outcomes are stated.
- The deviation is not based on ORM/session convenience and cannot be marked Rules Satisfied.

#### Command Handler Port-Pressure Heuristic

Count semantic outbound dependencies only: Repositories, QueryRepositories used by commands, ACLs, external semantic gateways, command-side ports.

| Count | Review action |
|---|---|
| 1-2 | Normal |
| 3 | Informal placement review |
| 4 | Mandatory port-pressure review |
| 5+ | Presumptively unresolved abstraction |

When count is 4+, check capability merge, rule extraction to Aggregate/Domain Service, event/message extraction, and mechanism sinking into Infrastructure.

### 3.3 Interface Layer

Interface owns protocol transformation only:

- request/response mapping;
- format/schema validation;
- actor/context extraction;
- protocol error mapping;
- one delegate call to Application.

No business rules, transaction control, repository calls, aggregate mutation, or adapter orchestration.

Error mapping defaults:

| Error | HTTP | gRPC |
|---|---|---|
| Not found | 404 | `NOT_FOUND` |
| Invalid Domain input | 400 | `INVALID_ARGUMENT` |
| Business precondition | 422 | `FAILED_PRECONDITION` |
| Concurrent modification | 409 | `ABORTED` |
| Infrastructure failure | 500 | `INTERNAL` |

### 3.4 Infrastructure Layer

Infrastructure owns technical implementation:

- Repository and QueryRepository implementations;
- data objects and converters;
- DB transactions, optimistic lock SQL, soft-delete columns;
- cache/broker/RPC/SDK/file/K8s/framework adapters;
- generated protocol adapter glue;
- retry, topology, routing mechanics.

Repository rules:

- Repository is a collection of aggregate roots, not a DAO.
- `Save()` covers create, update, and state-driven soft delete. Do not expose `Insert/Update/Delete` to Domain/Application.
- Write Repository interfaces live in Domain; QueryRepository/read facade interfaces live in Application or published API boundary.
- Infrastructure may compose multiple mechanisms behind one semantic port. Do not expose `RedisStore`, `MysqlReader`, `BrokerPublisher`, `TxManager`, `Peer`, `Directory`, or `Router` inward unless the use case names a semantic lifecycle and the Architecture Gate accepts it.
- Infrastructure increments optimistic-lock versions through storage semantics. Domain treats version as a read-only token.
- Business-driven delete is modeled as Domain state; `deleted_at` remains Infrastructure.

## 4. DDD Tactical Design Reference

| Concept | Owner | Notes |
|---|---|---|
| Aggregate Root | Domain | Guards invariants; repository operates on root |
| Entity | Domain | Stable identity |
| Value Object | Domain | Equality by value, immutable/replaceable |
| Domain Service | Domain | Named business decision spanning aggregates |
| Repository | Domain interface + Infrastructure impl | Write-side aggregate collection |
| QueryRepository/read facade | Application/API interface + Infrastructure impl | Product read model, DTOs |
| Domain Event | Domain | Same-BC fact after state change |
| Integration Message | Boundary/Application/Infrastructure contract | Cross-context published fact |
| Command/Query Handler | Application | Orchestration and transaction boundary |
| DTO/protocol message | Interface/Application/Infrastructure | Never a Domain entity |

## 5. Cross-Context Communication

### 5.1 Direct Calls Are Prohibited

Do not call another context's Domain model, Application Service, Repository, or database table directly. Cross-context interaction uses the mechanisms in §5.2.

### 5.2 Legitimate Cross-Context Mechanisms

| Mechanism | Use when |
|---|---|
| Integration Messages | State changes in one context trigger reactions elsewhere |
| Cross-context Queries | Read-only current snapshot is needed |
| ACL | External/legacy/upstream model must not pollute local language |
| Protocol Contracts | Cross-service/repository structured schema is needed |

### 5.3 Domain Events and Integration Messages

Domain Events are internal same-bounded-context facts. Integration Messages are cross-context contracts.
Event-storming facts are earlier modeling evidence: not every fact becomes a Domain Event, and not every Domain Event is published. Classify each fact by language scope, consumer, timing, and failure policy before choosing Domain Event, Integration Message, state, read model, process coordination, or no code artifact.

| Property | Domain Event | Integration Message |
|---|---|---|
| Scope | One bounded context | Crosses bounded contexts |
| Vocabulary | Publisher's ubiquitous language | Stable published language |
| Evolution | Refactor with Domain | Additive/deprecated schema discipline |
| Consumer coupling | Internal only | External consumers depend on it |

Async reaction roles:

- **Domain Event Handler**: consumes one same-BC Domain Event and performs a local reaction.
- **Boundary Publisher**: consumes same-BC Domain Event and publishes Integration Message.
- **Integration Message Handler**: consumes another context/service's contract and maps into local language.

One concrete handler has one role. Multi-kind handlers require same role, source context/contract family, target side effect, transaction boundary, failure policy, and dependency set.

Failure policy labels: best-effort, log-and-continue, return subscriber/adapter error, or explicit stronger reliability requirement.

### 5.4 Integration Message Payload Design

Messages carry aggregate ID plus minimum necessary facts at occurrence time. Never embed full aggregates/entities. Consumers treat payloads as historical snapshots, not current state.

### 5.5 Cross-Context Queries

Cross-context reads go through a facade/query port or protocol contract published by the owning context. They return DTOs/read models, have no side effects, and never return Domain objects. Avoid chains across more than two contexts.

### 5.6 Anti-Corruption Layer (ACL)

ACL translates external/legacy/upstream language into local Domain language. It lives in Infrastructure or a boundary adapter. Domain does not import external shapes.

### 5.7 Protocol Contracts

Schemas (Protobuf/OpenAPI/GraphQL/etc.) are contracts, not Domain models.

- Generated types stay outside Domain.
- Domain-facing ports use Domain-owned input/output types.
- Map generated types at Interface/Application/Infrastructure boundaries.
- Schema evolution is additive; deprecate before removing.

## 6. Domain Events and Dispatch Timing

### 6.1 Dispatch Timing

Correct order:

```text
call Domain method -> persist aggregate -> drain Domain Events -> dispatch/publish
```

Never dispatch before persistence succeeds.

### 6.2 Cross-process delivery

Cross-context Integration Messages default to broker at-least-once delivery plus idempotent consumers. If pre-publish loss is unacceptable, record an explicit reliability design and keep its mechanism inside Repository/Infrastructure adapters; do not leak `OutboxWriter`, `BrokerPublisher`, or `TransactionalEventPublisher` as inward ports.

## 7. Naming Conventions

Use conceptual names; apply language casing locally.

| Concept | Pattern |
|---|---|
| Domain Event | `<Name>Event` |
| Command | `<Action><Target>Command` |
| Query | `Find<Target>Query` or product-specific read name |
| Repository | `<Aggregate>Repository` |
| QueryRepository | `<ReadModelFamily>QueryRepository` |
| DTO | `<Purpose>DTO` |
| Domain Error | `<Description>Error` or `Err<Description>` |

Suspicious Application/Domain interface names are governed by [`ddd-modeling.md §0.2.3`](ddd-modeling.md).

## 8. Error Handling

### 8.1 Error Classification

| Error | Defined in | Handling |
|---|---|---|
| Domain error | Domain | Normal business flow; no log; map to 4xx/protocol equivalent |
| Infrastructure error | Infrastructure | Add context; log once at execution boundary; map to 5xx |
| Format validation error | Interface | Return at boundary; do not propagate inward |

### 8.2 Error Propagation

Domain returns business errors. Infrastructure wraps technical errors with operation/ID context. Application logs only when it owns the execution boundary. Interface maps errors to protocol responses.

## 9. Testing Strategy

### 9.1 Per-Layer Approach

| Layer | Evidence |
|---|---|
| Domain | Pure tests for invariants, transitions, errors, events |
| Application | Use-case tests through Repository/QueryRepository/event/message fakes |
| Infrastructure | Real adapter/schema tests where practical |
| Interface | Protocol mapping and error-code tests |

### 9.2 Domain Layer Test Priorities

Cover lifecycle transitions, invalid transitions, invariant violations, value object validation, and Domain Event emission.

### 9.3 Mock Usage Rules

Mock/stub cross-layer seams, not Domain objects. Domain tests instantiate real aggregates/value objects. Infrastructure tests prefer real dependencies or representative integration tests over pure mocks.

## 10. Architecture Review Checklist

- Modeling gate and accepted model source are present when needed.
- Domain import boundaries are clean.
- Layer ownership matches §3.
- Technical capability classification was done before package/port placement.
- Inward interfaces are defined by inward layers.
- CQRS ports follow caller semantics and product read-model families.
- Multi-aggregate transactions satisfy §3.2.
- Cross-context interaction uses §5 mechanisms.
- Generated protocol types do not enter Domain.
- Async handlers have one role and justified granularity.
- Repeated same-BC reactions use Domain Events selected from business facts; cross-context facts use Integration Messages.
- New command-side Application ports have Architecture Gate exception and semantic fake evidence.

## 11. Key Principles Summary

1. Domain has no concrete implementation dependencies.
2. Organize by bounded context.
3. Domain owns rules; Application orchestrates; Interface maps protocols; Infrastructure adapts mechanisms.
4. Repositories are write-side aggregate collections; QueryRepositories/read facades are product read models.
5. Application command-side ports are high-risk deviations, not defaults.
6. Aggregates guard non-repairable invariants.
7. Events dispatch after successful persistence.
8. Integration Messages are cross-context contracts; Domain Events are internal facts.
9. Generated protocol types are contracts/DTOs, not Domain types.
10. Technology mechanics stay in Infrastructure unless the use case names a semantic lifecycle.

## Appendix A: Strategic Modeling

Use [`ddd-modeling.md`](ddd-modeling.md) for bounded-context discovery, aggregate boundary probes, Architecture Gate, planning gates, technical capability classification, and port granularity.

## Appendix B: Language-Specific Implementation Guides

Use the active language guide for package names, concrete code shape, dependency injection, generated-code placement, logging, runtime, taskqueue, and database conventions:

- [`ddd-golang.md`](ddd-golang.md)
- [`ddd-python.md`](ddd-python.md)
- [`ddd-typescript.md`](ddd-typescript.md)
