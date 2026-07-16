# ADR 0004: `model_ready` Enters Codify Directly

- Status: Accepted
- Date: 2026-07-16
- Supersedes: the separate Tactical Design readiness and Design Realization authority decisions in [ADR 0001](0001-ddd-expert-reference-architecture.md), and the Strategic stop decision in [ADR 0003](0003-event-storming-whole-model-confirmation.md)
- EventStorming artifact placement, Model status, and implementation closure superseded by: [ADR 0005: EventStorming Produces Iteration Minutes and Current Models](0005-event-storming-minutes-and-current-models.md)

## Context

The plugin required a revision-matched `design.md` with `design_status: codify_ready` between a confirmed EventStorming Model and implementation. That extra state duplicated decisions Codify can derive from the confirmed Model, accepted project constraints, house-style references, and repository evidence. It also left EventStorming with an implementation-shaped documentation burden while providing no public workflow that could reliably produce the required authority.

The result was a broken handoff: EventStorming completed at `model_ready`, while Codify could still stop on `missing_design`, `evolving_design`, or `stale_design` even when the business model was complete.

## Decision

A canonical `model_ready` Model is sufficient implementation authority and enters Codify directly. There is no standalone Design artifact, `codify_ready` status, or tactical-design workflow stage in `ddd-expert`.

After the ten EventStorming steps and adversarial review produce one complete candidate, EventStorming validates it and replaces each affected canonical `model.md` with an incremented `model_status: draft` revision. The console summarizes the draft paths, revisions, validation, decisions, assumptions, and Hotspots, then requests approval of those exact files. Approval promotes the same revisions to `model_ready` and synchronizes the Context Map, root DDD README, and affected project documents. A semantic correction writes another incremented draft revision before approval is requested again.

EventStorming remains responsible for confirmed business meaning: language, authority, Aggregate and Bounded Context boundaries, identity and lifecycle, immediate invariants, collaboration contracts, and material failure or recovery semantics. Before confirmation it replays material scenarios and ensures the integrated Model contains the meaning implementation must preserve.

Codify owns engineering realization. It derives Repository/CQRS shape, ports, layers, Process Managers, package placement, adopted libraries, persistence, messages, adapters, runtime wiring, migrations, and verification from the confirmed Model, accepted project documents, house-style references, and repository evidence. This autonomy covers reversible in-scope choices within accepted constraints; it does not authorize destructive data/schema change, retention or deletion policy, security/compliance posture, incompatible deployment/public-contract migration, or first adoption of an external platform, paid service, or uncovered technology. Those require explicit project authority or an ADR, without recreating a standalone design phase. Codify returns to EventStorming only when implementation exposes missing or contradictory business meaning or would change the confirmed Model.

Guard reviews two independent axes: Model Realization and House-Style Conformance. Its realization inventory is built from scoped Model and request obligations, not Design rows. Missing implementation detail is not by itself a missing-authority verdict when Codify can decide it from the established authority order.

Canonical artifacts are the root README, Context Map, and one `model.md` per candidate or confirmed Bounded Context. A Model may be `draft` only as the complete approval surface or `model_ready` after approval. The retired `design.md` template and Design readiness states are removed.

## Consequences

- The workflow is `event-storming -> draft Model approval -> model_ready -> codify -> guard`.
- Model confirmation remains the only domain-authority gate before implementation; writing a `draft` creates no implementation authority.
- Codify has more explicit responsibility for engineering judgment and must cite the evidence behind material choices.
- Guard continues to provide an independent completion gate for material implementation changes.
- Historical `design.md` files may remain in existing repositories as ordinary project files, but the plugin does not inspect them as readiness authority or require them for Codify.

## Verification

- Release tests assert the direct `model_ready` handoff and absence of `design.md`, `codify_ready`, and Design readiness states from workflow contracts.
- Claude and Codex skills, references, and templates remain mirrored.
- Evaluation cases exercise implementation and review from confirmed Models without a separate Design artifact.
