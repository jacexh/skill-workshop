---
name: review
description: Use when reviewing DDD/backend domain abstractions, specs, plans, or code diffs with concrete files, modules, generated artifacts, runtime wiring, persistence, logging, or boundary evidence to inspect.
---

# Review

Review concrete evidence against the expected model. A review finds evidence-backed issues, return-to-modeling triggers, or evidence gaps; it does not redesign. Build/runtime blockers only block executable verification; Independent static model review still runs. Compile blocker is never a positive model signal; Absence of forbidden nouns is not model proof.

First read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md), then load deeper references only for triggered evidence.

## Expected model sources

Reconstruct the expected model before judging code:

- Domain Modeling Brief, user stories, strategic decisions, and out-of-scope rules;
- DDD design, testing seams, and **Implementation handoff**;
- model evidence for authority, lifecycle, invariant owner, failure tolerance, integration language, collaboration model, and coordination kind when those boundaries matter;
- spec/issue/ADR/glossary/CONTEXT;
- changed files, neighboring code, tests, generated artifacts, migrations, config, runtime wiring, logs, and documented deviations.

If the expected bounded context, data authority, invariant owner, model evidence, layer owner, or local convention cannot be reconstructed, report an evidence gap instead of inventing a model.

## Evidence gate

Before findings:

1. Confirm concrete evidence exists: diff, plan, files, paths, imports, tests, generated artifacts, schema/config/runtime/log evidence, or written deviation.
2. Start from business facts before code shape: Business fact timeline: command -> past-tense fact -> invariant owner -> reaction/process -> consistency/failure tolerance -> repository mechanism. Irreversible fact precedence: durable succeeded/accepted/completed/executed facts outrank open workflow states; delayed projection/reaction is not a retry/cancel window.
3. Classify touched surfaces from evidence: domain abstraction, spec behavior, generated/protocol boundary, persistence, runtime/config, messages/tasks, logging, external adapter, or repo-specific surface.
4. Use the risk router and local convention to choose required proof. The examples are a router, not an inventory.
5. For lifecycle, Repository, or event/reaction risks, require Event Timeline Reconciliation, Recovery reachability proof, terminal lifecycle facts and execution facts separation, and a candidate classification table before Rules Satisfied.
6. Decide each candidate as `Rules Satisfied / Not Applicable / Return to domain-modeling / Return to design / Evidence gap`. Return to domain-modeling cannot be classified as Rules Satisfied.
7. Evidence gap, not finding: missing proof stays a gap unless concrete evidence shows a violation.

## Coverage pass

Coverage pass is the orchestration checklist; detailed risk rules live in the risk router and core reference.
For lifecycle/repository/event/CQRS scope, do not start with Findings.
First emit the exact lifecycle sections from the output contract, including Output completion gate and Checked row admission control.
Lifecycle/repository/event/CQRS scope is a final-output gate, not only a checked/Rules Satisfied gate.
Mandatory-axis completion preflight: final findings are prohibited until every triggered lifecycle, repository/API, collaboration, parent-state, terminal/execution, recovery, event-timeline, and CQRS axis has an emitted ledger.
A mandatory axis may not be omitted. Absence of a ledger becomes a missing-axis evidence-gap ledger. Missing axis ledgers block same-scope positive claims, not final artifact emission.
Severe findings cannot abbreviate mandatory axes; continue inventories after Blocker or Critical findings.
One-row or grouped mandatory sections are incomplete when multiple seeds exist; split rows that cover multiple methods, flows, execution facts, states, ports, commands, or owners.
Inventory seeds: lifecycle flows, repository/API methods, collaboration trigger facts, terminal execution facts, parent state vocabulary, domain event names, and read-shaped write-side methods/shared adapters.
Mandatory proof sections are table-backed gates; prose-only sections, coverage summaries, or broad checked-flow summaries do not count.
Every mandatory proof row needs a stable row id and every checked row must appear in Checked row admission control with the same row id.
Output completion gate marks a section non-empty only when table rows exist and must appear before any checked decision.
Finding paragraphs are generated only from completed inventory rows; pre-written findings cannot replace inventory rows.
Residual positive claims are forbidden when any triggered axis ledger is missing, incomplete, grouped, or skipped.
Forbidden final decisions: scoped OK, no issue found, product reads separated, accepted by design, names look correct, used by commands.
Parallel risk-axis review: run shape-sentinel, lifecycle-spec, and evidence-admission axes independently. One risk axis cannot clear another risk axis.
First-principles shape challenge: after inventory questions and before admitting any tactical shape, ask: Is this shape genuinely necessary for the business invariant, or compensating for a wrong aggregate/lifecycle boundary? If the answer depends on accepted design, transaction shape, semantic names, DTO/package separation, command sequencing, or local convention without explicit model and failure-tolerance proof, keep the default-deny decision.
Rows cover lifecycle facts, event/recovery, aggregate-boundary candidates, terminal/execution facts, CQRS read/write split, FSM API compatibility and state polymorphism, and state-language semantics.
final output must not duplicate final answer blocks.

## Axis subagent review protocol

Main-axis quick scan: preflight reads only the task, spec/design/diff list, and minimal model evidence needed to identify triggered axes. Preflight identifies triggered axes only; do not deep-review or write findings in coordinator preflight.
When two or more mandatory lifecycle/repository/event/CQRS axes are triggered, the coordinator must use non-waiting axis delegation or bounded local axis ledgers before final output.
Use one subagent per triggered heavy axis only when the runtime can return ledgers without wait/collab wait: Repository/API candidate classification; lifecycle/event/recovery/terminal-execution; collaboration/process mechanism; parent-state/FSM language; CQRS/read-shaped write-side methods.
Do not call asynchronous subagents or collaboration tools when their only collection path is wait/collab wait.
If non-waiting subagent collection is unavailable, skip delegation and complete bounded local axis ledgers in the coordinator.
Local fallback ledgers are not shorthand; each triggered fallback axis must emit the same row-local tables required of subagents.
A bounded local ledger may not use one grouped row for multiple repository methods, collaboration flows, terminal facts, parent states, commands, or CQRS methods.
If local fallback cannot complete row-level CQRS inventory, decision is evidence gap, not no branch finding.
Local fallback stale-command matrix enumerates each later command after durable fact: cancel, retry/start, new payment, reopen, execution, and closure.
Local fallback collaboration ledger enumerates delivery, refund, dispute, settlement, split closure, and payment recovery mechanisms independently.
payment_pending must be classified as an open/stale parent state when durable child or payment facts can outrank it.
Split refund/settlement terminal rows must decide whether terminal agreement facts or events occur before both execution facts and aggregate closure complete.
Repository/API local fallback rows must be one row per semantic method; examples such as SaveDeliveryRejection or SaveDisputeResolutionAuthorization do not cover the family.
Collaboration local fallback rows must be one row per lifecycle flow, not inherited from repository or recovery findings.
A CQRS axis summary may not say no finding, no branch finding, or inventory-only unless visible method-level CQ rows are emitted.
Subagents must not each perform a full global review; each receives one axis, relevant source seeds, required ledger columns, and a bounded output contract.
Each subagent receives the expected model sources, scope trigger evidence, relevant code seeds, and required ledger columns for its axis.
Each subagent returns inventory rows and negative decisions only, not the final overall conclusion.
Coordinator merges returned ledgers; it does not restart full-repository review or let one high-salience issue truncate other axes.
Delegation has a single bounded collection pass: after dispatching triggered axis reviews, merge returned ledgers once; do not wait indefinitely for missing subagent responses.
Subagent delegation is fire-and-collect, not open-ended collaboration.
Do not send wait/collab-wait progress messages while expecting subagent ledgers.
After any axis ledger returns, finalize with returned ledgers plus bounded local ledgers or missing-axis evidence-gap ledgers for all remaining axes.
A delegated axis that has not returned becomes a missing-axis evidence-gap ledger with reviewer `subagent-missing`, trigger evidence, and blocked positive claims.
If a delegated axis has no returned ledger at finalization time, the coordinator must either fill a bounded local ledger from already-read evidence or emit a missing-axis evidence-gap ledger.
The coordinator may not emit final Finding paragraphs, Rules Satisfied entries, no-finding claims, or residual-risk summaries until every delegated axis is represented by a returned ledger or a missing-axis evidence-gap ledger in the Mandatory axis trigger ledger, Axis subagent ledger, and Negative decision inventory.
Never leave the review at a wait/collab wait state after returned ledgers exist; emit final output with missing-axis evidence gaps instead.
A finding from one subagent cannot close or waive another axis.
If a subagent call fails, record that axis as an evidence gap, block same-scope positive claims, and continue merging the completed axes.

Post-review calibration: when the user provides a known issue or scoring set after the initial conclusion, compare it to the original output, reflect why the original review missed or shallowly found each item, and convert repeated misses into generic review rules, risk-router updates, or eval assertions. Do not stop after the first Blocker if other independent flows are in scope; report Independent modeling findings separately from executable verification gaps.

## Default-first key concept check

Tactical drift reading: when structures look awkward, treat them as upstream model pressure before suggesting cleanup. For Aggregate, Repository, Domain Event, Integration Message, Application Port, CQRS read, Bounded Context, and FSM state, state the default rule before local convention. semantic repository methods are evidence, not proof: Aggregate Boundary Conflict returns to `domain-modeling`; implementation transaction shape is not model evidence. Return routing: domain-modeling for aggregate boundary/lifecycle/invariant/fact/BC uncertainty; design for accepted-model placement/CQRS/port/adapter/repository API shape. Accepted design is evidence, not waiver. transaction-shaped evidence cannot satisfy Repository design: never list semantic repository transaction, lifecycle transaction, or cross-table transaction under Rules Satisfied. Rules Satisfied is scoped to one rule; it must not cover aggregate boundary or event-collaboration risk in the same flow. Local convention is evidence to inspect, not a waiver.

## Review axes

Keep axes separate:

- **Domain Abstraction** — terms, identity, lifecycle, invariants, aggregate/policy/service/read-model boundary, events/messages, bounded-context ownership.
- **Spec/Behavior** — user stories, state transitions, exceptions, and out-of-scope behavior versus the plan or diff.
- **Code-level DDD/technology** — dependency direction, generated/protocol isolation, persistence mapping, runtime/config, logging, tests, and local technology rules.

Report each finding under one primary axis. Mention secondary impact only when it changes severity.

## Fix direction ordering

Do not reduce finding count to make every finding fully templated. Every finding needs evidence, guardrail, triage, and impact; follow-up fields are selected by finding type.

- **Model correction** — only for lifecycle, consistency, event-fact, or
  coordination findings; name the invariant owner, lifecycle owner, aggregate
  boundary, failure tolerance, or event fact before mechanisms.
- **Implementation mechanism** — repository, transaction, handler, event, task,
  reconciler, or test mechanism that implements the accepted model.
- **Evidence needed** — for evidence gaps.
- **Test / verification needed** — for missing or insufficient proof.

Do not present repository, port, or transaction shape as a peer alternative to
resolving model ownership.

## Output

Final answer is concise. Do not print the full ledger set by default.
For lifecycle/repository/event/CQRS scope, complete and merge required ledgers before the final answer, then cite row ids in the summary and findings.
Expand ledger rows only when they justify a finding/evidence gap/return, a no-finding claim, or the user asks.
Axis completion summary is evidence-derived: completed or no-finding axes must cite visible row ids whose decisions appear in findings, evidence gaps, returns, not-applicable rows, or the ledger appendix.
Wildcard row families such as RC-*, COL-*, or CQ-* are not proof; cite the concrete rows or report an evidence gap for that axis.
Do not claim CQRS inventory completed or product-read no-finding unless the final artifact shows method-level read-shaped write-side rows and decisions.

```text
DDD review:
- Scope/model evidence:
- Axis completion summary: Axis | Reviewer/subagent | Trigger evidence | Rows | Negative rows | Decision | Row ids
- Findings:

Finding: <severity> <axis> <title> [row ids]
- Evidence: <file:line>
- Violated guardrail:
- Triage: <violation | return to domain-modeling | return to design | harmless local style | evidence gap>
- Why it matters:
- Fix direction: <model correction | implementation mechanism | evidence needed | test/verification needed>

- Evidence gaps / returns:
- Verification:
- Residual risk:
- Ledger appendix: <omit unless needed/requested; include row ids and rows for disputed, negative, or checked claims>
```

No DDD findings: say that directly only after axis completion summary shows required ledgers completed, then list residual test or evidence gaps. Do not fill a finding template with harmless local style.

Severity is about architectural impact: Blocker for invariant/cross-context/generated/storage/runtime safety breaks; Major for likely boundary drift; Minor for localized maintainability or missing proof; Evidence gap when proof is missing.

Common mistakes: reviewing from grep hits; mixing domain/spec/code axes; treating local naming as a violation; treating modeling-return triggers as satisfied; saying "no issues" without residual test/evidence gaps.
