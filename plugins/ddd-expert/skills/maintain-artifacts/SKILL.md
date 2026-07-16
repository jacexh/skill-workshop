---
name: maintain-artifacts
description: Use when a ddd-expert workflow must internally inspect DDD artifacts, structurally validate an integrated model, or apply documentation synchronized from a user-confirmed Strategic Model.
user-invocable: false
---

# Maintain DDD Artifacts

Act as the artifact executor for `ddd-expert`. Own structure, consistency closure, concurrency checks, and file application. Own no domain decision.

Accept only an explicit caller authority and operation:

- `event-storming` may use `inspect`, `validate-proposed-model`, and `apply-confirmed-model`;
- `codify` and `guard` may use `inspect` only.

Unknown authorities or operations return `blocked` without writing.

## Inspect

Inspect the canonical artifact root plus caller-supplied project evidence. Return paths, exact observed content fingerprints, model/design revisions, links, layout diagnostics, and structural readiness. Never infer business truth from file presence, code shape, or naming.

Recognize:

- `ready_model`: a structurally valid `model_ready` Model;
- `legacy_ready_model`: a readable legacy `shape_ready` Model;
- `legacy_model`: a readable `evolving` or statusless Model without ready authority;
- `legacy_context_map`: a readable retired Context Map that needs confirmed coordinated migration;
- `missing_model`, `missing_design`, `evolving_design`, and `stale_design`;
- `uninitialized`; and
- `invalid_layout` with concrete diagnostics.

Inspection is read-only. A current implementation or legacy artifact is evidence, not permission to preserve its semantics.

## Validate a proposed model

Use `validate-proposed-model` only after EventStorming has completed the ten steps and assembled the exact user-visible integrated model.

Receive the proposed Model EventStorming sections and complete Context Map source when affected. Place them in canonical wrappers under ephemeral scratch outside the project workspace, check them against the Model template and run the installed Context Map structural validator in its strict default mode, report diagnostics, and remove scratch. Keep every project path unchanged. The validator's `--allow-legacy` mode is only for inspecting a retired map or coordinating its confirmed migration; it is never valid for a proposed or confirmed model.

This operation proves only that the displayed diagrams and artifact projections are structurally persistable. It does not judge whether the domain model is reasonable, grant confirmation, prepare companion-document prose, or authorize a write.

## Apply a confirmed model

Use `apply-confirmed-model` only after EventStorming supplies:

- the current integrated model and its explicit user-confirmation evidence;
- the exact confirmed EventStorming and Context Map sources;
- every fully rendered project-owned terminal file in the documentation closure;
- the complete consistency read set; and
- the exact observed pre-state of every existing path in that set.

The user confirms the integrated domain model, not this internal file inventory. EventStorming derives the documentation closure after confirmation. Reject an input that requires the executor to invent a term, rule, boundary, collaboration, lifecycle decision, or document meaning.

Apply with this fail-fast sequence:

1. Verify `authority: event-storming`, explicit confirmation of the current integrated model, canonical paths, and a unique write for each target.
2. Verify every rendered DDD Model contains its exact confirmed EventStorming source and every rendered Context Map contains its exact confirmed collaboration projections.
3. Stage the complete rendered terminal set outside the project workspace and validate the staged DDD root, Models, Context Map, navigation, revisions, and repository-required document checks.
4. Re-read every consistency-set pre-state after staging and immediately before the first project mutation. Any drift returns `revision_conflict` with zero writes.
5. Apply only the supplied bytes, remove only paths that are mechanical consequences of the confirmed model, and verify the resulting complete consistency set.

Project files are never an optimistic validation area. If the filesystem provides a repository lock, compare-and-swap primitive, or atomic directory exchange, use it. Otherwise report the residual race honestly. A failure after the first mutation is `blocked` with the exact partial state; never claim rollback or `model_ready` without proof.

## Canonical Model

Each written `model.md`:

- uses the canonical path and template section order;
- declares `model_status: model_ready` and advances `model_revision` once for this confirmed model;
- contains a complete Mermaid `flowchart LR` under `## EventStorming Model`;
- shows its Bounded Context boundary, connected actor/external-to-Command-to-rule/policy-to-past-tense-Event threads, supported Aggregate boundaries or an evidence-based `No supported Aggregate` conclusion, and non-blocking Hotspots; and
- contains exactly the confirmed EventStorming diagram source for that Model.

At Aggregate scope, preserve excluded sibling meaning and diagrams byte-for-byte. If confirmed meaning changes a sibling or the shared Bounded Context, the caller must expand the modeled scope and obtain a new integrated confirmation.

## Context Map projections

The Global View is a structural projection of confirmed Bounded Contexts and semantic dependencies:

- declare every accepted project Bounded Context exactly once, including isolated contexts;
- draw each upstream-to-downstream model dependency once as `U -> D`;
- reject self-loops, reciprocal dependencies, longer cycles, bidirectional arrows, Partnership, Shared Kernel, and external or technical components presented as project Bounded Contexts; and
- project each named contract consistently into the upstream publisher and downstream consumer sections.

The Interaction View uses the same accepted project Bounded Context nodes and draws runtime/business `initiator -> receiver` exchanges. Interactions may oppose a model dependency or form cycles. They never create, reverse, or duplicate semantic ownership.

The executor validates projection consistency, not semantic truth. A structurally valid but different graph is confirmation drift and invalid apply input.

## Documentation closure

The write set may contain the DDD root README, Context Map, affected Models, and relevant project-owned living Spec, PRD, ADR, and Glossary documents. Include only documents whose claims or vocabulary must change to express the confirmed model, plus mechanically coupled navigation.

- Update living Specs, PRDs, and Glossaries from the confirmed meaning.
- Follow repository ADR policy. Preserve accepted historical rationale and create a superseding ADR when a confirmed decision changes it.
- Leave inspected but semantically accurate sources unchanged.
- Leave external or remote sources outside project writes.
- Keep Tactical Design read-only. A missing, stale, or orphaned `design.md` is reported for a separate tactical workflow; EventStorming never creates, edits, moves, promotes, or deletes it.

A context rename, split, merge, or removal updates root navigation, Context Map, and every affected Model in one consistency closure. Remove an obsolete Model only when its absence is a direct consequence of the confirmed context inventory. Do not remove a directory that still contains retained Tactical Design or unrelated files.

## Legacy Context Map migration

When inspection finds a retired Context Map, discover the complete coordinated legacy set: the map, Models with retired relationship structure, and affected root navigation. EventStorming must present and obtain confirmation for the replacement integrated model before applying it. Migrate the whole coordinated set once; never infer missing dependency direction, interaction, contract, authority, or translation during execution.

## Results

Return one of:

- `changed`: list every changed path, resulting Model revision, diagram equality check, Context Map validation, and documentation checks;
- `no_change`: cite the confirmed model and current bytes proving no write was needed;
- `revision_conflict`: report expected and observed pre-state with zero writes;
- `blocked`: identify the validation, authority, transaction, or post-write failure and exact filesystem state.

Never write EventStorming Board state, implementation progress, review findings, task history, or session status into project artifacts.

## References

- Load [../../templates/artifact-layout.md](../../templates/artifact-layout.md) for canonical paths and artifact roles.
- Load [../../templates/README.md](../../templates/README.md), [../../templates/context-map.md](../../templates/context-map.md), and [../../templates/model.md](../../templates/model.md) for `apply-confirmed-model`.
- Load [../../templates/design.md](../../templates/design.md) only while inspecting existing Tactical Design structure.
