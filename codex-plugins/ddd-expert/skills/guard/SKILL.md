---
name: guard
description: Use when reviewing concrete backend implementation changes before merge or release for Design Realization and House-Style Conformance with accepted domain decisions, Tactical Design, and ddd-expert guidance.
---

# Guard

Review concrete implementation evidence through two independent axes: Design Realization and House-Style Conformance. Breadth produces falsifiable hypotheses; depth clears or proves them. A main coordinator owns the Review Envelope, dispatch, synthesis, verification, and routing; it does not perform either complete axis, redesign, or modify project files.

Build or runtime blockers limit executable verification only. Continue independent static review, and never treat compilation failure, passing tests, package names, or absence of suspicious words as model proof.

## Review authority

Guard is read-only. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute only its `inspect` operation in the same run with authority `guard`; never request or perform an apply operation. Report artifact evidence and routing through the review response without persisting findings under `docs/ddd-expert`.

The originating request defines the claimed change scope, not business truth. Each affected context's Model owns business meaning; its revision-matched Design owns tactical obligations; ddd-expert references own implementation defaults; code, tests, and existing conventions are evidence.

Establish before judging code:

1. review mode, exact target, comparison base or explicit snapshot surface, and the behavior claimed complete;
2. affected Bounded Contexts, Context Map relationships, and relevant Model and Design sections;
3. relevant house-style references and any explicit Design choices that override their defaults;
4. changed files and necessary neighboring code, generated artifacts, migrations, configuration, runtime wiring, logs, and verification evidence.

Code and tests never override accepted authority. Missing artifacts block only judgments that need them. A `stale_design` or `pending_design_reconciliation` result is not accepted implementation authority: report the material gap to `shape` while continuing independent conformance review. Route missing or contradictory business authority to `explore`.

An explicit accepted Design choice governs only its stated scope. Vague waiver language and local convention cannot override the Model, Design, or an applicable house-style rule.

Scope narrows applicable responsibilities: an absent layer or surface that the request does not claim is neither a coverage gap nor a violation. Follow adjacent evidence only while it shares the same reason family; never turn a narrow review into an unrequested project-completeness audit.

## Workflow

1. **Frame the review**: choose `change_review` or `snapshot_review`. For a change, pin a resolvable base/target and reusable diff/commit commands; an empty diff does not disprove a claimed missing realization. For a snapshot, name the complete surface being asserted.
2. **Freeze one Review Envelope**: record change intent, scope, affected contexts, artifact paths/revisions/fingerprints, evidence commands, changed-file inventory, and selected reference paths. Pass paths and commands rather than duplicating full files. Recheck the envelope before finalizing.
3. **Launch both axes**: use the host's native agent delegation to launch two independent read-only workers concurrently. Dispatch both initial workers before accepting or awaiting either completion. Label their exact roles `design-realization` and `house-style-conformance`; one worker or attempt cannot serve both roles. They receive the same frozen envelope, run in distinct agent contexts, cannot see each other's observations, and cannot delegate further. The coordinator performs neither complete axis.
4. **Merge candidate families**: after both workers finish, merge related candidates by semantic owner, lifecycle, boundary, state vocabulary, collaboration, Repository/CQRS shape, runtime reachability, or specialized reference surface. One axis being clear never cancels the other's non-clear result.
5. **Deep-check selectively**: axis workers close direct and adjacent evidence that shares the same reason and supplied surface. For every merged family still marked `needs_depth`, launch one bounded falsification worker; combine families only when they require the same evidence and reference surface. Each family is dispatched at most once. Launch independent families concurrently within capacity; never launch one worker per smell or allow recursive fan-out.
6. **Synthesize and verify**: combine duplicate symptoms into the smallest evidence-backed root cause, preserve its `[Realization]`, `[Conformance]`, or `[Both]` provenance, verify reported high-impact evidence, run available executable checks, and route each non-clear result.
7. **Enforce completion**: every scoped obligation and conformance coverage item is clear/not applicable or has a terminal candidate; every hypothesis and depth request is terminal; adjacent evidence is closed; both required axis workers completed; the frozen artifacts did not drift; every reported item cites concrete authority and implementation evidence.

If a required axis worker cannot be launched, fails, or returns unusable output, retry it once with a fresh worker and the same envelope. Each required role therefore has at most two attempts total. If it fails again, stop as an incomplete Guard execution. Do not substitute a main-thread axis, issue `No DDD findings`, infer an axis verdict, or emit an Explore/Shape/Codify route for this execution blocker.

A depth worker must return a terminal `clear`, `violation`, or `evidence_gap`. If it fails, returns unusable output, or returns `needs_depth`, stop as incomplete without redispatching that family. Do not infer a verdict or emit a phase route from this execution blocker.

## Axis contracts

### Design Realization worker

Use the change intent to select only the Model and Design obligations this review claims to deliver. Trace each scoped obligation through its applicable `Domain -> Application -> port -> adapter -> Runtime -> verification` path and assign exactly one state:

- `realized`, `missing_realization`, `partial_realization`, `incorrect_realization`, `unverifiable`, or `not_applicable`.

Proving `missing_realization` requires the scope authority, Design obligation, expected semantic owner or production path, every relevant inspected entrypoint/adapter/registration/configuration/verification surface, and evidence that no alternative realization exists. Missing a searched name is not proof. Semantic behavior outside the change intent is a candidate only when it conflicts with accepted authority or requires new authority.

### House-Style Conformance worker

Classify the diff or snapshot by touched layer and specialized surface. Apply the compact breadth baseline below, plus only the relevant reference sections and explicit Design overrides. Seed `coverage_obligation` and `hypothesis` rows; inspect the nearest sibling flows, states, events, ports, adapters, persistence methods, and runtime registrations that share the same reason. Cheaply falsify what the supplied evidence can settle, and mark expensive cross-layer candidates `needs_depth` rather than expanding scope.

### Worker result

Each required worker returns exactly one JSON object with no surrounding prose:

```json
{
  "axis": "design-realization",
  "status": "completed",
  "coverage": [{"id": "obligation-id", "state": "realized"}],
  "candidates": [],
  "gaps": []
}
```

`axis` must equal the worker's assigned role exactly. Set `status` to `completed` only after every row is worker-terminal: closed directly or explicitly handed to depth. `coverage` must be nonempty, use unique identifiers, and contain only the Design states above or, for Conformance, `clear`, `violation`, `evidence_gap`, `needs_depth`, and `not_applicable`.

Every `candidates` row is an object with `coverage_id`, `state` (`violation` or `needs_depth`), `reason_family`, `authority`, `confirming_evidence`, `disconfirming_evidence`, and `depth_scope`. Citation/evidence fields are arrays of concise path-and-location strings; only disconfirming evidence may be empty. `depth_scope` is a nonempty bounded question for `needs_depth` and `null` for a proven violation. Every `gaps` row is an object with `coverage_id`, `reason_family`, `missing`, `authority`, and nonempty `evidence`; `authority` may be empty only when its absence is the reported gap. Each `coverage_id` must name a row in `coverage`. Missing, partial, or incorrect Design realization maps to a violation candidate; `unverifiable` maps to a gap.

A depth worker uses `depth:<reason-family>` as its axis, the same envelope, and one coverage row whose state is exactly `clear`, `violation`, or `evidence_gap`; it cannot return `needs_depth`. Keep citations, evidence, and detail for clear/not-applicable rows internal. Do not repeat the full envelope, paste clear code, spawn another worker, or recommend edits to DDD artifacts.

## Hypothesis and dispatch discipline

- A smell candidate is innocent until depth evidence proves a violation; seek evidence that clears it as actively as evidence that confirms it.
- Every merged candidate ends `clear`, `violation`, or `evidence_gap`; attach a phase route only to a non-clear result.
- Use a depth worker only when falsification needs a new large reference surface, cross-layer/cross-context tracing, runtime reachability, or credible disconfirming evidence. A direct one-file proof remains in its axis worker.
- Missing, partial, and incorrect realization are violations when accepted authority and completed scope are clear. `unverifiable` is an evidence gap, not a substitute for proven absence.
- A required verification seam that does not exist is missing realization. Existing verification that cannot run is a verification gap.
- When a proven implementation violation itself prevents its verification, include the missing proof in that violation instead of duplicating it as an `evidence_gap`.
- Implementation transaction shape, object splitting, DTO presence, QueryRepository presence, or local convention cannot by themselves prove model correctness.
- Prefer the shared model or boundary cause over listing every mechanical symptom. The coordinator validates findings; it does not repeat either full scan.

## Breadth baseline

Seed one coverage obligation for every touched specialized surface without loading its full reference during breadth:

- **Language/framework**: layer and mechanism;
- **Database**: schema, migration, SQL, mapping, index, constraint, and configuration;
- **Generated/protocol**: generated boundaries and translation ownership;
- **Async/runtime**: events, messages, tasks, schedules, recovery, registration, and lifecycle wiring;
- **Model evidence**: unclear authority, lifecycle, invariant, failure tolerance, language, boundary, or coordination.

| Layer | Expected responsibility signals | Boundary-leak signals |
|---|---|---|
| Domain | Behavior, invariants, lifecycle, policies, Domain Events, Aggregate writes, Repository interfaces | Generated/storage/runtime types, persistence or dispatch mechanics, public mutation, external clients |
| Application | Command/query orchestration, transaction/idempotency boundary, dispatch after persistence, DTO/read mapping | Business state decisions, direct Entity mutation, technical clients, cross-owner transactions, mixed handler roles |
| Infrastructure | Repository/query adapters, mapping, storage/SDK mechanics, publishers | Business decisions, lifecycle admission, independent owners hidden behind one save, raw mechanisms exposed inward |
| Interface | Protocol translation, actor/context extraction, one Application delegation, public outcome mapping | Business workflow, Repository/transaction control, Aggregate mutation, event/task orchestration |
| Runtime | Configuration, composition, registration, process lifecycle, reachable recovery | Business policy, compensation semantics, hidden loops, lifecycle owned inward |

Each applicable sentinel seeds a hypothesis, never a verdict:

- one Aggregate Root owns one lifecycle and invariant boundary;
- one write Repository represents one Aggregate Root plus owned children/value objects; distinct list/report/projection reads use QueryRepository/read facades;
- independent Aggregate Roots do not depend on one transaction for business correctness;
- durable facts govern later admission, terminal closure, and replay;
- execution facts and parent terminal facts use distinct timing and language;
- multi-step external collaboration has named coordination and recovery;
- Domain/Application APIs use domain-owned language;
- production messages, tasks, schedules, reconciliation, and recovery have reachable Runtime ownership.

## Routing and reporting

- Missing or contradictory business facts: `evidence_gap`, route `explore`.
- Missing, stale, or contradictory tactical design: `evidence_gap`, route `shape`.
- Clear authority with missing, partial, or incorrect implementation, or a house-style violation: `violation`, route `codify`.
- Missing runtime, test, or operational proof: report a material verification gap; do not turn an unavailable check into a model claim.

Report only non-clear outcomes, ordered by architectural severity. Prefix each finding with `[Realization]`, `[Conformance]`, or `[Both]`; merge shared root causes rather than pasting worker reports. Cite file/line evidence, impact, root cause, and correction direction, then authority/verification gaps, checks, and residual risk. Assign Blocker/Major/Minor only to violations. Say `No DDD findings` only after both axes and all completion gates are clear.

## References

- Start Conformance breadth with this skill's compact baseline; do not load a language guide or [../../references/ddd-core.md](../../references/ddd-core.md) wholesale.
- During depth, load only the rule owner required by the merged family.
- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for missing model evidence.
- Use [../../references/ddd-core.md](../../references/ddd-core.md) for tactical ownership.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, message, or cross-context evidence.
- For triggered Go code, start with [../../references/ddd-golang.md](../../references/ddd-golang.md), then follow only the layer, flow, or platform leaf that owns the family.
- For triggered Python or TypeScript code, load only the relevant section of [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
- Load [../../references/database.md](../../references/database.md) independently for persistence evidence.
