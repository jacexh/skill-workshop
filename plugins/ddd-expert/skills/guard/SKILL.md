---
name: guard
description: Use when independently reviewing concrete backend changes for faithful Model and Tactical Design realization in ddd-expert house style before merge, release, or iteration closure.
---

# Guard

Guard is an independent **semantic-structure review** of a stable backend change. It asks one question: **does the changed architecture express the accepted Model, current BC Architecture, and any scoped Tactical Design in the `ddd-expert` House Style?**

This is not a comprehensive code review, bug hunt, verification campaign, or file-by-file conformance audit. Read implementation code to judge where business meaning and engineering responsibilities live. A concrete logic defect is a Guard finding when it shows that accepted Domain behavior is missing, contradicted, or owned by the wrong abstraction; ordinary adapter, SQL, protocol, provider, performance, or UI defects belong to producer verification and other review tools.

A producer's **Review Handoff** is a navigation index, not authority, coverage proof, or a verdict. Run Guard in one fresh agent context distinct from the implementer, keep it read-only, and do not delegate or create recursive review fan-out.

## Review contract

Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute only its `inspect` operation with authority `guard`. Read the actual content of the artifact set that governs this change:

- the artifact README and scoped `ready` EventStorming minutes;
- every affected canonical Model named by those minutes;
- every relevant current BC Architecture file;
- every scoped `ready` Tactical Design record that governs the implementation;
- the relevant Context Map relationships;
- every governing project document explicitly referenced by that scope, limited to its relevant sections.

The affected canonical Models own current business meaning. Scoped `ready` minutes own this iteration's claimed solution and implementation scope without overriding those Models. Accepted PRDs, Specs, ADRs, Glossaries, project documents, and current BC Architecture decisions own their recorded project or context-specific constraints. Scoped `ready` Tactical Design owns its active collaboration-design claims without overriding those sources; an implemented record is provenance for BC Architecture, not living authority. The `ddd-expert` references own implementation defaults. Code, tests, generated artifacts, runtime configuration, and existing conventions are evidence, not higher authority. A `legacy_model_ready` Model remains accepted current authority during migration.

A missing or contradictory authority produces an `evidence_gap` only for the judgment it prevents; continue reviewing independent architecture units. A `draft` iteration is not implementation authority, whether it is EventStorming or Tactical Design; a `superseded` EventStorming record is correction history, not review authority. A superseded Tactical Design is likewise invalidated history. A `ready` Tactical Design whose governing EventStorming link became superseded is invalidated and routes to Tactical Design before review or closure. An explicit accepted constraint overrides a House Rule only within its stated scope.

An inspected `legacy_capability_projection` remains readable authority while its Model is unchanged. Trace it to Commands in the governing ready minutes; when overlapping state-qualified rows leave the accepted business operation ambiguous, record only the affected unit as an `evidence_gap` routed to EventStorming rather than judging code against accidental row cardinality.

## Review focus

Review every applicable architectural responsibility, but vary depth by what that layer owns rather than changed-path count. No layer is categorically excluded:

`Interface` is the language-neutral responsibility name used by this plugin. A language House Style may give its physical package a language-specific name; Go calls the same layer `transport`. They are not separate layers.

- **Domain is primary**: inspect affected Aggregate Roots, owned Entities and Value Objects, intention-revealing methods, invariants, lifecycle transitions, Repository contracts, and Domain Events. Trace normalized Commands to their accepted capabilities and judge whether the method surface preserves each stable operation without turning pre-state branches into independent business behavior. Judge whether behavior and facts belong to the accepted owner. For an event, review its owner, name, and Domain payload; inspect a consumer contract only when collaboration is itself a frozen review unit.
- **Application is primary**: inspect affected commands, queries, coordinators, transaction ownership, and outbound ports. Judge whether each use case delegates decisions to Domain, supplies current authoritative facts when required, and depends on necessary business capabilities rather than storage, protocol, provider, topology, or SDK mechanisms. Treat Application inspection of Aggregate state to select state-qualified Root operations as an ownership violation when the accepted capability assigns that choice to the Root; do not infer a violation from method count alone.
- **Infrastructure is a structural seam**: inspect affected Repository and port adapters, mapping boundaries, transaction abstractions, and outbound adapters far enough to judge whether they faithfully implement inner contracts, isolate technical mechanisms, and preserve Aggregate ownership. For example, verify that one Root's `Repository.Save` encapsulates owned persistence rather than exposing tables or combining independent Roots. Do not turn this into SQL, provider, locking, or error-branch debugging.
- **Interface is a structural seam**: inspect affected handlers and public mappings for protocol isolation, actor/context extraction, one Application delegation, and semantic outcome translation. The requirement may determine the API shape; Guard judges placement and dependency, not API aesthetics or ordinary endpoint bugs.
- **Runtime is a structural seam when affected**: inspect composition and registration ownership plus dependency direction. This confirms architectural wiring, not operational reachability of an endpoint or job. Do not investigate process health, deployment, environment values, or operational failures.

A changed file is not automatically a review obligation. Group symbols that express one architectural responsibility and review that seam once. Mechanical implementation beneath an already-sound seam is producer-verification evidence, not a reason to read every body or trace every behavior through every layer.

Test bodies and frontend behavior are producer-verification evidence, not a search surface for backend architecture findings. Do not open them merely to discover more behavior or defects; inspect one only when a declaration explicitly included in a frozen architecture unit lives there.

## Review Handoff

Codify maintains this compact index while implementing and passes it by path when possible. It contains only producer claims and reproducible evidence:

- `claim_sources`: originating request, scoped minutes, affected Models, current BC Architecture, scoped ready Tactical Design, relevant Context Map, and governing project documents, with exact paths, relevant headings or revisions, and fingerprints;
- `snapshot`: immutable base/target identifiers or an immutable base plus complete staged, unstaged, and untracked manifest fingerprints and replay commands;
- `tactical_claim_map`: immutable `<record-path>#TD-NNN` canonical claim keys mapped to the changed `path#symbol` entries that realize or connect them; the producer cannot rewrite a claim here;
- `architecture_review_units`: neutral IDs, canonical `authority_refs` such as `<architecture-path>#ARCH-NNN`, optional `house_rule_refs`, one atomic responsibility assertion, and the changed `path#symbol` entries that define or connect that architectural seam; put independently falsifiable assertions in separate units even when they share files, while rule count alone never creates another unit;
- `producer_checks`: command, exit code, concise result, source fingerprint, and any check not run with its objective reason.
- `producer_checkpoint`: `complete` or `incomplete`, bound to the same snapshot fingerprint; this is Codify execution status, not a Guard verdict.

The handoff contains no `clear`, `violation`, `evidence_gap`, conformance claim, severity, risk label, suspicion, recommendation, or Guard-completeness assertion. Keep it outside `docs/ddd-expert`; it is review input, not a DDD artifact. For an arbitrary review with no handoff, build the same compact index after independently pinning the source; an absent producer checkpoint prevents iteration closure but not the structural review.

## Workflow

1. **Pin the source before reading the handoff body**: identify the comparison base and fingerprint the complete staged, unstaged, and untracked target. Use changed names and diff shape to locate affected responsibilities. The full inventory proves source identity; it does not require equal review of every path.
2. **Build a finite, atomic architecture-unit set**: seed source-backed architecture responsibilities from every governing authority that applies to the changed scope—relevant Model capabilities or Required Reactions, current BC Architecture decisions, accepted project constraints, scoped Tactical Design Claims, and the request—plus DDD-significant declarations or wiring edges added or changed in the target diff. This remains two finite seed kinds: governing source assertions and changed structural declarations/wiring. One unit groups the `path#symbol` entries needed to falsify one atomic responsibility assertion across its necessary layers. Do not parse every Mermaid arrow or create a unit per arrow, file, method, layer, mechanism, or rule. If ownership, a semantic inner contract, its adapter fidelity, or composition can be independently conforming or nonconforming, give them separate units even when they share symbols. Ordinary function-body edits, tests, migrations, generated output, configuration values, endpoints, and speculative failure modes do not seed units by themselves.
3. **Audit, trace, then freeze the units**: reproduce the handoff snapshot and compare its sources, immutable claim IDs, claim-to-symbol map, and units with the two seed sources in step 2. Split every compound responsibility into atomic assertions and make an explicit crosswalk from each source-unit assertion, identified by source ID and clause, to exactly one frozen ID. Preserve the union of its authority and House Rule references across the children; an assertion or rule cannot disappear merely because a sibling is clear or violated. Add only omissions directly proven by the two seeds, load the House Rule sections governing the resulting units, reconcile the crosswalk, then freeze IDs before depth. Adjacent evidence may change a frozen unit's judgment but cannot create another unit unless it directly proves that a step-2 seed was omitted. Producer checks are receipts, not tasks to rerun.
4. **Inspect each unit inside-out**: start with its Domain owner and behavior, then Application orchestration and ports, then only the Interface, Infrastructure, collaboration, or Runtime symbols that define or connect the same responsibility. Challenge Aggregate and lifecycle ownership, event meaning, Repository semantics, dependency direction, mechanism isolation, boundary translation, and composition. Review signatures and structural control flow before implementation detail. Judge the semantic shape of an inner contract separately from whether its adapter works; adapter fidelity cannot clear a mechanism-shaped or over-broad inner capability. A violation terminates only its own unit; it cannot stand in for another responsibility sharing the same evidence.
5. **Use question-led implementation depth**: before expanding into an adapter or runtime implementation body, state one concrete, falsifiable architecture question left unresolved by the seam. Inspect the minimum adjacent evidence and stop when answered. Ordinary implementation correctness, API aesthetics, and provider-specific behavior remain out of scope even though their architectural boundary is reviewed.
6. **Consume verification receipts; do not verify again**: match producer checks and checkpoint to the pinned source. Do not run producer tests, builds, migrations, query experiments, environment probes, Docker, live databases, networks, deployment checks, or external services. Static inspection may read the DI or configuration declaration that defines a frozen seam; it must not inspect environment values or probe a running configuration. Missing implementation-correctness evidence is not a Guard gap.
7. **Recheck and report**: recompute source and governing-artifact fingerprints. Completion requires every source assertion to appear in the reconciled crosswalk and every frozen unit ID to have exactly one state: `clear`, `violation`, or `evidence_gap`. Emit a compact table with source unit/assertion, frozen ID, responsibility, and state before merging symptoms with one semantic owner and root cause; clear rows need no evidence detail. A merged correction direction must address every violated unit contributing to that root. Changed files and adjacent evidence are not completion dimensions.

## Judgment

- `violation`: accepted meaning, current BC Architecture, Tactical Design, or structural House Style is clear and its architectural realization is missing, misplaced, contradictory, or leaks a forbidden responsibility. Route to `codify`.
- `evidence_gap`: a material semantic-structure judgment cannot be made because exact authority or the necessary implementation evidence is unavailable. Route to `event-storming` when the missing evidence is business meaning or a semantic boundary decision. Route to `tactical-design` when business meaning is sufficient but collaboration, transaction, state, concurrency, event, failure/recovery, or durable Interface ownership is absent or contradictory. If implementation itself exposes a needed design change, route to `tactical-design`; do not ask Codify to invent it.
- `incomplete`: the source or artifacts drift, or execution stops before every frozen unit receives one terminal state. This is an execution result, not an implementation finding; `evidence_gap` is already a terminal unit state.

Passing tests, package names, DTOs, Repository names, transaction shape, or absence of a searched symbol never prove realization by themselves. Conversely, a missing test, unavailable service, generic implementation suspicion, or possible edge-case bug is not a Guard finding unless it prevents or disproves a named semantic-structure judgment.

Report only non-clear outcomes, ordered by architectural impact. Prefix each with `[Realization]`, `[Conformance]`, or `[Both]`; assign Blocker/Major/Minor only to violations. Cite the governing source, concrete file/line evidence, impact, root cause, and correction direction. List the consumed producer checkpoint and only residual evidence that affects the structural verdict. Say `No DDD structural findings` only after step 7 completes; this does not claim general code correctness.

For a clear reviewed `ready` iteration, request `maintain-artifacts.mark-iteration-implemented` only when the snapshot-bound producer checkpoint is also `complete`. Supply the complete scoped closure and close every reviewed `ready` EventStorming and Tactical Design record together; when no Tactical Design governed the change, preserve the existing EventStorming-only closure. Otherwise report the Guard structural verdict and closure as incomplete without rerunning producer verification. A failed closure does not alter the review verdict.

## References

- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) only for missing Model evidence.
- Start with the relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Repository boundaries, and realization shape.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) only when retained Domain Events or cross-context collaboration are affected.
- For Go, use [../../references/ddd-golang.md](../../references/ddd-golang.md) to route each architecture unit to only the layer or flow sections that own its seam.
- For Python or TypeScript, load only the sections owning each architecture unit from [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
