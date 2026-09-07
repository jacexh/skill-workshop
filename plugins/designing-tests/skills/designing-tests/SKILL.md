---
name: designing-tests
description: Design regression test cases and choose reliable verification evidence. Use when designing or implementing tests, reviewing test coverage or quality, deriving cases from requirements or architecture, choosing verification methods, or reporting verification evidence.
---

# Designing Tests

Identify the behavior and regression risk, then choose the least costly sufficient
evidence, reusing valid existing evidence. When tests are needed or explicitly
requested, derive cases from the behavior. An explicit test-design request enters
case design without reopening whether tests are wanted. A useful suite explains
what each case catches and why the selected cases protect the requested behavior.

## Route and Scope

Infer the task from the request and existing authorization:

- **Design:** deliver cases, expected outcomes, boundaries, and coverage gaps.
  Execution is not a prerequisite for a completed design.
- **Implement:** design or reuse cases, implement them, and run relevant checks.
- **Review:** assess existing evidence against the requested claims; report
  missing protection. A static review can finish from supplied artifacts.
- **Choose evidence:** use Intent, Risk, and Evidence. Derive cases only when
  tests are selected or needed to decide the boundary.
- **Hand-off only:** summarize existing results using
  [references/handoff-gate.md](references/handoff-gate.md).

Keep coverage obligations within the requested behavior and its affected
contracts. User instructions take precedence over this skill's default workflow;
a design, review, or evidence gap does not authorize implementation or new
infrastructure. Continue independent work when an ambiguity affects only part of
the task; ask only when the missing answer changes the required behavior or scope.

Architecture and sequence documents are inputs to any mode. When deriving claims
from them, read [references/architecture-test-design.md](references/architecture-test-design.md).

## 1. Intent and Risk

Identify the target behavior and its authority: acceptance criteria, contract,
issue, bug report, or design decision. If formal authority is absent, infer the
public contract from callers and mark the inference as an assumption. Keep
unknown behavior explicit rather than inventing expected outcomes.

State the regression as: `If <behavior breaks>, <observable failure> occurs.`
Prioritize by consequence and plausible exposure. Security, persistence, external
contracts, and async work warrant attention where the change can affect them;
their presence alone does not require a broader audit.

**Complete when:** each in-scope claim has an authority or assumption and a
failure consequence, or a reason it owns no independent risk.

## 2. Evidence

Inspect available production paths and existing tests enough to identify where
the failure can occur and what is already protected. For design from documents,
mark proposed boundaries that still need implementation discovery.

Choose the least costly sufficient evidence for each risk:

- `test`: repeatable behavior or contract verification
- `check`: build, typecheck, lint, syntax, static, or schema validation
- `dry-run`: configuration, deployment, or script preview
- `smoke`: narrow runtime exercise
- `manual`: an explicit human verification procedure
- `residual`: intentionally unverified or partially verified risk

Explain why the chosen evidence detects the regression; for a test, identify
what lighter evidence would miss. Reuse sufficient existing evidence.

**Complete when:** each risk has selected evidence or an explicit gap. A behavior
with no test requirement can finish with lighter evidence.

## 3. Derive Cases

For selected or reviewed tests, turn each rule into preconditions, an action,
and observable expectations. Start with a representative allowed outcome and
identify distinct rejection, boundary, or historical conditions that change it.
Choose applicable derivation methods rather than a fixed quota of case types.

For input partitions, interacting rules, state histories, concurrency, or partial
failure, read [references/case-design.md](references/case-design.md). Apply only
the sections relevant to the behavior; simple contracts can use a single case.

A case should expose its input or prior state, action or event sequence, expected
outcome, and the rule or regression it protects. Carry unknown policies as gaps;
use conditional cases when their answer changes the expected outcome.

**Complete when:** candidates account for the relevant rule outcomes and their
material interactions, with missing policy separated from missing coverage.

## 4. Make Each Case Discriminating

### Oracle

Derive expectations independently of the production algorithm: contract examples,
business invariants, independent calculations, or justified metamorphic relations.
Choose concrete values or properties that distinguish the named wrong outcome.
A weak property such as “result is nonnegative” does not prove an exact amount.

Check the assertion dimensions the contract needs: returned result, required
state changes, forbidden side effects, and consistency across related state.
For example, an idempotent response may need both the original ID and evidence
that no extra record or message was created.

### Seam

Use the narrowest boundary that includes the component carrying the claimed
risk: function for local rules, handler or component for mapping and interaction,
integration for cooperating components, contract for agreement across a seam,
and E2E for a journey lower boundaries cannot prove.

Keep the risk carrier real; doubles may control other collaborators. For
integration, API, contract, seam, or E2E cases, read
[references/integration-quality.md](references/integration-quality.md).

### Control

Specify the clocks, inputs, schedules, and isolated resources needed to reproduce
the case. For async work, synchronize on observable conditions within a bounded
timeout. Preserve the failure mechanism while controlling nondeterminism, and
clean up owned resources even after failure.

### Proof

Name a plausible defect that would fail each critical assertion. Assess proof
relative to the stated claim:

- `real`: exercises the risk carrier with assertions that detect the regression
- `shallow`: exercises relevant code but leaves a material part of the claim
  unchecked; name the escaping defect
- `fake`: asserts a substitute, copied algorithm, or fixture instead of the
  claimed production behavior

A status, schema, or empty-body assertion can be sufficient when that is the
contract. A passing test with a narrow claim does not prove a broader workflow.
Keep this assessment separate from whether the case has actually been executed.

**Complete when:** each retained case has an independent oracle, a sufficient
boundary, reproducible conditions, and discriminating assertions, or a named gap.

## 5. Select the Suite

Map in-scope rules, important interactions, transitions, and recovery obligations
to cases or existing evidence. Use a small table only when it makes gaps clearer.
For each candidate ask: “If removed, what protection is lost?” Merge cases with
identical protection; preserve distinct boundaries or histories that catch
different defects. One case can protect several obligations, and one obligation
may need several cases. Coverage percentages alone do not establish sufficiency.

Prioritize high-consequence failures and known regressions. Under a time or
environment limit, distinguish essential cases from deferred protection and name
the remaining impact. Do not claim minimality merely from a small case count.

**Complete when:** each material obligation has a detecting case or explicit gap,
and retained cases add distinct protection or have a stated reason to overlap.

## 6. Implement and Verify When Requested

For implementation, inspect the runner, relevant tests, and fixtures; run the
focused baseline when available. Add cases through the chosen production boundary.
For bug fixes, observe red-before-fix when practical; otherwise state the limit
of the evidence. Execute the affected tests and required repository checks.

After relevant code, configuration, or dependency changes invalidate a result,
rerun affected verification. Once it passes, expand or repeat only for a new
change, failure, or unresolved concern. Record unavailable evidence as a gap.

Resolve test, fixture, and setup failures that are within the authorized work;
observing such a failure alone does not complete implementation. Change production
code only when that work is in scope.

Judge completion against the requested outcome:

| Requested outcome | Completion evidence |
|---|---|
| Implement tests | Cases exercise the intended behavior and discriminate the target regressions; in-scope test/fixture/setup failures are resolved. Distinguish passing coverage from product defects exposed by the tests. |
| Reproduce a defect only | The test reliably fails because of the target defect, rather than a fixture or environment error. Preserve that expected failure unless a product fix is also authorized. |
| Fix a defect and prevent regression | The authorized defect is fixed and relevant checks pass; establish that the regression test distinguishes the defective behavior from the fix, or disclose the missing before-fix evidence. |

**Complete when:** the requested outcome is established by observed evidence.
If an external dependency or unavailable condition blocks it, report the completed
portion, exact blocker, and unverified remainder as incomplete work. For a
test-only request that exposes a product defect, deliver the reproducer and
finding without expanding the task into an unauthorized production fix.

## Delivery

Match the output to the task. A small design can be a few cases; a larger design
can use `Claim | Given / When | Then | Boundary | Coverage gap`. Include controls
or priorities where they affect implementation. Review findings should name the
unprotected behavior and the smallest useful correction.

For executed work or a verification hand-off, use
[references/handoff-gate.md](references/handoff-gate.md). Label a design as planned
and a static review as assessed; neither needs runtime evidence to be complete.
