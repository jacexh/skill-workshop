---
name: designing-tests
description: Use when writing tests, adding coverage, fixing flaky tests, reviewing test quality, choosing verification evidence, deciding between unit/integration/E2E/check/dry-run/smoke/manual validation, planning regression cases from architecture docs or sequence diagrams, preparing hand-off evidence, or reporting skipped/unrun/flaky verification risk. Covers business rules, state machines, APIs, async flows, service boundaries, mocking strategy, and evidence hand-off gates.
---

# Designing Tests

Choose verification evidence for real regressions. Tests are one evidence type,
not the default answer. Do not optimize for coverage percentage, ritual
completeness, or tests around code that has no independently observable risk.

## Workflow

### 1. Intent Gate

State the intent source before proposing verification:

- Product spec, API contract, acceptance criteria, issue/bug report, ADR,
  architecture docs, message flow, or sequence diagram.
- If formal docs are missing, infer intent from the public contract: name,
  parameters, return type, module role, and callers. Mark this as an
  `assumption`.
- If intent is ambiguous and the risk is high, ask for the missing requirement
  or state the unresolved assumption instead of inventing tests.
- For architecture docs, ADRs, component diagrams, message flows, or sequence
  diagrams, identify architecture design goals first. Use
  [references/architecture-test-design.md](references/architecture-test-design.md).

### 2. Risk Gate

State the observable regression each evidence item protects:

`If <behavior breaks>, users/system observe <failure>.`

If you cannot name a meaningful observable failure, do not add a test for that
surface. A thin entrypoint, simple glue script, generated artifact, static
configuration, or deployment helper can be verified by cheaper evidence when it
does not own independent behavior.

Use this short high-risk lens before choosing evidence:

- security, auth, permission, tenancy, or secret handling
- data persistence, migration, uniqueness, transactions, or irreversible state
- external API, message, schema, generated client, route, or topic contracts
- async retry, deduplication, idempotency, ordering, timeout, or recovery
- environment/profile/config translation that can break deployment
- user-visible critical journeys or production incident regressions

High-risk surfaces need stronger evidence. If you choose a lightweight check
instead of a test for one of these risks, explain why the check is sufficient and
what residual risk remains.

### 3. Evidence Gate

Choose the lowest-cost reliable evidence:

- `test`: automated unit, integration, seam, contract, component, or E2E test
- `check`: build, typecheck, lint, static validation, syntax check, schema check
- `dry-run`: deployment/config/script dry-run such as `kubectl --dry-run`
- `smoke`: narrow runtime exercise of a critical path
- `manual`: explicit manual verification when automation is not practical
- `residual`: risk intentionally left unverified or only partially verified

Select `test` only when it is the narrowest reliable evidence for the stated
regression. If selecting a test, state why lighter evidence such as build, lint,
typecheck, shell syntax, schema validation, dry-run, or smoke would miss the
regression. If not selecting a test, record the chosen evidence and residual
risk.

### 4. Boundary Selection, Only For Tests

When a test is the selected evidence, choose the lowest boundary that can fail
the same way production fails:

- pure function/reducer: branching, parsing, normalization, state transitions
- handler/API/component: request mapping, rendered behavior, validation feedback
- integration: production collaborators cooperate at one service boundary
- seam/contract: serialization, message schema, generated client, route/topic
  wiring, compatibility drift
- E2E: only for critical full user/system journeys lower layers cannot prove

Do not call a test `real` if it mocks the internal collaborator carrying the
claimed risk. Mock third-party or expensive edges only. See
[references/integration-quality.md](references/integration-quality.md) for
integration and contract tests.

### 5. Hand-off Evidence

Before claiming behavior is complete, fixed, reviewed, or ready to hand off,
report verification evidence:

- `tested`: test or command that protects a stated risk
- `checked`: build, lint, typecheck, static validation, syntax check, dry-run, or
  smoke result
- `not covered/skipped`: unavailable service, skipped/flaky test, missing
  credential, manual-only path, or unrun suite
- `residual risk`: what can still break despite the evidence

Skipped integration/E2E tests and unavailable services are not passing evidence.
Use [references/handoff-gate.md](references/handoff-gate.md) for the full
handoff rubric.

## Output Format

Before writing tests, output an evidence plan:

```text
Evidence Plan: <change or component>
Intent source: <spec/contract/ADR/bug report/assumption>

Risk map:
- <risk>: If <behavior breaks>, <observable failure>

Evidence choice:
- test/check/dry-run/smoke/manual/residual: <evidence> -> protects <risk>

Tests, if selected:
- <boundary>: <scenario> -> <expected outcome>

Not covered:
- <risk> -> <why not covered and residual impact>
```

## Test Quality Labels

Use these labels only for tests:

- `real`: reaches the risky implementation and would fail if the target
  regression returns
- `shallow`: touches the area but only proves shape, status, smoke behavior, or
  a heavily mocked path
- `fake`: proves mocks, copied logic, types, fixtures, or the test double rather
  than production behavior

For critical changed behavior, at least one selected test must be `real` at the
narrowest boundary that catches the real failure. A `shallow` test can support
smoke confidence but cannot prove the risky behavior. A `fake` test is evidence
of a gap.

## Case Design Heuristics

After the Evidence Gate selects tests:

- Start with the smallest set that proves the stated regression cannot happen.
- Add success, failure, boundary, invalid transition, duplicate/retry, ordering,
  permission, schema, or time-window cases only when they protect distinct
  risks.
- Use equivalence partitioning for large input spaces, boundary values for
  limits, decision tables for multi-condition business rules, and pairwise
  sampling when exhaustive combinations add little detection value.
- Do not duplicate the same assertion across unit, integration, and E2E unless
  each layer catches a different failure mode.

## Intent Notes

Every non-obvious test needs an intent note in the test name, comment, or
enclosing context. Add an explicit comment when:

- the protected regression is not obvious from the test name
- the test scans config/source text
- the boundary is architecture, deployment, contract, or migration evidence

Self-explanatory behavior tests do not need ceremonial comments.

## Failure Triage

When a test fails:

1. Confirm the test still matches the requirement or stated assumption.
2. Confirm the test reaches the real implementation under risk.
3. If both are true, treat the implementation as suspect before weakening the
   test.

Do not change a test just to make it pass.

## When To Read References

- Read [references/architecture-test-design.md](references/architecture-test-design.md)
  for architecture docs, ADRs, component diagrams, message flows, or sequence
  diagrams.
- Read [references/integration-quality.md](references/integration-quality.md)
  when selected evidence is integration, API, contract, seam, or E2E testing.
- Read [references/handoff-gate.md](references/handoff-gate.md) before claiming
  work is ready for user hand-off.
