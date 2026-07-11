---
context: "<Bounded Context>"
based_on_model_revision: 1
---

# <Bounded Context> Tactical Design

<!-- This artifact describes one Bounded Context. Replace the title placeholder, remove template comments, and omit sections that have no material accepted decisions. Use business language for responsibilities and behavior, DDD language for boundaries and ownership, and technology language only for material design mechanisms. For scheduled, asynchronous, or recovery responsibilities, state the semantic owner and execution owner separately. -->

## Aggregates and Invariant Ownership

<!-- Define Aggregate boundaries, root ownership, and the invariants each boundary protects. -->

## Application Responsibilities

<!-- Define commands, queries, orchestration, transaction intent, accepted reactions, and the semantic owner of scheduled or recovery work without code signatures. -->

## Boundary Contracts

<!-- Include only for a design-significant semantic boundary. Record its meaning, owner, direction, and consequences; leave interface names, method signatures, adapters, and file locations to code. -->

## Persistence and Consistency

<!-- Define Repository/CQRS boundaries, transaction and consistency scope, idempotency, durability, and recovery mechanisms when material. -->

## Runtime Ownership

<!-- Name the execution owner for process lifecycle, scheduling, delivery, concurrency, retry, and shutdown when these are material design decisions. Keep business eligibility, fact interpretation, coordination decisions, and outcome selection with the named semantic owner. -->

## Verification Seams

<!-- State the observable evidence that proves the accepted model and design. -->

## Cross-Context Collaboration

<!-- Include only when multiple Bounded Contexts collaborate. Define contract ownership, fact or intent language, the semantic owner of translation and coordination, failure and recovery semantics, and the execution-ownership role when delivery is asynchronous. -->
