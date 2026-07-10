---
name: guard
description: Use when reviewing concrete backend implementation changes before merge or release for conformance with accepted domain decisions, Tactical Design, and the ddd-expert house style. Finds evidence-backed model, boundary, persistence, messaging, runtime, and verification issues.
---

# Guard

Review concrete implementation evidence against the accepted DDD model, Tactical Design, and house style. Breadth produces falsifiable hypotheses; depth clears or proves them. Guard reports and routes non-clear outcomes; it does not redesign or modify project files.

Build or runtime blockers limit executable verification only. Continue independent static review, and never treat compilation failure, passing tests, package names, or absence of suspicious words as model proof.

## Review authority

Establish these inputs before judging code:

1. the exact review target, comparison base, and requested scope;
2. the relevant `docs/ddd/model.md` sections for accepted business meaning and context relationships;
3. the relevant `docs/ddd/design.md` sections for accepted tactical choices;
4. the `ddd-expert` house-style sections applicable to touched surfaces;
5. changed files and the necessary neighboring code, generated artifacts, migrations, configuration, runtime wiring, logs, and verification evidence.

Code and tests are observed implementation evidence, not authority over the model or design. Missing DDD artifacts do not stop independently provable static findings; they block only verdicts that depend on the absent facts or decisions.

## Workflow

1. **Establish scope**: confirm the target/base and locate the accepted authority for each touched responsibility. Scope narrows inspection; it does not make absent unrelated layers an evidence gap.
2. **Breadth scan**: inventory touched layers, boundaries, and specialized surfaces. Apply the compact baselines below to seed an internal Review Ledger with `hypothesis` and `coverage_obligation` entries. A baseline signal is never a finding.
3. **Merge families**: group related entries by semantic owner, lifecycle, boundary, state vocabulary, collaboration, Repository/CQRS shape, runtime reachability, or specialized reference surface.
4. **Deep-check**: load only the relevant reference sections. Try to falsify each hypothesis with confirming and disconfirming evidence. Give it `clear`, `violation`, or `evidence_gap`; attach route `explore`, `shape`, or `codify` only when applicable. Clear a coverage obligation as conforming/not applicable, or promote a concrete miss to a hypothesis.
5. **Follow adjacent evidence**: inspect the nearest sibling flows, states, events, ports, adapters, persistence methods, and runtime registrations that share the same reason. Merge and deep-check again whenever a new entry appears; stop only after a complete pass adds nothing.
6. **Synthesize and verify**: combine related symptoms into the smallest evidence-backed root cause. Run available executable verification and record blockers or residual risk without converting them into model claims.
7. **Enforce completion**: every coverage obligation is clear/not applicable or promoted; every hypothesis has a terminal verdict; every adjacent candidate is checked; the ledger is stable; and every reported item cites concrete evidence and the authority it is judged against.

## Hypothesis discipline

- A smell candidate is innocent until depth evidence proves a violation; seek evidence that clears it as actively as evidence that confirms it.
- Missing proof is an evidence gap only when a material applicable responsibility should expose that proof in the reviewed scope.
- Implementation transaction shape, object splitting, DTO presence, QueryRepository presence, or accepted local convention cannot by themselves prove model correctness.
- An explicit accepted design choice governs its exact scope; vague waiver wording does not.
- Prefer the shared model or boundary cause over listing every mechanical symptom.

## Breadth baseline

### Specialized obligations

Seed one coverage obligation for every touched specialized surface without loading its full reference during breadth:

- **Language/framework**: classify changed code by layer and mechanism.
- **Database**: classify schema, migration, SQL, mapping, index, constraint, and persistence configuration against the MySQL 8.0 profile.
- **Generated/protocol**: classify generated boundaries and translation ownership.
- **Async/runtime**: classify events, messages, tasks, schedules, recovery paths, configuration, registration, and lifecycle wiring.
- **Model evidence**: classify unclear authority, lifecycle, invariant, failure tolerance, language, boundary, or coordination as a possible phase return.

### Layer signals

| Layer | Expected responsibility signals | Boundary-leak signals |
|---|---|---|
| Domain | Business behavior, invariants, lifecycle, policies, Domain Events, Aggregate-root writes, semantic Repository interfaces | Generated/storage/runtime types, persistence or dispatch mechanics, public mutation, external clients |
| Application | Command/query orchestration, transaction and idempotency boundary, event dispatch after persistence, DTO/read-model mapping | Business state decisions, direct Entity mutation, technical clients in Domain, cross-owner transactions, mixed handler roles |
| Infrastructure | Repository/query adapters, explicit mapping, storage and SDK mechanics, external adapters, publishers | Business decisions, lifecycle admission, several independent owners disguised as one save, raw mechanisms exposed inward |
| Interface | Protocol translation, actor/context extraction, one delegation, response/error mapping | Business workflow, repository or transaction control, Aggregate mutation, event/task orchestration |
| Runtime | Configuration, module assembly, registration, process lifecycle, reachable recovery paths | Business policy, compensation semantics, hidden process loops, runtime lifecycle owned by Application or Domain |

### Cross-layer sentinels

Each applicable sentinel seeds a hypothesis, never a verdict:

- one Aggregate Root owns one lifecycle and invariant boundary;
- one write Repository represents one Aggregate Root plus owned children/value objects, while product reads use QueryRepository/read facades;
- independent Aggregate Roots do not depend on one transaction for business correctness;
- durable facts govern later command admission, terminal closure, and replay behavior;
- execution facts and parent terminal facts use distinct timing and language;
- multi-step external collaboration has one named coordination and recovery mechanism;
- Domain/Application APIs use domain-owned language rather than protocol, storage, or runtime concepts;
- production messages, tasks, schedules, reconciliation, and recovery have reachable runtime ownership.

## Routing and reporting

- Missing or contradictory business facts: `evidence_gap`, route to `explore`.
- Accepted facts but missing or contradictory tactical design: `evidence_gap`, route to `shape`.
- Implementation violates clear accepted authority or house style: `violation`, route `codify`.
- Missing runtime, test, or operational proof: report the material evidence gap; do not edit code to make the review pass.

Report only non-clear outcomes. Put findings first by architectural severity, with concrete file/line evidence, impact, root cause, and correction direction. Then report material evidence gaps/returns, verification performed or blocked, and residual risk. Omit empty sections and internal ledger rows. Assign Blocker/Major/Minor only to concrete violations; describe an evidence gap by potential impact instead. If none exist, say `No DDD findings` and include only material evidence or verification gaps.

## References

Start with the compact baselines in this skill. Do not load [../../references/ddd-core.md](../../references/ddd-core.md) wholesale before breadth. During depth, load only the relevant tactical section and the specialized section required by an investigating family: [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md) or [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for missing model evidence; the active language guide ([../../references/ddd-golang.md](../../references/ddd-golang.md), [../../references/ddd-python.md](../../references/ddd-python.md), or [../../references/ddd-typescript.md](../../references/ddd-typescript.md)) for triggered code; [../../references/database.md](../../references/database.md) for MySQL 8.0 persistence evidence; and the active language sections for generated, event/message, taskqueue, or runtime evidence.
