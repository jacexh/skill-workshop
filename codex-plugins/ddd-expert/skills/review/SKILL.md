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

For lifecycle designs, final output must include these sections before broad conclusions: Candidate ledger:, Per-flow Event Timeline Reconciliation:, Recovery reachability table:, Mandatory coverage matrix:. If lifecycle scope is present, these sections are required even when findings already exist. A compile/build blocker cannot remove any mandatory review section. Do not compress mandatory sections into Checked flows. Rows cover lifecycle facts, event/recovery, aggregate-boundary candidates, terminal/execution facts, CQRS read/write split, FSM API compatibility and state polymorphism, and state-language semantics. Mark each row as `checked`, `finding`, `evidence gap`, `return`, or `not applicable`; Checked means evidence-backed. Checked rows must name evidence, the exact rule satisfied, and why the risk is not a finding; every probed risk must end as one decision. Unproven owned-child classification cannot be checked. No positive model-alignment conclusion until every mandatory coverage row is classified; final output must not duplicate final answer blocks.
Counterfactual defect hunt: Draft findings are not final. Before final output,
try to prove each checked, no-finding, or Rules Satisfied conclusion wrong.
Ask `What evidence would falsify this checked row?` Gateway questions: hidden stale-state command rights after durable facts; hidden owner proof behind
Repository/API transactions; missing reaction/recovery path after facts;
child-process language posing as aggregate lifecycle; hidden read/write semantic blending.
No checked or no-finding row is final without a falsifier question and inspected evidence;
if uninspected, classify as finding, evidence gap, or return route.
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

Lead with findings. Keep small reviews small.

```text
DDD review:
- Expected model sources:
- Evidence gate:
- Checked flows:
- Candidate ledger: Candidate | Decision | Evidence | Rule satisfied | Why not finding / Gap / Return; Candidate | Role | Owner proof | Repository/API evidence | Decision | Return route
- Per-flow Event Timeline Reconciliation: Flow | Fact | Event/process/reconciler owner | Recovery/failure behavior | Decision
- Recovery reachability table: Fact | Recovery trigger | Production entrypoint | Guard after durable fact | Decision
- Mandatory coverage matrix: Coverage row | Decision | Evidence | Rule satisfied | Why not finding / Gap / Return
- Counterfactual defect hunt: Checked row | Falsifier question | Evidence inspected | Decision
- Rules Satisfied / Not Applicable / Return to domain-modeling / Return to design / Evidence gap:

Finding: <severity> <axis> <title>
- Evidence: <file:line>
- Violated guardrail:
- Triage: <violation | return to domain-modeling | return to design | harmless local style | evidence gap>
- Why it matters:
- Model correction: <only for model-affecting findings>
- Implementation mechanism: <when implementation placement is relevant>
- Evidence needed: <for evidence gaps>
- Test / verification needed: <for proof gaps>
```

No DDD findings: say that directly only after coverage classification, then list residual test or evidence gaps. Do not fill a finding template with harmless local style.

Severity is about architectural impact: Blocker for invariant/cross-context/generated/storage/runtime safety breaks; Major for likely boundary drift; Minor for localized maintainability or missing proof; Evidence gap when proof is missing.

Common mistakes: reviewing from grep hits; mixing domain/spec/code axes; treating local naming as a violation; treating modeling-return triggers as satisfied; saying "no issues" without residual test/evidence gaps.
