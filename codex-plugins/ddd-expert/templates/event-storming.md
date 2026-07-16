---
status: draft
---

# <EventStorming Scope>

<!-- These minutes are the complete solution for one EventStorming iteration. Keep `status: draft` until the user confirms this exact candidate, use `status: ready` after the affected Models are synchronized, and let Guard set `status: implemented` only after the implementation is clear. Replace every placeholder and remove all template comments. -->

## Scope and Exclusions

<!-- State the business outcome, actors, time horizon, included scenarios, and explicit exclusions. -->

## EventStorming Model

<!-- Persist the complete integrated view discussed with the user. Include actors/external systems, Commands, policies, past-tense Events, supported Aggregate and Bounded Context boundaries, cross-context scenario interactions, and non-blocking Hotspots. -->

```mermaid
flowchart LR
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

## Decisions and Reasons

<!-- Record the material language, authority, lifecycle, Aggregate, Bounded Context, collaboration, and recovery decisions plus the business evidence or trade-off behind each. -->

## Affected Models

<!-- Link every canonical Model whose expected state this iteration changes. -->

- [<Bounded Context>](../context/<context-slug>/model.md)

## Assumptions and Hotspots

<!-- Preserve only assumptions and non-blocking Hotspots that remain relevant to implementing this iteration. -->

| ID | Question or assumption | Why non-blocking |
|---|---|---|
| H1 | <Question or assumption> | <Why implementation can proceed> |
