---
context: "<Bounded Context>"
model_revision: 1
last_changed_by: "../../event-storming/<event-storming-slug>.md"
---

# <Bounded Context> Domain Model

<!-- This artifact owns confirmed business facts and the current falsifiable structural model for one Bounded Context. Integrate only durable conclusions owned by this context, link the EventStorming minutes that produced the current revision, replace every placeholder, remove all template comments, and retain the canonical section order. -->

## Ubiquitous Language

<!-- Define material terms in this context's own business language. Distinguish translated external terms. -->

## Authority and Ownership

<!-- State who proposes, decides, confirms, changes, reverses, expires, and publishes material facts. Preserve each confirmed Bounded Context-local Role-to-Command permission in compact business language, grouping Roles that share a permission; do not equate the Role to an IAM principal, transport identity, handler, or authorization mechanism. -->

## Aggregates and Core Business Objects

<!-- State each current Aggregate boundary/root hypothesis and the identity, lifecycle, invariant, or concurrency evidence that supports it. For each material core object, record its business meaning, identity and continuity, owned facts, lifecycle and change reasons, rules, semantic result, relationships to other owned objects, and cross-Aggregate references by identity when material. A Root may compose objects with distinct responsibilities inside one Aggregate; do not make independent lifecycle an automatic split or make the Root absorb every behavior. Do not prescribe fields, classes, accessors, calls, or storage mapping. If Bounded Context scope supports none, write exactly `- **No supported Aggregate:** <evidence-based reason>`. -->

## Aggregate Capabilities

<!-- This section is the sole current authority for each supported Aggregate Root's full capability contracts. Project normalized EventStorming Command-labeled edges into stable intention-revealing business operations. One row guides the Root's Domain method surface; do not create rows per pre-state, success/rejection branch, timing case, or Application workflow. State only the operation's source Command or Commands, common required authoritative facts, guaranteed business result, and stable rejection contract. It does not prescribe a signature or exact method count: internal branches, helpers, or a justified prepare/complete protocol may realize one capability without moving the Root's decision into its caller. Account for every state-changing Command through one or more owned capabilities or explicit Application/cross-Aggregate coordination. Omit this section when the context has no supported Aggregate. -->

### <Aggregate Root>

| Source Command(s) | Capability | Required authoritative facts | Guaranteed business result | Stable rejection |
|---|---|---|---|---|
| <Normalized business intent> | <Stable Root operation> | <Facts the Root owns or must receive> | <Common accepted guarantee> | <Common rejected/unchanged guarantee> |

## Scenarios and Lifecycle

<!-- Narrate this context's durable scenarios and lifecycle. Keep the complete cross-context iteration flow in the linked EventStorming minutes; retain here only obligations that remain part of this context's current model. Preserve cross-Aggregate progress and completion obligations without prescribing a Process Manager, message topology, transaction, or runtime mechanism. -->

## Domain Events and Event-triggered Commands

<!-- Omit this section when the confirmed Model selects no Domain Events and owns no event-triggered Commands. Keep only selected local Domain Events and business-required fact-to-intent causality. Do not copy analytical-only Workshop Events. Do not prescribe handlers, dispatch, transport, transactions, or retry mechanisms. Published cross-context meaning belongs once in Context Dependencies; a trigger below references only its contract name. -->

### Selected Domain Events

<!-- Omit this subsection when this context selects no local Domain Event. -->

| Domain Event | Owner | Established by Aggregate Capability | Why occurrence matters | Business consequence if not established |
|---|---|---|---|---|
| <Past-tense fact> | <Aggregate Root or Bounded Context> | <Capability> | <Required event-triggered Command or durable evidence purpose> | <Business guarantee> |

### Event-triggered Commands

<!-- Omit this subsection when this context owns no Command required by an established Domain Event or Published Fact Contract. The triggering fact replaces a human Role as the source of intent; the reacting context owns the Command and its required business outcome. -->

| Triggering Domain Event or Published Fact Contract | Command | Target Aggregate Capability or coordination | Required business outcome |
|---|---|---|---|
| <Fact or contract name> | <Business intent> | <Capability or explicit coordination> | <Outcome the context must establish> |

## Invariants and Policies

<!-- State immediate consistency rules, decision policies, timing rules, their required facts, semantic owner, and business outcome. -->

## Material Adverse Semantics

<!-- Omit this section unless an adverse fact changes a business right, obligation, value, or required next action. Record that business consequence without prescribing timeout, retry, rollback, compensation, or recovery mechanisms. -->

## Hotspots and Open Questions

<!-- Record the non-blocking Hotspots and assumptions that remained visible when the user confirmed the model. Resolved questions belong in the model decisions they produced, not in a conversation log. If this Model has none, omit every Hotspot node and write only `- None for the confirmed scope.` -->

| ID | Question | Why non-blocking |
|---|---|---|
| H1 | <Question> | <Why the confirmed model does not depend on its answer> |

## Context Dependencies

<!-- Required when this context participates in a Context Map dependency; otherwise omit it. For each named contract, record this context's upstream or downstream role, published meaning, permitted downstream reliance, local translation, and the upstream-owned authority, ordering, durability, or failure guarantee when material. Keep each Published Fact Contract aligned with its one named Context Map dependency; do not duplicate it as a Workshop Event catalog. -->
