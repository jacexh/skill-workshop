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

## Gate 2: Event Timeline Before Objects

Use event storming to expose business facts before tactical object names.
Event-storming facts are modeling evidence, not automatic code artifacts.

Ask:

- What happened, in past tense, after each command or external trigger?
- Which facts are business-visible, repeated, reversed, retried, or
  compensated?
- Which policy or decision reacts to each fact?
- Which facts stay inside one bounded context, and which need published
  language?
- Which facts are only audit, read-model, integration, or process clues?

Outcome: event-storming timeline and candidate Domain Events, Integration
Messages, state changes, process steps, read-model facts, or non-code facts.

## Gate 3: Authority Before Ownership

Before assigning a bounded context or model owner, identify authority.

Ask:

- Who confirms this state?
- Who can reverse, override, or expire it?
- Which system is the source of truth?
- Which team, actor, or external party owns the language?
- Is this external language that needs an ACL instead of entering Domain?

Outcome: bounded-context owner, data authority, published-language boundary, or
ACL need.

## Gate 4: Lifecycle Before Type

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

## Gate 5: Invariant Before Aggregate

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

## Gate 6: Failure Tolerance Before Transaction

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

Outcome: same-aggregate transaction, Domain Event, Integration Message, task,
compensation, process manager, or reconciler. Default path is one aggregate per command;
an aggregate boundary conflict returns to domain-modeling instead of being solved by persistence shape.

## Gate 7: Language Before Integration

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

## Gate 8: Coordination Before Abstraction

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
- Event timeline / facts:
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

## Forward-Test Principles

Keep concrete scenario fixtures outside this hot-path reference. Avoid project-specific scenario names here; use them in tests or benchmark prompts.
Forward tests should pass raw artifacts and assert whether the agent:

- reconstructs an event timeline from business facts before tactical objects;
- decides aggregate boundary before repository or transaction shape;
- distinguishes Event Storming facts from Domain Events, Integration Messages,
  state changes, read models, process steps, and non-code facts;
- separates product reads from command-side fact lookup before loading CQRS
  mechanics;
- treats repository, transaction, handler, and port shapes as evidence, not as
  the diagnosis;
- avoids mechanism suggestions until collaboration style and failure tolerance
  are explicit.
