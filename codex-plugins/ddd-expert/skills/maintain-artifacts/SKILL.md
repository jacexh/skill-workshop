---
name: maintain-artifacts
description: Use when a ddd-expert workflow must inspect DDD artifacts, validate or materialize EventStorming minutes, synchronize confirmed Models, or close an implemented iteration.
---

# Maintain DDD Artifacts

Execute the artifact protocol for `ddd-expert`. Own structure, validation, concurrency checks, and supplied-byte application. Own no domain decision.

Accept only an explicit caller authority and operation:

- `event-storming` may use `inspect`, `validate-proposed-model`, `write-event-storming-draft`, and `apply-ready-event-storming`;
- `codify` may use `inspect` only; and
- `guard` may use `inspect` and, after a clear review, `mark-event-storming-implemented`.

Return `blocked` for every other authority or operation.

## Inspect

Inspect the canonical artifact root plus caller-supplied project evidence. Return paths, content fingerprints, Model revisions, `last_changed_by` links, minutes status, README checkbox parity, layout diagnostics, and structural readiness.

Recognize:

- `canonical_model`: a structurally valid current Model with `model_revision` and `last_changed_by`;
- `legacy_model_ready`: a structurally valid confirmed Model that still uses `model_status: model_ready`; accept it as current authority until a later EventStorming iteration migrates that Model;
- `draft_event_storming`, `ready_event_storming`, or `implemented_event_storming`: structurally valid minutes with the matching `status`;
- `legacy_model`, `legacy_context_map`, `missing_model`, `uninitialized`, or `invalid_layout` with concrete diagnostics.

Inspection is read-only. File presence and code shape are evidence, not business authority.

## Validate a proposed model

Use `validate-proposed-model` after EventStorming completes the ten steps and assembles the exact candidate minutes plus every projected terminal Model and Context Map source.

Stage canonical wrappers outside the project workspace. Validate the minutes against the EventStorming template, every projected Model against the Model template, and the Context Map with the installed strict validator. Report diagnostics and remove scratch. Keep every project path unchanged.

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
- the complete Context Map, README, and relevant project-owned document closure;
- the complete consistency read set and observed pre-state of every existing path.

Reject input that requires inventing a term, rule, boundary, collaboration, lifecycle decision, or document meaning. The user confirms the integrated domain model, not this internal file inventory.

Apply with this fail-fast sequence:

1. Verify `authority: event-storming`, the exact `draft -> ready` transition, confirmation evidence, canonical paths, unique writes, and one unchecked README link.
2. Verify every changed Model follows the template and updates `last_changed_by` to the ready minutes. A new Model starts at `model_revision: 1`; an existing Model advances its revision exactly once.
3. Stage the complete rendered terminal set outside the project workspace and validate the DDD root, minutes, Models, Context Map, navigation, and repository-required checks.
4. Re-read every consistency-set pre-state immediately before the first project mutation. Any drift returns `revision_conflict` with zero writes.
5. Apply only the supplied bytes and verify the resulting complete consistency set.

Project files are never an optimistic validation area. Report any failure after the first mutation as `blocked` with the exact partial state.

## Mark EventStorming implemented

Use `mark-event-storming-implemented` only after Guard proves both required axes and every completion gate clear over one unchanged Review Envelope.

Receive the reviewed `ready` minutes paths and fingerprints, Guard's clear completion evidence, the frozen Model and source snapshot identities, the README pre-state, and the exact rendered closure. For each reviewed iteration, preserve every byte except `status: ready -> implemented`; change only its matching README checkbox from `[ ]` to `[x]`. Stage, recheck all pre-states, apply once, and verify both representations agree.

A violation, evidence gap, incomplete worker, snapshot drift, unrelated minutes, or any other status transition returns `blocked` or `revision_conflict` with zero writes. Persist the iteration closure only; keep review findings in Guard's response.

## Canonical Models

Each new or changed `model.md`:

- uses the canonical path and template section order;
- declares `model_revision` and a relative `last_changed_by` link, with no iteration status;
- states current language, authority, Aggregates/core objects, lifecycle, invariants, policies, failure semantics, Hotspots, and dependencies owned by that context;
- supplies enough durable meaning for Codify without prescribing reversible implementation choices; and
- leaves complete iteration diagrams and cross-context scenario flow in the linked EventStorming minutes.

At Aggregate scope, preserve excluded sibling meaning byte-for-byte. A shared Bounded Context change requires Bounded Context scope and integrated confirmation.

## Context Map and documentation closure

The Context Map declares every accepted project Bounded Context exactly once and each upstream-to-downstream model dependency once as `U -> D`. Reject self-loops, reciprocal dependencies, longer cycles, bidirectional arrows, Partnership, Shared Kernel, and mismatched named contracts. A structurally valid but different graph is confirmation drift.

The ready write set may include the README, Context Map, minutes, affected Models, and relevant project-owned Spec, PRD, ADR, and Glossary files. Preserve accepted historical rationale and follow repository ADR policy. Leave unrelated and external documents unchanged.

## Results

Return one of `inspected`, `validated`, `draft_written`, `ready`, `implemented`, `no_change`, `revision_conflict`, or `blocked`, with the paths, revisions, fingerprints, checks, and exact filesystem state needed to verify that result.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for canonical paths and artifact roles.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/context-map.md](../../templates/context-map.md), [../../templates/event-storming.md](../../templates/event-storming.md), and [../../templates/model.md](../../templates/model.md) for validation and rendering.
