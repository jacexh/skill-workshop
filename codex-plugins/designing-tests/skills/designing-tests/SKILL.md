---
name: designing-tests
description: Design verification evidence and high-signal tests. Use when writing or adding tests, reviewing test quality or coverage, choosing between tests and checks, dry-runs, smokes, or manual validation, deriving regression cases from architecture or sequence documents, or preparing verification hand-off evidence.
---

# Designing Tests

Choose the cheapest reliable evidence for an observable regression. Use tests
when they are the narrowest evidence that can fail for the same reason as
production.

## Route

Choose the task path before doing the work:

- **Design or write tests:** run the full workflow.
- **Review existing tests:** map each material claim through the workflow,
  classify its proof, and report false confidence or missing evidence.
- **Choose verification evidence:** run Intent, Risk, and Evidence; run Test
  Construction only when `test` is selected.
- **Architecture or sequence input:** first read
  [references/architecture-test-design.md](references/architecture-test-design.md),
  then feed its claims into Intent, Risk, and Evidence.
- **Hand-off only:** read
  [references/handoff-gate.md](references/handoff-gate.md) and report observed
  evidence rather than planned evidence.

**Complete when:** the primary path is named and only its conditional references
are loaded.

## Workflow

### 1. Intent

Identify the authority for each target behavior:

- Prefer a product spec, API contract, acceptance criterion, issue, bug report,
  ADR, architecture document, message flow, or sequence diagram.
- When formal authority is absent, infer intent from the public contract and
  callers, and mark it as an `assumption`.
- Surface unresolved high-risk ambiguity instead of silently choosing behavior.

**Complete when:** every target behavior has an authority or explicit
assumption, and every unresolved high-risk ambiguity is named.

### 2. Risk

State each observable regression:

`If <behavior breaks>, users or the system observe <failure>.`

Treat security and tenancy, persistence and migrations, external contracts,
async state, deployment translation, and production-incident regressions as
high-risk surfaces.

A surface with no independently observable failure does not need its own test;
record cheaper evidence when appropriate.

**Complete when:** every target behavior has an observable regression, or is
excluded with a reason that it owns no independent risk.

### 3. Evidence

Choose the lowest-cost reliable evidence:

- `test`: unit, integration, API, seam, contract, component, or E2E
- `check`: build, typecheck, lint, syntax, static, or schema validation
- `dry-run`: deployment, configuration, or script dry-run
- `smoke`: narrow runtime exercise of a critical path
- `manual`: explicit manual verification
- `residual`: intentionally unverified or partially verified risk

When selecting `test`, state why lighter evidence would miss the regression.
When selecting lighter evidence for a high-risk surface, state why it is
sufficient and what remains unproven.

**Complete when:** every risk has one evidence choice or explicit residual risk,
and every selected test has a reason lighter evidence is insufficient.

### 4. Test Construction

Run this section only for selected or reviewed tests.

#### Discover

Inspect the production call path, nearest relevant tests, test runner and
configuration, and existing fixtures or helpers. Run the focused baseline when
the environment permits.

**Complete when:** the production path under risk and the existing evidence
around it are known, and baseline status is recorded or its absence explained.

#### Oracle

Derive the expected outcome from an authority independent of the implementation:
an exact contract example, business invariant, before/after relation,
independent calculation, or metamorphic property.

**Complete when:** every expected outcome is traceable to intent and
distinguishes correct behavior from the named regression without copying the
production algorithm.

#### Seam

Choose the lowest boundary that can fail the way production fails:

- pure function or reducer for rules and transitions
- handler, API, or component for mapping and visible behavior
- integration for cooperating production components
- seam or contract for serialization, schema, route, topic, or client drift
- E2E for a critical journey that lower boundaries cannot prove

Keep the collaborator carrying the claimed risk inside the tested boundary.
For integration, API, contract, seam, or E2E work, read
[references/integration-quality.md](references/integration-quality.md).

**Complete when:** the boundary is justified by the production failure mode and
no test double replaces the collaborator carrying the claim.

#### Control

Make the test repeatable while preserving the risky behavior:

- Control clocks, randomness, identifiers, schedulers, and environment inputs.
- Isolate data and resources from execution order, shared state, and developer
  state.
- Synchronize async completion on an observable condition under a bounded
  timeout.
- Seed or pin variable inputs and clean up owned state even after failure.

**Complete when:** every material nondeterministic input is controlled or named
as residual risk, and resource isolation is explicit.

#### Proof

Assert observable behavior, contract-visible state, durable state, messages, or
meaningful side effects. Select the smallest cases that protect distinct risks;
use boundary values, equivalence partitions, decision tables, state transitions,
or pairwise sampling only when they expose a different failure.

Classify reviewed or selected tests:

- `real`: reaches the risk carrier and fails when the target regression returns
- `shallow`: proves shape, status, smoke behavior, or a heavily mocked path
- `fake`: proves a double, copied logic, type, fixture, or constant rather than
  production behavior

For each critical assertion, name the defect or perturbation that would make it
fail. For a bug fix, observe red-before-fix when practical. Duplicate a case
across layers only when each layer catches a different failure mode.

**Complete when:** every critical risk has at least one `real` proof at the
narrowest sufficient boundary, or an explicit evidence gap; implemented tests
have an observed result.

### 5. Hand-off

Report:

- `tested`: command and risk protected
- `checked`: command and risk protected
- `not covered/skipped`: unavailable or unrun evidence and its impact
- `residual risk`: what can still break

Use [references/handoff-gate.md](references/handoff-gate.md) for the complete
record.

**Complete when:** commands and outcomes reflect the final state, planned
evidence is not presented as executed evidence, and every uncovered risk is
visible.

## Evidence Plan

Use one compact entry per distinct risk:

```text
Evidence Plan: <change or component>
Intent: <authority or assumption>
Risk: <breakage> -> <observable failure>
Evidence: <test/check/dry-run/smoke/manual/residual> because <reason>

Test construction, if selected:
- <scenario>: Oracle <expected authority>; Seam <boundary>; Control <inputs>;
  Proof <observable assertion and target regression>

Residual: <unproven risk and impact>
```
