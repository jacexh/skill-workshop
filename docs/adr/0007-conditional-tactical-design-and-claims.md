# ADR 0007: Tactical Design Is Conditional and Claim-Led

- Status: Accepted
- Date: 2026-08-17
- Supersedes: the unconditional absence of a tactical-design workflow stage in [ADR 0004](0004-model-ready-enters-codify-directly.md)
- Extends: artifact lifecycle and closure in [ADR 0005](0005-event-storming-minutes-and-current-models.md), and Guard authority and unit seeding in [ADR 0006](0006-guard-is-a-semantic-structure-review.md)

## Context

EventStorming currently confirms business language, ownership, Aggregates, lifecycle, policies, and cross-context meaning, then hands the result directly to Codify. Canonical Models describe Aggregate boundaries but do not make each Root's business capabilities or required `fact -> policy -> Command` reactions checkable. Complete collaboration is present only as a business EventStorming flow; transaction, state, concurrency, event-publication, failure, and recovery ownership can remain implicit.

That gap permits two independently reasonable steps to compose badly. A user can accept each business concept while Codify invents an unfamiliar coordination mechanism, transaction boundary, or event order during implementation. Requiring a full design phase for every change would replace that failure with unnecessary ceremony and duplicate reversible choices that Codify can safely make.

## Decision

EventStorming projects **Aggregate Capabilities** and only business-required **Reactions** into each affected canonical Model. Capabilities state intent, required facts, outcome, and rejection meaning. A reaction records `selected Domain Event or Published Fact Contract -> Reaction Policy and owner -> Command -> Aggregate Capability or explicit coordination`, plus business failure/recovery meaning. Models prescribe neither signatures nor handlers, transport, transactions, retry mechanisms, packages, or persistence.

Tactical Design is conditional on a real Design Delta. A Design Delta exists when realization creates or changes material Aggregate/context coordination, transaction ownership, state/checkpoint ownership, concurrency control, event-publication timing, failure/recovery responsibility, semantic ports, or another durable Interface boundary not already accepted. No Design Delta creates no Tactical Design artifact; ordinary reversible work inside established seams continues directly to Codify.

One material delta is stored at `docs/ddd-expert/tactical-design/<slug>.md`. The record is scoped to an implementation slice, may reference multiple EventStorming iterations and Bounded Contexts, and is not created mechanically per Model or meeting. `model.md` owns current Bounded Context business authority, Aggregate Capabilities, and Required Reactions. Tactical Design owns the accepted collaboration design for its slice. ADRs own hard-to-reverse project decisions and rationale; code and configuration own implementation detail.

An optional `docs/ddd-expert/context/<context-slug>/architecture.md` owns only current, durable, BC-specific software decisions that outlive one Design Delta. It is created lazily, contains one compact decision table, and links every row to its confirming Tactical Design claim. It never copies Model facts, generic House Style, complete sequences, code structure, or historical rationale. A cross-context decision is projected once to the context that owns the responsibility. No root `docs/ddd-expert/architecture.md` is introduced.

A pure context rename moves its Architecture without revising decisions. A split, merge, or removal retires the old Architecture without automatically reassigning rows; any decision that must survive the new boundary is confirmed again through Tactical Design.

Each Tactical Design contains:

- the exact Design Delta, authority links, scope, and exclusions;
- one complete critical sequence per material success, failure, or recovery path, including rejection, timeout, or retry only when it changes ownership or guarantees;
- transaction, state, concurrency, event-publication, failure, and recovery ownership;
- changed semantic Interfaces and their connection to Aggregate Capabilities;
- a small set of immutable `Tactical Design Claims` with record-local `TD-NNN` IDs and canonical `<record-path>#TD-NNN` keys;
- an optional exact `add`/`replace`/`remove` projection into affected BC Architecture files;
- non-goals, Codify discretion, the strongest credible alternative, and reasons.

The record normally follows `draft -> ready -> implemented`; newer confirmed business authority may add `ready -> superseded` before implementation. Ordinary `no_design_change` is a zero-write result only when no existing draft or invalidated ready authority awaits resolution; removing such a draft returns `discarded`, while retiring such a ready record returns `superseded`. Tactical Design writes a complete initial draft before the first review question so the editor artifact is the shared canvas. Each turn advances one material question and adversarially tests user proposals; related conclusions form one connected revision batch, and the complete draft is redrawn only after every affected path settles. When no question or batch remains, the user confirms the exact current path and fingerprint as one collaboration design. The exact ready transition, README, Architecture projections, and required ADR closure are applied together; Tactical Design never changes canonical Models.

Tactical Design may falsify but never silently override EventStorming authority. It freezes its draft and returns a concrete **Model Challenge** to EventStorming. After EventStorming returns unchanged or newer ready Models, Tactical Design resumes the same draft, rebases it when the same delta remains, or discards the unconfirmed draft when the delta disappears or its implementation-slice identity is replaced. A ready Tactical Design whose governing EventStorming authority is superseded is never edited or discarded: a replacement ready record supersedes it when a material delta remains, while direct retirement supersedes it against the newer ready minutes when no delta remains. Either path replaces or removes every BC Architecture source from the stale claims in the same consistency write.

Codify consumes current BC Architecture plus a ready Tactical Design whose governing EventStorming links remain ready when the implementation has an active Design Delta. It maps canonical claim keys to changed `path#symbol` entries in the neutral Review Handoff, but cannot edit claims or prewrite verdicts. Implemented Tactical Design records are provenance rather than current authority; superseded records are invalidated history. If implementation exposes missing or contradictory design authority, it returns to Tactical Design. If it exposes missing business meaning, it returns to EventStorming.

Guard remains one fresh read-only semantic-structure reviewer. Its authority order places current BC Architecture and ready Tactical Design below Models, ready EventStorming, and accepted project constraints, but above House Style defaults and code evidence. Its finite units are seeded by all governing source-backed architecture responsibilities plus changed DDD-significant declarations or wiring. Guard does not parse every Mermaid arrow or create units per arrow, file, method, layer, mechanism, or rule.

When code contradicts an accepted Tactical Design, Guard reports a violation routed to Codify. Missing or contradictory business authority routes to EventStorming; missing or contradictory collaboration-design authority, or an implementation need that changes the design, routes to Tactical Design. Existing `clear`, `violation`, and `evidence_gap` terminal states remain unchanged.

A clear Guard review with a complete snapshot-bound producer checkpoint closes every reviewed ready EventStorming and Tactical Design record together while leaving BC Architecture current. When no Tactical Design governed the implementation, EventStorming-only closure remains valid. Partial closure is rejected because it would claim that one part of the accepted iteration was implemented independently.

## Consequences

- Business behavior becomes inspectable at each Aggregate Root without turning Models into code designs.
- Business-required Event-to-Command causality remains current without persisting implementation wiring.
- Material object collaboration becomes visible and confirmable before code is written.
- Routine changes retain the low-cost direct Model-to-Codify path.
- Tactical Design records remain iteration-scoped; only their durable BC-owned decisions survive in optional sibling Architecture files, with no root architecture catch-all.
- Guard gains design fidelity without another reviewer, another verdict axis, arrow auditing, test execution, or file-by-file review.

## Verification

- Release contracts assert Aggregate Capability projection, conditional routing, Tactical Design lifecycle and claims, Codify claim mapping, Guard routes, and joint closure.
- A Guard behavior fixture binds one accepted claim to a concrete Application symbol and requires code drift to route to Codify.
- Claude and Codex skill and template bodies remain mirrored, and standard release validation remains green.
