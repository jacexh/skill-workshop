# Evidence Hand-off Gate

Use this before claiming behavior is complete, fixed, reviewed, or ready for a
user to take over. The goal is a compact evidence trail: what risk changed, what
proves it, what was only checked, and what remains unproven.

## Required Hand-off Record

Report:

1. **Intent:** requirement source or stated assumption.
2. **Risk map:** observable regressions for business behavior, state,
   persistence, contract, async, permission, security, UI, config, or
   deployment.
3. **Verification evidence:**
   - `tested`: automated test or command that protects a stated risk.
   - `checked`: build, lint, typecheck, syntax check, schema/static validation,
     dry-run, or smoke result.
   - `not covered/skipped`: unavailable service, skipped or flaky test, missing
     credential, manual-only path, or unrun suite.
   - `residual risk`: what can still break despite the evidence.
4. **Commands run:** exact commands and pass/fail result.

Skipped integration/E2E tests and unavailable services are not passing evidence.

## Minimum Bar

- Critical changed behavior has evidence at the narrowest boundary that can fail
  like production.
- High-risk security, permission, tenancy, data, migration, contract, async, or
  deployment changes are tested or have an explicit reason why a lighter check is
  sufficient.
- Integration claims use real internal collaborators for the claimed boundary.
- Contract or schema changes include compatibility, schema, generated-client, or
  drift evidence.
- Async behavior avoids fixed sleeps and asserts observable state, message, log,
  metric, trace, or durable side effect.
- Verification commands are run after the final edit.
- Skips, flakes, unavailable services, and unrun suites are named as residual
  risk.

## Evidence Labels

- `real test`: reaches the risky implementation and would fail on the target
  regression.
- `shallow test`: touches the area but only proves shape, status, or smoke
  behavior.
- `fake test`: proves mocks, copied logic, types, fixtures, or the test double.
- `check`: useful evidence, but not a behavior test.
- `residual`: unproven or only manually verified risk.

Do not use shallow or fake tests as proof for critical behavior.

## Red Flags

- "All tests pass" while critical checks are skipped or unavailable.
- Only status, non-null, snapshot, or type-shape assertions protect risky
  behavior.
- A test mocks the component whose correctness is being claimed.
- A test copies production logic to calculate the expected value.
- E2E is the only evidence for a complex rule that could be tested lower.
- Unit tests are the only evidence for serialization, storage constraints,
  middleware, generated clients, broker wiring, or deployment config.
- The final answer omits commands run or hides failures behind "not run locally."

## Final Answer Template

```text
Verification evidence:
- tested: <test/command> protects <risk>
- checked: <command/static validation> protects <risk>
- not covered/skipped: <reason> leaves <risk>
- residual risk: <specific remaining gap>
```

## Architecture Evidence Hand-off

When validating an architecture plan, ADR, message flow, or sequence diagram,
report architecture claims separately:

```text
Architecture evidence:
- proven: <architecture claim> via <test/check/evidence>
- checked: <claim> via <static validation/dry-run/smoke>
- assumed: <claim> because <threshold/policy was not specified>
- unproven: <claim> needs <load/contract/env/manual recovery evidence>

Goal coverage:
- <goal>: <evidence or none> / <residual risk>

Skipped/unavailable:
- <test/check/environment> -> <architecture risk left open>
```

Do not claim architecture verification when important quality goals, state
ownership rules, or compatibility claims are only assumed.
