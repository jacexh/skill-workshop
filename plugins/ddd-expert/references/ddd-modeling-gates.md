---
name: ddd-modeling-gates
description: Use when domain-modeling or design needs to reason about business stories, authority, lifecycles, invariants, failure tolerance, integration language, or DDD mechanism choice before naming tactical objects.
---

# DDD Modeling Gates

Use this file as a thinking spine for `domain-modeling` and `design`. It is not
a rule catalog. The gates help an agent slow down before turning product nouns
into Aggregates, Repositories, Events, ports, handlers, schemas, or
transactions.

Use the gates only when the work touches lifecycle, ownership, consistency,
integration, or model boundaries. Tiny layer-local changes can state why no
gate is material and continue.

## How To Use

- In `domain-modeling`, use the gates to form one high-fidelity question at a
  time and to synthesize compact Model Decisions.
- In `design`, answer the relevant gates before tactical mechanisms are named.
- In `implement`, do not redo modeling; stop when the handoff lacks required
  modeling evidence.
- In `review`, use missing or contradictory gate evidence as a model evidence
  gap or design violation.

## Gate 1: Story Before Nouns

Start from the business story, not from object names.

Ask:

- Who acts, or what system trigger starts the story?
- What command, decision, or policy changes the business state?
- What result becomes visible to the business?
- What exception path matters?
- Which nouns are just UI, table, protocol, or report vocabulary?

Outcome: candidate commands, decisions, outcomes, and explicit non-domain or
non-aggregate nouns.

## Gate 2: Authority Before Ownership

Before assigning a bounded context or model owner, identify authority.

Ask:

- Who confirms this state?
- Who can reverse, override, or expire it?
- Which system is the source of truth?
- Which team, actor, or external party owns the language?
- Is this external language that needs an ACL instead of entering Domain?

Outcome: bounded-context owner, data authority, published-language boundary, or
ACL need.

## Gate 3: Lifecycle Before Type

Before choosing Entity, Value Object, Aggregate Root, read model, or adapter,
identify lifecycle.

Ask:

- Does this thing have identity across change, retry, transfer, or failure?
- Can it exist without the proposed parent?
- Can it fail independently?
- Does the business talk about its lifecycle, or is it an attribute/snapshot?
- Is it only a projected view or external-system representation?

Outcome: Entity, Value Object, child Entity, Aggregate Root candidate, read
model, or adapter shape.

## Gate 4: Invariant Before Aggregate

An Aggregate is a consistency boundary around business invariants, not an
important noun.

Ask:

- What rule must always be true after a command?
- If A changes without B, is the business state invalid or temporarily
  incomplete?
- Can retry, event handling, compensation, or reconciliation repair it?
- If several objects always change together, why are they separate aggregate
  roots?
- If one object owns the invariant, can the other be passed as an immutable
  snapshot/value object?

Outcome: aggregate boundary, invariant owner, or reason to revisit candidate
Aggregate Roots.

## Gate 5: Failure Tolerance Before Transaction

Before accepting a synchronous transaction, decide what failure means.

Ask:

- Is temporary inconsistency acceptable?
- Is the business outcome observable before all side effects complete?
- Is retry idempotent?
- Is compensation needed?
- Does a process manager, task, or reconciler own the long-running
  coordination?
- Is a same-transaction write a business requirement or just persistence/API
  convenience?

Outcome: same-aggregate transaction, justified multi-aggregate exception,
Domain Event, Integration Message, task, compensation, process manager, or
reconciler.

## Gate 6: Language Before Integration

Before choosing Domain Event, Integration Message, ACL, protocol contract, or
read facade, identify language scope.

Ask:

- Is this a past-tense fact inside one bounded context?
- Is this stable published language for other consumers?
- Is downstream adopting upstream language, translating it, or reading a
  published facade?
- Is the event actually a disguised command?
- What is the minimum fact a consumer needs at occurrence time?

Outcome: Domain Event, Boundary Publisher, Integration Message, ACL, protocol
contract, or published read facade.

## Gate 7: Coordination Before Abstraction

Before creating a Repository, Domain Service, Application Service, port, task,
or process manager, classify the work.

Ask:

- Is this a domain decision?
- Is this application orchestration?
- Is this long-running process coordination?
- Is this product read-model composition?
- Is this external-system translation?
- Is this infrastructure mechanism?

Outcome: Aggregate method, Domain Service, Repository, Application service,
Process Manager/Reconciler, QueryRepository/read facade, ACL, or Infrastructure
adapter.

## Model Decisions

When a brief or design materially affects boundaries, summarize the accepted
model without turning it into a large template:

```text
Model Decisions:
- Story / command:
- Authority / data owner:
- Lifecycle owner:
- Invariant owner:
- Failure tolerance:
- Collaboration style:
- Explicit non-aggregate nouns:
```

Omit this block only when the change truly does not affect lifecycle,
ownership, consistency, integration, or model boundaries.

## Fix Direction Ordering

When proposing fixes for consistency, lifecycle, event-fact, or coordination
findings, order the reasoning before the mechanism:

1. Identify the invariant owner and lifecycle owner.
2. Decide whether the affected objects are one Aggregate, child
   Entities/Value Objects, read models, external facts, or independent
   Aggregates.
3. Decide failure tolerance, retry, compensation, reconciliation, or process
   ownership.
4. Only then mention repository or transaction changes as persistence
   mechanics for the accepted model.

Do not make transaction shape a peer of model correction. Do not present a
semantic repository transaction as a peer alternative to resolving invariant
ownership.

## Forward-Test Scenarios

These scenarios define the reasoning behavior expected from the plugin. Tests
should assert the outcome, not exact long prose.

### TaskAgreement Boundary Scenario

Input: `TaskAgreement` owns lifecycle, while `Payment`, `Delivery`,
`RefundCase`, `Refund`, and `Settlement` are proposed as independent Aggregate
Roots and commands synchronously update several of them.

Expected: design stops or flags an aggregate-boundary contradiction, asks what
invariant requires synchronous commit, and does not first generate
`LifecycleRepository` or prettier multi-aggregate repository methods.

### Noun-List Scenario

Input: a spec lists many nouns such as `Order`, `OrderLine`, `Invoice`,
`PaymentAttempt`, `Shipment`, `Address`, and `Coupon` without lifecycle or
invariant evidence.

Expected: domain-modeling asks for story, authority, and lifecycle before
Aggregate Roots are named.

### Event-as-Command Scenario

Input: a design emits `UserShouldBeSuspended` or `StartPayment` as an event
consumed by another context.

Expected: modeling/design distinguishes past-tense facts from commands and
review asks whether this is a Domain Event, Integration Message, command, or
process step.

### External-Language Leakage Scenario

Input: an external payment provider's status names are used directly in Domain
state.

Expected: design routes through Authority Before Ownership and ACL; implement
or review expects translation at the boundary.

### Read-Model Backflow Scenario

Input: a dashboard query shape is used to define the write aggregate.

Expected: design separates product read model from write-side aggregate; CQRS
guidance loads only after the model boundary is clear.

### Long-Running Coordination Scenario

Input: a command needs payment authorization, delivery acceptance, refund, and
settlement over time.

Expected: design considers process manager, reconciler, task, or event flow
before synchronous transaction; implementation stops if the handoff lacks
failure, idempotency, or compensation evidence.
