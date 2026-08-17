---
name: maintain-artifacts
description: Use when a ddd-expert workflow must inspect DDD artifacts, validate or materialize EventStorming or Tactical Design records, synchronize confirmed authority, or close an implemented iteration.
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

Inspect the canonical artifact root plus caller-supplied project evidence. Return paths, content fingerprints, Model and BC Architecture revisions, `last_changed_by` links, EventStorming and Tactical Design status, README checkbox parity, layout diagnostics, and structural readiness.

Recognize:

- `canonical_model`: a structurally valid current Model with `model_revision` and `last_changed_by`;
- `context_architecture`: a structurally valid optional current Architecture at `context/<context-slug>/architecture.md`, with `architecture_revision`, `last_changed_by`, at least one current decision, and valid claim sources;
- `legacy_model_ready`: a structurally valid confirmed Model that still uses `model_status: model_ready`; accept it as current authority until a later EventStorming iteration migrates that Model;
- `draft_event_storming`, `ready_event_storming`, or `implemented_event_storming`: structurally valid minutes with the matching `status`;
- `superseded_event_storming`: structurally valid minutes with `status: superseded` and one `superseded_by` link to the later ready correction that replaced it before implementation;
- `draft_tactical_design`, `ready_tactical_design`, or `implemented_tactical_design`: a structurally valid Design Delta record with the matching `status`, unique stable claim IDs, matching explicit HTML anchors, and valid authority links; claim IDs are unique within each record and canonical claim keys use `<record-path>#TD-NNN`. A `ready` record whose governing EventStorming link became `superseded` is invalidated pending Tactical Design replacement or retirement and is not Codify authority;
- `superseded_tactical_design`: a formerly `ready`, unimplemented record with one `superseded_by` link to either its replacement ready Tactical Design or the newer ready EventStorming authority that eliminated its Design Delta;
- `legacy_model`, `legacy_context_map`, `missing_model`, `uninitialized`, or `invalid_layout` with concrete diagnostics.

Inspection is read-only. File presence and code shape are evidence, not business authority.

Treat an otherwise valid existing minutes record with an `## Aggregate Capabilities`, `## Command-to-Capability Projection`, or `## Required Reactions` table, or a canonical Model whose capability table still uses `Capability | Business intent | Required facts | State transition or outcome | Rejection or failure`, as an accepted `legacy_capability_projection`, not `invalid_layout`. Report the diagnostic and preserve its bytes. New draft minutes express Command-to-Capability and event-to-Command traceability only through connected diagram edges; every later EventStorming revision of an affected Model uses the full normalized capability contract and `Event-triggered Commands` form. A supersession write may still consume and preserve an older ready record without migrating its historical body.

## Validate a proposed model

Use `validate-proposed-model` after EventStorming completes the ten steps and assembles the exact candidate minutes plus every projected terminal Model and Context Map source.

Stage canonical wrappers outside the project workspace. Validate the minutes against the EventStorming template and every projected Model's full capability contracts against the Model template; validate the Context Map with the installed strict validator. Require each initiating business participant to be a Bounded Context-local Role or external authority, every normalized Command to appear only as an incoming arrow label rather than a node, repeated Role edges for one intent to reuse the same canonical label and target, every state-changing Command edge to reach an Aggregate Capability or explicit coordination, and every new or changed capability to have at least one source Command edge. Require each projected Model source-Command/capability pair to equal one connected diagram edge. Require authoritative facts, guarantees, and stable rejection semantics to be supported by a connected Workshop Event, confirmed decision, assumption, or other evidence in the exact minutes rather than introduced only in the Model projection. Require every projected event-triggered Command to equal a diagram edge from its selected Domain Event or producer-owned Published Fact Contract to the named capability or coordination, with no fake Role or standalone Reaction Policy node. Reject a new draft that adds a parallel Command-to-Capability, Required Reaction, or Event Index table. Report diagnostics and remove scratch. Keep every project path unchanged.

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

Use `validate-proposed-tactical-design` after Tactical Design determines a real Design Delta and assembles the exact candidate record plus projected README, BC Architecture, and ADR sources. Stage canonical wrappers outside the project workspace. Validate the record against the Tactical Design template, including ready EventStorming and Model links, complete critical sequences, unique `TD-NNN` claim IDs with matching anchors, required ownership sections, the exact optional BC Architecture projection, and absence of placeholders. Validate every projected Architecture against its template and observed revision without changing a project path.

This proves structural persistence only. It does not decide whether a Design Delta exists, whether a sequence is correct, or whether the design should be accepted.

## Write Tactical Design draft

Use `write-tactical-design-draft` first for the complete initial candidate before interactive review begins, and later only after one settled revision batch produces another complete validated candidate.

Receive one exact rendered record with `status: draft`, its candidate fingerprint, a unique canonical path, the root README with one matching unchecked entry, and the observed pre-state of both targets. Stage and validate both files, re-read their pre-states, then write only the record and README entry. Any drift returns `revision_conflict` with zero writes. Do not change Models, EventStorming minutes, Context Map, BC Architecture, or project decisions.

A revision supplies the observed draft fingerprint, caller evidence that its connected batch has no unresolved affected path, and one complete newly validated record. Reject partial conversational edits, per-question writes, or an open batch. Rewrite the same draft once, keep its README entry byte-identical, and return the new fingerprint. Stable claim IDs become immutable only when the record becomes `ready`.

## Discard Tactical Design draft

Use `discard-tactical-design-draft` only after Tactical Design re-inspects newer ready business authority and determines that the draft's Design Delta disappeared or its implementation-slice identity was replaced.

Receive the exact draft path and fingerprint, its one unchecked README entry, caller evidence that no replacement Design Delta remains or that slice identity changed, and the complete consistency pre-state. Verify `status: draft`, confirm that no current BC Architecture or ready authority references the draft, stage the draft removal and README without its entry, re-read both pre-states, then apply and validate once. Drift returns `revision_conflict` with zero writes. Never discard a `ready` or `implemented` record; preserve a same-slice draft and rebase it instead.

## Supersede ready Tactical Design

Use `supersede-ready-tactical-design` only when newer ready EventStorming authority invalidates an unimplemented `ready` Tactical Design and Tactical Design confirms that no replacement Design Delta remains. This is retirement of stale authority, not creation of a design artifact.

Receive the exact ready record path and fingerprint, its superseded governing EventStorming link, the newer ready minutes and Models, an exact `ready -> superseded` rendering whose `superseded_by` targets those newer minutes, the README lineage replacement, and exact instructions to remove every current BC Architecture row sourced from that record. Require evidence that no replacement Design Delta remains and verify that no current Architecture source will point to the superseded record. Preserve every unrelated Architecture row and Source byte-for-byte. When such rows remain, increment that Architecture revision exactly once and set `last_changed_by` to the just-superseded Tactical Design solely as retirement provenance, never as a current claim source; remove the optional file when no current rows remain. Stage the complete consistency set, re-read every pre-state, then apply and validate once. Reject an `implemented`, already superseded, still-governing, unrelated, or partially supplied record. Drift returns `revision_conflict` with zero writes.

## Apply ready Tactical Design

Use `apply-ready-tactical-design` only after Tactical Design supplies:

- explicit user-confirmation evidence for the exact draft path and fingerprint;
- the same record with only `status: ready` changed;
- every invalidated unimplemented `ready` Tactical Design being replaced, rendered with only `status: ready -> superseded` plus `superseded_by` targeting the new ready record;
- the root README, exact affected BC Architecture projections, and any required project-owned ADR closure;
- the complete consistency read set and observed pre-state of every existing path.

Reject input that invents or changes business meaning, an Aggregate Capability, context ownership, or an unconfirmed project commitment. For each replaced Tactical Design, require a governing EventStorming link now be superseded, overlapping implementation scope, one plain README lineage entry, and no surviving BC Architecture source pointing to the old canonical claim keys. Require each Architecture `add`, `replace`, or `remove` to equal the confirmed record projection and point to its canonical claim key; each changed surviving file sets `last_changed_by` to the new ready Tactical Design, while unaffected row Sources remain byte-identical. Reject duplicated cross-context decisions, empty Architecture files, generic House Style copies, or a root Architecture path. Stage the rendered terminal set outside the workspace, validate it, immediately re-read every pre-state, apply only the supplied bytes, and verify the resulting consistency set. Drift returns `revision_conflict` with zero writes; a failure after mutation returns `blocked` with the exact partial state.

## Mark iteration implemented

Use `mark-iteration-implemented` only after Guard reports a clear semantic-structure review over one unchanged snapshot, every frozen architecture unit is terminal, and the snapshot-bound producer checkpoint is complete.

Receive every reviewed `ready` EventStorming and Tactical Design path and fingerprint, Guard's clear completion evidence, the frozen Model, BC Architecture, design-authority, and source snapshot identities, the README pre-state, and the exact rendered closure. Preserve every record byte except `status: ready -> implemented`; change only each matching README checkbox from `[ ]` to `[x]`. When Tactical Design governed the implementation, require its complete scoped ready EventStorming set and close both kinds together. Leave every BC Architecture byte-identical. Stage, recheck all pre-states, apply once, and verify every representation agrees.

A violation, evidence gap, incomplete Guard execution, snapshot drift, unrelated or partially supplied records, or any other status transition returns `blocked` or `revision_conflict` with zero writes. Persist the iteration closure only; keep review findings in Guard's response.

## Canonical Models

Each new or changed `model.md`:

- uses the canonical path and template section order;
- declares `model_revision` and a relative `last_changed_by` link, with no iteration status;
- states current language, authority, Aggregates/core objects, full normalized Aggregate Capability contracts when Aggregates are supported, lifecycle, selected Domain Event semantics and event-triggered Commands when present, invariants, policies, failure semantics, Hotspots, and dependencies owned by that context;
- supplies enough durable meaning for Codify without prescribing reversible implementation choices; and
- leaves complete iteration diagrams and cross-context scenario flow in the linked EventStorming minutes.

An unchanged Model may retain an inspected `legacy_capability_projection`. Once EventStorming changes that Model for any semantic reason, migrate its complete capability table to the current Command-to-Capability form in the same confirmed revision; never perform a format-only Model revision.

At Aggregate scope, preserve excluded sibling meaning byte-for-byte. A shared Bounded Context change requires Bounded Context scope and integrated confirmation.

## Bounded Context Architecture

BC Architecture decision IDs are unique within each file, each has a matching explicit HTML anchor, and canonical architecture keys use `<architecture-path>#ARCH-NNN`. Each current row names one BC-specific implementation-shaping decision and links its Source to the canonical `<tactical-design-record-path>#TD-NNN` claim. A confirmed projection increments an existing `architecture_revision` exactly once or creates revision 1; replacement removes the superseded row, and removal of the final row removes the optional file. Never create `docs/ddd-expert/architecture.md`.

Reject complete sequences, Model facts, generic House Style, code inventories, historical rationale, and decisions owned by another context. These checks are structural ownership checks; Tactical Design supplies the accepted meaning.

## Context Map and documentation closure

The Context Map declares every accepted project Bounded Context exactly once and each upstream-to-downstream model dependency once as `U -> D`. Reject self-loops, reciprocal dependencies, longer cycles, bidirectional arrows, Partnership, Shared Kernel, and mismatched named contracts. A structurally valid but different graph is confirmation drift.

The EventStorming ready write set may include the README, Context Map, minutes, affected Models, relevant project-owned Spec, PRD, ADR, and Glossary files, and only the mechanically renamed or removed BC Architecture paths permitted above. The Tactical Design ready write set may include its record, README, exact affected BC Architecture projections, and relevant project-owned ADR files, but never canonical Models or Context Map changes. Preserve accepted historical rationale and follow repository ADR policy. Leave unrelated and external documents unchanged.

## Results

Return one of `inspected`, `validated`, `draft_written`, `discarded`, `ready`, `superseded`, `implemented`, `no_change`, `revision_conflict`, or `blocked`, with the paths, revisions, fingerprints, checks, and exact filesystem state needed to verify that result.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for canonical paths and artifact roles.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/architecture.md](../../templates/architecture.md), [../../templates/context-map.md](../../templates/context-map.md), [../../templates/event-storming.md](../../templates/event-storming.md), [../../templates/model.md](../../templates/model.md), and [../../templates/tactical-design.md](../../templates/tactical-design.md) for validation and rendering.
