---
context: "<Bounded Context>"
model_revision: 1
model_status: model_ready
---

# <Bounded Context> Domain Model

<!-- This artifact is the user-confirmed Strategic Model for one Bounded Context. Copy the exact confirmed EventStorming source, replace every placeholder, remove all template comments, and retain the canonical section order. -->

## EventStorming Model

<!-- Persist the exact complete section shown in the integrated model. Include actor/external system, Commands, policies, past-tense Events, non-blocking Hotspots, every supported Aggregate boundary, and the Bounded Context boundary. At Bounded Context scope with no supported Aggregate, omit the Aggregate subgraph and use the explicit evidence-based marker in the Aggregates section. Add diagrams only when readability requires Aggregate detail views plus a Bounded Context panorama. -->

```mermaid
flowchart LR
    %% Within this diagram, declare each node and subgraph ID once; another diagram may reuse stable IDs.
    actor["<Actor>"]:::actor

    subgraph BC["BC: <Bounded Context>"]
        subgraph Aggregate["Aggregate: <Aggregate Root>"]
            command["Command: <Business intent>"]:::command
            policy{"Policy: <Decision rule>"}:::policy
            event(["Event: <Past-tense fact>"]):::event
        end
        hotspot_H1["Hotspot H1: <Non-blocking question>"]:::hotspot
    end

    actor --> command --> policy --> event
    policy -.-> hotspot_H1

    classDef actor fill:#fff2cc,stroke:#8a6d1d,color:#111
    classDef external fill:#d9eaf7,stroke:#24527a,color:#111
    classDef command fill:#cfe2f3,stroke:#24527a,color:#111
    classDef policy fill:#d9d2e9,stroke:#674ea7,color:#111
    classDef event fill:#f9cb9c,stroke:#b45f06,color:#111
    classDef hotspot fill:#f4cccc,stroke:#990000,color:#111,stroke-dasharray: 5 5
```

## Ubiquitous Language

<!-- Define material terms in this context's own business language. Distinguish translated external terms. -->

## Authority and Ownership

<!-- State who proposes, decides, confirms, changes, reverses, expires, and publishes material facts. -->

## Aggregates and Core Business Objects

<!-- State each confirmed Aggregate boundary/root and the identity, lifecycle, invariant, or concurrency reason that requires it. If Bounded Context scope supports none, write exactly `- **No supported Aggregate:** <evidence-based reason>` instead of inventing a root. Keep detailed Tactical Design elsewhere. -->

## Scenarios and Lifecycle

<!-- Narrate material Commands, past-tense facts, reactions, changed rights/obligations/value, and terminal conditions in business time. -->

## Invariants and Policies

<!-- State immediate consistency rules, decision policies, timing rules, and their business authority. -->

## Failure and Recovery Semantics

<!-- State duplicate, cancellation, expiry, retry, compensation, and recovery meaning when material. -->

## Hotspots and Open Questions

<!-- Record the non-blocking Hotspots and assumptions that remained visible when the user confirmed the model. Resolved questions belong in the model decisions they produced, not in a conversation log. If this Model has none, omit every Hotspot node and write only `- None for the confirmed scope.` -->

| ID | Question | Why non-blocking |
|---|---|---|
| H1 | <Question> | <Why the confirmed model does not depend on its answer> |

## Context Dependencies

<!-- Optional final section. Record only this context's confirmed side of semantic dependencies and translations from context-map.md. Runtime interactions belong to the Context Map Interaction View, not here. -->
