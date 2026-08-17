---
status: draft
---

# <Design Delta> Tactical Design

<!-- One record owns one material Design Delta for an implementation slice. Keep `status: draft` until the user confirms this exact candidate, use `status: ready` for Codify authority, and let Guard set `status: implemented` only with the paired iteration closure. Use `status: superseded` plus `superseded_by: "<replacement-ready-tactical-design-or-newer-ready-minutes-path>"` only when newer confirmed business authority invalidates this ready record before implementation. Replace every placeholder and remove all comments. -->

## Scope and Authority

<!-- State the Design Delta and explicit exclusions. Link every governing ready EventStorming record, affected canonical Model, ADR, Spec, PRD, or other accepted project constraint. -->

## Critical Collaboration Sequences

<!-- These typed sequence diagrams are the only persisted Model-to-design projection; do not add a parallel mapping table. Include one complete sequence per materially different success, rejection, failure, timeout, retry, or recovery path. A separate diagram is justified only by different responsibility, guarantee, durable state/checkpoint, or visible outcome; combine mechanically equivalent variants in one `alt` branch or note and use the fewest readable scenario-focused diagrams. Use exact accepted `Role:`, `External Authority:`, `Command:`, `Aggregate:`, `Capability:`, `Domain Event:`, `Published Fact Contract:`, `Integration Message:`, `Coordination:`, and `Workshop Event:` labels when that meaning participates in the Design Delta. Preserve the Domain Event -> producer translation -> Integration Message -> consumer translation -> event-triggered Command chain when published meaning crosses a Bounded Context. Show an analytical Workshop Event only as an outcome note; it does not become a software participant, message, or event type. Reuse the same Capability across state variants; trace any additional Domain call to that Capability or an accepted Model policy. Show authoritative reads/writes, transaction boundary, state/checkpoint changes, event publication timing, and visible outcome. Do not use code-level method signatures unless an accepted public contract itself is authority. -->

```mermaid
sequenceDiagram
    actor Role as Role: <Business Role>
    %% For a non-human source, use: actor Authority as External Authority: <Accepted authority>
    participant Interface as Interface: <Inbound responsibility>
    participant Application as Application: <Command use case>
    participant Repository as Repository: <Aggregate collection>
    participant Root as Aggregate: <Aggregate Root>

    Role->>Interface: Command: <Business intent>
    Interface->>Application: Command: <Business intent>
    Application->>Repository: Load: <Authoritative state>
    Repository-->>Application: Aggregate: <Aggregate Root>
    Application->>Root: Capability: <Stable Root operation>
    Root-->>Application: Business outcome: <Accepted or rejected meaning>
    Application->>Repository: Persist: <Named transaction boundary>
    Repository-->>Application: Commit result: <Outcome>
    Application-->>Interface: Result: <Semantic result>
    Interface-->>Role: Outcome: <Visible business outcome>
    Note over Role,Root: Workshop Event: <Past-tense business outcome>

    %% Selected local-event form: Root-->>Application: Domain Event: <Past-tense fact>
    %% Cross-context continuation must show Published Fact Contract, Integration Message,
    %% consumer translation, event-triggered Command, and target Capability as distinct steps.
```

## Ownership and Changed Interfaces

<!-- Name transaction, state, concurrency, event publication, failure, and recovery ownership. List only changed semantic Interfaces or seams and connect each responsibility to the exact typed Model meaning shown in the sequences. Keep Role authorization, Domain Event recording, Published Fact translation, Integration Message adaptation, event-triggered Commands, and Aggregate Capability ownership distinct when present. -->

## Tactical Design Claims

<!-- Keep stable IDs once ready. Keep each ID equal to its explicit HTML anchor so canonical claim keys remain navigable. Each row is one independently falsifiable semantic owner, boundary, ordering, or atomicity assertion. Do not create rows per arrow, file, method, or layer. -->

| Claim ID | Responsibility | Accepted assertion |
|---|---|---|
| <a id="TD-001"></a>TD-001 | <Domain/Application/Interface/Infrastructure/Runtime/Collaboration> | <Implementation-shaping assertion> |

## BC Architecture Projection

<!-- Omit this section when no accepted claim must survive as a current BC-specific architecture decision. Project only durable decisions, once, to the context that owns each responsibility. Use `add`, `replace`, or `remove`; do not copy sequences or rationale. -->

| Bounded Context | Action | Decision ID | Current BC-specific architecture decision | Source claim |
|---|---|---|---|---|
| <Bounded Context> | <add/replace/remove> | ARCH-001 | <One lasting decision, or `—` for remove> | [TD-001](#TD-001) |

## Non-Goals

<!-- State plausible but excluded mechanisms, flows, and architecture changes. -->

## Codify Discretion

<!-- State reversible implementation choices Codify may make inside the accepted seams. -->

## Decisions and Reasons

<!-- Record the chosen collaboration design, strongest credible alternative, decisive constraints, and any ADR update. -->
