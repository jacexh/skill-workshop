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

Lifecycle exact-section preamble: For lifecycle/repository/event/CQRS scope, do not start with Findings.
First emit the exact lifecycle sections from the output contract, including Output completion gate and Checked row admission control.
Checked Flows is forbidden until exact-section gate and admission control are complete.
Missing admission-control table invalidates every related checked row.
Output completion gate must appear before any checked decision.
Mandatory proof sections are table-backed gates.
A prose-only mandatory section counts as missing for its related rows.
Every mandatory proof row must have a stable row id.
Every checked row must appear in Checked row admission control with the same row id.
Grouped row scopes cannot be checked; split any row that covers multiple methods, flows, execution facts, states, ports, commands, or owners.
Output completion gate marks a section non-empty only when table rows exist.
Section-coverage summary claims are invalid.
Do not write that lifecycle sections are covered; emit the actual tables.
A sentence saying a section was covered is an evidence gap until table rows follow the exact heading.
Irreversible fact command-admission matrix: Every durable succeeded, authorized, completed, or executed fact must be tested against later cancel, retry, reopen, or refund commands that can act from stale parent state.
CQRS write-side inventory gate: Inventory every read-shaped method on write repositories and shared adapters before CQRS checked.
Query DTO or read facade evidence alone cannot satisfy CQRS; each checked row must name the write-side method/adapter, caller semantics, returned model family, write-side influence, storage/adapter overlap, and why no read facade should own it.
All-checked contradiction gate: Do not write all rows checked when any mandatory row is finding, return, evidence gap, grouped, compressed, or missing admission-control proof.
Hard downgrade checked-row filter: Forbidden proof tokens in a checked row force downgrade.
checked with caveat, design accepts, accepted by design, xorm tx, accepted atomic write, command-side check, or synchronous command path cannot be decisive checked proof.
Accepted atomic transaction requires model decision id and failure-tolerance rule in the same row; otherwise downgrade.
Terminal/event timing gate: Terminal/execution checked rows must inspect lifecycle event emission timing and durable fact ordering; command/domain guards alone cannot check terminal/execution separation.
Positive-conclusion quarantine: If any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted, omit Checked flows and positive Rules Satisfied entries.
Output completion exact-column gate: A section is present only when its table header exactly matches the required template.
Residual-risk summary replaces checked-flow summary while negative decisions exist.
Negative-scope lock: When any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted, every same-scope checked decision is invalid.
Use not admitted or not claimed instead of checked for same-scope rows while the lock is active.
Grouped method, flow, candidate, state, port, or execution rows cannot be admitted.
Independent-scope checked exception requires row-local scope boundary proof.
Not-claimed extraction gate: not claimed cannot be a final mandatory-row decision.
Every not-claimed lifecycle/repository/event/CQRS row must become evidence gap, return, or finding.
Positive-word scrub: covered, reachable, shape matches, appears guarded, or no blocker found are positive conclusions; downgrade them while negative decisions exist.
Bare method-name lists are not CQRS inventory; each row needs caller semantics, returned model family, write influence, storage overlap, and read-facade ownership.
Inventory completeness gate: Mandatory sections are incomplete unless all accepted model and code seeds are inventoried.
A blocker cannot shrink lifecycle scope; continue independent flow inventory after high-severity findings.
One-row mandatory sections are incomplete when multiple commands, methods, states, events, flows, or read-shaped methods exist.
Inventory seeds: lifecycle flows, repository/API methods, collaboration trigger facts, terminal execution facts, parent state vocabulary, domain event names, and read-shaped write-side methods/shared adapters.

For lifecycle designs, final output must include these sections before broad conclusions: Candidate ledger:, Per-flow Event Timeline Reconciliation:, Recovery reachability table:, Mandatory coverage matrix:. If lifecycle scope is present, these sections are required even when findings already exist. A compile/build blocker cannot remove any mandatory review section. Do not compress mandatory sections into Checked flows. Rows cover lifecycle facts, event/recovery, aggregate-boundary candidates, terminal/execution facts, CQRS read/write split, FSM API compatibility and state polymorphism, and state-language semantics. Mark each row as `checked`, `finding`, `evidence gap`, `return`, or `not applicable`; Checked means evidence-backed. Checked rows must name evidence, the exact rule satisfied, and why the risk is not a finding; every probed risk must end as one decision. Unproven owned-child classification cannot be checked. No positive model-alignment conclusion until every mandatory coverage row is classified; final output must not duplicate final answer blocks.
Counterfactual defect hunt: Draft findings are not final. Before final output,
try to prove each checked, no-finding, or Rules Satisfied conclusion wrong.
Ask `What evidence would falsify this checked row?` Gateway questions: hidden stale-state command rights after durable facts; hidden owner proof behind
Repository/API transactions; missing reaction/recovery path after facts;
child-process language posing as aggregate lifecycle; hidden read/write semantic blending.
No checked or no-finding row is final without a falsifier question and inspected evidence;
if uninspected, classify as finding, evidence gap, or return route.
Checked row proof artifacts: a checked/no-finding row must cite the proof artifact
required by its risk family; otherwise downgrade to finding, evidence gap, or
return route. Aggregate-boundary checks require a candidate ledger; event/reaction
checks require per-flow timeline proof; split or terminal flows require terminal
and execution fact proof; CQRS checks require semantic split proof. An accepted design row must name independent code evidence; accepted design, transaction shape,
package names, QueryRepository names, or DTOs alone cannot satisfy a row.
Lifecycle scope is not a small review. Output completion gate: for lifecycle, Repository, event/reaction, or CQRS scope, the final answer is invalid unless required proof-artifact sections are present and non-empty. Do not write broad checked-flow summaries; checked-with-caveat is not checked. A checked row with
`caveat`, `appears`, accepted-design-only, naming-only, transaction-only, or
DTO-only proof downgrades to evidence gap, return route, or finding.
Mandatory rows are decision gates, not summaries. A row that cites a caveat or another finding cannot be checked; inherit the strongest decision from the caveat or downgrade to return/evidence gap. Summary rows that aggregate several methods, flows, states, or ports cannot be checked until each member has its own decision row.
For aggregate/repository risks, use one row per Repository/API method that saves or coordinates multiple candidates. Each row names the method, every candidate, role, owner proof, owned-child proof when claimed, invariant or command outcome, transaction evidence, coordination alternative, and decision/return route.
For linked lifecycle behavior, synchronous command path is evidence, not a collaboration decision. Classify the mechanism as Domain Event, process manager, reconciler, task processor, Integration Message, accepted atomic transaction, or evidence gap.
For state-language semantics, if a parent aggregate state is named after a child process outcome, prove the parent lifecycle fact and owner; otherwise return to modeling/design or mark an evidence gap.
CQRS checked requires semantic proof beyond names, DTOs, packages, and absent imports: classify caller intent, returned model family, write-side product-read overlap, query-adapter write authority, shared storage/adapter coupling, and whether reads influence write-side decisions.
Finding extraction gate: any mandatory row with finding, return, or evidence gap must become a Finding paragraph or cite an existing finding with the same scope; important risks cannot remain only in tables.
Split or multi-execution outcomes require one row per execution fact with authorization source, amount/result scope, idempotency/replay rule, failure recovery, and exact aggregate closure condition; command sequencing alone cannot check terminal/execution separation.
State-language enumeration must inspect every parent state whose vocabulary looks like pending, failed, cancelled, succeeded, authorized, executed, completed, refunded, settled, or closed.
CQRS read-shaped method inventory must inspect every read-shaped method on write repositories or shared adapters before marking read/write split checked.
checked rows inherit the strongest negative decision unless independence is proven; a related finding, return, evidence gap, or caveat dominates positive local proof.
Use the exact mandatory section names. Evidence Matrix is not a substitute for mandatory sections. Free-form summary matrices may not contain checked decisions; they are commentary only after all mandatory sections are complete.
Compact Mandatory review sections blocks are invalid for lifecycle scope. Lifecycle exact-section gate: when lifecycle, repository, event/reaction, terminal/execution, state-language, or CQRS scope is active, the final output must include each exact lifecycle section from the template, including Finding extraction gate:, Terminal/execution fact table:, Parent-state language table:, CQRS read-shaped method inventory:, and Strongest-decision inheritance:. If any exact lifecycle section is missing, do not mark any related row checked or Rules Satisfied. Output completion gate must list every exact lifecycle section. Missing exact section becomes evidence gap.
Negative decision inventory runs before findings for lifecycle/repository/event/CQRS scope. All mandatory lifecycle rows start as `unresolved`; Row-local proof is the only promotion path from `unresolved` to `checked`. Findings are generated from negative inventory rows after the inventory is complete. Pre-written findings cannot satisfy inventory rows; a finding paragraph may cite an inventory row, but it cannot replace the row's evidence, promotion proof, and final decision.
Checked promotion requires non-transaction model proof. Transaction shape, accepted design, semantic repository naming, DTO/query naming, or package separation cannot be the strongest checked evidence; if they are the strongest evidence, downgrade to return/evidence gap/finding. command transaction is not a final collaboration mechanism; accepted atomic transaction requires explicit model decision and failure-tolerance proof. State-language inventory must enumerate every discovered or declared parent state word; Missing configured state words force evidence gap. CQRS inventory rows must be one method or port each; Grouped CQRS rows cannot be checked. Run Overclaim scrub before final output.
Checked row admission control: a row may be promoted to checked only when its
row-local proof tuple is complete. Checked-row proof tuple: row scope, model fact, owner proof, coordination proof, forbidden evidence scrub, final decision.
Category-level checked decisions are invalid; prose such as structurally checked,
mostly acceptable, reasonable ownership, or no leakage found is commentary until
every member row is admitted. semantic lifecycle transaction is red-flag evidence only, not checked proof.
synchronous command plus transaction cannot be checked collaboration unless an explicit accepted atomic-transaction decision and failure-tolerance proof are named.
caller-location-only CQRS proof is insufficient; command handler caller location must be paired with returned model family, product-read overlap, write-side influence, and adapter/storage overlap.
checked with inherited negative is not checked; inherited findings, returns, evidence gaps, or caveats downgrade the row unless independence proof is row-local.
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

Lead with findings only when lifecycle/repository/event/CQRS gates are not triggered. For lifecycle/repository/event/CQRS scope, lead with the negative decision inventory, then generate findings from it.

```text
DDD review:
- Expected model sources:
- Evidence gate:
- Negative decision inventory: Row id | Row scope | Initial decision | Evidence inspected | Row-local promotion proof | Final decision | Finding id
- Irreversible fact command-admission matrix: Row id | Durable fact | Stale parent state | Later command | Guard consulted | Decision
- Candidate ledger: Row id | Candidate | Decision | Evidence | Rule satisfied | Why not finding / Gap / Return; Row id | Candidate | Role | Owner proof | Repository/API evidence | Decision | Return route
- Repository/API candidate classification: Row id | Repository/API method | Candidate | Role | Owner proof | Owned-child proof | Invariant/command outcome | Transaction evidence | Coordination alternative | Decision/return route
- Per-flow Event Timeline Reconciliation: Row id | Flow | Fact | Event/process/reconciler owner | Recovery/failure behavior | Decision
- Collaboration model table: Row id | Flow | Trigger fact | Affected owner | Mechanism | Recovery/failure behavior | Decision
- Recovery reachability table: Row id | Fact | Recovery trigger | Production entrypoint | Guard after durable fact | Decision
- Mandatory coverage matrix: Row id | Coverage row | Decision | Evidence | Rule satisfied | Why not finding / Gap / Return
- Finding extraction gate: Row id | Mandatory row | Decision | Finding paragraph or same-scope finding | Extraction decision
- Counterfactual defect hunt: Row id | Checked row | Falsifier question | Evidence inspected | Decision
- Checked row proof artifacts: Row id | Checked row | Risk family | Required proof artifact | Evidence | Decision
- Terminal/execution fact table: Row id | Flow | Execution fact | Authorization source | Amount/result scope | Idempotency/replay rule | Failure recovery | Lifecycle event emission timing | Durable fact ordering | Aggregate closure condition | Decision
- Parent-state language table: Row id | State | State word family | Parent aggregate fact | Child/process outcome risk | Owner proof | Decision
- CQRS semantic split table: Row id | Port/interface | Caller semantics | Returned model family | Write-side overlap | Adapter overlap | Decision
- CQRS read-shaped method inventory: Row id | Write-side method/adapter or read port | Location | Caller semantics | Returned model family | Product-read overlap | Write-side influence | Adapter/storage overlap | Read-facade ownership decision | Decision
- Strongest-decision inheritance: Row id | Checked row | Related finding/return/gap | Independence proof | Final decision
- Overclaim scrub: Row id | Checked row | Strongest evidence source | Forbidden promotion source | Downgrade decision
- Output completion gate: Row id | Exact lifecycle section | Present | Non-empty table rows | If missing decision
- Checked row admission control: Row id | Proof tuple complete | Invalid category/prose/forbidden proof | Admission decision
- Checked flows: <omit when any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted>
- Residual-risk summary: <use instead of checked-flow summaries while negative decisions exist>
- Rules Satisfied / Not Applicable / Return to domain-modeling / Return to design / Evidence gap: <positive Rules Satisfied entries forbidden for same-scope rows while negative decisions exist>
- Finding generation map: Inventory row | Final decision | Finding id or evidence-gap id | Extracted paragraph

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
