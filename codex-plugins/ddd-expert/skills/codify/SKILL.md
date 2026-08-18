---
name: codify
description: Use when house-style backend coding must realize confirmed business meaning, reversibly test a scoped Tactical Design draft, make an unambiguous mechanical change, or repair a Guard finding already covered by accepted authority.
---

# Codify

Realize confirmed business meaning as working backend code and use implementation evidence to test tactical candidates. Codify preserves business authority, deletes unsupported mechanisms rather than renaming them, and never silently turns code into design authority.

## Authority

Every DDD artifact is read-only in Codify. Load this plugin's internal `maintain-artifacts` skill and execute only `inspect` with authority `codify`. Require scoped `ready` EventStorming minutes and their canonical Models for DDD work.

Use one of two modes when a Design Delta exists:

- **exploration**: a structurally valid Tactical Design `draft`, explicit implementation authorization, and a reversible scope may guide code changes. The draft is a candidate, not authority. Do not perform irreversible external actions, project BC Architecture, claim final conformance, or invoke Guard. Return implementation evidence to Tactical Design for reconciliation.
- **final realization**: the reconciled Tactical Design is `ready` and all governing EventStorming links remain `ready`. Codify may finish conformance, verification, and the Guard handoff.

A superseded record or superseded governing link is history. Route missing or contradictory business meaning, Bounded Context, Aggregate, capability, or core-object decomposition to EventStorming because the canonical Model owns that strategic structure. Route a missing tactical candidate, an alternative class/collaboration/state design that preserves the strategic structure, or a contradictory BC Architecture decision to Tactical Design.

Use this order when inputs disagree:

1. Affected canonical Models own confirmed business meaning and the current falsifiable structural model; a `legacy_model_ready` remains accepted current authority until a later iteration migrates it.
2. Scoped `ready` EventStorming minutes own this iteration's confirmed facts, reviewed structural candidate, and implementation scope without making that structure infallible.
3. Relevant accepted PRDs, Specs, ADRs, Glossaries, project documentation, and current BC Architecture own their recorded project or BC-specific decisions.
4. Scoped `ready` Tactical Design owns reconciled transaction, state, concurrency, event, failure/recovery, Interface, and collaboration-design claims for its active delta without overriding higher authority. A `draft` is evidence only.
5. The `ddd-expert` references own conditional realization rules, never scenario-specific design decisions.
6. Existing code, tests, generated artifacts, adopted libraries, and local conventions are compatibility and realization evidence.

An explicit accepted constraint controls its exact scope. Vague waiver language, current transaction shape, package names, or local convention do not override higher authority.

An inspected `legacy_capability_projection` remains readable authority while its Model is unchanged. Trace its capabilities back to Commands in the governing ready minutes. Proceed only when that mapping and operation ownership are unambiguous; route overlapping state-qualified rows or missing source intent to `event-storming` rather than implementing the legacy row count as a method count.

DDD artifacts may be absent for a purely mechanical change whose behavior, semantic owner, and layer are unambiguous. Do not create or edit DDD documents. A material business contradiction or evidence against Model-owned Bounded Context, Aggregate, capability, or core-object structure stops editing and returns to EventStorming. In final-realization mode, a changed class, collaboration, or state design that preserves that strategic structure returns to Tactical Design. In exploration mode, Codify may implement the smallest reversible tactical alternative that preserves confirmed business facts and strategic structure, then record why it better explains the normal flow and which draft mechanism became obsolete. Repository/CQRS details, package placement, persistence mapping, adapters, runtime wiring, migrations, and verification strategy remain Codify choices only inside the selected design.

For every DDD-backed implementation, including the direct EventStorming-to-Codify path, build a temporary scoped `model_projection_map` using `ddd-core`'s Model-to-code Projection. Include each implementation-shaping Model concept or relationship in scope, its canonical artifact path and section plus accepted name or relationship, and the software responsibility and proposed or actual `path#symbol` entries that realize or connect it. Keep the map many-to-many and semantic: it is not a class, handler, or method inventory. Record an analytical Workshop Event as requiring no production projection unless the Model separately selected stronger semantics. Keep this task evidence outside DDD artifacts and code.

Codify may make those engineering decisions when they stay within accepted project constraints and do not create a new irreversible or external commitment. Do not autonomously choose destructive data/schema change, retention or deletion policy, security/compliance posture, incompatible deployment or public-contract migration, or first adoption of an external platform, paid service, or uncovered technology. When the request and accepted project documents do not authorize such a commitment, stop and name the exact project-authority or ADR decision required. Tactical Design is conditional design authority, not a universal readiness ceremony.

## Workflow

1. **Preflight before edits**: inspect artifacts and choose `exploration` or `final realization`. Read the scoped request, governing facts, current Models, active Tactical Design candidate, accepted project decisions, touched production paths, and verification surface. Do not load unrelated reference branches or historical discussion.
2. **Check the boundary**: EventStorming authority must be `ready`. Final realization requires every active Tactical Design to be `ready`. Exploration requires one coherent `draft`, explicit user implementation authority, a named reversible write set, and no irreversible migration or external mutation. An implemented design is provenance, not a current handoff.
3. **Build one multi-label realization map**: start the `model_projection_map` with every scoped Role- or external-authority-to-Command permission, Command-to-Capability or explicit-coordination thread, selected Domain Event, Published Fact Contract, event-triggered Command, and affected Aggregate/core-object boundary. Then map current BC Architecture decisions, active Tactical Design claims, request obligations, and required production paths to their semantic owner, execution owner when applicable, layer/package, abstraction or adapter, adopted library, runtime mechanics, and verification evidence. Preserve the distinct Domain Event -> producer translation -> Integration Message -> consumer translation -> event-triggered Command chain when it applies. Do not derive a method inventory from scenario branches or treat each capability as an exact method count. Labels accumulate rather than compete. For Go, a Runtime/platform label never suppresses an applicable flow label: periodic, polling, and deferred-recovery work also follows the router's taskqueue branch. Load every mapped reference branch. From the same authority and House Rules, start one neutral architecture review unit per atomic responsibility assertion; ownership, a semantic inner contract, its adapter fidelity, and composition remain separate units when they can fail independently, even if they share symbols. Review units do not mirror the full projection map.
4. **Reconcile the implementation**: map changed production symbols back to business meaning and the current object/state thesis. Record `design_evidence`: what the implementation confirmed, what it simplified or falsified, every introduced Domain concept and its supporting fact, every obsolete semantic responsibility actually deleted, and each deviation from the draft. Compare responsibilities, not names, so renaming an obsolete mechanism does not count as deletion. In final mode, also map immutable claim keys to their realizing `path#symbol` evidence.
5. **Implement the house style**: preserve business decisions and sequencing in their semantic owner, keep dependencies inward, and isolate generated, storage, provider, and runtime types at adapters. Apply only House Rules whose lifecycle and design conditions are established. Do not preserve a draft participant, event, checkpoint, or recovery mechanism merely because the artifact named it. Do not broaden the change to unrelated legacy conformance.
6. **Run producer conformance**: re-read the final change against every loaded House Rule and the nearest production path that shares its responsibility. Account for every realization-map label as conforming, not applicable, or lacking evidence; repair implementation drift before handoff. Attach a House Rule reference to an architecture review unit only when it governs that unit's seam; keep all other rule accounting in producer evidence. Rule count never creates another Guard unit. This is Codify's own quality control, not an independent review verdict.
7. **Verify implementation evidence**: run the smallest sufficient combination of tests, build/static checks, import inspection, migration dry run, runtime wiring evidence, or smoke checks appropriate to the realization map. Record each command, exit code, concise result, unrun check with its objective reason, and the source fingerprint against which it ran.
8. **Close the current mode**: exploration stops with `design_evidence`, changed paths, checks, and a route to Tactical Design; its producer checkpoint remains `incomplete`. Final realization builds the neutral Review Handoff from the reconciled ready claims, projection, stable snapshot, and verification receipts.

## Review Handoff

Maintain this compact index incrementally during implementation so a fresh Guard can spend its attention challenging DDD architecture instead of reconstructing Codify's search history. Pass it by path when the host supports that, and keep it outside `docs/ddd-expert`; it is task evidence, not durable Model authority.

- `claim_sources`: originating request, scoped minutes, affected Models, current BC Architecture, ready Tactical Design records, relevant Context Map, and governing project documents, with exact paths, relevant headings or revisions, and fingerprints;
- `snapshot`: immutable base/target identifiers or an immutable base plus complete staged, unstaged, and untracked manifest fingerprints and replay commands;
- `model_projection_map`: each scoped implementation-shaping Model concept or relationship, identified by canonical artifact path, section, and accepted name or relationship, mapped many-to-many to its software responsibility and actual `path#symbol` evidence; explicitly mark an analytical Workshop Event as having no production projection when relevant;
- `tactical_claim_map`: each immutable `<record-path>#TD-NNN` canonical claim key mapped to the changed `path#symbol` entries that realize or connect it, without restating or editing the claim;
- `architecture_review_units`: neutral IDs, canonical `authority_refs` such as `<architecture-path>#ARCH-NNN`, optional `house_rule_refs`, one atomic responsibility assertion, and changed `path#symbol` entries that define or connect that architectural seam; put independently falsifiable assertions in separate units even when they share files, while rule count alone never creates another unit;
- `producer_checks`: command, exit code, concise result, source fingerprint, and any check not run with its objective reason.
- `design_evidence`: the explored or final domain-object responsibilities and state authority, introduced concepts with supporting facts, deleted semantic mechanisms, and any draft-to-code deviation requiring Tactical Design reconciliation;
- `producer_checkpoint`: `complete` only when the Codify completion conditions hold for that snapshot, otherwise `incomplete`.

Do not put `clear`, `violation`, `evidence_gap`, conformance claims, severity, risk labels, suspicions, recommendations, `not applicable`, or Guard-completeness claims in this handoff. Those are Guard judgments. `producer_checkpoint` reports Codify execution status only. The handoff is useful only as reproducible navigation; Guard independently reconstructs the scoped Model projection, pins the source, and searches the finite seeds—accepted Tactical Design Claims and other claimed architecture responsibilities, plus changed DDD-significant declarations or wiring edges—for omissions. It never treats the producer map as authority or creates a review unit per entry.

## Independent Guard boundary

Codify does not self-certify DDD architecture. Never run Guard against a Tactical Design `draft` or an unreconciled deviation. After Tactical Design makes the final candidate `ready`, run independent Guard when the requested outcome is iteration closure, merge/release review, or explicit certification.

Routine, reversible, Model-preserving implementation work may finish at a Codify checkpoint after producer conformance and local verification. Default to this checkpoint for an implementation-only request when none of the Guard conditions above applies. State that Guard remains due at the next certification boundary and leave every `ready` iteration open. The later Guard reviews the cumulative change from an immutable base, so deferred small changes remain in its envelope.

When Guard is required, stabilize the complete implementation first, then send the scoped request, Review Handoff path, and either immutable base/target identifiers or an immutable base plus a complete worktree snapshot to a fresh read-only Guard reviewer in a distinct agent context. A worktree snapshot must enumerate staged, unstaged, and untracked paths, fingerprint their contents, and provide replayable inspection commands. Guard independently pins that surface before opening the handoff. Run Guard once over the stable snapshot rather than after each edit.

A Guard violation with accepted authority returns to Codify for a complete repair pass, local producer conformance, verification, and a fresh Guard run over the new stable snapshot. An `event-storming` route stops implementation for an exact Model or business-authority gap; a `tactical-design` route stops it for missing or contradictory collaboration-design authority. Resolve reported structural evidence gaps and rerun Guard when they are locally closable; otherwise follow the owning route or block. A required but incomplete Guard execution or failed iteration closure blocks that certification boundary, not an earlier Codify checkpoint.

## Guard remediation

A Guard finding is evidence, not implementation authority. Before fixing it, compare the current worktree with the confirmed Model, accepted project constraints, and house style:

- if the finding is stale or already fixed, return `no_change` with evidence;
- if accepted authority already defines the correct shape, complete the implementation repair, run producer conformance and local verification, then rerun Guard when the current outcome requires certification;
- if the correction changes business meaning or Model-owned Bounded Context, Aggregate, capability, or core-object structure, return to `event-storming`;
- if the correction changes an accepted or missing class, collaboration, or state design while preserving that strategic structure, return to `tactical-design`;
- if the correction changes only reversible engineering realization inside accepted seams, Codify chooses and applies the House Style correction;
- if proof is missing, gather evidence rather than guessing or editing.

## Completion

An exploration checkpoint is deliberately incomplete: code and checks exist, but `design_evidence` must return to Tactical Design. A final implementation checkpoint requires reconciled `ready` authority, implemented Model obligations, producer conformance, verification evidence, and a stable snapshot. Iteration closure still requires independent Guard over that snapshot. `no_change` is valid only when the requested behavior already exists and the scoped realization already conforms.

Codify reports upstream artifact problems only through a `returned` route with concrete evidence. Review conclusions and `violation` / `evidence_gap` verdicts belong to Guard and are not Codify output.

Finish with one of:

- `changed`: summarize code behavior, producer conformance, local verification, and whether Guard cleared the final snapshot or remains due at the named certification boundary.
- `explored`: summarize reversible code evidence, supported and deleted concepts, checks, and the exact Tactical Design reconciliation required; do not claim Guard readiness.
- `no_change`: cite the evidence that made editing unnecessary.
- `returned`: identify `event-storming` for an exact business-authority or Model-owned strategic-structure gap, `tactical-design` for an exact tactical design gap that preserves that structure, or the missing project-authority/ADR commitment, with the evidence exposing it.
- `blocked`: identify the external execution constraint, unrun local verification, or incomplete Guard execution when the current outcome requires certification.

Keep the final response focused on changed files, verification, and residual risk.

## References

- After surface classification, load the smallest relevant sections.
- Infer the active language from the accepted choice and touched files. Use Go House Style only when the backend language remains open.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the router leaves for touched Domain, Application, Transport, CQRS, Infrastructure, events/messages, taskqueue, Runtime, scaffold, or generated-code surfaces.
- For Python or TypeScript, load only the sections for touched surfaces from the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load the relevant section of [../../references/ddd-core.md](../../references/ddd-core.md) when domain ownership or realization shape must be checked.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, message, or cross-context work.
- Load [../../references/database.md](../../references/database.md) for schema, migration, index, SQL, or persistence work.
