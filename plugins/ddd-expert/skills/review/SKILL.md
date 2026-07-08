---
name: review
description: Use when reviewing DDD/backend domain abstractions, specs, plans, or code diffs with concrete files, modules, generated artifacts, runtime wiring, persistence, logging, or boundary evidence to inspect.
---

# Review

Review concrete evidence against the expected model. A review finds evidence-backed issues, return-to-modeling triggers, or evidence gaps; it does not redesign. Build/runtime blockers only block executable verification; Independent static model review still runs. Compile blocker is never a positive model signal; Absence of forbidden nouns is not model proof.

First read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md). For complex lifecycle/repository/event/CQRS scope, also read [../../references/ddd-review-smell-protocol.md](../../references/ddd-review-smell-protocol.md), then load deeper references only for triggered evidence.

## Checklist

1. Reconstruct the expected model from specs, briefs, designs, handoff, code, tests, and runtime evidence.
2. Run breadth first: a thin main-axis scan compares touched code shape against the correct-shape whitelist and emits coarse smell families.
3. Dispatch depth by coarse smell family; each investigator expands one family into sibling methods, flows, states, events, and ports.
4. Merge returned negative/gap decisions and new issue candidates; do not re-review the whole repo in the coordinator.
5. Generate findings from depth decisions; generate no-finding notes only from positive correct-shape evidence.
6. Report verification separately from model review.

## Process Flow

```dot
digraph ddd_review {
  "Expected model" -> "Breadth scan";
  "Breadth scan" -> "Coarse smell families";
  "Coarse smell families" -> "Family-specific depth";
  "Family-specific depth" -> "Sibling smells?";
  "Sibling smells?" -> "Family-specific depth" [label="yes"];
  "Sibling smells?" -> "Depth decisions" [label="no"];
  "Depth decisions" -> "Coordinator merge";
  "Coordinator merge" -> "Judgment report";
  "Judgment report" -> "Verification";
}
```

## Breadth and depth

Breadth is a thin main-axis scan: read the user task, named spec/design/diff seeds, and minimum model evidence needed to identify triggered axes. Breadth emits coarse smell families, not findings and not per-method inventories.

Depth is family-specific investigation, with axes used only as classification tags. Depth expands each coarse smell family into sibling methods, flows, states, events, and ports, then performs full-chain analysis from business fact to owner, reaction/process, failure tolerance, and implementation mechanism. Each depth pass includes a first-principles shape challenge.

Codex and Claude Code review runtimes are expected to have subagent/task capability. Dispatch one subagent per coarse smell family before coordinator depth analysis. If the runtime exposes no subagent tool, treat that as an environment defect and name it in Depth execution instead of silently falling back.

No-finding decisions require positive correct-shape evidence. Do not clear an axis because negative examples were not found; show the observed shape that satisfies the whitelist or report an evidence gap.

The coordinator merges depth results and new issue candidates. A high-severity finding does not stop other triggered smell-family depth tasks. Final output is judgment-oriented; proof packets are working evidence, not the user-facing report.

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

Coverage pass is the breadth/depth orchestration checklist; detailed risk rules live in the risk router and core reference.
For lifecycle/repository/event/CQRS scope, do not start with Findings; start with breadth scan.
Lifecycle/repository/event/CQRS scope tags smell-family depth tasks, not broad-axis delegation or final-output proof dumps.
Axis tags classify smell-family tasks: lifecycle/event timeline/recovery/fact precedence; Repository/API/aggregate ownership; collaboration/process mechanism; parent-state/FSM vocabulary; CQRS read/write split; runtime/wiring/persistence/protocol boundary.
Missing depth results for a triggered smell family become evidence gaps, not positive coverage claims.
Severe findings cannot abbreviate triggered smell-family depth tasks; continue independent depth tasks after Blocker or Critical findings.
Depth investigators expand coarse families into sibling methods, flows, execution facts, parent states, domain events, and read-shaped ports when those siblings share the same whitelist deviation.
No-finding decisions require observed positive shape, not absence of forbidden nouns, DTO/package separation, semantic names, or untriggered grep results.
Finding paragraphs are generated from negative or gap depth decisions.
Final report leads with judgment, not working evidence dumps.
One risk axis cannot clear another risk axis.
First-principles shape challenge: after inventory questions and before admitting any tactical shape, ask: Is this shape genuinely necessary for the business invariant, or compensating for a wrong aggregate/lifecycle boundary? If the answer depends on accepted design, transaction shape, semantic names, DTO/package separation, command sequencing, or local convention without explicit model and failure-tolerance proof, keep the default-deny decision.
Rows cover lifecycle facts, event/recovery, aggregate-boundary candidates, terminal/execution facts, CQRS read/write split, FSM API compatibility and state polymorphism, and state-language semantics.
final output must not duplicate final answer blocks.

## Smell queue review protocol

Use [../../references/ddd-review-smell-protocol.md](../../references/ddd-review-smell-protocol.md) for the detailed smell row schema, investigator contract, and risk-card proof reminders.
Main axis emits a bounded Smell Queue before deep investigation. Main-axis preflight compares touched code shape against the correct-shape whitelist; deviations become smell rows. Breadth emits coarse smell families; depth expands the family and checks sibling shapes. Do not try to enumerate every possible bad smell, and do not write findings in coordinator preflight. Fixed axes are classification tags, not delegation units.
Investigate exactly one smell family per subagent. Subagents must not each perform a full global review.
Dispatch one subagent per coarse smell family. The subagent owns depth for that family, expands sibling methods/flows/states/events/ports, and returns verdicts plus spawned smell families.
A spawned smell is appended to the same Smell Queue and must reach a terminal verdict before final output. Finding paragraphs can only be generated from negative or gap depth decisions.
Never leave the review at a wait/collab wait state after returned smell verdicts exist; emit final output with missing-smell evidence gaps instead.

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

Final answer is concise. Do not print the full working-evidence set by default.
For lifecycle/repository/event/CQRS scope, complete and merge required smell verdicts before the final answer, then cite smell families in findings, evidence gaps, returns, or no-finding notes.
Working evidence stays internal unless it justifies a finding, evidence gap, return, or positive-shape no-finding claim. A missing depth decision becomes an evidence gap, not a positive emitted-row claim.
Expand working-evidence rows only when they justify a finding/evidence gap/return, a no-finding claim, or the user asks.
Smell queue summary is evidence-derived: completed or no-finding tags must cite decisions that appear in findings, evidence gaps, returns, no-finding notes, or selected working evidence.
Wildcard row families such as RC-*, COL-*, or CQ-* are not proof; cite concrete depth decisions or report an evidence gap for that axis.
Do not claim CQRS inventory completed or product-read no-finding unless depth found positive correct-shape evidence for read/write separation.

```text
DDD review:
- Scope/model evidence:
- Axis coverage: Axis | coarse smell families | negative/gap decisions | positive-shape no-finding evidence
- Findings:

Finding: <severity> <axis> <title> [smell family ids]
- Evidence: <file:line>
- Violated guardrail:
- Triage: <violation | return to domain-modeling | return to design | evidence gap>
- Why it matters:
- Fix direction: <model correction | implementation mechanism | evidence needed | test/verification needed>

- Evidence gaps / returns:
- No-finding notes: <only when positive correct-shape evidence was observed>
- Depth execution: <subagents used by smell family; if unavailable, environment defect>
- Verification:
- Residual risk:
- Selected working evidence: <only rows needed to support judgments, gaps, returns, or no-finding notes>
```

No DDD findings: say that directly only after every triggered smell family has positive correct-shape evidence or an explicit evidence gap, then list residual test or evidence gaps. Do not fill a finding template with harmless local style.

Severity is about architectural impact: Blocker for invariant/cross-context/generated/storage/runtime safety breaks; Major for likely boundary drift; Minor for localized maintainability or missing proof; Evidence gap when proof is missing.

Common mistakes: reviewing from grep hits; mixing domain/spec/code axes; treating local naming as a violation; treating modeling-return triggers as satisfied; saying "no issues" without residual test/evidence gaps.
