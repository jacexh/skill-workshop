# Test Hand-off Gate

Use this before claiming behavior is complete, fixed, or ready for a user to take over. The goal is a compact evidence trail: what risk changed, what proves it works, and what remains unproven.

## Required Hand-off Record

Report these items in the final answer or PR summary:

1. **Intent:** the behavior changed and the requirement source. Mark inferred intent as an assumption.
2. **Risk map:** the main regression risks: business rule, state transition, persistence, contract, async, permission, security, UI, or deployment/config.
3. **Test evidence:** each new or relevant test with its quality label:
   - `real`: reaches the risky implementation and would fail on the target regression
   - `shallow`: touches the area but only proves shape, status, smoke behavior, or heavily mocked flow
   - `fake`: proves only mocks, types, duplicated logic, or the test double
4. **Commands run:** exact commands and pass/fail result.
5. **Skipped or unavailable tests:** skipped tests, missing services, unavailable credentials, or local-only checks. These do not count as passing evidence.
6. **Residual risk:** what could still break despite the evidence.

## Minimum Bar

For a behavior change to be hand-off grade:

- Critical changed behavior has at least one `real` test at the narrowest boundary that can fail like production.
- Success, meaningful failure, and edge or regression-shaped paths are covered unless the risk is explicitly lower.
- Integration claims use real internal collaborators for the claimed boundary.
- Contract or schema changes include compatibility or drift checks.
- Async behavior uses condition-based waits and deterministic state assertions.
- Security, permission, and tenancy changes include denial tests, not only allowed-path tests.
- Verification commands were run after the final edit.
- Skips, flaky tests, and unrun suites are named as residual risk.

## Red Flags That Block Hand-off Claims

- "All tests pass" while critical integration tests skipped.
- Only `200 OK`, non-null, snapshot, or type-shape assertions for a risky behavior.
- The test mocks the component whose correctness is being claimed.
- The test copies production logic to calculate the expected value.
- E2E is the only coverage for a complex rule that could be tested lower.
- Unit tests are the only coverage for serialization, storage constraints, middleware, generated clients, or broker wiring.
- The final answer omits commands run or hides failures behind "not run locally."

## Scoring Rubric

Use this 100-point rubric for suite reviews or large hand-offs. Score each dimension 0-10.

| Dimension | What to look for |
| --- | --- |
| Intent traceability | Tests derive from spec, contract, acceptance criteria, bug report, or stated assumption |
| Boundary correctness | Each test runs at the lowest boundary that can catch the real failure |
| Behavior protection | Assertions prove user-visible result, contract state, durable state, or key side effect |
| Failure coverage | Meaningful errors, denial, rollback, retry, invalid state, and edge cases are covered |
| Integration reality | Internal collaborators are real where integration risk is claimed |
| Contract coverage | API, message, schema, generated clients, and compatibility risks are checked |
| Data/environment quality | Isolated data, deterministic setup, real migrations, controlled dependencies |
| Async/concurrency quality | Condition-based waits, dedup, ordering, timeout, retry, and idempotency risks |
| Diagnostics/observability | Failures reveal request/response, durable state, logs, trace, or message state |
| CI trust | Tests are stable, appropriately tiered, and skips/flakes are governed |

Score bands:

- 90-100: hand-off grade for critical systems
- 75-89: strong, with limited and documented residual risk
- 60-74: acceptable for moderate risk; improve before critical release
- 40-59: weak; likely misses real integration failures
- below 40: not credible verification

## Final Answer Template

Keep it concise:

```
Implemented <change>.

Verification:
- real: <test/command> protects <regression>
- shallow: <test/command> only protects <limited signal>
- not run/skipped: <reason and risk>

Residual risk:
- <specific remaining gap or "none beyond unrun suites">
```

## Architecture Verification Hand-off

When the work validates an architecture plan, ADR, message flow, or sequence diagram, report architecture claims separately from ordinary test results:

```
Architecture verification:
- proven: <architecture claim> via <test/check/evidence>
- assumed: <claim> because <threshold/policy was not specified>
- unproven: <claim> needs <load/contract/env/manual recovery test>

Goal coverage:
- <goal>: <tests or none> / <evidence type> / <residual risk>

Skipped/unavailable:
- <test or environment> -> <architecture risk left open>
```

Do not claim the architecture is verified when important quality goals, state ownership rules, or compatibility claims are only assumed. State the assumption and the evidence still needed.
