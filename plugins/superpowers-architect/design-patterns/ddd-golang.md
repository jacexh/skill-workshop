---
name: ddd-golang
description: Go implementation guide for DDD + Clean Architecture. Use when editing Go business files under internal/business/<context>/**.go or pkg/gen/** contracts, or when implementing aggregates, repositories, domain events, integration messages, CQRS, cross-context query ports, module assembly, or Go package boundaries. For cmd/**/main.go, internal/pkg/**, config, fx.Lifecycle, graceful shutdown, or Kubernetes runtime work, use ddd-golang-runtime.md. Code agents must read ddd-agent-contract.md first.
---

# Go Web System Architecture Guide
## DDD + Clean Architecture — Go Implementation

**Version**: v2.4
**Date**: 2026-05-21
**Scope**: Team backend service architecture standard
**Prerequisites**:
- **Agent contract**: [`ddd-agent-contract.md`](ddd-agent-contract.md) — Code agents must read this first; defines trigger conditions, stop protocol, and prohibited actions. Do not skip.
- **Strategic modeling**: [`ddd-modeling.md`](ddd-modeling.md) — Complete this first to identify bounded contexts and aggregate boundaries from business requirements
- **Architecture spec**: [`ddd-core.md`](ddd-core.md) — Language-agnostic DDD + Clean Architecture rules. All architecture principles defer to `ddd-core.md`; in particular, the architecture review checklist lives at [ddd-core.md §10](ddd-core.md) and the consolidated principles summary lives at [ddd-core.md §11](ddd-core.md).
- This document is the Go implementation guide that builds on both.

> **Cross-reference convention**: major architecture sections align with the corresponding `ddd-core.md` sections where applicable. The Go guide also adds Go-specific workflow, placement, event/message, testing, and module-assembly sections.

> **Code blocks in this guide are illustrative**, not copy-paste templates. Imports may be omitted and identifiers may reference types defined elsewhere in the project. See [`ddd-agent-contract.md` §6](ddd-agent-contract.md).

---

## 0. Go DDD Planning Workflow

Apply the planning gates defined in [ddd-modeling.md §7](ddd-modeling.md). For each gate level, the plan/spec must additionally state these **Go-specific** items.

Every Go backend plan must also include the `Architecture Gate` block from [ddd-modeling.md §0](ddd-modeling.md). For technical-facing packages, explicitly classify the capability before choosing between `domain`, `application`, `interfaces`, `infrastructure`, `internal/pkg`, or root `pkg`.

### Level 1 (Local Change)

Plan must additionally state:

- the Go package being changed (e.g., `internal/business/user/domain`)
- why the package path matches the bounded context and layer responsibility
- whether tests are co-located with the package or in a separate suite (§6.3)

### Level 2 (New Use Case)

Plan must additionally state:

- file placement under the bounded context (`application/command/<use_case>.go`, `application/query/<use_case>.go`, `application/query/repository.go`, `application/handler/<event>.go`, consumer-specific reader/writer/coordination ports, etc. — see §6.2)
- whether each new port is Command-side, Query-side, cross-context facade, or coordination; do not combine unrelated producer and consumer needs in one interface
- import-boundary impact: generated proto, ConnectRPC, storage, queue, and framework imports stay out of Domain
- new mock generation requirements (§6.3 "Generated mocks")
- fx wiring changes (which `Module` aggregates the new constructor)

### Level 3 (New Bounded Context or Aggregate)

Spec must additionally state:

- planned package layout under `internal/business/<module>/...` (§2.2)
- package/path naming and import boundaries for each layer
- shared object placement decisions (§2.3) — what goes in `proto/`, `internal/pkg/`, the owning context, or root `pkg/`
- shared middleware client ownership ([`ddd-golang-runtime.md §1.1`](ddd-golang-runtime.md) "Shared Middleware Client Ownership")

### Cross-Context Change Without a New Context

Follow the multi-side planning rule in [ddd-modeling.md §7.4](ddd-modeling.md). The Go-side plan must list:

- producing context's `application/handler/<event>.go` or event publisher path
- consuming context's `application/handler/<event>.go` and its idempotency strategy
- `proto/` files and `pkg/gen/` regeneration if a new protocol contract is introduced

---

## 1. Architecture Principles

### 1.1 Core Philosophy

This guide combines **Domain-Driven Design (DDD)** with **Clean Architecture**, targeting:

1. **Domain-centric** — Business logic is independent of frameworks, UI, and databases
2. **Dependency inversion** — Inner layers define interfaces; outer layers implement them
3. **Vertical slicing** — Code organized by bounded context, not by technical layer
4. **Testability** — Business logic testable without external infrastructure

### 1.2 Layered Architecture

Four layers with the **Domain Layer as the core** (innermost). The Interface layer is optional — in Go projects it is skipped for gRPC/ConnectRPC (the `Application` struct implements the generated handler stub directly; see §3.3). For REST/HTTP/WebSocket and other hand-written protocols, the Interface layer is present.

```
          ┌─────────────────────────────────────────────┐
          │   Interface Layer (optional — see §3.3)     │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Application Layer                      │
          │  Use-case orchestration, transactions,      │
          │  DTOs, QueryRepository interfaces,          │
          │  RPC handler (implements generated stub)    │
          └──────────────────┬──────────────────────────┘
                             │ depends on
          ┌──────────────────▼──────────────────────────┐
          │      Domain Layer ◄─── Core. No implementation deps.
          │  Entities, VOs, Domain Services,            │
          │  Write Repository interfaces, Events        │
          └─────────────────────────────────────────────┘
                             ▲ implements
  ┌──────────────────────────┴──────────────────────────┐
  │       Infrastructure Layer                          │
  │  Repository impls, external API clients, MQs,       │
  │  caches — external system integrations ONLY         │
  └─────────────────────────────────────────────────────┘
```

### 1.3 Dependency Rule

**Golden rule: dependencies point inward only. The Domain Layer must not depend on any other layer.**

- Interface Layer (if present) depends on Application and Domain layers
- Application Layer depends only on Domain Layer (and implements generated RPC stubs when applicable)
- Domain Layer has no concrete implementation dependencies (no `import` of Infrastructure packages, ORM/database drivers, HTTP clients/servers, message queue clients, or generated protocol packages)
- Infrastructure Layer depends on Domain Layer (implements Repository interfaces) and Application Layer (implements QueryRepository interfaces)

> For full dependency rules and common violations, see [ddd-core.md §1.3](ddd-core.md). Concrete Go code shown in §3.1 / §3.2 / §3.4.

---

## 2. Directory Structure

### 2.1 Overall Layout

```
project/
├── cmd/
│   ├── server/
│   │   └── main.go              # HTTP/gRPC service entry point
│   └── client/
│       └── main.go              # CLI client (if applicable)
├── configs/
│   ├── default.yml              # Default configuration
│   └── default_prod.yml         # Profile-specific overrides (optional, see ddd-golang-runtime.md §1)
├── internal/
│   ├── business/                # Business code — bounded contexts (vertical slices)
│   │   └── <module>/            # One bounded context
│   │       ├── domain/          # Domain layer - core business logic
│   │       ├── application/     # Application layer - use-case orchestration
│   │       ├── interfaces/      # Interface layer (optional, see §3.3)
│   │       ├── infrastructure/  # Infrastructure layer - external system integrations ONLY
│   │       ├── pkg/             # Bounded-context private utilities (if needed)
│   │       └── <module>.go      # Module assembly (fx Module)
│   └── pkg/                     # Infrastructure adapters — third-party libs wrapped + fx providers
│       ├── eventbus/            # event.Dispatcher wrapper + lifecycle hooks
│       ├── mysql/               # MySQL / XORM client wrapper + config
│       ├── redis/               # Redis client wrapper + config
│       ├── kafka/               # Kafka producer/consumer wrapper + config
│       ├── httpsrv/             # HTTP server wrapper + lifecycle hooks
│       ├── grpcsrv/             # gRPC server wrapper + lifecycle hooks
│       └── module.go            # Aggregates the above into a single fx.Module("internal.pkg")
├── pkg/                         # Generated code + stable libraries for external consumers
│   └── gen/                     # Generated protocol code (proto, etc.)
├── proto/                       # Protobuf definitions
└── scripts/
    └── sql/                     # Database migration scripts
```

**`internal/business/` vs `internal/pkg/`** — `business/` holds bounded contexts (the DDD four-layer structure); `internal/pkg/` holds shared technical adapters (DB, HTTP/gRPC server, event bus, validator …). Business may depend on `internal/pkg/`; `internal/pkg/` must never import `internal/business/*`.

**One directory under `internal/business/` = one bounded context.** The directory name (`<module>`) is the bounded context's name, and its `domain/`, `application/`, `interfaces/`, `infrastructure/` sub-tree is the full DDD four-layer slice for that context. Do not split a single bounded context across sibling directories, and do not collapse two bounded contexts into one directory.

Root `pkg/` has only two valid uses:
1. `pkg/gen/` — code generated from `proto/` or other schemas
2. Stable, hand-written libraries intended to be imported by repositories outside this one

Root `pkg/` is **not** an internal shared/common directory. Do not place internal cross-context DTOs, read models, domain concepts, or business constants there merely because multiple internal modules use them. If multiple internal contexts need to share a type, follow §2.3.

### 2.2 Bounded Context Internal Structure

```
internal/business/user/          # User bounded context
├── domain/                      # Domain layer - pure business logic, no implementation deps
│   ├── user.go                  # Aggregate Root + Entity
│   ├── user_test.go             # Aggregate behavior tests
│   ├── valueobject.go           # Value Objects (Email, Password, etc.)
│   ├── valueobject_test.go      # Value Object validation tests
│   ├── event.go                 # Domain event definitions
│   ├── repository.go            # Write repository interface
│   └── service.go               # Domain service (if needed)
│
├── application/                 # Application layer - orchestrates domain objects
│   ├── application.go           # App Service constructor + gRPC/ConnectRPC stub
│   ├── command/                 # Commands, command handlers, command-side ports
│   │   ├── change_password.go   # One use case per file when practical
│   │   └── activity_log_writer.go # Command/output writer port
│   ├── query/                   # Queries, query handlers, DTOs, query-side ports
│   │   ├── find_user.go         # One read use case per file when practical
│   │   ├── repository.go        # QueryRepository / reader interfaces
│   │   └── dto.go               # Query DTOs / read models
│   ├── handler/                 # Event handlers
│   │   └── user_created.go
│   ├── assembler.go             # DTO/Proto <-> Domain conversion
│   │   # application.go remains the single entry point that wires them all.
│
├── interfaces/                  # Interface layer (OPTIONAL — only for hand-written protocols)
│   └── http/
│       ├── handler.go           # REST Handler (manual routing, request/response mapping)
│       └── handler_test.go      # Protocol mapping tests
│
├── api/                         # Cross-context published ports (OPTIONAL — only when this context exposes read-side facades to other contexts; see §5.3)
│   └── queries.go               # Reader / Facade interface + DTOs consumed by other bounded contexts
│
├── infrastructure/              # Infrastructure layer - external system integrations ONLY
│   ├── user_repository.go       # Write repository implementation
│   ├── user_repository_test.go  # Repository integration tests
│   ├── user_query_repository.go # Read repository implementation
│   ├── order_publisher.go       # Message/event publisher adapter
│   ├── do.go                    # Database models (XORM/GORM)
│   ├── converter.go             # DO <-> Entity conversion
│   └── dto.go                   # Infrastructure-local DTOs, if shared by adapters
│
├── pkg/                         # Bounded-context private utilities (not imported by other contexts)
│
└── user.go                      # Module assembly (fx Module)
```

Within a bounded context, keep `infrastructure/` flat by default. Primary adapter files use semantic capability names: one port, Repository, or adapter maps to one `<capability>.go` file plus `<capability>_test.go`. Supporting files such as `do.go`, `converter.go`, or `dto.go` may stay role-named when they are shared by those adapters. Do not create `redis/`, `mysql/`, `persistence/`, or `messaging/` packages merely because of the backing technology. Technology names belong in concrete type names or file suffixes only when multiple implementations coexist, for example `runtime_state_redis.go` and `runtime_state_memory.go`. Shared technology components belong in `internal/pkg/<capability>`; bounded-context Infrastructure receives initialized clients from those shared packages.

Because `infrastructure` is a single Go package, exported adapter types and constructors must include the semantic capability. Prefer `NewUserRepository`, `NewRuntimeStateRepository`, and `NewOrderPublisher` over generic names such as `NewRepository` or `NewPublisher`. If multiple technologies implement the same semantic capability, include the technology as a suffix: `NewRuntimeStateRedisRepository`, `NewRuntimeStateMemoryRepository`.

### 2.3 Shared Object Placement

When a type is needed by multiple modules, first decide what it represents:

1. **Domain concept owned by one bounded context**: keep it in the owning bounded context. Other contexts must not import it directly; exchange through Integration Messages, queries, ACL, or protocol contracts (see §5).
2. **Cross-context / cross-service data contract**: define it in `proto/<capability>/v1/*.proto` and consume generated code from `pkg/gen/proto/...`. Keep business derivation rules in the owning context.
3. **Shared technical capability** (storage adapter, streaming adapter, message-bus adapter, observability client): place it in `internal/pkg/<capability>`. Common examples: `mysql`, `redis`, `kafka`.
4. **General-purpose library intended for external reuse**: only then place hand-written code in root `pkg/`.

Use protobuf for cross-boundary contracts, not for internal Domain models. Generated proto types may be used by Interface/Application boundary code, Infrastructure adapters, message publishers/consumers, and read-model contracts. Domain layer must not depend on generated proto packages; if Domain logic needs an internal representation, define a Domain type and convert at the boundary.

Generated proto structs are DTOs / protocol contracts, not Go Domain entities or Value Objects. Do not decide that a port belongs in Application merely because its external request/response shape is a proto message. Decide the port owner from the semantic capability; when Domain owns it, define Go domain types in `domain/` and convert `Proto ↔ Domain` in `application/assembler.go`, an Interface handler, or an Infrastructure adapter.

**Worked example — a cross-context read model**

Suppose a `producer` context emits a stream of records, and one or more `consumer` contexts need to query and stream them. The placement falls out of the four buckets above:

- **Contract** — `proto/<capability>/v1/<capability>.proto` defines the record type, its enums, and pagination/cursor fields; `pkg/gen/proto/<capability>/v1` contains generated code.
- **Owning context** — `internal/business/<producer>/domain/<projection>` owns derivation, classification, and state semantics; it converts to the contract shape at its boundary.
- **Shared technical adapters** — `internal/pkg/<capability>store` and `internal/pkg/<capability>stream` adapt the generated contract to storage and streaming infrastructure. They are technical, reusable across consuming contexts, and import the contract — never the producer's Domain.
- **Avoid** — a hand-written `pkg/<capability>` package that re-declares the record type as an "internal shared model"; that collapses the boundary between Domain ownership, contract, and infrastructure adapter.

### 2.4 Go Boundary Checklist

Use this checklist before accepting a package layout or import graph:

- A package path ending in `/domain` contains only domain concepts: aggregates, entities, value objects, domain services, write repository interfaces, domain events, and domain errors.
- Domain packages do not import `pkg/gen`, ConnectRPC/gRPC/HTTP packages, storage drivers, queue clients, framework packages, `internal/pkg` adapters, `internal/.../infrastructure`, or another bounded context's Domain package.
- Application packages may import Domain and generated protocol packages when they implement generated RPC stubs or map DTOs, but they must not import concrete storage, queue, or network clients.
- Infrastructure packages may import Domain/Application interfaces they implement, generated protocol packages, and external clients.
- `internal/pkg/<capability>` is only for shared technical adapters. It must not import `internal/business/*` or own business/domain rules.
- Root `pkg/` is not a dumping ground. Use it for generated code or stable libraries intended for external repository consumers.
- A generated proto type in a method signature is boundary evidence, not layer-ownership evidence. If the method represents a Domain capability, keep the interface in `domain/` with Domain types and map at the boundary.
- Application-owned read ports must be small, consumer-specific QueryRepositories/read facades. Command-side Application ports are exceptions justified only after the Domain mechanism placement gate. Do not expose one storage-shaped or routing-shaped interface to multiple use cases merely because one adapter implements all methods, and do not place peer forwarding, network address lookup, hop headers, queue subjects, retry/backoff, or deployment topology in Application ports.
- Package names and directory names must agree with the bounded context and layer they represent. A `dispatcher`, `registry`, `router`, or `connector` package must still declare whether it is Domain-facing policy, Application orchestration, or Infrastructure adapter.

### 2.5 Technical Coordination Placement

Technical coordination code often exposes domain rules indirectly. Place it by rule ownership, not by mechanism:

| Example | Place the rule | Place the mechanism |
|---------|----------------|---------------------|
| Connection registration with naming, ownership, admission, or lifecycle rules | `internal/business/<context>/domain` as a policy, service, value object, or aggregate behavior | Storage/lease/CAS implementation in `infrastructure` or `internal/pkg` |
| Dispatch routing with semantic destinations, priorities, or retry eligibility | Domain policy when destinations, priorities, or retry rules are stable language and testable without a queue; Application orchestration when it merely selects among Domain-defined ports | Queue/client/server adapter in Infrastructure |
| Scheduler with business-visible states or deadlines | Domain state/policy plus Application orchestration | Timer, worker pool, or lock backend in Infrastructure |
| Observability or audit derivation with business meaning | Domain event or Domain-facing projection rule | Telemetry/export backend in Infrastructure |

If the rule can be unit-tested without Redis, SQL, a queue, ConnectRPC, or generated protocol types, keep that rule inward and adapt the mechanism outward.

### 2.6 Mechanized Review Checks

These checks operationalize the P1-P4 hot-path checks in [ddd-core.md §10](ddd-core.md) and the §5.1 self-check in [ddd-agent-contract.md](ddd-agent-contract.md). Treat the shell commands below as local smoke checks unless they are replaced by AST-aware lint rules; they surface review targets, not architectural proof.

**P1 — Port eligibility: suspicious naming smoke scan (Application/Domain layer)**

```bash
grep -rn -E "type [A-Z][a-zA-Z]+(Policy|Specification|Allocator|Generator|Resolver|Finalizer|Terminator|Closer|Calculator|Scorer|Pricer|Decider|Authorizer|Validator|Sink|Hook|Observer) interface" \
  internal/business/*/application/ internal/business/*/domain/
```

Any hit requires a written placement answer in the Architecture Gate's `Domain mechanism placement before Application ports` field. The answer must say whether the need belongs to an Aggregate, Domain Repository, Domain Service, Domain Event handler, Integration Message, ACL, Infrastructure adapter, QueryRepository/read facade, or an exceptional Application command-side port.

```bash
grep -rn -E "type [A-Z][a-zA-Z]+(Client|Directory|Router|Forwarder) interface" \
  internal/business/*/application/ internal/business/*/domain/
```

Any hit here is a strong review signal. Re-shape mechanism-shaped ports to a domain-noun lifecycle role, move routing/topology mechanics to Infrastructure, or document why the word is part of the ubiquitous language and the interface excludes addresses, hop headers, retry knobs, and deployment topology.

**Audit-only R3 — Domain mechanism parity smoke scan (Level 3 or periodic review)**

```bash
for ctx in internal/business/*/; do
  [ -d "${ctx}application" ] || continue
  app_ports=$(grep -rE "^type [A-Z][a-zA-Z]+ interface" "${ctx}application" 2>/dev/null | wc -l)
  domain_svc=$( [ -f "${ctx}domain/service.go" ] && echo 1 || echo 0 )
  domain_events=$(grep -rE "type [A-Z][a-zA-Z]+Event struct" "${ctx}domain" 2>/dev/null | wc -l)
  if [ "$app_ports" -gt 5 ] && [ "$domain_svc" -eq 0 ] && [ "$domain_events" -eq 0 ]; then
    echo "WARN: ${ctx} has ${app_ports} application ports, no domain/service.go, and no domain events"
  fi
done
```

A warning here triggers audit-only R3: list the BC's command-side Application ports, Domain Repositories, Domain Services, Domain Events, Integration Messages, and Saga/Process Managers. Add a missing mechanism only when the domain need exists; do not add a service/event merely to satisfy a ratio.

**P2 — Handler pressure**

For each Command Handler struct, count exported and unexported fields whose types are interfaces. Implementations vary, but a workable shape is:

```bash
# Heuristic: find Handler structs whose fields suggest >=4 outbound ports.
ast-grep --pattern 'type $H struct { $$$ }' --lang go \
  internal/business/*/application/command/*.go
```

For projects without `ast-grep`, a simpler heuristic: any file in `application/command/` declaring a Handler struct with four or more interface-typed fields is reviewed against [`ddd-core.md §3.2`](ddd-core.md) "Command Handler Port-Pressure Heuristic".

**P3 — Read-side DTO check**

```bash
grep -rnE "interface \{[^}]*\) \(\[\]\*?domain\.[A-Z]" \
  internal/business/*/application/query/ \
  internal/business/*/application/*read*.go 2>/dev/null
```

Any reader/query interface returning `*domain.X` or `[]*domain.X` from Application is rejected: convert to a DTO/read-model returned from `application/query/dto.go`. Repository (write) interfaces in `domain/` are exempt.

**P4 — Event/message extraction (manual)**

When two or more handlers/subscribers react to the same same-BC state change, collapse the reaction behind one Domain Event and one same-BC handler. When the fact crosses a bounded-context boundary, publish an Integration Message instead of subscribing to another context's Domain Event. Long-running multi-aggregate coordination belongs in a Saga/Process Manager or compensating flow, not in a cluster of command-side Application ports.

**P1 semantic fake sub-check (manual)**

For every new inward interface introduced in the diff, write — at least mentally — a no-dependency semantic fake that uses a `map`, slice, or simple struct as backing state and preserves the observable contract. If the fake can support business/use-case tests, continue the placement gate; this still does not automatically justify an Application command-side port. If the only meaningful fake is "pretend the external side effect succeeded", the interface is a mechanism adapter — hide it behind a Repository, QueryRepository, Saga/Process Manager, ACL, event/message publisher, or Infrastructure implementation ([modeling §0.1.1](ddd-modeling.md)).

**Recommended CI wiring**

P1 naming and P3 DTO scans are useful grep smoke checks and can run on every PR, but AST-aware analyzers are required before treating them as hard CI gates. Audit-only R3 is a per-BC structural smell check for nightly runs or Level 3 changes. P2 handler pressure, P4 event/message extraction, and the P1 semantic fake sub-check remain review-time prose checks; encode them as required PR-description sections rather than brittle grep lints.

---

## 3. Layer Responsibilities

### 3.1 Domain Layer

**Role**: Core business logic, independent of frameworks, databases, and UI.

**Contents**:
- **Aggregate Root**: Guardian of business invariants
- **Entity**: Object with unique identity
- **Value Object**: Defined by attributes, no identity, immutable
- **Domain Service**: Cross-aggregate logic that doesn't belong to a single entity
- **State Machine** (optional): Lifecycle management for aggregates with complex state transitions
- **Repository Interface**: Persistence abstraction (write operations only)
- **Domain Event**: Records significant domain occurrences

**Constraints**: see [ddd-core.md §3.1](ddd-core.md) for the full list (no concrete implementation dependencies; general-purpose libraries allowed; no cross-context Domain imports; state changes through domain methods; Version is a read-only token incremented by Infrastructure; IDs generated in Domain via UUID/ULID/Snowflake). Go-specific deltas:

- **Canonical Go component libraries are requirements, not suggestions.** When this guide names a Go library for a DDD concern, use that library and its public interfaces instead of inventing local equivalents. Examples: Domain Events use `github.com/go-jimu/components/ddd/event`; Integration Messages use `github.com/go-jimu/components/ddd/message`; Kafka messaging uses `github.com/go-jimu/contrib/message/kafka`; state machines use `github.com/go-jimu/components/fsm`; logging helpers use `github.com/go-jimu/components/sloghelper`; configuration uses `github.com/go-jimu/components/config` and `config/loader`. A different library is allowed only when existing repository code already standardized on it or the user explicitly approves the exception.
- **Concrete prohibition list for Go imports**: no `import` of `pkg/gen/...` (generated proto), `connectrpc.com/connect`, `google.golang.org/grpc`, `net/http`'s server side, `xorm.io/xorm`, `gorm.io/gorm`, database/sql drivers, `franz-go` / Kafka / NATS / RocketMQ / Redis clients, `internal/pkg/*` adapters, `internal/.../infrastructure`, or another bounded context's `internal/business/<ctx>/domain`. Allowed: `github.com/google/uuid`, `time`, `errors`, `fmt`, `strings`, `github.com/samber/oops`, and the in-package `github.com/go-jimu/components/ddd/event` (event types only, no dispatcher implementation).
- **No anemic aggregates.** An Aggregate Root that exposes only exported fields and getters/setters while the rules live in `application/command/` or `application/handler/` is prohibited. Every state transition must be a method on the Aggregate Root (or Value Object) that enforces the relevant invariant. When fields must be exported for XORM/copier mapping, keep mutation methods as the only sanctioned mutation path and treat direct external assignment as a code-review failure.
- **Version increment lives in SQL.** The Domain `Version int` field is read-only; the `version = version + 1` mutation happens in the Repository's `UPDATE` statement (see §3.4). Do not increment `Version` in Domain methods or factories.

**Business Field Validation** — implements the Validation Contract defined in [ddd-core.md §3.1 "Validation Contract"](ddd-core.md). Go-specific notes:

- `Type.Validate() error` is the canonical method signature
- Inside `Validate()`, `github.com/go-playground/validator/v10` may be used (reflecting over tags on the type's own fields), hand-written checks, or a mix. Tags on Domain fields are an implementation choice of `Validate()`, not a public contract
- Use explicit code for cross-field rules, state transitions, and invariants that cannot be expressed cleanly with validator tags

**Domain Rules in Technical Capabilities** — see [ddd-core.md §3.1 "Domain Rules in Technical Capabilities"](ddd-core.md). The rule applies to Go projects exactly as written.

**Factory Design**:
- Simple cases: use the Aggregate Root's own constructor (`NewXxx`)
- Complex cases (assembling multiple Value Objects, cross-entity validation): extract an independent Domain Factory struct within the domain package

**Domain Event Collection Contract** (using `event.Collection`):
- Aggregate Root holds an `Events event.Collection` field
- Domain methods append events via `Events.Add(event)` — they never dispatch directly
- The Application layer is the sole drainer. After a successful `Save()` returns, Application calls `dispatcher.DispatchAll(user.Events.Drain())` exactly once. The Repository must not drain.
- `Drain()` is one-shot — a subsequent call on the same in-memory instance returns `nil`. After `Save()` succeeds, the in-memory aggregate is stale; if the use case needs further mutations, reload via `Repository.Get()` first (§3.2). Never retry `Save()` on an already-drained instance.

> This is the Go-specific implementation of the language-agnostic event collection pattern described in [ddd-core.md §3.1 "Domain Event Collection"](ddd-core.md). Domain Events are bounded-context-internal facts; the current `github.com/go-jimu/components/ddd/event` dispatcher is the in-memory, same-process implementation for handling them. The `event.Collection` exposes `Add`/`Drain`/`Len` with a one-shot drain guarantee. `Dispatch` / `DispatchAll` only enqueue events into the in-memory worker — the returned `error` reflects admission/enqueue (`event.ErrDispatcherClosed` during shutdown), never handler execution, panic, or unhandled-event outcomes. Handlers own their own error policy. Subscription is a separate `event.Subscriber` interface; the in-memory dispatcher implements both. Cross-process Integration Messages use the separate `ddd/message` port — see §5.2.

**State Machine Contract** (optional, using `github.com/go-jimu/components/fsm`):

Not every aggregate needs a state machine. Use the following criteria to decide:

| Scenario | Recommended Approach |
|----------|---------------------|
| Few states (2-3), simple transition logic | Enum + guards in domain methods, no FSM needed |
| Many states (4+), complex rules, conditional guards | Use FSM |
| Multiple roles/actions driving one entity (approval, ticket) | Use FSM |
| Need visualization or dynamic transition configuration | Use FSM |

When an Aggregate Root has a complex lifecycle with multiple state transitions and guard conditions (e.g., Order, Task, Approval), use a finite state machine to enforce transition rules.

- **States, Actions, Conditions** are all defined in the Domain layer — they are business invariants
- **Aggregate Root implements `fsm.StateContext`** — the entity itself is the state context
- **`Condition`** functions are business guards (e.g., "only allow checkout if cart has items"), belong in Domain
- **StateMachine is a shared, read-only definition** — registered globally during module initialization via `fsm.RegisterStateMachine()`; retrieved at runtime via `fsm.MustGetStateMachine()`
- **Domain methods call `sm.TransitionToNext(aggregate, action)`** — never manipulate state directly
- **Transitions can trigger domain events** — append events inside `TransitionTo()` when state changes
- **Infrastructure only persists `fsm.StateLabel`** — it does not know about transition rules or conditions

```go
// domain/order.go — minimal viable shape; replicate the same idiom for additional states / transitions
package domain

import (
    "github.com/go-jimu/components/ddd/event"
    "github.com/go-jimu/components/fsm"
)

const (
    OrderStatePending fsm.StateLabel = "pending"
    OrderStatePaid    fsm.StateLabel = "paid"
    OrderActionPay    fsm.Action     = "pay"
)

func NewOrderStateMachine() fsm.StateMachine {
    sm := fsm.NewStateMachine("order")
    sm.RegisterStateBuilder(OrderStatePending, func() fsm.State { return fsm.NewSimpleState(OrderStatePending) })
    sm.RegisterStateBuilder(OrderStatePaid, func() fsm.State { return fsm.NewSimpleState(OrderStatePaid) })

    // Transition with a business guard
    sm.AddTransition(OrderStatePending, OrderStatePaid, OrderActionPay, func(sc fsm.StateContext) bool {
        return sc.(*Order).TotalAmount > 0
    })
    if err := sm.Check(); err != nil {
        panic(err) // Fail fast on invalid definition
    }
    return sm
}

// Order Aggregate Root implements fsm.StateContext
type Order struct {
    ID          string
    Status      fsm.State
    TotalAmount int64
    Events      event.Collection
    Version     int
}

func (o *Order) CurrentState() fsm.State { return o.Status }

func (o *Order) TransitionTo(next fsm.State, by fsm.Action) error {
    prev := o.Status.Label()
    next.SetContext(o)
    o.Status = next
    o.Events.Add(EventOrderStatusChanged{ID: o.ID, From: string(prev), To: string(next.Label())})
    return nil
}

// Domain method drives transition via the FSM — never mutates Status directly
func (o *Order) Pay() error {
    return fsm.MustGetStateMachine("order").TransitionToNext(o, OrderActionPay)
}
```

```go
// domain/event.go
package domain

import "github.com/go-jimu/components/ddd/event"

// Event kind constants
const (
    EventKindUserCreated     event.Kind = "user.created"
    EventKindPasswordChanged event.Kind = "user.password_changed"
)

// Domain events implement event.Event (Kind() method).
// Rich Event style: carry ID + minimum necessary fields.
type EventUserCreated struct {
    ID    string
    Name  string
    Email string
}

func (e EventUserCreated) Kind() event.Kind { return EventKindUserCreated }

type EventPasswordChanged struct{ ID string }

func (e EventPasswordChanged) Kind() event.Kind { return EventKindPasswordChanged }
```

```go
// domain/user.go
package domain

import (
    "errors"
    "time"

    "github.com/go-jimu/components/ddd/event"
    "github.com/google/uuid"
)

var (
    ErrInvalidEmail    = errors.New("invalid email format")
    ErrWeakPassword    = errors.New("password too weak")
    ErrUserNotActive   = errors.New("user is not active")
)

// User Aggregate Root
type User struct {
    ID             string
    Name           string
    Email          Email          // Value Object
    HashedPassword Password       // Value Object
    Status         UserStatus     // Value Object
    Events         event.Collection  // Domain event collection
    Version        int            // Optimistic lock version (read-only; Infrastructure increments)
    CreatedAt      time.Time
    UpdatedAt      time.Time
}

// Value Object: Email
type Email string

func (e Email) Validate() error {
    if !strings.Contains(string(e), "@") {
        return ErrInvalidEmail
    }
    return nil
}

// Value Object: Password (hashed)
type Password []byte

// Value Object: UserStatus
type UserStatus int

const (
    UserStatusInactive UserStatus = iota
    UserStatusActive
    UserStatusSuspended
)

// Factory Method — ID generated in Domain layer, Version starts at 0
func NewUser(name, rawPassword string, email Email) (*User, error) {
    if err := email.Validate(); err != nil {
        return nil, err
    }

    hashed, err := hashPassword(rawPassword)
    if err != nil {
        return nil, err
    }

    user := &User{
        ID:             uuid.Must(uuid.NewV7()).String(),  // ID generated in Domain
        Name:           name,
        Email:          email,
        HashedPassword: hashed,
        Status:         UserStatusInactive,
        Events:         event.NewCollection(),
        Version:        0,  // 0 = new object, not yet persisted
        CreatedAt:      time.Now(),
    }

    user.Events.Add(EventUserCreated{
        ID:    user.ID,
        Name:  name,
        Email: string(email),
    })

    return user, nil
}

// Domain Method: Change password
// Note: does not increment Version — Infrastructure handles that via SQL
func (u *User) ChangePassword(oldRaw, newRaw string) error {
    if u.Status != UserStatusActive {
        return ErrUserNotActive
    }

    if !verifyPassword(oldRaw, u.HashedPassword) {
        return errors.New("old password incorrect")
    }

    hashed, err := hashPassword(newRaw)
    if err != nil {
        return err
    }

    u.HashedPassword = hashed
    u.UpdatedAt = time.Now()

    u.Events.Add(EventPasswordChanged{ID: u.ID})
    return nil
}

// Repository Interface (write repository, defined in Domain layer).
// Generated mocks are test-only; see §6.3 "Generated mocks" for placement rules.
//go:generate mockery --name=Repository --case=snake
type Repository interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}
```

### 3.2 Application Layer

**Role**: Orchestrate domain objects to fulfill use cases; define transaction boundaries.

**Contents**:
- **Application Service**: Use-case orchestration, coordinating multiple aggregates/domain services
- **Command + Command Handler** (`application/command/<use_case>.go`): Write operation intent and handling
- **Query + Query Handler** (`application/query/<use_case>.go`): Read operation intent and handling
- **Event Handler** (`application/handler/<event>.go`): In-process Domain Event consumers — subscribe to Domain Events emitted within the same bounded context and execute side-effect logic (e.g., send notification, update read model, trigger follow-up workflow within this context)
- **QueryRepository Interface**: Defined in Application layer, returns DTOs, bypasses Domain model
- **Consumer-specific ports**: Small reader/writer/facade/coordination interfaces needed by a use case; never storage-shaped omnibus stores
- **DTO**: Data Transfer Objects, decoupling internal and external models
- **Assembler**: DTO ↔ Domain object conversion

**Constraints** (see [ddd-core.md §3.2](ddd-core.md) for the full list, including the prohibition on implementing validation or owning technical-capability domain rules):

- No business rules (those belong in the Domain layer)
- Depends only on the Domain layer
- Transaction boundaries are controlled here
- **Default transaction boundary: one transaction modifies one aggregate only.** To modify multiple aggregates, prefer Domain Events / Integration Messages, a Saga / Process Manager, or compensating actions. A same-transaction multi-aggregate write is a design exception and must satisfy the gate in [ddd-core.md §3.2](ddd-core.md); do not implement one in Go merely because `xorm.Session` or another transaction API makes it easy.
- The Application layer is the sole drainer of `event.Collection` (see §3.1 "Domain Event Collection Contract"): after a successful `Save()` it calls `dispatcher.DispatchAll(user.Events.Drain())` exactly once. Repository never drains. `Drain()` is one-shot — never call it twice on the same aggregate instance.
- After `Save()`, the in-memory aggregate is stale — reload via `Get()` if further operations are needed
- **File organization**: always use `application/command/`, `application/query/`, and `application/handler/` for Go DDD application code. Put command types, command handlers, and command-side ports in `application/command/`; put query types, query handlers, query DTOs/read models, and query-side ports in `application/query/`; put event handlers in `application/handler/`. Do not create an `application/port/` package — ports live beside the use case that owns them. `application.go` remains the single entry point that wires everything and imports the subpackages; subpackages must not import the root `application` package.

#### CQRS Port Granularity

Apply [ddd-core.md §3.2](ddd-core.md) before adding or expanding any Go interface in `application/`.

Prefer read-side examples first; command-side Application ports need an explicit placement-gate exception.

```go
// application/query/activity_replay_reader.go — consumer replay query side.
package query

type ActivityReplayReader interface {
    ListReplay(ctx context.Context, streamID string, cursor ReplayCursor) ([]*activityv1.ActivityRecord, error)
}
```

```go
// application/query/activity_correlation_reader.go — audit/correlation query side.
package query

type ActivityCorrelationReader interface {
    ListByCorrelation(ctx context.Context, q CorrelationQuery) ([]*activityv1.ActivityRecord, error)
}
```

Exceptional command-side port example after the Architecture Gate rejects Domain Event, Integration Message, Repository, ACL, and Infrastructure homes:

```go
// application/command/projection_sequence_port.go — projection coordination side.
package command

type ProjectionSequenceCounter interface {
    Next(ctx context.Context, streamID string) (uint64, error)
}
```

Avoid this:

```go
// Wrong inward port: it follows the storage adapter, not one caller's use case.
type ActivityLogStore interface {
    Append(ctx context.Context, record *activityv1.ActivityRecord) error
    ListReplay(ctx context.Context, streamID string, cursor ReplayCursor) ([]*activityv1.ActivityRecord, error)
    ListByCorrelation(ctx context.Context, q CorrelationQuery) ([]*activityv1.ActivityRecord, error)
    MaxProjectionSeq(ctx context.Context, streamID string) (uint64, error)
}
```

One Infrastructure struct may implement all of the small ports:

```go
fx.Provide(func(conn storage.Conn) *infrastructure.ActivityLogAdapter {
    return infrastructure.NewActivityLogAdapter(conn)
})
fx.Provide(func(log *infrastructure.ActivityLogAdapter) command.ActivityLogWriter { return log })
fx.Provide(func(log *infrastructure.ActivityLogAdapter) query.ActivityReplayReader {
    return infrastructure.NewReplayReader(log)
})
fx.Provide(func(log *infrastructure.ActivityLogAdapter) query.ActivityCorrelationReader {
    return infrastructure.NewCorrelationReader(log)
})
```

The concrete adapter can keep helper methods for SQL reuse, but inward packages depend only on the interface matching their use case. Split command-side ports only after the placement gate confirms the need is not better expressed as a Domain Event, Integration Message, Repository, ACL, or Infrastructure detail.

Concrete QueryRepository implementations stay in Infrastructure even when their interfaces live in `application/query/`:

```go
// application/query/repository.go
package query

type Repository interface {
    FindDetail(ctx context.Context, id string) (*DetailDTO, error)
}

// infrastructure/activity_query_repository.go
package infrastructure

var _ query.Repository = (*activityQueryRepository)(nil)
```

This avoids circular imports: `application.go` may import `application/query`, Infrastructure imports `application/query` to implement the interface, and `application/query` imports neither Infrastructure nor the root `application` package.

**Domain Event Handler Contract**:
- Implements `event.Handler` interface: `Listening() []event.Kind` + `Handle(context.Context, event.Event)`
- Lives in the **same bounded context** as the Domain Event producer, usually in `application/handler/`
- Handles repeated same-BC reactions to a domain fact after the aggregate is saved and events are drained
- Each EventHandler owns its own transaction — failures do not roll back the producing command
- Error handling: log and continue (or retry); never propagate errors back to the event producer. `Dispatch` / `DispatchAll` only return admission/enqueue errors (`event.ErrDispatcherClosed` during shutdown), never handler execution, panic, or unhandled-event outcomes — handlers own their own error policy
- Registered during module initialization via `subscriber.Subscribe(handler)`. Inject `event.Subscriber` for the same-BC subscribing side and `event.Dispatcher` for the dispatching side; the `*event.InMemoryDispatcher` returned by `eventbus.NewDispatcher` implements both

**Integration Message Subscriber Contract**:
- Lives in the consuming bounded context's Application layer
- Handles stable cross-context Integration Message payloads, never another context's internal Domain Event type
- Owns idempotency and transaction boundaries for the consuming context

`DispatchAll` admission error policy:
- Best-effort follow-up only: log the admission/enqueue error and continue.
- Caller or operator must observe missed follow-up dispatch: return the admission/enqueue error after adding useful context.
- Returning this error after `Save()` never implies persistence rollback; it only reports that follow-up dispatch was not accepted.
- Handler execution failures are not reported by `DispatchAll`; handlers own their own failure policy.

#### Event Handler Idempotency

The in-memory `event.Dispatcher` is best-effort only: it has no persistence, no retry, and no at-least-once guarantee. Do not introduce deduplication tables or other delivery machinery for ordinary Domain Event handlers by default.

Still write handlers so repeated execution is harmless when practical: prefer set/update operations, deterministic business keys, and guards on externally visible side effects. If a handler is later moved to a replayable or persistent delivery path, design the idempotency key and storage mechanism as part of that adapter-backed flow rather than assuming `event.Event` has a standard global ID.

```go
// application/command/change_password.go
package command

// Command definition
type CommandChangePassword struct {
    ID          string
    OldPassword string
    NewPassword string
}

// Command Handler — canonical 4-step orchestration:
// Load aggregate → invoke domain method → Save → dispatch events.
type CommandChangePasswordHandler struct {
    repo       domain.Repository
    dispatcher event.Dispatcher   // injected; no global default
    logger     *slog.Logger
}

func (h *CommandChangePasswordHandler) Handle(ctx context.Context, cmd *CommandChangePassword) error {
    // 1. Load aggregate
    user, err := h.repo.Get(ctx, cmd.ID)
    if err != nil {
        return err
    }

    // 2. Execute business logic (in Domain layer)
    if err = user.ChangePassword(cmd.OldPassword, cmd.NewPassword); err != nil {
        return err
    }

    // 3. Persist
    if err = h.repo.Save(ctx, user); err != nil {
        return err
    }

    // 4. Best-effort dispatch after successful persist.
    // DispatchAll only reports admission/enqueue errors (event.ErrDispatcherClosed during
    // shutdown) — log and continue.
    if err := h.dispatcher.DispatchAll(user.Events.Drain()); err != nil {
        h.logger.WarnContext(ctx, "domain event dispatch skipped",
            slog.String("operation", "user.change_password"),
            slog.String("user_id", cmd.ID),
            sloghelper.Error(err))
    }
    return nil
}
```

**Query Handler — When the Struct Is Optional** (Go form of [ddd-core.md §3.2](ddd-core.md) "Query Handler: When the Struct Is Optional"):

For trivial reads, skip the dedicated `XxxHandler` struct and let the `Application` stub method (or the REST handler) call `QueryRepository` directly. The `QueryRepository` Go interface stays.

```go
// ✅ Trivial read — no separate FindUserDetailHandler. Stub method delegates directly.
type Application struct {
    userQueryRepo QueryRepository
}

func (app *Application) GetUserDetail(
    ctx context.Context,
    req *connect.Request[userv1.GetUserDetailRequest],
) (*connect.Response[userv1.GetUserDetailResponse], error) {
    dto, err := app.userQueryRepo.FindUserDetail(ctx, req.Msg.Id)
    if err != nil {
        return nil, convertError(err)
    }
    return connect.NewResponse(&userv1.GetUserDetailResponse{User: dto}), nil
}
```

```go
// ✅ Non-trivial read — keep the dedicated handler when it does real orchestration.
type ListUsersHandler struct {
    queryRepo QueryRepository
    readCache UserListReadCache  // named use-case cache policy; not raw redis (see [ddd-core.md §3.4](ddd-core.md))
}

func (h *ListUsersHandler) Handle(ctx context.Context, q *QueryListUsers) (*userv1.UserListDTO, error) {
    offset, err := decodeCursor(q.Cursor)
    if err != nil {
        return nil, err
    }
    page, total, err := h.queryRepo.List(ctx, offset, q.PageSize)
    if err != nil {
        return nil, err
    }
    if !q.Actor.IsAdmin() {
        for i := range page {
            page[i].Email = mask(page[i].Email)
        }
    }
    return &userv1.UserListDTO{
        Items:      page,
        NextCursor: encodeCursor(offset + int64(len(page))),
        Total:      total,
    }, nil
}
```

Litmus test: read the body of `Handle`. If it is one delegating call to `QueryRepository`, the struct is ceremony — collapse it. If it composes, filters, caches, or normalizes, keep it.

### 3.3 Interface Layer (Optional)

**Role**: Adapt external protocols that require hand-written routing and request/response mapping (e.g., REST with chi/gin/echo, custom WebSocket handlers). In Go this layer is named `interfaces/` rather than ddd-core's `adapter/`.

**Skip this layer for gRPC / ConnectRPC.** The code generator emits a handler interface (e.g., `userv1connect.UserServiceHandler`) — the `Application` struct implements it directly, and a separate `interfaces/` directory only adds indirection.

**Contents (when used)**: HTTP handler, request/response structs, input format validation (business validation belongs in Domain).
**Constraints**: depends only on Application and Domain; no business logic; owns protocol details (status codes, error mapping).

#### gRPC/ConnectRPC: Application struct implements the generated stub directly

```go
// application/application.go
package application

import (
    "context"

    "connectrpc.com/connect"
    userv1 "github.com/example/project/pkg/gen/proto/user/v1"
)

// Thin protocol adapter — translate request, delegate to the §3.2
// Command handler, map errors back to connect codes.
func (app *Application) ChangePassword(
    ctx context.Context,
    req *connect.Request[userv1.ChangePasswordRequest],
) (*connect.Response[userv1.ChangePasswordResponse], error) {
    err := app.changePasswordHandler.Handle(ctx, &CommandChangePassword{
        ID:          req.Msg.UserId,
        OldPassword: req.Msg.OldPassword,
        NewPassword: req.Msg.NewPassword,
    })
    if err != nil {
        return nil, convertError(err)
    }
    return connect.NewResponse(&userv1.ChangePasswordResponse{}), nil
}

func convertError(err error) error {
    switch {
    case errors.Is(err, domain.ErrUserNotActive):
        return connect.NewError(connect.CodeFailedPrecondition, err)
    case errors.Is(err, domain.ErrInvalidEmail):
        return connect.NewError(connect.CodeInvalidArgument, err)
    default:
        return connect.NewError(connect.CodeInternal, err)
    }
}
```

#### REST: Interface layer handles manual routing

```go
// interfaces/http/handler.go — only needed for hand-written REST controllers
package http

type UserHandler struct {
    app *application.Application
}

func (h *UserHandler) RegisterRoutes(r chi.Router) {
    r.Post("/users", h.CreateUser)
    r.Put("/users/{id}/password", h.ChangePassword)
}
```

### 3.4 Infrastructure Layer

**Role**: Implement Domain/Application-layer interfaces that integrate with **external systems** (databases, caches, message queues, third-party APIs).

**Contents** (external system integrations ONLY):
- **Repository Implementation**: Database access implementation
- **Data Object (DO)**: ORM models
- **Converter**: DO ↔ Domain Entity conversion
- **External API Client**: Third-party service clients (payment gateway, email service, etc.)
- **Event Publisher**: Message queue publishing implementation
- **Cache Implementation**: Redis, Memcached, etc.

**What does NOT belong in Infrastructure**:
- Utility/tool packages (CLI wrappers, parsers, helpers) — these are not external system integrations
- Place them according to scope:
  - `internal/pkg/` — cross-domain shared infrastructure adapters
  - `pkg/` — generated protocol code or stable public libraries consumable by external projects; not internal shared DTOs/read models
  - `internal/business/<domain>/pkg/` — utilities scoped to a single bounded context; must not be imported by other contexts or hold shared DTOs/read models/domain concepts

**Constraints**:
- Implements Repository interfaces (Domain layer) and QueryRepository interfaces (Application layer)
- No business logic
- Handles technical details (SQL, caching, retries, etc.)
- **Version is incremented by SQL** (`version = version + 1`) — Domain layer does not increment it
- Adding a technical client does not imply adding a new Application/Domain interface. If Redis, another cache, or a coordination store only accelerates a repository or routing directory, compose Redis inside the Infrastructure implementation; do not add a separate `Cacher`, `Directory`, `Peer`, or equivalent routing-shaped port. Add a separate port only after classification, for a named use-case capability such as lease ownership lifecycle, distributed locking, explicit cache invalidation, rate limiting, or event publication. Keep address lookup, hop headers, peer forwarding, queue subjects, retry/backoff, storage keys, and deployment topology out of that semantic port.
- Infrastructure implements technical mechanisms for domain rules, but it must not be the only place where those rules are expressed
- Shared middleware clients are initialized in `internal/pkg/<middleware>`; bounded-context Infrastructure receives already constructed clients

**Soft Delete**:
- **Business-driven logical deletion**: Domain has a status field (e.g., `Status = Cancelled`); `Save()` internally sets `deleted_at` based on the status
- **Technical soft delete**: Domain is unaware; Infrastructure transparently manages `deleted_at`
- In both cases, `deleted_at` is an Infrastructure concern — Domain never knows about this field

> For the full soft delete specification, see [ddd-core.md §3.4 "Soft Delete"](ddd-core.md).

```go
// infrastructure/do.go
package infrastructure

import (
    "xorm.io/xorm"
    "github.com/example/project/internal/pkg/mysql"
)

// Data Object - XORM model
type UserDO struct {
    ID        string             `xorm:"id pk"`
    Name      string             `xorm:"name"`
    Password  []byte             `xorm:"password"`  // maps to HashedPassword
    Email     string             `xorm:"email"`
    Status    int                `xorm:"status"`
    Version   int                `xorm:"version"`
    CreatedAt mysql.Timestamp `xorm:"created_at"`
    UpdatedAt mysql.Timestamp `xorm:"updated_at"`
    DeletedAt mysql.Timestamp `xorm:"deleted_at deleted"`
}

func (u UserDO) TableName() string {
    return "user"
}

// infrastructure/user_repository.go
package infrastructure

import (
    "context"

    "github.com/jinzhu/copier"
    "xorm.io/xorm"
    "github.com/samber/oops"

    "github.com/example/project/internal/business/user/domain"
)

// Compile-time interface check
var _ domain.Repository = (*userRepository)(nil)

type userRepository struct {
    db *xorm.Engine
}

// Constructor returns interface. The MySQL client is constructed in internal/pkg/mysql
// and injected here; this package does not read config or open connections.
func NewUserRepository(db *xorm.Engine) domain.Repository {
    return &userRepository{db: db}
}

func (r *userRepository) Get(ctx context.Context, id string) (*domain.User, error) {
    var do UserDO
    has, err := r.db.Context(ctx).ID(id).Get(&do)
    if err != nil {
        return nil, oops.Wrap(err)
    }
    if !has {
        return nil, oops.With("id", id).Wrap(sql.ErrRecordNotFound)
    }
    return convertToEntity(&do)
}

func (r *userRepository) Save(ctx context.Context, user *domain.User) error {
    do := convertToDO(user)

    if user.Version == 0 {
        // New object: INSERT, version starts at 1
        do.Version = 1
        _, err := r.db.Context(ctx).Insert(do)
        return oops.Wrap(err)
    }

    // Existing object: UPDATE (optimistic lock: version incremented by SQL)
    do.Version = user.Version + 1
    affected, err := r.db.Context(ctx).
        Where("version = ?", user.Version).
        ID(user.ID).
        Update(do)
    if err != nil {
        return oops.Wrap(err)
    }
    if affected == 0 {
        return domain.ErrConcurrentModification
    }
    // After Save(), the in-memory user is stale — caller must re-Get() if needed
    return nil
}

// converter.go
func convertToEntity(do *UserDO) (*domain.User, error) {
    user := new(domain.User)
    if err := copier.Copy(user, do); err != nil {
        return nil, oops.Wrap(err)
    }
    user.Events = event.NewCollection()  // Initialize event collection when loading from DB
    return user, nil
}

func convertToDO(user *domain.User) *UserDO {
    do := new(UserDO)
    copier.Copy(do, user)
    return do
}
```

---

## 4. DDD Tactical Design Reference

| DDD Concept | Layer | Go Implementation |
|-------------|-------|-------------------|
| **Aggregate** | Domain | `struct` + domain methods + `event.Collection` |
| **Entity** | Domain | `struct` with ID |
| **Value Object** | Domain | Immutable `struct` |
| **Domain Service** | Domain | Stateless function / struct |
| **State Machine** | Domain (definition) | `fsm.StateMachine` + `fsm.StateContext` |
| **Repository** | Domain (interface) + Infra (impl) | Interface + Impl |
| **Query Repository** | Application (interface) + Infra (impl) | Interface + Impl |
| **Domain Event** | Domain | `Event` struct implementing `event.Event` |
| **Application Service** (Command/Query Handler) | Application | Use-case orchestration; concrete form is `CommandXxxHandler` / `QueryXxxHandler` |
| **Event Handler** | Application | `event.Handler` impl |
| **DTO** | Application / Interface | Data transfer struct |
| **Factory** | Domain | Constructor / independent Factory struct |
| **CQRS** | Application | Command + Query separation |

---

## 5. Cross-Context Communication

> For the full specification (four legitimate mechanisms, ACL, payload rules), see [ddd-core.md §5](ddd-core.md). This section captures the Go forms.

### 5.1 Direct Domain Coupling Is Prohibited

Bounded contexts must not import another context's Domain model or call its Application Service / Repository directly:

```go
// ❌ Wrong: Order context imports User's Domain or calls its Application directly
import userdomain "github.com/example/project/internal/business/user/domain"

func (s *OrderAppService) CreateOrder(ctx context.Context, cmd CreateOrderCommand) error {
    // Prohibited — Order is now coupled to User's Domain shape
    user, err := s.userApp.GetUser(ctx, cmd.UserID)
    ...
}
```

### 5.2 Integration Messages (default for cross-context state propagation)

Cross-context state propagation publishes **Integration Messages** through the `github.com/go-jimu/components/ddd/message` port (see [ddd-core.md §5.3](ddd-core.md) for the language-neutral concept). The Application layer of the **producing context** maps selected Domain Events into protobuf-typed Integration Message payloads, packages each as a `message.Message` value, and publishes through `message.Publisher`. The **consuming context** implements `message.Handler` and registers it with a `message.Subscriber`; Kafka is only the default adapter used in this guide. Subscribing directly to the producer's Domain Event from another context — via `event.Subscriber.Subscribe` — is prohibited; that couples the consumer to the publisher's internal model and violates [ddd-core.md §5.3](ddd-core.md). Domain Events stay inside one bounded context; this Go guide's `ddd/event` dispatcher is the in-memory, same-process implementation of that internal delivery path.

> **Terminology.** This guide uses *Integration Message* — not `Integration Event` — for the cross-context fact carrying a stable contract payload, deliberately separating it from *Domain Event* (which lives inside one bounded context and uses the publisher's ubiquitous language). The Go library `ddd/message` already names this layer `message`; using "Integration Message" keeps doc and library vocabulary aligned and avoids overloading "Event" across two semantic layers. `message.Message` is the transport-neutral envelope passed through publisher/subscriber adapters; Kafka records, topics, partitions, offsets, retries, and DLQs belong to the Kafka adapter.

Keep four layers separate:

- **Concept**: Integration Message means a cross-context fact with a stable published-language payload.
- **Contract**: protobuf payload type, `message.Kind`, versioning, and compatibility rules.
- **Port**: `message.Publisher`, `message.Handler`, `message.Subscriber`, and `message.Message`.
- **Adapter**: `github.com/go-jimu/contrib/message/kafka` maps the port to Kafka records, topics, commits, retry, and DLQ behavior.

`message.Kind` is the semantic contract identifier used for handler routing and payload resolution. Default: derive Kind from the protobuf full name with `message.KindOf(&pb.MessageType{})` so the contract identifier and the schema cannot drift apart. A semantic string literal (e.g. `"orders.paid"`) is also valid for simple setups or migration paths; pick one form per integration. Kind is **not** a Kafka topic, partition, or routing key — those are provider-side concerns and may be remapped via `kafka.WithTopicResolver`.

**Producer side** — the command handler stays ordinary Application orchestration. It saves the aggregate and dispatches drained Domain Events inside the bounded context; a separate boundary publisher translates selected Domain Events into Integration Messages. The sample focuses on the `ddd/event`, `ddd/message`, and Kafka adapter API shape; repository, aggregate, and generated protobuf details are intentionally minimal.

```go
// domain/event.go
package domain

import (
    "time"

    "github.com/go-jimu/components/ddd/event"
)

const EventKindOrderCompleted event.Kind = "order.completed"

type EventOrderCompleted struct {
    OrderID     string
    UserID      string
    TotalAmount int64
    OccurredAt  time.Time
}

func (e EventOrderCompleted) Kind() event.Kind { return EventKindOrderCompleted }
```

```go
// application/command/complete_order.go
package command

import (
    "context"

    "github.com/go-jimu/components/ddd/event"

    "github.com/example/project/internal/business/order/domain"
)

type CompleteOrderHandler struct {
    repo       domain.Repository
    dispatcher event.Dispatcher  // BC-internal Domain Events; ddd/event is in-memory
}

func (h *CompleteOrderHandler) Handle(ctx context.Context, id domain.OrderID) error {
    order, err := h.repo.Get(ctx, id)
    if err != nil {
        return err
    }
    if err := order.Complete(); err != nil {
        return err
    }
    if err := h.repo.Save(ctx, order); err != nil {
        return err
    }

    // BC-internal Domain Event dispatch through the in-memory ddd/event implementation.
    // This only reports admission/enqueue errors; handler failures are owned by handlers.
    // Returning this error after Save() does not roll back persistence; it only reports
    // that follow-up dispatch was not accepted by the in-memory dispatcher.
    if err := h.dispatcher.DispatchAll(order.Events.Drain()); err != nil {
        return err
    }
    return nil
}
```

```go
// application/handler/order_completed_publisher.go
package handler

import (
    "context"
    "log/slog"

    "github.com/go-jimu/components/ddd/event"
    "github.com/go-jimu/components/ddd/message"
    "google.golang.org/protobuf/types/known/timestamppb"

    "github.com/example/project/internal/business/order/domain"
    orderv1 "github.com/example/project/pkg/gen/proto/order/v1"
)

// OrderCompletedPublisher is a boundary translator inside the producing bounded context.
// It maps an internal Domain Event to the public Integration Message contract.
type OrderCompletedPublisher struct {
    publisher message.Publisher
    logger    *slog.Logger
}

func (p *OrderCompletedPublisher) Listening() []event.Kind {
    return []event.Kind{domain.EventKindOrderCompleted}
}

func (p *OrderCompletedPublisher) Handle(ctx context.Context, evt event.Event) {
    completed, ok := evt.(domain.EventOrderCompleted)
    if !ok {
        return
    }

    // Cross-context Integration Message — protobuf payload wrapped in the transport-neutral message envelope.
    msg, err := message.New(
        message.KindOf(&orderv1.OrderCompletedV1{}),
        &orderv1.OrderCompletedV1{
            OrderId:     completed.OrderID,
            UserId:      completed.UserID,
            TotalAmount: completed.TotalAmount,
            OccurredAt:  timestamppb.New(completed.OccurredAt),
        },
        message.WithKey(completed.OrderID),
    )
    if err != nil {
        p.logger.WarnContext(ctx, "integration message build failed",
            slog.String("event_kind", string(completed.Kind())),
            slog.String("error", err.Error()))
        return
    }
    if err := p.publisher.Publish(ctx, msg); err != nil {
        p.logger.WarnContext(ctx, "integration message publish failed",
            slog.String("message_kind", string(msg.Kind())),
            slog.String("message_id", msg.ID()),
            slog.String("error", err.Error()))
    }
}
```

The Domain method `Complete()` records its Domain Event internally; mapping that Domain Event into an Integration Message payload is a boundary translation, not a Domain rule. Keep payload conversion in a same-context Application event handler or Infrastructure adapter; if the mapping starts making business decisions (whether the event is valid, whether to publish, what transition happened), move that decision back into Domain or Application policy. `message.Publisher.Publish` returns the publisher adapter's admission / delivery error and respects `context` cancellation. In the in-memory Domain Event path above, publish failure cannot roll back the original command; if pre-publish loss is unacceptable, use an explicit reliability design rather than hiding that requirement in the command handler.

**Consumer side** — the consuming context implements `message.Handler` and registers it with a `Subscriber`. Check the selected subscriber adapter's delivery semantics: when it can redeliver the same Integration Message, the handler must be idempotent through natural convergence, deterministic business keys, or an application-level dedup mechanism chosen for that use case. Do not add a processed-message table by default.

```go
// internal/business/user/application/handler/order_completed.go
package handler

import (
    "context"
    "fmt"

    "github.com/go-jimu/components/ddd/message"

    orderv1 "github.com/example/project/pkg/gen/proto/order/v1"
)

type OrderCompletedHandler struct{ /* deps */ }

func (h *OrderCompletedHandler) Listening() []message.Kind {
    return []message.Kind{message.KindOf(&orderv1.OrderCompletedV1{})}
}

func (h *OrderCompletedHandler) Handle(ctx context.Context, msg message.Message) error {
    payload, ok := msg.Payload().(*orderv1.OrderCompletedV1)
    if !ok {
        return fmt.Errorf("unexpected payload kind=%s", msg.Kind())
    }
    // Idempotent side effect; owns its own transaction.
    // Returning nil means the handler accepted and completed the message.
    // Returning a non-nil error lets the subscriber adapter apply its failure policy.
    _ = payload
    return nil
}
```

**Wiring** — Application code depends only on the upstream `message.Publisher` / `message.Handler` / `message.Subscriber` interfaces; the Kafka adapter lives in Infrastructure:

```go
// infrastructure/order_publisher.go
package infrastructure

import (
    "github.com/go-jimu/components/ddd/message"
    "github.com/go-jimu/contrib/message/kafka"
    "github.com/twmb/franz-go/pkg/kgo"
    "google.golang.org/protobuf/proto"

    orderv1 "github.com/example/project/pkg/gen/proto/order/v1"
)

func NewOrderPublisher(client *kgo.Client) message.Publisher {
    return kafka.NewPublisher(client)
}

func NewKafkaConsumer(client *kgo.Client, handlers []message.Handler) (*kafka.Consumer, error) {
    registry := message.NewPayloadRegistry()
    if err := registry.Register(
        message.KindOf(&orderv1.OrderCompletedV1{}),
        func() proto.Message { return &orderv1.OrderCompletedV1{} },
    ); err != nil {
        return nil, err
    }

    consumer := kafka.NewConsumer(client, kafka.WithPayloadResolver(registry))
    for _, h := range handlers {
        if err := consumer.Subscribe(h); err != nil {
            return nil, err
        }
    }
    return consumer, nil
}
```

Operational facts that come with the adapter (do not re-implement these in Application):

- Default Kafka topic equals `Kind` — override with `kafka.WithTopicResolver` when topic naming differs from semantic kinds
- Consumer requires `kgo.DisableAutoCommit()`; the adapter commits offsets manually after handler success / retry publish / DLQ publish
- Handler errors trigger retry on `<topic>.retry`; exhaustion goes to `<topic>.dlq` (defaults: 3 attempts; tune with `kafka.WithRetryPolicy` / `WithDLQTopicResolver` / `WithDLQDisabled` / `WithErrorHandler`)
- `Message.Key()` maps to the Kafka record key — use it for per-key partition affinity and ordering when the consumer relies on per-aggregate sequence

> **When pre-publish loss is unacceptable** (payment, inventory, regulatory compliance), the upstream `github.com/go-jimu/components/ddd/message/outbox` submodule and external transactional-outbox / change-data-capture patterns exist for this purpose. This guide does not prescribe an implementation; whichever mechanism is chosen, hide it behind the Repository or an Infrastructure adapter so it does not leak as a Domain or Application port (see [ddd-core.md §3.4](ddd-core.md)).

### 5.3 Cross-Context Queries

When a context needs a current snapshot of data owned elsewhere, depend on a **port the owning context exports** (see [ddd-core.md §5.5](ddd-core.md)) — not on its internal `QueryRepository` class:

```go
// Owning context publishes a small read-side port that returns DTOs:
// internal/business/user/api/queries.go
package userapi

type UserSummary struct {
    ID     string
    Name   string
    Active bool
}

type Reader interface {
    FindUserSummary(ctx context.Context, id string) (UserSummary, error)
}

// Consuming context depends on the port, not on user's QueryRepository:
type OrderAppService struct {
    users userapi.Reader
}
```

For cross-process consumers, define the contract in `proto/<capability>/v1/*.proto` and consume generated code from `pkg/gen/proto/...`; never import the producing service's Domain types.

### 5.4 ACL and Protocol Contracts

For external / legacy integrations, place the Anti-Corruption Layer in `internal/business/<context>/infrastructure/` and translate at the boundary; Domain remains unaware of the external shape (see [ddd-core.md §5.6](ddd-core.md)).

For cross-service / cross-repository structured contracts, define schemas under `proto/`; generated code lives in `pkg/gen/proto/...` and is consumed by Interface, Application, or Infrastructure code (see [ddd-core.md §5.7](ddd-core.md)). Domain layers must not import `pkg/gen/...`.

If an operation records or mutates a Domain fact, the recording/mutation port remains Domain-owned even when the wire contract is generated from Protobuf. Convert generated messages into Domain entities, Value Objects, commands, or events before calling the port.

---

## 6. Naming Conventions

### 6.1 General Rules

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Domain Event Constant | `EventKind` + Name | `EventKindUserCreated` |
| Domain Event Struct | `Event` + Name | `EventUserCreated` |
| Command | `Command` + Action | `CommandChangePassword` |
| Command Handler | `Command` + Action + `Handler` | `CommandChangePasswordHandler` |
| Query | `Query` + Name | `QueryFindUserList` |
| Query Handler | Name + `Handler` | `FindUserListHandler` |
| Event Handler | Event name + `Handler` | `UserCreatedHandler` |
| State Label | Entity + `State` + Name | `OrderStatePending` |
| State Action | Entity + `Action` + Verb | `OrderActionPay` |
| Repository Interface | `Repository` | `Repository` |
| Repository Implementation | lowercase + `Repository` | `userRepository` |
| Data Object | Entity name + `DO` | `UserDO` |
| DTO | Purpose + `DTO` | `UserListDTO` |

### 6.2 File Organization

Production files only. Test file placement is governed by §6.3 and is not required to mirror this table 1:1.

| File | Contents |
|------|----------|
| `domain/<entity>.go` | Aggregate Root + Entity |
| `domain/valueobject.go` | Value Object definitions |
| `domain/event.go` | Domain event definitions |
| `domain/repository.go` | Write repository interface |
| `domain/service.go` | Domain service |
| `application/application.go` | App Service constructor + gRPC/ConnectRPC stub implementation |
| `application/command/<use_case>.go` | Command type + Handler; exceptional command-side ports only when the Architecture Gate rejects Domain/Event/Message/ACL/Infrastructure homes |
| `application/command/<capability>_port.go` | Exceptional command-side coordination port for sequence, cursor, lease, ownership, or high-watermark semantics after placement-gate classification; not for address lookup, peer forwarding, or routing topology |
| `application/query/<use_case>.go` | Query type + Handler for a read use case |
| `application/query/repository.go` | QueryRepository / reader interfaces owned by query use cases |
| `application/query/dto.go` | Query DTOs/read models |
| `application/query/<capability>_reader.go` | Consumer-specific read/facade port when `QueryRepository` is too broad or the reader is not an aggregate read model |
| `application/handler/<event>.go` | Event Handler for domain event consumers |
| `application/assembler.go` | Object conversion (DTO ↔ Domain, Proto ↔ Domain) |
| `interfaces/http/handler.go` | REST handler (optional, hand-written protocols only) |
| `api/queries.go` | Cross-context Reader / Facade ports (optional, only when this context publishes read-side facades; §5.3) |
| `infrastructure/<aggregate>_repository.go` | Write repository implementation |
| `infrastructure/<read_model>_query_repository.go` | Read repository implementation |
| `infrastructure/<message>_publisher.go` | Conditional: `message.Publisher` / `message.Subscriber` wiring against the selected adapter (§5.2) |
| `infrastructure/do.go` | Database models shared by Infrastructure adapters |
| `infrastructure/converter.go` | Conversion functions shared by Infrastructure adapters |

### 6.3 Test File Organization

Go test cases must live in `*_test.go` files. Do not place test-only code, fixtures, fakes, mocks, or assertions in production files.

Do not collect all tests into a separate top-level test module by default. Keep tests beside the package under test; use a separate test suite directory only for service-level integration or end-to-end tests that span multiple bounded contexts.

Both same-package tests (`package <name>`) and external test packages (`package <name>_test`) are acceptable. Use the external `_test` package when you need to break an import cycle (e.g., a test that imports a sibling package which itself imports the package under test) or when you want to verify the package compiles cleanly against its public API alone. In all cases, tests must exercise behavior rather than implementation trivia.

Test helpers and generated mocks must be test-only:
- keep them in `*_test.go`, or
- place them in a clearly named test-support package that production code never imports.

Layer-specific placement:
- Domain tests live beside the Domain package and instantiate aggregates/value objects directly.
- Application tests live beside the Application package and mock only Repository / QueryRepository / external boundary interfaces.
- Infrastructure tests live beside Infrastructure implementations and may use real external dependencies or test containers.
- Interface tests live beside Interface handlers and verify protocol transformation and error mapping.

**Generated mocks**:
- Prefer `mockery --inpackage --testonly` so mocks are emitted as `mock_<name>_test.go` in the same package — they are physically test-only and cannot be imported by production code
- If using a separate output directory (e.g., `<package>/mocks/`), keep it out of production import paths and enforce the boundary with a depguard / golangci-lint rule that bans `*/mocks` imports outside `*_test.go`
- Mock files are never the source of truth for behavior; the interface in `domain/repository.go` or `application/query/repository.go` is

---

## 7. Technology Stack

Unless an existing repository has already standardized on a different implementation or the user explicitly approves an exception, these are the required libraries for the concerns listed below. Do not create project-local substitutes for their core interfaces (`event.Event`, `event.Collection`, `message.Publisher`, `message.Handler`, `fsm.StateContext`, `sloghelper.Error`, config loader options, and similar).

| Purpose | Required Library |
|---------|---------------------|
| Dependency Injection | `go.uber.org/fx` |
| RPC/HTTP | `connectrpc.com/connect` |
| HTTP Router | `github.com/go-chi/chi/v5` |
| ORM | `xorm.io/xorm` |
| Validation | `github.com/go-playground/validator/v10` |
| Logging | `log/slog` + `github.com/go-jimu/components/sloghelper` |
| Error Handling | `github.com/samber/oops` |
| In-process Event Bus | `github.com/go-jimu/components/ddd/event` |
| Integration Message port | `github.com/go-jimu/components/ddd/message` |
| Integration Message Kafka adapter | `github.com/go-jimu/contrib/message/kafka` (franz-go backed) |
| State Machine | `github.com/go-jimu/components/fsm` |
| Configuration | `github.com/go-jimu/components/config` + `config/loader` |
| Object Copying | `github.com/jinzhu/copier` |

---

## 8. Error Handling

### 8.1 Per-Layer Strategy

| Layer | Approach |
|-------|----------|
| Domain / Infrastructure | Use `oops.With("key", val).Wrap(err)` to attach context |
| Application | If this is the active execution boundary, log completion then return; otherwise wrap / return and let the outer boundary log |
| Interface | Convert to protocol error: `connect.NewError(connect.CodeNotFound, err)` |

### 8.2 Boundary Logging

Every execution boundary must emit one completion log for each operation, whether it succeeds, fails, skips, or schedules a retry. Internal layers enrich returned errors with context; they do not log errors that an outer boundary will log again.

Execution boundaries:

- HTTP / gRPC / ConnectRPC handlers or middleware
- `Application` methods that directly implement generated RPC handlers
- Command and Query Handlers when they are the use-case entry point
- Event Handlers
- async workers, schedulers, and consumers
- process startup, shutdown, and fx lifecycle hooks

Layer rules:

| Layer / component | Logging rule |
|-------------------|--------------|
| Domain | No logging. Return Domain errors and collect Domain Events only. |
| Infrastructure adapter | Do not log returned errors; wrap with `oops.With(...).Wrap(err)`. |
| Infrastructure execution boundary | Log completion, because there is no outer request boundary. Examples: worker tick, consumer loop, lifecycle hook. |
| Application / Interface boundary | Log completion once, then return or map the error. Do not duplicate an error log already emitted by an outer middleware. |

Completion logs must include stable structured fields:

| Field | Meaning |
|-------|---------|
| `operation` | Stable operation name, e.g. `user.change_password`, `order.completed.handle`, `kafka.consumer.tick` |
| `outcome` | One of `success`, `failed`, `skipped`, `retrying` |
| `duration_ms` | Wall-clock duration for the operation |
| `error` | `sloghelper.Error(err)` on failed outcomes |
| Business IDs | Add available identifiers such as `user_id`, `order_id`, `aggregate_id`, `event_id`, `event_kind`, `consumer` |

Use context-aware logging at runtime:

```go
start := time.Now()
err := h.changePassword.Handle(ctx, cmd)
if err != nil {
    logger.ErrorContext(ctx, "command completed",
        slog.String("operation", "user.change_password"),
        slog.String("outcome", "failed"),
        slog.String("user_id", cmd.ID),
        slog.Int64("duration_ms", time.Since(start).Milliseconds()),
        sloghelper.Error(err),
    )
    return err
}
logger.InfoContext(ctx, "command completed",
    slog.String("operation", "user.change_password"),
    slog.String("outcome", "success"),
    slog.String("user_id", cmd.ID),
    slog.Int64("duration_ms", time.Since(start).Milliseconds()),
)
```

Use `github.com/go-jimu/components/sloghelper` for runtime logging:

- Initialize the process logger with `sloghelper.NewLog(opt)` from the configured `sloghelper.Options`; it sets `slog.Default()` and enables source shortening / JSON output.
- Pass `*slog.Logger` through fx constructors for components that own execution boundaries.
- Use `sloghelper.NewContext(ctx, logger)` / `sloghelper.FromContext(ctx)` when middleware attaches request-scoped loggers.
- Log errors with `sloghelper.Error(err)` so wrapped errors keep structured message and stack trace data.

Use `logger.InfoContext` / `logger.ErrorContext` when a request or job context exists. Use package-level `slog.Info` / `slog.Error` only during bootstrap before `sloghelper.NewLog` has been wired, or in tiny examples where dependency injection is omitted for brevity.

For Event Handlers and workers, logging is the primary observable result because there is no synchronous caller. They must log a completion summary:

- idempotent duplicate / already-processed event: `outcome=skipped`
- transient publish / storage failure that will retry: `outcome=retrying`
- exhausted retries / dead-letter / unrecoverable error: `outcome=failed`
- worker tick summary: include counts such as `attempted`, `processed`, `failed`, `skipped`

### 8.3 Error Definitions

```go
// domain/errors.go
package domain

import "errors"

var (
    // Domain errors
    ErrUserNotFound            = errors.New("user not found")
    ErrInvalidEmail            = errors.New("invalid email format")
    ErrWeakPassword            = errors.New("password too weak")
    ErrUserNotActive           = errors.New("user is not active")
    ErrConcurrentModification  = errors.New("concurrent modification detected")
)
```

---

## 9. Runtime Concerns (Configuration, Lifecycle, Shutdown, Kubernetes)

The Go runtime concerns — fx-based **configuration management**, **`fx.Lifecycle` hooks**, **graceful shutdown ordering**, and **Kubernetes `preStop` handling** — live in a separate guide so they can be loaded independently of the layer/aggregate/event content above.

**See [`ddd-golang-runtime.md`](ddd-golang-runtime.md).**

| Topic | Where it lives now |
|---|---|
| Component-owned `Option`, shared middleware client ownership (`internal/pkg/<middleware>`) | [`ddd-golang-runtime.md §1.1`](ddd-golang-runtime.md) |
| Aggregate `Option` in `cmd/server/main.go`, `fx.Out` distribution, bootstrap log | [`ddd-golang-runtime.md §1.2`](ddd-golang-runtime.md) |
| `configs/` directory, profile selection via `JIMU_PROFILES_ACTIVE` | [`ddd-golang-runtime.md §1.3`](ddd-golang-runtime.md) |
| `${VAR:default}` placeholder expansion | [`ddd-golang-runtime.md §1.4`](ddd-golang-runtime.md) |
| `app.Run()` entry point, fx.Module wiring | [`ddd-golang-runtime.md §2.1`](ddd-golang-runtime.md) |
| Which components need `OnStop`, Listen/Serve separation, EventBus drain | [`ddd-golang-runtime.md §2.2`](ddd-golang-runtime.md) |
| Shutdown ordering (reverse-of-start) | [`ddd-golang-runtime.md §2.3`](ddd-golang-runtime.md) |
| Kubernetes `preStop` race-condition workaround | [`ddd-golang-runtime.md §2.4`](ddd-golang-runtime.md) |

Read `ddd-golang-runtime.md` when you are editing `cmd/**/main.go`, `internal/pkg/<middleware>/**.go`, `fx.Lifecycle` hooks, or shutdown logic. For pure layer / aggregate / event work, this current document is sufficient.

---

## 10. Complete Example: Module Assembly

```go
// user.go - Module assembly
package user

import (
    "github.com/go-jimu/components/ddd/event"
    "go.uber.org/fx"

    "github.com/example/project/internal/business/user/application"
    "github.com/example/project/internal/business/user/application/handler"
    "github.com/example/project/internal/business/user/infrastructure"
    userv1connect "github.com/example/project/pkg/gen/proto/user/v1/userv1connect"
)

var Module = fx.Module(
    "domain.user",
    fx.Provide(infrastructure.NewUserRepository),
    fx.Provide(infrastructure.NewUserQueryRepository),
    fx.Provide(infrastructure.NewOrderPublisher), // provides message.Publisher via the selected adapter
    fx.Provide(handler.NewWelcomeEmailHandler), // in-process Domain Event Handler (event.Handler impl in application/handler/<event>.go)
    fx.Provide(handler.NewOrderCompletedPublisher), // boundary publisher: Domain Event -> Integration Message
    fx.Provide(application.NewApplication),
    // Register in-process Domain Event Handlers with the dispatcher's Subscriber face.
    // Repeat for each event.Handler the context owns. See §3.2 "Event Handler Contract".
    fx.Invoke(func(sub event.Subscriber, h *handler.WelcomeEmailHandler) {
        sub.Subscribe(h)
    }),
    fx.Invoke(func(sub event.Subscriber, h *handler.OrderCompletedPublisher) {
        sub.Subscribe(h)
    }),
    fx.Invoke(func(app *application.Application, mux *http.ServeMux) {
        path, handler := userv1connect.NewUserServiceHandler(app)
        mux.Handle(path, handler)
    }),
)
```

---

**References:**
- [ddd-agent-contract.md](ddd-agent-contract.md) — Agent execution contract (read first)
- [ddd-modeling.md](ddd-modeling.md) — Strategic domain modeling (bounded context discovery, aggregate design)
- [ddd-core.md](ddd-core.md) — Language-agnostic DDD + Clean Architecture specification
- [ddd-golang-runtime.md](ddd-golang-runtime.md) — Go runtime: configuration, fx.Lifecycle, graceful shutdown, Kubernetes
- [The Clean Architecture — Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design Reference — Eric Evans](https://domainlanguage.com/ddd/reference/)
