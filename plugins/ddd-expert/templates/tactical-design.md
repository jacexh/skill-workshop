---
status: draft
---

# <Design Delta> Tactical Design

<!-- One record owns one material Design Delta. `draft` is an exploration candidate, not accepted truth. Transition the reconciled candidate to `ready` before Guard; Guard closes it as `implemented`. Use `superseded` only when newer confirmed authority or reconciled implementation evidence invalidates an unimplemented ready record; `superseded_by` names either its ready replacement or the surviving ready EventStorming authority when the delta disappears. Replace placeholders and remove comments. -->

## Scope and Authority

<!-- Name the Design Delta, confirmed business facts and constraints, current structural hypotheses, accepted project decisions, and exclusions. Link governing ready EventStorming records and canonical Models. -->

## Domain Responsibility Thesis

<!-- Explain the smallest object model that preserves the confirmed facts. The diagram is a tactical candidate; it does not silently revise business authority. -->

```mermaid
classDiagram
    %% Derive every class and relationship from the responsibility thesis.
    %% This template intentionally supplies no example topology.
```

| Domain object | Identity and lifecycle | Owned facts, rules, and change reasons | Semantic result | Boundary reason |
|---|---|---|---|---|
| <Object> | <Identity/continuity> | <What it alone knows and changes> | <Minimal domain result> | <Why owned here> |

## State Authority and Semantic Flow

| Material fact/state | Business owner | Live runtime authority | Durable checkpoint or external authority | Validity after failure |
|---|---|---|---|---|
| <Fact> | <Owner> | <Authoritative instance/source> | <Optional checkpoint/authority> | <What remains valid> |

| Flow | Producer | Semantic result | Consumer | Business sequencer | Technical executor |
|---|---|---|---|---|---|
| <Normal flow> | <Domain owner> | <Owning-language value/capability> | <Domain owner> | <Who decides when> | <Who supplies context/provider execution> |

## Necessity Proof

<!-- Include only design-shaping concepts. If removing one does not break a confirmed responsibility or guarantee, remove it from the design. -->

| Proposed concept | Confirmed responsibility or guarantee it enables | Consequence of removal |
|---|---|---|
| <Participant/state/event/checkpoint/mechanism> | <Exact supported need> | <Concrete breakage> |

## Critical Collaboration Sequences

<!-- Derive the fewest readable `sequenceDiagram` views from the object thesis; do not start from a fixed layer or Repository topology. Show the normal path first. Add an adverse path only when responsibility, guarantee, durable state, required next action, or visible business result changes. Group technical participants by owning Bounded Context. Keep Roles, external authorities, and unowned external systems outside. Label calls `Public Method: <receiver operation>(<semantic inputs>)` and replies `Returns: <semantic result>`. Put accepted Model traceability in adjacent notes. -->

```mermaid
sequenceDiagram
    %% Derive every participant and call from the responsibility thesis.
    %% This template intentionally supplies no example topology.
```

## Ownership and Changed Interfaces

<!-- Name only ownership and semantic seams changed by this delta. Distinguish who owns business timing from who supplies use-case context and provider execution. -->

## Tactical Design Claims

<!-- Ready-only: omit this entire section from the exploration draft. Add stable claims only after implementation evidence reconciles the candidate. -->

| Claim ID | Responsibility | Reconciled assertion |
|---|---|---|
| <a id="TD-001"></a>TD-001 | <Owner/seam> | <Independently falsifiable assertion> |

## BC Architecture Projection

<!-- Ready-only: omit this entire section from the exploration draft. Account for each reconciled claim exactly once. Project only a durable BC-specific decision; otherwise give a concrete iteration-only reason. -->

| Source claim | Disposition | Bounded Context | Action | Decision ID | Current decision or iteration-only reason |
|---|---|---|---|---|---|
| [TD-001](#TD-001) | <projected/iteration-only> | <Context or `—`> | <add/replace/remove or `—`> | <ARCH-001 or `—`> | <Decision/reason> |

## Reconciliation Evidence

<!-- Ready-only: omit this entire section until Codify has produced concrete implementation evidence. Record paths or symbols and executed checks that confirmed, simplified, or falsified the draft. Name deleted concepts explicitly so semantic renaming cannot preserve them. Design-only work remains draft. -->

## Non-Goals and Codify Discretion

<!-- State only meaningful exclusions and the reversible choices left to Codify. -->

## Decision and Alternative

<!-- State the chosen whole, one credible alternative or deletion challenge, and the decisive evidence. -->
