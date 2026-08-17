---
name: codify
description: Use when house-style backend coding must realize a confirmed EventStorming Model and any required ready Tactical Design, make an unambiguous mechanical change, or repair a Guard finding already covered by accepted authority.
---

# Codify

Realize confirmed business meaning and any accepted collaboration design as working, verified backend code in the `ddd-expert` house style. Codify preserves accepted authority, makes reversible implementation decisions inside its seams, and produces implementation evidence for an independent Guard review.

## Authority

Every DDD artifact is read-only in Codify. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute only its `inspect` operation in the same run with authority `codify`; never request or perform an apply operation. For an EventStorming iteration, require one or more scoped EventStorming minutes with `status: ready` plus their affected canonical Models; a `superseded` record is history and cannot satisfy readiness. Read relevant current BC Architecture when present. When the realization has a Design Delta, also require every required scoped Tactical Design is `ready` and every governing EventStorming link is still `ready`. A Tactical Design with `status: superseded` or a superseded governing link is history, not Codify authority. Route missing or contradictory business meaning, authority, Aggregate, Bounded Context, Aggregate Capability, Required Reaction, or Context Map decisions to `event-storming`; route missing, invalidated, or contradictory collaboration-design or BC Architecture authority to `tactical-design`.

Use this order when inputs disagree:

1. Affected canonical Models own current business meaning; a `legacy_model_ready` remains accepted current authority until a later iteration migrates it.
2. Scoped `ready` EventStorming minutes own this iteration's complete solution and implementation scope without overriding the Models.
3. Relevant accepted PRDs, Specs, ADRs, Glossaries, project documentation, and current BC Architecture own their recorded project or BC-specific decisions.
4. Scoped `ready` Tactical Design owns confirmed transaction, state, concurrency, event, failure/recovery, Interface, and collaboration-design claims for its active delta without overriding higher authority.
5. The `ddd-expert` references own implementation defaults and house-style shape.
6. Existing code, tests, generated artifacts, adopted libraries, and local conventions are compatibility and realization evidence.

An explicit accepted constraint controls its exact scope. Vague waiver language, current transaction shape, package names, or local convention do not override higher authority.

DDD artifacts may be absent for a purely mechanical change whose behavior, semantic owner, and layer are already unambiguous. Do not create DDD documents from Codify. If implementation requires a material business choice or would change the confirmed Model, return to `event-storming` before editing. If it creates or changes Aggregate/context coordination, transaction ownership, state/checkpoint ownership, concurrency control, event publication timing, failure/recovery responsibility, semantic ports, or another durable software boundary not already accepted, return to `tactical-design`. Reversible choices inside accepted seams remain Codify decisions: Repository/CQRS details, package placement, persistence mapping, adapters, runtime wiring, migrations, and verification strategy. Derive them from the authority order, House Style, and repository evidence.

Codify may make those engineering decisions when they stay within accepted project constraints and do not create a new irreversible or external commitment. Do not autonomously choose destructive data/schema change, retention or deletion policy, security/compliance posture, incompatible deployment or public-contract migration, or first adoption of an external platform, paid service, or uncovered technology. When the request and accepted project documents do not authorize such a commitment, stop and name the exact project-authority or ADR decision required. Tactical Design is conditional design authority, not a universal readiness ceremony.

## Workflow

1. **Preflight before edits**: run artifact inspection, then read the scoped request, every scoped EventStorming minutes file, affected canonical Models, relevant current BC Architecture, every active Tactical Design record, accepted project documents, touched code, generated artifacts, migrations, runtime entrypoints, and verification surface. Resolve every material authority conflict before changing files.
2. **Check readiness**: each scoped EventStorming file is `ready`, every linked Model is canonical or `legacy_model_ready`, every present BC Architecture is structurally current, and every required scoped Tactical Design is `ready`; each active iteration README item is unchecked. Route `draft` minutes, missing Models, contradictory business authority, or semantic Context Map repair to `event-storming`. Route an absent, draft, stale, or contradictory required design to `tactical-design`. An `implemented` Tactical Design is provenance, not current authority; follow its source links from current BC Architecture rather than reopening it as a handoff. Proceed without DDD artifacts only for a purely mechanical change whose behavior, semantic owner, layer, and collaboration seam are already unambiguous.
3. **Build one multi-label realization map**: for every confirmed Model capability or Required Reaction, current BC Architecture decision, active Tactical Design claim, request obligation, and required production path, account for its semantic owner, execution owner when applicable, layer/package, abstraction or adapter, adopted library, runtime mechanics, and verification evidence. Labels accumulate rather than compete. For Go, a Runtime/platform label never suppresses an applicable flow label: periodic, polling, and deferred-recovery work also follows the router's taskqueue branch. Load every mapped reference branch. From the same authority and House Rules, start one neutral architecture review unit per atomic responsibility assertion; ownership, a semantic inner contract, its adapter fidelity, and composition remain separate units when they can fail independently, even if they share symbols. The Guard handoff does not mirror the full implementation map.
4. **Reconcile the implementation**: after each edit, map every actual changed file and required path back to the realization map, add newly exposed labels, load their reference branches, and resolve any responsibility or authority conflict before continuing. Map each immutable Tactical Design canonical claim key `<record-path>#TD-NNN` to the changed `path#symbol` entries that realize it in `tactical_claim_map`; Codify must not rewrite a claim or prewrite its verdict. Mechanical bodies, migrations, generated artifacts, configuration values, and verification files remain producer-owned evidence unless they define a claimed seam.
5. **Implement the house style**: preserve business decisions in the semantic owner, invoke intention-revealing Aggregate Capabilities, keep dependencies inward, use adopted abstractions and libraries, isolate generated/storage/runtime types at adapters, and wire every production path required by the Model, ready Tactical Design, and request. Cross-context contracts and imports must preserve the Context Map's acyclic `U -> D` Model Dependency View; runtime request/response direction is not permission for a reverse model import. If realization appears to need a changed Model, route to `event-storming`; if it needs a changed collaboration design, route to `tactical-design`. Do not broaden the change to unrelated legacy conformance.
6. **Run producer conformance**: re-read the final change against every loaded House Rule and the nearest production path that shares its responsibility. Account for every realization-map label as conforming, not applicable, or lacking evidence; repair implementation drift before handoff. Attach a House Rule reference to an architecture review unit only when it governs that unit's seam; keep all other rule accounting in producer evidence. Rule count never creates another Guard unit. This is Codify's own quality control, not an independent review verdict.
7. **Verify implementation evidence**: run the smallest sufficient combination of tests, build/static checks, import inspection, migration dry run, runtime wiring evidence, or smoke checks appropriate to the realization map. Record each command, exit code, concise result, unrun check with its objective reason, and the source fingerprint against which it ran.
8. **Finalize the Review Handoff when Guard is due**: reconcile its neutral architecture review units with the accepted Tactical Design Claims when present, other claimed architecture responsibilities, and DDD-significant declarations or wiring edges added or changed in the final diff. Attach the claim-to-symbol map, replayable complete-snapshot commands, fingerprints, producer-check receipts, and the snapshot-bound producer checkpoint. Completion: the handoff locates the architecture Guard must judge without turning every implementation path into a review obligation or making any review judgment.

## Review Handoff

Maintain this compact index incrementally during implementation so a fresh Guard can spend its attention challenging DDD architecture instead of reconstructing Codify's search history. Pass it by path when the host supports that, and keep it outside `docs/ddd-expert`; it is task evidence, not durable Model authority.

- `claim_sources`: originating request, scoped minutes, affected Models, current BC Architecture, ready Tactical Design records, relevant Context Map, and governing project documents, with exact paths, relevant headings or revisions, and fingerprints;
- `snapshot`: immutable base/target identifiers or an immutable base plus complete staged, unstaged, and untracked manifest fingerprints and replay commands;
- `tactical_claim_map`: each immutable `<record-path>#TD-NNN` canonical claim key mapped to the changed `path#symbol` entries that realize or connect it, without restating or editing the claim;
- `architecture_review_units`: neutral IDs, canonical `authority_refs` such as `<architecture-path>#ARCH-NNN`, optional `house_rule_refs`, one atomic responsibility assertion, and changed `path#symbol` entries that define or connect that architectural seam; put independently falsifiable assertions in separate units even when they share files, while rule count alone never creates another unit;
- `producer_checks`: command, exit code, concise result, source fingerprint, and any check not run with its objective reason.
- `producer_checkpoint`: `complete` only when the Codify completion conditions hold for that snapshot, otherwise `incomplete`.

Do not put `clear`, `violation`, `evidence_gap`, conformance claims, severity, risk labels, suspicions, recommendations, `not applicable`, or Guard-completeness claims in this handoff. Those are Guard judgments. `producer_checkpoint` reports Codify execution status only. The handoff is useful only as reproducible navigation; Guard independently pins the source and searches the finite seeds—accepted Tactical Design Claims and other claimed architecture responsibilities, plus changed DDD-significant declarations or wiring edges—for omitted seams.

## Independent Guard boundary

Codify does not self-certify DDD architecture. Run independent Guard when the requested outcome is to close a `ready` EventStorming iteration, review before merge or release, or obtain an explicit independent review. Also run it when the implementation changes accepted Aggregate or context boundaries, invariants, lifecycle, Domain Events, use-case ownership, semantic ports, Repository/adapter boundaries, Interface responsibility, composition, consistency, or collaboration semantics beyond what local producer conformance can bound confidently.

Routine, reversible, Model-preserving implementation work may finish at a Codify checkpoint after producer conformance and local verification. Default to this checkpoint for an implementation-only request when none of the Guard conditions above applies. State that Guard remains due at the next certification boundary and leave every `ready` iteration open. The later Guard reviews the cumulative change from an immutable base, so deferred small changes remain in its envelope.

When Guard is required, stabilize the complete implementation first, then send the scoped request, Review Handoff path, and either immutable base/target identifiers or an immutable base plus a complete worktree snapshot to a fresh read-only Guard reviewer in a distinct agent context. A worktree snapshot must enumerate staged, unstaged, and untracked paths, fingerprint their contents, and provide replayable inspection commands. Guard independently pins that surface before opening the handoff. Run Guard once over the stable snapshot rather than after each edit.

A Guard violation with accepted authority returns to Codify for a complete repair pass, local producer conformance, verification, and a fresh Guard run over the new stable snapshot. An `event-storming` route stops implementation for an exact Model or business-authority gap; a `tactical-design` route stops it for missing or contradictory collaboration-design authority. Resolve reported structural evidence gaps and rerun Guard when they are locally closable; otherwise follow the owning route or block. A required but incomplete Guard execution or failed iteration closure blocks that certification boundary, not an earlier Codify checkpoint.

## Guard remediation

A Guard finding is evidence, not implementation authority. Before fixing it, compare the current worktree with the confirmed Model, accepted project constraints, and house style:

- if the finding is stale or already fixed, return `no_change` with evidence;
- if accepted authority already defines the correct shape, complete the implementation repair, run producer conformance and local verification, then rerun Guard when the current outcome requires certification;
- if the correction changes business meaning, return to `event-storming`;
- if the correction changes an accepted or missing collaboration design, return to `tactical-design`;
- if the correction changes only reversible engineering realization inside accepted seams, Codify chooses and applies the House Style correction;
- if proof is missing, gather evidence rather than guessing or editing.

## Completion

Codify reaches an implementation checkpoint only when every material realization-map obligation is implemented or shown not applicable, required migrations/generated artifacts/runtime registrations are present, every realization-map label passed producer conformance or has a named evidence gap, and local verification evidence is recorded. When Guard is due, the neutral Review Handoff must reconcile accepted Tactical Design Claims and its architecture review units with the finite seeds and attach the complete source snapshot. Mark its snapshot-bound producer checkpoint `complete` only when these Codify conditions hold. Ready EventStorming and Tactical Design records reach `implemented`, and a merge/release review reaches completion, only after independent Guard is clear over that snapshot and the producer checkpoint is complete. `no_change` is valid only when the requested behavior already exists and the touched scope already conforms.

Codify reports upstream artifact problems only through a `returned` route with concrete evidence. Review conclusions and `violation` / `evidence_gap` verdicts belong to Guard and are not Codify output.

Finish with one of:

- `changed`: summarize code behavior, producer conformance, local verification, and whether Guard cleared the final snapshot or remains due at the named certification boundary.
- `no_change`: cite the evidence that made editing unnecessary.
- `returned`: identify `event-storming` for an exact confirmed-Model/business-authority gap, `tactical-design` for an exact collaboration-design gap, or the missing project-authority/ADR commitment, with the evidence exposing it.
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
