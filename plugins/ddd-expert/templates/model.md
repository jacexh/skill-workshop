---
context: "<Bounded Context>"
model_revision: 1
last_changed_by: "../../event-storming/<event-storming-slug>.md"
---

# <Bounded Context> Domain Model

<!-- This artifact is the current domain authority for one Bounded Context. Integrate only durable conclusions owned by this context, link the EventStorming minutes that produced the current revision, replace every placeholder, remove all template comments, and retain the canonical section order. -->

## Ubiquitous Language

<!-- Define material terms in this context's own business language. Distinguish translated external terms. -->

## Authority and Ownership

<!-- State who proposes, decides, confirms, changes, reverses, expires, and publishes material facts. -->

## Aggregates and Core Business Objects

<!-- State each confirmed Aggregate boundary/root and the identity, lifecycle, invariant, or concurrency reason that requires it. For each material core object, record the Domain facts Codify needs to choose its tactical form: business meaning, identity and continuity when present, ownership, lifecycle, validity, equality, normalization or units, and references to other Aggregates by identity when material. Do not prescribe fields, classes, accessors, or storage mapping. If Bounded Context scope supports none, write exactly `- **No supported Aggregate:** <evidence-based reason>` instead of inventing a root. -->

## Aggregate Capabilities

<!-- For each supported Aggregate Root, record its intention-revealing business capabilities. A capability usually maps to an intention-revealing method in code, but this authority owns behavior rather than a method signature. Account for every state-changing Command or policy decision through one or more owned capabilities or explicit Application/cross-Aggregate coordination; state required authoritative facts, successful transition/outcome, and rejection/failure meaning. Do not prescribe parameters, return types, fields, packages, persistence, or orchestration mechanisms. Omit this section when the context has no supported Aggregate. -->

### <Aggregate Root>

| Capability | Business intent | Required facts | State transition or outcome | Rejection or failure |
|---|---|---|---|---|
| <Business capability> | <Why the actor invokes it> | <Facts the Root owns or must receive> | <Accepted business result> | <Rejected/unchanged result> |

## Scenarios and Lifecycle

<!-- Narrate this context's durable scenarios and lifecycle. Keep the complete cross-context iteration flow in the linked EventStorming minutes; retain here only obligations that remain part of this context's current model. Preserve cross-Aggregate progress and completion obligations without prescribing a Process Manager, message topology, transaction, or runtime mechanism. -->

## Domain Events and Reactions

<!-- Omit this section when the confirmed Model selects no Domain Events and requires no reactions. Keep only selected local Domain Events and business-required fact-to-intent causality. Do not copy analytical-only Workshop Events. Do not prescribe handlers, dispatch, transport, transactions, or retry mechanisms. Published cross-context meaning belongs once in Context Dependencies; a reaction below references only its contract name. -->

### Selected Domain Events

<!-- Omit this subsection when this context selects no local Domain Event. -->

| Domain Event | Owner | Established by Aggregate Capability | Why occurrence matters | Business failure or recovery |
|---|---|---|---|---|
| <Past-tense fact> | <Aggregate Root or Bounded Context> | <Capability> | <Required local reaction or durable evidence purpose> | <Business guarantee> |

### Required Reactions

<!-- Omit this subsection when this context owns no business-required reaction. An Event is an established fact; the named policy or process owner issues the next Command. -->

| Observed Domain Event or Published Fact Contract | Reaction Policy and owner | Issued Command | Target Aggregate Capability or coordination | Business failure or recovery |
|---|---|---|---|---|
| <Fact or contract name> | <Business reason and semantic owner> | <Business intent> | <Capability or explicit coordination> | <Business obligation if the reaction fails or repeats> |

## Invariants and Policies

<!-- State immediate consistency rules, decision policies, timing rules, their required facts, semantic owner, and business outcome. -->

## Failure and Recovery Semantics

<!-- State duplicate, cancellation, expiry, retry, compensation, and recovery meaning when material. -->

## Hotspots and Open Questions

<!-- Record the non-blocking Hotspots and assumptions that remained visible when the user confirmed the model. Resolved questions belong in the model decisions they produced, not in a conversation log. If this Model has none, omit every Hotspot node and write only `- None for the confirmed scope.` -->

| ID | Question | Why non-blocking |
|---|---|---|
| H1 | <Question> | <Why the confirmed model does not depend on its answer> |

## Context Dependencies

<!-- Required when this context participates in a Context Map dependency; otherwise omit it. For each named contract, record this context's upstream or downstream role, published meaning, permitted downstream reliance, local translation, and the upstream-owned authority, ordering, durability, or failure guarantee when material. Keep each Published Fact Contract aligned with its one named Context Map dependency; do not duplicate it as a Workshop Event catalog. -->
