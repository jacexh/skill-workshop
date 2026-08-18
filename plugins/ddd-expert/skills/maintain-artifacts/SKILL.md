---
name: maintain-artifacts
description: Use when a ddd-expert workflow must inspect DDD artifacts, validate or materialize EventStorming or Tactical Design records, synchronize confirmed authority, or close an implemented iteration.
user-invocable: false
---

# Maintain DDD Artifacts

Execute the artifact protocol for `ddd-expert`. Own structure, validation, concurrency checks, and supplied-byte application. Own no domain decision.

Accept only an explicit caller authority and operation:

- `event-storming` may use `inspect`, `validate-proposed-model`, `write-event-storming-draft`, and `apply-ready-event-storming`;
- `tactical-design` may use `inspect`, `validate-proposed-tactical-design`, `write-tactical-design-draft`, `discard-tactical-design-draft`, `supersede-ready-tactical-design`, and `apply-ready-tactical-design`;
- `codify` may use `inspect` only; and
- `guard` may use `inspect` and, after a clear review, `mark-iteration-implemented`.

Return `blocked` for every other authority or operation.

## Inspect

Inspect the canonical artifact root plus caller-supplied project evidence. Return paths, content fingerprints, Model and BC Architecture revisions, `last_changed_by` links, EventStorming and Tactical Design status, README checkbox parity, layout diagnostics, and **structural** readiness. Never describe structural validity as design validation.

Recognize:

- `canonical_model`: a structurally valid current Model with `model_revision` and `last_changed_by`;
- `context_architecture`: a structurally valid optional current Architecture at `context/<context-slug>/architecture.md`, with `architecture_revision`, `last_changed_by`, at least one current decision, and valid claim sources;
- `legacy_model_ready`: a structurally valid confirmed Model that still uses `model_status: model_ready`; accept it as current authority until a later EventStorming iteration migrates that Model;
- `draft_event_storming`, `ready_event_storming`, or `implemented_event_storming`: structurally valid minutes with the matching `status`;
- `superseded_event_storming`: structurally valid minutes with `status: superseded` and one `superseded_by` link to the later ready correction that replaced it before implementation;
- `draft_tactical_design`: a structurally valid exploration candidate with the matching `status`, valid authority links, and the common design-thesis sections. It may omit Reconciliation Evidence, final claims, and BC Architecture projection until implementation evidence exists. It may be reported to Codify only as an exploration candidate, never accepted authority;
- `ready_tactical_design` or `implemented_tactical_design`: a structurally valid reconciled Design Delta record with the matching `status`, concrete implementation evidence, unique stable claim IDs, matching explicit HTML anchors, exhaustive claim disposition, and valid authority links. A `ready` record whose governing EventStorming link became `superseded`, or whose tactical claims conflict with concrete implementation evidence supplied for reconciliation under the same authority, is invalidated pending Tactical Design replacement or retirement;
- `superseded_tactical_design`: a formerly `ready`, unimplemented record with one `superseded_by` link to either its replacement ready Tactical Design or the surviving ready EventStorming authority left sufficient when newer authority or reconciled implementation evidence eliminated its Design Delta;
- `legacy_model`, `legacy_context_map`, `missing_model`, `uninitialized`, or `invalid_layout` with concrete diagnostics.

Inspection is read-only. File presence and code shape are evidence, not business authority.

Treat an otherwise valid existing minutes record with an `## Aggregate Capabilities`, `## Command-to-Capability Projection`, or `## Required Reactions` table, or a canonical Model whose capability table still uses `Capability | Business intent | Required facts | State transition or outcome | Rejection or failure`, as an accepted `legacy_capability_projection`, not `invalid_layout`. Report the diagnostic and preserve its bytes. Treat an otherwise valid unchanged Model whose section at the adverse-semantics position is still named `## Failure and Recovery Semantics`, or whose Selected Domain Events table still ends with `Business failure or recovery`, as accepted legacy layout, not `invalid_layout`; preserve its bytes until a later semantic EventStorming revision migrates those names and narrows their contents. Likewise, do not invalidate an existing `ready` or `implemented` Tactical Design solely because its sequence layout or labels predate the current Bounded Context box and Public Method projection form; require the current form only when Tactical Design creates or revises a draft. Do not invalidate those records solely because their claim disposition predates the exhaustive Architecture-disposition form; report the diagnostic and preserve their bytes until a separately authorized repair. New draft minutes express Command-to-Capability and event-to-Command traceability only through connected diagram edges; every later EventStorming revision of an affected Model uses the full normalized capability contract and `Event-triggered Commands` form. A supersession write may still consume and preserve an older ready record without migrating its historical body.

## Validate a proposed model

Use `validate-proposed-model` after EventStorming applies the relevant ten lenses and assembles the exact current candidate minutes plus every projected terminal Model and Context Map source.

Stage canonical wrappers outside the project workspace. Validate the minutes against the EventStorming template and every projected Model's full capability contracts against the Model template; validate the Context Map with the installed strict validator. Require each initiating business participant to be a Bounded Context-local Role or external authority, every normalized Command to appear only as an incoming arrow label rather than a node, repeated Role edges for one intent to reuse the same canonical label and target, every state-changing Command edge to reach an Aggregate Capability or explicit coordination, and every new or changed capability to have at least one source Command edge. Require each projected Model source-Command/capability pair to equal one connected diagram edge, and require each confirmed Bounded Context-local Role-to-Command permission to remain in that Model's Authority and Ownership in business language without IAM or handler mapping. Require authoritative facts, guarantees, and stable rejection semantics to be supported by a connected Workshop Event, confirmed decision, assumption, or other evidence in the exact minutes rather than introduced only in the Model projection. Require every projected event-triggered Command to equal a diagram edge from its selected Domain Event or producer-owned Published Fact Contract to the named capability or coordination, with no fake Role or standalone Reaction Policy node. Reject a new draft that adds a parallel Command-to-Capability, Required Reaction, or Event Index table. Report diagnostics and remove scratch. Keep every project path unchanged.

This proves only that the displayed diagrams and artifact projections are structurally persistable. It neither judges the domain model nor authorizes a write.

## Write EventStorming draft

Use `write-event-storming-draft` after proposal validation and before Integrated Model Confirmation.

Receive one exact rendered minutes file with `status: draft`, its candidate fingerprint, a unique canonical path, the root README with one matching unchecked entry, and the observed pre-state of both targets. Stage and validate both files, re-read their pre-states, then write only the minutes and README entry. Any drift returns `revision_conflict` with zero writes.

Keep every canonical Model byte-identical. A semantic correction rewrites the same draft minutes and preserves its single README entry; it does not create a Model revision.

## Apply ready EventStorming

Use `apply-ready-event-storming` only after EventStorming supplies:

- explicit user-confirmation evidence for the exact draft path and fingerprint;
- the same minutes with only `status: ready` changed;
- every affected Model rendered with an incremented `model_revision` and `last_changed_by` pointing to the ready minutes;
- for any confirmed correction, every replaced unimplemented minutes record rendered with the exact `ready -> superseded` transition and `superseded_by` link to the new ready minutes;
- the complete Context Map, README, relevant project-owned document closure, and any mechanically renamed or removed BC Architecture paths required by a confirmed context rename, split, merge, or removal;
- the complete consistency read set and observed pre-state of every existing path.

Reject input that requires inventing a term, rule, boundary, collaboration, lifecycle decision, or document meaning. The user confirms the integrated domain model, not this internal file inventory.

For every replaced minutes record, preserve every byte except `status: ready -> superseded` plus one `superseded_by` field targeting the new ready minutes. Require the old `ready` state, scope overlap, a new affected Model revision that explicitly replaces its meaning, and a plain README lineage entry replacing the old unchecked TODO. Do not condition this transition on whether the correction originated in Tactical Design. Reject an `implemented`, already superseded, unrelated, or partially supplied record. Superseded minutes are history and never enter Codify or Guard authority.

For an identity-preserving context rename, accept only a file move plus owning-context label and navigation-link updates; preserve every decision row, source claim, and `architecture_revision`. For a split, merge, or removal, accept only deletion of each retired context Architecture from the current set. Never reassign a decision row through EventStorming; a surviving decision requires a later confirmed Tactical Design projection.

Apply with this fail-fast sequence:

1. Verify `authority: event-storming`, the exact `draft -> ready` transition, confirmation evidence, canonical paths, unique writes, and one unchecked README link.
2. Verify every changed Model follows the template and updates `last_changed_by` to the ready minutes. A new Model starts at `model_revision: 1`; an existing Model advances its revision exactly once.
3. Stage the complete rendered terminal set outside the project workspace and validate the DDD root, minutes, Models, Context Map, navigation, and repository-required checks.
4. Re-read every consistency-set pre-state immediately before the first project mutation. Any drift returns `revision_conflict` with zero writes.
5. Apply only the supplied bytes and verify the resulting complete consistency set.

Project files are never an optimistic validation area. Report any failure after the first mutation as `blocked` with the exact partial state.

## Validate proposed Tactical Design

Use `validate-proposed-tactical-design` after the conversational candidate is coherent. Stage canonical wrappers outside the project workspace. For an exploration draft, validate ready EventStorming and Model links, one derived domain-object `classDiagram`, object responsibility, state authority, semantic flow, necessity proof, the fewest typed critical sequences, and absence of placeholders in the sections present. Require sequence calls and replies to name semantic receiver operations and results, but do not require a fixed Interface/Application/Repository topology or a diagram for every technical error. A separate adverse path is structurally admissible only when its text names the changed responsibility, guarantee, durable state, required next action, or visible result. Do not require or synthesize final `TD-NNN` claims, Reconciliation Evidence, or BC Architecture dispositions for this exploration draft.

For a reconciled candidate seeking `ready`, additionally require Reconciliation Evidence that identifies concrete implementation paths or symbols and executed checks, unique anchored `TD-NNN` claims, and claim-by-claim BC Architecture disposition. Require each claim exactly once as `projected` or `iteration-only`, and require projected Architecture rows or removals to match. Reject a ready candidate whose evidence says that no implementation evidence exists. Reject duplicate mapping ledgers and analytical Workshop Events promoted to production types without stronger authority. Validate structure only; do not infer that the object split, lifecycle, or mechanism is wise.

This proves structural persistence only. It does not decide whether a Design Delta exists, whether a sequence is correct, or whether the design should be accepted.

## Write Tactical Design draft

Use `write-tactical-design-draft` only after the object thesis, state authority, semantic flow, necessity test, and adversarial conversation produce one coherent candidate. Never write it before the first design question merely to create a review canvas. Later rewrites occur only after one connected revision batch settles.

Receive one exact rendered record with `status: draft`, its candidate fingerprint, a unique canonical path, the common exploration sections, the root README with one matching unchecked entry, and the observed pre-state of both targets. The initial draft does not need Reconciliation Evidence, final claims, or a BC Architecture projection. Stage and validate both files, re-read their pre-states, then write only the record and README entry. Any drift returns `revision_conflict` with zero writes. Do not change Models, EventStorming minutes, Context Map, BC Architecture, or project decisions.

A revision supplies the observed draft fingerprint, caller evidence that its connected batch has no unresolved affected path, and one complete newly validated record. Reject partial conversational edits, per-question writes, or an open batch. Rewrite the same draft once, keep its README entry byte-identical, and return the new fingerprint. Reconciliation may add evidence, claims, and Architecture dispositions after Codify has produced implementation evidence. Stable claim IDs become immutable only when the record becomes `ready`.

## Discard Tactical Design draft

Use `discard-tactical-design-draft` only after Tactical Design determines that the draft's Design Delta disappeared or its implementation-slice identity was replaced, based on either newer ready business authority or concrete implementation evidence reconciled under the same current ready authority.

Receive the exact draft path and fingerprint, its one unchecked README entry, the governing ready authority, caller evidence that no replacement Design Delta remains or that slice identity changed, and the complete consistency pre-state. When the governing business authority is unchanged, require concrete implementation paths or symbols and executed checks that eliminated the candidate mechanism. Verify `status: draft`, confirm that no current BC Architecture or ready authority references the draft, stage the draft removal and README without its entry, re-read both pre-states, then apply and validate once. Drift returns `revision_conflict` with zero writes. Never discard a `ready` or `implemented` record; preserve a same-slice draft and rebase it when a material delta remains.

## Supersede ready Tactical Design

Use `supersede-ready-tactical-design` only when Tactical Design has reconciled concrete evidence, the user explicitly confirms that no replacement Design Delta remains, and either newer ready EventStorming authority or implementation evidence under the same current ready authority invalidates an unimplemented `ready` Tactical Design. This is retirement of stale tactical authority, not creation of a design artifact.

Receive the exact ready record path and fingerprint, its governing EventStorming link, the surviving ready minutes and Models, the user's confirmation, an exact `ready -> superseded` rendering whose `superseded_by` targets the surviving ready minutes, the README lineage replacement, and exact instructions to remove every current BC Architecture row sourced from that record. When EventStorming authority is unchanged, also require concrete implementation paths or symbols and executed checks showing why the Design Delta disappeared; the `superseded_by` link names the authority now sufficient for realization and does not claim that its business facts changed. Verify that no current Architecture source will point to the superseded record. Preserve every unrelated Architecture row and Source byte-for-byte. When such rows remain, increment that Architecture revision exactly once and set `last_changed_by` to the just-superseded Tactical Design solely as retirement provenance, never as a current claim source; remove the optional file when no current rows remain. Stage the complete consistency set, re-read every pre-state, then apply and validate once. Reject an `implemented`, already superseded, unsupported, unrelated, or partially supplied record. Drift returns `revision_conflict` with zero writes.

## Apply ready Tactical Design

Use `apply-ready-tactical-design` only after Tactical Design supplies:

- explicit user-confirmation evidence for the exact reconciled draft path and fingerprint;
- the same record with only `status: ready` changed;
- every invalidated unimplemented `ready` Tactical Design being replaced, rendered with only `status: ready -> superseded` plus `superseded_by` targeting the new ready record;
- the root README, exhaustive claim-disposition ledger, exact affected BC Architecture projections, and any required project-owned ADR closure;
- the complete consistency read set and observed pre-state of every existing path.

Require the Reconciliation Evidence section to identify concrete implementation paths or symbols and executed checks that confirmed, simplified, or falsified the draft, including deleted semantic mechanisms. A design-only request stops at `draft`; absence of implementation evidence blocks the `ready` transition. Structural validation does not judge whether the design is wise, but missing evidence or an unresolved implementation/design deviation blocks the transition.

Reject input that invents or changes business meaning, an Aggregate Capability, context ownership, or an unconfirmed project commitment. Before staging, require the confirmed record to account every claim exactly once. Require that every projected `add` or `replace` claim has one matching supplied current Architecture row, every projected `remove` claim has one matching supplied removal from the observed current Architecture, and no supplied current row lacks a projected source claim; an `iteration-only` claim produces no Architecture change and must retain its concrete reason in the ready record. Reject a ready transition with any unaccounted or duplicate claim, any incomplete projected action in the consistency set, or any supplied current Architecture row without a projected source claim. For each replaced Tactical Design, require either a governing EventStorming link now be superseded or concrete implementation paths, symbols, and executed checks that invalidate its tactical claims under the same current ready authority. Also require overlapping implementation scope, explicit confirmation of the replacement, one plain README lineage entry, and no surviving BC Architecture source pointing to the old canonical claim keys. Require each Architecture `add`, `replace`, or `remove` to equal the confirmed record projection and point to its canonical claim key; each changed surviving file sets `last_changed_by` to the new ready Tactical Design, while unaffected row Sources remain byte-identical. Reject duplicated cross-context decisions, empty Architecture files, generic House Style copies, or a root Architecture path. Stage the rendered terminal set outside the workspace, validate it, immediately re-read every pre-state, apply only the supplied bytes, and verify the resulting consistency set. Drift returns `revision_conflict` with zero writes; a failure after mutation returns `blocked` with the exact partial state.

## Mark iteration implemented

Use `mark-iteration-implemented` only after Guard reports a clear semantic-structure review over one unchanged snapshot, every frozen architecture unit is terminal, and the snapshot-bound producer checkpoint is complete.

Receive every reviewed `ready` EventStorming and Tactical Design path and fingerprint, Guard's clear completion evidence, the frozen Model, BC Architecture, design-authority, and source snapshot identities, the README pre-state, and the exact rendered closure. Preserve every record byte except `status: ready -> implemented`; change only each matching README checkbox from `[ ]` to `[x]`. When Tactical Design governed the implementation, require its complete scoped ready EventStorming set and close both kinds together. Leave every BC Architecture byte-identical. Stage, recheck all pre-states, apply once, and verify every representation agrees.

A violation, evidence gap, incomplete Guard execution, snapshot drift, unrelated or partially supplied records, or any other status transition returns `blocked` or `revision_conflict` with zero writes. Persist the iteration closure only; keep review findings in Guard's response.

## Canonical Models

Each new or changed `model.md`:

- uses the canonical path and template section order;
- declares `model_revision` and a relative `last_changed_by` link, with no iteration status;
- states current language, authority, confirmed Bounded Context-local Role-to-Command permissions, current Aggregate/core-object hypotheses, full normalized Aggregate Capability contracts when supported, lifecycle, selected Domain Event semantics and event-triggered Commands when present, invariants, policies, material adverse business semantics, Hotspots, and dependencies owned by that context;
- supplies enough durable meaning for Codify without prescribing reversible implementation choices; and
- leaves complete iteration diagrams and cross-context scenario flow in the linked EventStorming minutes.

An unchanged Model may retain an inspected `legacy_capability_projection`, the legacy `## Failure and Recovery Semantics` heading, and the legacy Selected Domain Events column `Business failure or recovery`. Once EventStorming changes that Model for any semantic reason, migrate its complete capability table and adverse-semantics labels to the current form in the same confirmed revision; never perform a format-only Model revision.

At Aggregate scope, preserve excluded sibling meaning byte-for-byte. A shared Bounded Context change requires Bounded Context scope and integrated confirmation.

## Bounded Context Architecture

BC Architecture decision IDs are unique within each file, each has a matching explicit HTML anchor, and canonical architecture keys use `<architecture-path>#ARCH-NNN`. Each current row names one BC-specific implementation-shaping decision and links its Source to the canonical `<tactical-design-record-path>#TD-NNN` claim classified `projected` in that record. A confirmed projection increments an existing `architecture_revision` exactly once or creates revision 1; replacement removes the superseded row, and removal of the final row removes the optional file. Never create `docs/ddd-expert/architecture.md`.

Reject complete sequences, Model facts, generic House Style, code inventories, historical rationale, and decisions owned by another context. These checks are structural ownership checks; Tactical Design supplies the accepted meaning.

## Context Map and documentation closure

The Context Map declares every accepted project Bounded Context exactly once and each upstream-to-downstream model dependency once as `U -> D`. Reject self-loops, reciprocal dependencies, longer cycles, bidirectional arrows, Partnership, Shared Kernel, and mismatched named contracts. A structurally valid but different graph is confirmation drift.

The EventStorming ready write set may include the README, Context Map, minutes, affected Models, relevant project-owned Spec, PRD, ADR, and Glossary files, and only the mechanically renamed or removed BC Architecture paths permitted above. The Tactical Design ready write set may include its record, README, exact affected BC Architecture projections, and relevant project-owned ADR files, but never canonical Models or Context Map changes. Preserve accepted historical rationale and follow repository ADR policy. Leave unrelated and external documents unchanged.

## Results

Return one of `inspected`, `validated`, `draft_written`, `discarded`, `ready`, `superseded`, `implemented`, `no_change`, `revision_conflict`, or `blocked`, with the paths, revisions, fingerprints, checks, and exact filesystem state needed to verify that result.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for canonical paths and artifact roles.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/architecture.md](../../templates/architecture.md), [../../templates/context-map.md](../../templates/context-map.md), [../../templates/event-storming.md](../../templates/event-storming.md), [../../templates/model.md](../../templates/model.md), and [../../templates/tactical-design.md](../../templates/tactical-design.md) for validation and rendering.
