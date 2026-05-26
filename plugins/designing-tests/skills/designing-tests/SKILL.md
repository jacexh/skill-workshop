---
name: designing-tests
description: Use when writing tests, adding test coverage, fixing flaky tests, reviewing test quality, choosing between unit/integration/E2E, deciding what to test from architecture docs or sequence diagrams, planning regression cases, preparing hand-off test evidence, or reporting skipped/unrun/flaky test risk. Covers business rules, state machines, APIs, async flows, service boundaries, mocking strategy, and hand-off gates.
---

# Designing Tests

Design tests to catch real regressions at the lowest reliable boundary. Do not optimize for coverage percentage or ritual completeness.

## Workflow

1. Identify the intent of the code under test.
   - Sources (in priority order): product spec, architecture docs, sequence diagrams, API contract, acceptance criteria, issue/bug report, ADR — then function signature, naming, docstring, and architectural role.
   - If formal docs are missing, derive intent from the function's public contract (name, parameters, return type, module role). Mark inferred intent as assumptions.
   - If the source is an architecture plan, ADR, component diagram, message flow, or sequence diagram, identify the architecture design goals first. Use [references/architecture-test-design.md](references/architecture-test-design.md).
2. Generate a test list from intent — before reading implementation code.
   - For each test, write one line: `<unit/integration/e2e>: <what to test> → <expected outcome>`
   - Apply equivalence partitioning for ranges, boundary value analysis for limits, decision tables for multi-condition logic. See [references/test-case-patterns.md](references/test-case-patterns.md) for techniques.
   - This is a planning step output in your response, not a file to create.
3. Read the implementation and existing tests.
   - Purpose: determine the real test boundary and check what is already covered, duplicated, shallow, or fake.
   - Do NOT add or remove tests merely to mirror implementation branches.
   - Revise the test list when implementation or existing tests reveal a production boundary, contract, dependency, or shallow/fake gap that the initial intent pass missed. Mark the revision and the reason.
4. State the regression each test protects.
   - Write one sentence per test: `If <behavior breaks>, users/system will observe <failure>.`
5. Choose the narrowest real boundary that can catch each regression.
   - Escalate to integration, seam, contract, or E2E when the regression depends on real storage, transport, serialization, authorization middleware, runtime wiring, or deployment-like configuration.
   - For integration tests, apply [references/integration-quality.md](references/integration-quality.md).
6. Write test code.
   - Each test MUST have an intent comment above it: one sentence explaining what regression this test catches, written in the language of the test file.
   - Default minimum: one main success path, one meaningful failure path, one edge or bug-shaped path.
7. Prefer assertions on externally visible behavior.
   - User-visible result, contract-visible state, or key side effect.
8. Keep mocks at the system edge.
   - Do not mock the unit under test or copy the production logic into the test.
9. Run the relevant tests and verify each one protects its stated regression.
10. Before hand-off, complete the quality gate in [references/handoff-gate.md](references/handoff-gate.md).
    - State what was tested, what was not tested, why any tests skipped, and what residual risk remains.

## Boundary Selection Rule

Pick the lowest layer that still catches the real bug:

- Pure function or reducer: branching, parsing, normalization, state transitions, classification
- Handler or API boundary: request parsing, error mapping, response contract, persistence side effects
- Component or UI boundary: rendered behavior, interaction flow, validation feedback, navigation
- Seam or contract boundary: serialization, message schema, routing, retry, idempotency, cross-service mismatch
- E2E: only when the regression depends on the full deployed flow or a critical user journey

If a lower layer can catch the bug with a stable signal, prefer the lower layer.

Do not over-apply the lower-layer rule. If the production failure requires real database constraints, real migrations, broker behavior, generated API clients, authorization middleware, or deployed configuration, a unit test is not enough. Add the narrowest integration, seam, contract, or E2E test that fails the same way production would fail.

## Intent-First Rule

Derive test cases from the function's **intent** (what it should do), not its **implementation** (how it does it).

Intent sources:
- formal spec, API contract, acceptance criteria, issue description
- function signature, naming, docstring
- the function's role in the module and who calls it

Read implementation code only to determine the **test boundary** and check **existing coverage** — never to decide what to test.

Common violations:
- reading an `if/else` branch and writing an assert for each branch → tests the implementation, not the intent
- copying internal logic into the test setup → the test passes by construction, not by verification
- testing private methods directly → couples tests to implementation structure

## Test List Format

Before writing test code, output a test list in your response:

```
Test List: <function or component name>
Intent source: <where you derived the intent from>

- [ ] unit: <what to test> → <expected outcome>
- [ ] integration: <scenario> → <expected side effect or status>
```

Example for `OrderService.place_order` (intent source: API spec — max 10 items, qty > 0):

```
- [ ] unit: valid items list → returns order with generated id
- [ ] unit: empty items list → raises ValidationError
- [ ] unit: item qty = 0 (boundary) → raises ValidationError
- [ ] unit: 10 items (max boundary) → succeeds
- [ ] unit: 11 items (above max) → raises ValidationError
- [ ] integration: valid payload, authenticated → 201, order persisted
- [ ] integration: unauthenticated → 401
```

This is a planning step, not a file to create.

## Intent Comment Rule

Every test MUST have a comment above it explaining what regression it protects. Write the comment in the language of the test file.

```go
// When order items exceed the maximum (10), placing the order should fail
// with a validation error rather than silently truncating.
func TestPlaceOrder_ExceedsMaxItems_ReturnsValidationError(t *testing.T) {
```

```python
# Duplicate idempotency keys within the 5-minute window must return the
# original order, not create a second one.
def test_place_order_duplicate_idempotency_key_returns_same_order():
```

The comment states the **intent** (what should happen and why it matters), not the **mechanism** (what the test code does).

## Quality Labels

Classify tests before extending a suite:

- `real`: exercises the risky implementation and would fail if real behavior regresses
- `shallow`: touches the area but only checks trivial shape, status, or incidental fields
- `fake`: reimplements business logic in the test, or mocks so much that the real behavior is never exercised

When reviewing or planning tests, name the label and the reason.

For hand-off, critical changed behavior needs at least one `real` test at the right boundary. `shallow` tests can support readability or smoke coverage, but they do not prove the risky behavior. `fake` tests are evidence of a gap, not evidence of correctness.

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
- If an integration test mocks the service, repository, storage, broker, or middleware that carries the risk being claimed, label it `shallow` or `fake`, not `real`.

## Hand-off Gate

When finishing work that changed behavior, include a concise verification record:

- intent and assumptions
- test list with `real` / `shallow` / `fake` labels
- regression protected by each test
- commands run and results
- skipped tests and why they do not count as verification evidence
- remaining gaps or user-visible risk

Use [references/handoff-gate.md](references/handoff-gate.md) for the full rubric.

## Failure Triage Rule

When a test fails:

1. confirm the test still matches the requirement or justified assumption
2. confirm the test reaches the real implementation under risk
3. if both are true, treat the implementation as suspect before changing the test

Do not weaken a test only to make it pass.

## When to Read References

- Read [references/layer-selection.md](references/layer-selection.md) when deciding where a test should live.
- Read [references/architecture-test-design.md](references/architecture-test-design.md) when the user provides architecture docs, ADRs, component diagrams, message flows, or sequence diagrams.
- Read [references/integration-quality.md](references/integration-quality.md) when writing or reviewing integration, API, contract, seam, or E2E tests.
- Read [references/handoff-gate.md](references/handoff-gate.md) before claiming work is ready for user hand-off.
- Read [references/risk-catalog.md](references/risk-catalog.md) when looking for high-value failure modes.
- Read [references/test-quality-review.md](references/test-quality-review.md) when auditing an existing suite.
- Read [references/test-case-patterns.md](references/test-case-patterns.md) when turning a requirement into concrete test cases.
