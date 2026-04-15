---
name: designing-tests
description: Use when writing tests, adding test coverage, fixing flaky tests, reviewing test quality, choosing between unit/integration/E2E, deciding what to test, planning regression cases, or when asked "does this need tests", "what should I test", "write tests for X", "add tests", "improve test coverage". Covers business rules, state machines, APIs, async flows, service boundaries, and mocking strategy.
---

# Designing Tests

Design tests to catch real regressions at the lowest reliable boundary. Do not optimize for coverage percentage or ritual completeness.

## Workflow

1. Read the requirement source first.
   - Prefer product spec, acceptance criteria, API contract, issue, bug report, ADR, or migration notes.
   - If formal docs are missing, use the best available artifacts and mark assumptions explicitly.
2. Read the implementation and the existing tests.
   - Find the real production boundary under risk.
   - Check what is already covered, duplicated, shallow, or fake.
3. State the regression to catch.
   - Write one sentence: `If <behavior breaks>, users/system will observe <failure>.`
4. Choose the narrowest real boundary that can catch that regression.
5. Design the minimum sufficient test set.
   - Usually cover one main success path, one meaningful failure path, and one edge or bug-shaped path.
6. Prefer assertions on externally visible behavior.
   - User-visible result, contract-visible state, or key side effect.
7. Keep mocks at the system edge.
   - Do not mock the unit under test or copy the production logic into the test.
8. Run the relevant tests and state what regression each test protects.

## Boundary Selection Rule

Pick the lowest layer that still catches the real bug:

- Pure function or reducer: branching, parsing, normalization, state transitions, classification
- Handler or API boundary: request parsing, error mapping, response contract, persistence side effects
- Component or UI boundary: rendered behavior, interaction flow, validation feedback, navigation
- Seam or contract boundary: serialization, message schema, routing, retry, idempotency, cross-service mismatch
- E2E: only when the regression depends on the full deployed flow or a critical user journey

If a lower layer can catch the bug with a stable signal, prefer the lower layer.

## Requirement Sources

Good test design starts from requirements, not from implementation alone. But do not stop at the spec.

Use this order:

1. Read the requirement source
2. Read the implementation to find the real boundary and observables
3. Read existing tests before adding new ones

If documentation is incomplete:

- use API schema, code comments, migration docs, PR descriptions, and current product behavior
- mark inferred requirements as assumptions
- avoid presenting assumptions as authoritative spec

## Quality Labels

Classify tests before extending a suite:

- `real`: exercises the risky implementation and would fail if real behavior regresses
- `shallow`: touches the area but only checks trivial shape, status, or incidental fields
- `fake`: reimplements business logic in the test, or mocks so much that the real behavior is never exercised

When reviewing or planning tests, name the label and the reason.

## Coverage Heuristic

Default minimum for a changed behavior:

1. one main success path
2. one meaningful failure path
3. one edge condition or regression-shaped path

Add more only when risk justifies it:

- boundary values
- invalid state transitions
- duplicate or retried operations
- concurrency or ordering
- permission edges
- schema drift or serialization mismatch
- time-window behavior

Do not mirror the same rule across unit, integration, and E2E unless each layer catches a different failure mode.

## Assertion Rule

Prefer this order of evidence:

1. externally visible result
2. contract-visible state
3. key side effect
4. internal detail only if it is itself the contract

One strong behavioral assertion is usually better than many incidental assertions.

## Mocking Rule

- Mock external services and expensive infrastructure at the system edge.
- Prefer fakes over interaction-heavy mocks when you own the boundary.
- Do not mock pure logic, reducers, value objects, or the unit under test.
- In integration tests, avoid mocking internal collaborators just to make setup easier.

## Failure Triage Rule

When a test fails:

1. confirm the test still matches the requirement or justified assumption
2. confirm the test reaches the real implementation under risk
3. if both are true, treat the implementation as suspect before changing the test

Do not weaken a test only to make it pass.

## When to Read References

- Read [references/layer-selection.md](references/layer-selection.md) when deciding where a test should live.
- Read [references/risk-catalog.md](references/risk-catalog.md) when looking for high-value failure modes.
- Read [references/test-quality-review.md](references/test-quality-review.md) when auditing an existing suite.
- Read [references/test-case-patterns.md](references/test-case-patterns.md) when turning a requirement into concrete test cases.
