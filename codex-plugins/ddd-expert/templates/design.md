---
context: "<Bounded Context>"
based_on_model_revision: 1
design_status: evolving
---

# <Bounded Context> Tactical Design

<!-- This artifact records accepted Tactical Design decisions for one Bounded Context. Keep design_status evolving while material scoped obligations remain; promote it to codify_ready only after complete Model realization and readiness replay. Replace placeholders, remove template comments, and omit every optional section that has no material accepted decision. Use business language for meaning and behavior, DDD language for boundaries and ownership, and technology language only for design-significant mechanisms. -->

## Model Realization

<!-- Trial format: while this Design is evolving, map only Model obligations whose tactical realization is accepted and omit unresolved rows rather than adding placeholders. Before codify_ready, map every material Model obligation to its tactical owner or mechanism and the section that defines it. Keep this compact; do not copy stories, scenario inventories, or routine implementation tasks. -->

| Accepted Model Obligation | Tactical Owner or Mechanism | Defined In |
|---|---|---|
| <Obligation> | <Owner or mechanism> | <Section> |

## Aggregate Map

<!-- Include only when a diagram or compact tree materially clarifies Root boundaries, owned Entities and Value Objects, or identity-only references to other Roots. This is a Domain ownership view, not a database ERD. -->

## Aggregate Designs

### <Aggregate Root>

#### Boundary Thesis

<!-- Explain why these objects and rules form the smallest sound immediate-consistency and mutation boundary. -->

#### Identity, Ownership, and External References

<!-- Define the Root's identity and continuity, owned objects, who may change them, and references to other Aggregate Roots by identity. -->

#### Invariants

<!-- State each business proposition that every successful operation must preserve and the Root behavior that protects it. -->

#### Entities

##### <Entity>

<!-- Define Domain meaning, identity and continuity, owning Root, lifecycle, behavior, rules, and references. Describe semantics rather than fields, accessors, ORM mapping, or method signatures. -->

#### Value Objects

##### <Value Object>

<!-- Define Domain meaning, constituent Domain values, validity rules, equality semantics, normalization or units, and Domain operations. -->

#### Behaviors and Lifecycle

<!-- Describe intention-revealing behaviors. When accepted facts establish material discrete states, use the transition table below as the authoritative lifecycle expression. Otherwise use a fact timeline, lineage, derivation rule, or another representation that matches the lifecycle. A state-machine diagram may illustrate but does not replace guards and authority. -->

| From | Intent | Authority | Guard | To | Established Fact |
|---|---|---|---|---|---|
| <State> | <Intent> | <Authority> | <Guard> | <State> | <Fact> |

#### Domain Events

<!-- Include only selected local past-tense facts that the Domain needs to name. Define their business meaning, producing decision, occurrence condition, established fact, and local consequence without payload schemas. -->

#### Consistency, Concurrency, and Failure

<!-- Record transaction scope and only the concurrency, duplicate, idempotency, durability, failure, and recovery guarantees required to protect this Aggregate's accepted design. -->

#### Boundary Challenge

<!-- For a new or materially changed non-trivial Aggregate, record the closest credible split or merge alternative and the concrete invariant, concurrency, or failure scenario that rejects it. Omit when no credible alternative exists. -->

#### Verification Obligations

<!-- Include only for an independently observable design risk. State the design promise, observable regression, and semantic boundary from which evidence must be collected; leave test framework and file choices to implementation. -->

## Domain Policies and Services

<!-- Include only important Domain decisions that do not naturally belong to an Entity or Value Object. Define meaning, required facts, decision, rules, semantic owner, and why an Aggregate does not own the behavior. -->

## Process Managers and Cross-Aggregate Coordination

<!-- Include only durable multi-step coordination or another non-trivial cross-Aggregate flow. Separate Process Manager state from Domain Aggregate state. Define trigger, persisted progress, reactions, next intents, completion or termination, duplicates, failure, and recovery. Routine load/invoke/save wiring is not Tactical Design. -->

## Context Dependencies and Contracts

<!-- Include only design-significant collaboration on an accepted Context Map edge. For each contract, record the upstream owner, downstream consumer, published meaning, runtime interaction when material, downstream translation, failure and recovery semantics, and dependency constraint. Define Integration Messages here as cross-context contracts rather than reusing Domain Event types. -->

## Design-Significant Technical Constraints

<!-- Include only when replacing a technical mechanism would change an accepted invariant, consistency boundary, ordering, idempotency, durability, recovery, performance/operability guarantee, or contract semantic. Add a Persistence View only when physical mapping materially constrains the design; it cannot prove an Aggregate boundary. -->

## Cross-Cutting Verification Obligations

<!-- Include only when one observable risk crosses several Aggregates, processes, or context contracts. Keep local obligations beside the design element they prove. -->
