---
name: ddd-modeling
description: Strategic domain modeling rule cards for DDD. Use when domain-modeling, design, implement, or review needs bounded context, aggregate boundary, invariant, Architecture Gate, technical capability, or port-granularity decisions.
---

# Strategic Domain Modeling Rule Cards

**Scope**: Backend services using DDD.
**Usage**: This is an on-demand rule source, not a default entrypoint. Start from [`domain-modeling`](../skills/domain-modeling/SKILL.md), [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), or [`review`](../skills/review/SKILL.md). Load this file only when a phase skill needs strategic model decisions.

This file is intentionally not a DDD tutorial. Assume the agent understands the concepts. Use these cards to decide ambiguous cases and to produce compact evidence for later design, implementation, and review.

## 0. Mandatory Architecture Gate

Emit the smallest gate that preserves the decision before implementation or approval when a change touches bounded-context ownership, aggregate boundaries, stable language, data authority, inward interfaces, cross-context contracts, or technical capabilities with state/policy/invariant semantics.

Runtime-only exception: Go runtime/config/lifecycle work that does not change a bounded context, aggregate, repository, command/query handler, event/message contract, task processor, or domain rule uses [`ddd-agent-contract.md`](ddd-agent-contract.md) plus runtime/taskqueue references instead of fabricating DDD gate values.

```text
Architecture Gate (core):
- Gate level: <Level 1 | Level 2 | Level 3 | Cross-context>
- Bounded context / business capability:
- Business facts / event timeline:
- Stable language / data authority:
- Affected aggregate, policy, service, or explicit none:
- Invariants and lifecycle rules:
- Technical capability classification: <Domain-facing | Application orchestration | Infrastructure | n/a>
- Layer ownership:
- Proceed / Stop:
```

Add the placement extension when the change adds an inward interface, modifies an event/message handler, touches cross-aggregate decisions, duplicates a reaction to the same domain fact, coordinates multiple aggregate writes, changes publication failure semantics, or is Level 2/3/cross-context work:

```text
Architecture Gate (placement extension):
- New inward interfaces introduced:
- Collaboration model before mechanism:
- Domain mechanism placement before Application ports:
  - <need>: <Aggregate method | Domain Repository | Domain Service | Domain Event handler | Integration Message | named Application coordination service | ACL | Infrastructure adapter | Application QueryRepository/read facade | return-to-modeling Application command-side port decision>
- Placement per new inward interface:
  - <interface>: semantic contract; rule owner; fake-test result when relevant
- Cross-aggregate business decisions:
- Repeated side effects / event candidates:
- Async reaction handlers:
  - role: <Domain Event Handler | Boundary Publisher | Integration Message Handler>
  - input/output/failure policy:
- Application command-side port review:
- Proceed / Stop:
```

Stop when any required answer is unknown. `n/a` is allowed only when the change truly does not touch the field.

## 0.1 Technical capability classification

Technical-facing modules still require modeling when they own stable language, state transitions, admission rules, ownership policy, routing policy, scheduling policy, or invariants. Dispatchers, registries, schedulers, routers, connectors, projections, ownership managers, delivery engines, and observability pipelines are not automatically Infrastructure.

| Classification | Use when | Owner |
|---|---|---|
| Domain-facing | Stable language, lifecycle, admission/routing policy, ownership semantics, or derivation rules can be tested without external systems | Domain method, Value Object, Domain Service, or policy |
| Application orchestration | The capability sequences a use case, manages transactions, chooses already-classified mechanisms, or coordinates Domain objects without owning the rule | Application handler/service |
| Infrastructure | The capability adapts DB/cache/queue/RPC/filesystem/K8s/SDK/framework lifecycle/retry/topology without owning semantic rules | Infrastructure adapter or shared technical package |

Routing policy and routing mechanics are different. Policy names destination/admission/priority/tenant/retry eligibility/ownership rules. Mechanics resolve addresses, peers, hops, replicas, queue subjects, retry timers, or deployment topology.

## 0.1.1 Litmus test: semantic fake implementability

When classification is unclear, ask:

> Can a no-external-dependency fake preserve the same observable contract for business/use-case tests?

If yes, the interface may encode a semantic capability. Continue choosing the narrowest owner. If no, and the fake can only "pretend the DB/broker/RPC/SDK succeeded", the interface is a mechanism adapter and belongs in Infrastructure behind the semantic owner.

Passing this test is necessary, not sufficient. It does not by itself justify an Application command-side port.

## 0.2 Port granularity

Define ports by use-case semantics, not by implementation operations. Adding Redis, MySQL, Kafka, an HTTP client, or another technical dependency does not automatically justify a new Domain/Application interface.

Before adding an inward port, answer:

- What semantic capability does the caller need?
- Is the caller command/write, query/read, cross-context facade, or coordination?
- Which existing capability lifecycle already owns this observation?
- Which layer owns the rule behind it?
- Does the caller observe distinct freshness, ordering, authorization, pagination, consistency-window, failure, dependency-direction, or test-substitute semantics?
- Would the caller change if the implementation switched technology?

Reject inward ports shaped around peer addresses, instance IDs used only for routing, cache/coordination rows, RPC forwarding, hop headers, retry/backoff knobs, queue subjects, storage keys, replicas, or deployment topology.

## 0.2.1 Capability lifecycle is the unit of granularity, not the mechanism operation

One semantic lifecycle may have multiple methods: observe, mutate, publish, transfer, retire, release, recover, retry. Do not split it into `*Reader`, `*Writer`, `*Opener`, `*Sender`, `*Fetcher`, or similar verb ports only because the adapter exposes separate operations.

Good port names start from a domain noun plus lifecycle role: `AttachmentContentStore`, `WorkspaceArtifactStore`, `OrderRepository`, `PaymentSettlementGateway`, `NotificationDeliveryPort`. A verb-suffix port is acceptable only when the capability is genuinely one-directional and the design records why the opposite lifecycle stages do not share identity, consistency, authorization, or failure semantics.

One Infrastructure adapter may implement several inward semantic ports. The inward side still exposes capability lifecycles, not adapter method groups.

## 0.2.2 Inward-defined ports evolve by adding methods, not by forking

When a new use case touches an existing semantic capability, default to adding a method on the existing port. Fork only when the new caller observes different freshness, ordering, authorization, pagination, failure, consistency-window semantics, published API surface, dependency direction, test substitute, or aggregate.

For QueryRepository, the default unit is the bounded context's stable product read-model family, not one screen, RPC method, handler, or SQL statement. Split only when the read model family or its runtime semantics materially differ.

If one use case is about to inject two or more ports that look like verbs on the same noun, regroup. At three or more, stop unless the semantic split is already justified in writing.

## 0.2.3 Suspicious naming and Application-port eligibility

These names are review signals. They are not forbidden, but they require an Architecture Gate entry explaining which DDD mechanism owns the need before Application gets a command-side port.

| Name pattern | First owner to check |
|---|---|
| `*Policy`, `*Specification`, `*Validator` | Value Object, Aggregate method, Domain Service, Interface format validation |
| `*Allocator`, `*Generator`, `*Calculator`, `*Scorer`, `*Pricer`, `*Decider`, `*Authorizer` | Aggregate method, Domain Service, Domain Repository uniqueness, external ACL |
| `*Resolver`, `*Client` | ACL, published read facade, Infrastructure adapter |
| `*Finalizer`, `*Terminator`, `*Closer` | Aggregate lifecycle method, Domain Service, Domain Event, Integration Message |
| `*Sink`, `*Hook`, `*Observer` | Domain Event handler, Integration Message subscriber, Infrastructure adapter |
| `*Directory`, `*Router`, `*Forwarder` | Domain routing policy only when ubiquitous language; otherwise Infrastructure topology/routing |

## 1. Purpose

Use this file to answer two recurring modeling questions:

- Where is the stable language and authority boundary?
- Which DDD mechanism owns this decision before Application or Infrastructure gets a new abstraction?

When a candidate capability is only a vendor wrapper (auth provider, transactional email, object storage, observability backend, billing SaaS, payment gateway), prefer an ACL/Infrastructure adapter and skip full bounded-context/aggregate design unless the team owns stable rules and language around it.

## 2. Bounded Context Discovery

Use bounded-context discovery only when language, authority, or lifecycle may change. Do not run it as a checklist for every small implementation task.

High-signal probes:

- Same noun, different meaning, attributes, lifecycle, authority, or behavior?
- Different source of truth or confirmation authority?
- Different actors/operators use different language for the same data?
- Change reasons diverge enough that one model would constantly branch?
- Cross-boundary interaction is better as Integration Message, published query, ACL, or protocol contract than direct model sharing?

Context relationship choices:

| Relationship | Use when |
|---|---|
| Customer-Supplier | Downstream depends on upstream and can influence its published model |
| Conformist | Downstream adopts upstream's model because it has no influence |
| Anti-Corruption Layer | Downstream protects its model from upstream/external language |
| Open-Host Service / Published Language | Upstream serves many consumers through a stable contract |
| Partnership / Shared Kernel | Rare high-coupling relationship; record why merging is worse |
| Separate Ways | No business reason to integrate |

Proceed only when the owning context, data authority, and allowed cross-context mechanisms are explicit.

## 3. Aggregate Design

The only strong reason to put multiple Entities in one Aggregate is a business invariant that must be enforced in one transaction.

Entity / Value Object probes:

- Stable identity across attribute changes, versions, retries, or ownership transfer? Entity.
- Equality entirely by attributes and replaceable as a whole? Value Object.
- Externally referenced or independently lifecycle-managed? Entity, often Aggregate Root.

Aggregate boundary probes:

- If A changes without B in the same transaction, can the system enter a non-repairable invalid business state?
- Does B have meaningful identity outside A?
- Can B exist without A?
- When B changes, must A's invariants be revalidated synchronously?
- Is the collection bounded and routinely loaded with the root?
- Are modifications concurrent enough that a shared optimistic lock would create contention?

Cross-aggregate decision placement:

- If one aggregate clearly owns the invariant, pass the other aggregate's immutable snapshot/value object into an Aggregate method.
- If the decision has a domain name and genuinely spans aggregates, use a Domain Service after ruling out aggregate redesign, a new decision aggregate, Domain Event/Integration Message flow, or a database uniqueness/exclusion constraint surfaced as a Domain error.
- Do not push cross-aggregate business decisions into Application `*Policy`, `*Allocator`, `*Resolver`, or `*Decider` ports.

Default to small aggregates. Reference other aggregates by ID. Use read models for UI composition.

## 4. Worked Examples with Reasoning

Omit generic worked examples from the hot path. For examples, use the current project's specs, `CONTEXT.md`, ADRs, tests, and code. If an example is needed in an answer, make it project-specific and no longer than one scenario.

## 5. Common Modeling Mistakes

- Foreign key or "belongs to" treated as Aggregate containment.
- UI screen shape treated as write model shape.
- CRUD table nouns treated as Aggregates without behavior.
- Every Entity promoted to Aggregate Root.
- Application command-side port created before Aggregate method, Domain Repository, Domain Service, Domain Event, Integration Message, named Application coordination service, ACL, QueryRepository, and Infrastructure adapter are ruled out.
- Technical routing/topology mechanics promoted to Application because they are easy to mock.

## 6. Modeling Process Checklist

Use this compact order:

1. Read spec, glossary/CONTEXT, ADRs, and relevant code.
2. Surface implicit objects and existing-model impact.
3. Reconstruct the command/trigger -> past-tense facts -> policies/reactions timeline.
4. Ask one high-fidelity question at a time until material facts are decided.
5. Classify context authority, lifecycle, invariants, aggregate candidates, event-storming facts, event/message candidates, repository candidates, and open risks.
6. Produce the Domain Modeling Brief or Architecture Gate needed by the next phase.

## 7. Planning Gates

Choose the smallest gate that fits the change.

### 7.1 Level 1 - Local Change

Use for changes inside an existing bounded context that do not add a new aggregate, repository, QueryRepository, domain event, cross-context contract, or external integration.

State: bounded context, affected layer, aggregate/use case, changed rule or explicit none, technical capability classification if touched, tests, and whether any existing inward interface/event/message responsibility shifted.

### 7.2 Level 2 - New Use Case

Use for a new command, query, event handler, repository method, QueryRepository method, DTO, assembler, or external integration inside an existing bounded context.

State: use-case kind; aggregate and invariants; repository/query repository changes; DTO/assembler changes; transaction boundary; event/message publication or consumption; async handler role; port-pressure declaration when command handlers inject four or more semantic outbound dependencies; placement extension for every new inward interface.

### 7.3 Level 3 - New Bounded Context or Aggregate

Use for a new bounded context, aggregate root, event family, repository, or cross-context communication channel.

State: bounded context, capability, language, data authority, aggregate root/entities/value objects/invariants, transaction boundaries, Integration Messages, cross-context mechanisms, technical capability classification, and a domain-mechanism inventory of every Aggregate rule, Repository, Domain Service, Domain Event, Integration Message, Application coordination service, ACL, QueryRepository/read facade, and Application command-side port decision.

### 7.4 Cross-Context Change Without a New Context

Treat as Level 2 on each affected side:

- Producing side: published event/message/query/contract, payload, timing, and failure policy.
- Consuming side: handler/consumer, idempotency, transaction boundary, ACL or facade, and whether a new inward interface is justified.

Escalate to Level 3 when the change crosses three or more contexts or the contract itself is unstable.

### 7.5 Gate Failure

If the required facts are missing, stop. Missing domain facts go back to `domain-modeling`; missing placement/layer decisions go back to `design`; missing implementation conventions go to the active language/runtime/database reference.

## 8. Quick Reference: Decision Summary

- Same Aggregate: non-repairable invariant, bounded child lifecycle, same transaction required.
- Separate Aggregates: independent identity/lifecycle, eventual consistency acceptable, unbounded collection, different authority or context.
- Event Storming fact: business evidence; later classify as Domain Event, Integration Message, state change, read-model fact, process step, or non-code fact.
- Domain Event: selected same bounded-context fact after state changes, for repeated same-BC reactions.
- Integration Message: cross-context contract.
- Repository: write-side aggregate collection.
- QueryRepository/read facade: product/application read model.
- Infrastructure adapter: DB/cache/broker/RPC/SDK/routing/topology mechanics.

Golden aggregate test:

> If I modify A but not B in the same transaction, can the system enter a business-invalid state that cannot be repaired by retry, compensation, reconciliation, or event/message flow?
