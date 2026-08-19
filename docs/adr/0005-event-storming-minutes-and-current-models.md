# ADR 0005: EventStorming Produces Iteration Minutes and Current Models

- Status: Superseded by [ADR 0009](0009-sparse-current-ddd-artifacts.md)
- Date: 2026-07-16
- Supersedes: the EventStorming artifact-placement and Model-readiness decisions in [ADR 0003](0003-event-storming-whole-model-confirmation.md) and [ADR 0004](0004-model-ready-enters-codify-directly.md)
- Guard review and closure preconditions superseded by: [ADR 0006: Guard Is a Bounded Semantic-Structure Review](0006-guard-is-a-semantic-structure-review.md)
- Tactical Design artifact lifecycle and joint closure extended by: [ADR 0007: Tactical Design Is Conditional and Claim-Led](0007-conditional-tactical-design-and-claims.md)
- Artifact authority and falsifiability refined by: [ADR 0008: Design Artifacts Are Falsifiable Candidates](0008-design-artifacts-are-falsifiable-candidates.md)

## Context

Persisting each complete EventStorming view inside every affected Bounded Context Model duplicated cross-context scenarios and made later iterations choose between replacing old diagrams or growing one diagram indefinitely. The Model is durable current domain authority; one EventStorming discussion is a temporary solution and implementation handoff.

## Decision

Store one complete meeting record per iteration under `docs/ddd-expert/event-storming/`. Its lifecycle is `draft -> ready -> implemented`: EventStorming writes `draft`; explicit confirmation applies the `ready` minutes, affected Models, and documentation closure through one staged consistency write with pre-state drift checks; and a clear Guard changes it to `implemented` while checking its README TODO. The filesystem protocol does not claim multi-file atomicity: pre-write drift produces zero writes, while an unexpected failure after mutation is reported with its exact partial state for repair.

Whenever later confirmed EventStorming authority replaces a ready iteration before implementation, the correction adds `ready -> superseded`: the old minutes retain their content, gain only the new status and `superseded_by` link, and become a plain README lineage entry while the replacement ready minutes update the Models. Replacement is established by the old `ready` state, overlapping scope, and a new affected Model revision, regardless of whether the correcting evidence came from Tactical Design, the user, or another source. A superseded iteration is history, never implementation authority or a checked implementation result.

Canonical `model.md` files contain only current context-owned language, authority, Aggregates, lifecycle, invariants, policies, failure semantics, Hotspots, and dependencies. They carry `model_revision` and `last_changed_by`, but no iteration status or complete EventStorming diagram. Existing `model_status: model_ready` files remain accepted until a later iteration changes them.

Codify consumes the scoped `ready` meeting record or records plus the affected current Models. After Guard marks an iteration `implemented`, its meeting record is closed process history, not authority that future work must reconstruct. Future work reads current Models and creates new EventStorming minutes when new modeling is required.

## Consequences

- Cross-context scenarios have one complete iteration view instead of copies in several Models.
- Models remain stable current-state projections and change only after confirmation.
- README exposes a lightweight implementation TODO without becoming a design-history registry.
- Guard gains one narrowly mechanical post-clear write; its review remains read-only.
