# Evidence Hand-off Gate

Use this before claiming behavior is complete, fixed, reviewed, or ready for a
user to take over. Report observed evidence, not planned evidence.

## Required Record

For each material risk, report:

- `tested`: exact command, result, and regression protected
- `checked`: exact build, lint, typecheck, static validation, syntax check,
  schema check, dry-run, or smoke command and result
- `not covered/skipped`: unavailable dependency, skipped path, manual-only path,
  or unrun suite and the impact it leaves
- `residual risk`: what can still break despite the observed evidence

Run verification after the final edit. A command from an earlier state is not
evidence for the current hand-off.

Skipped tests, unavailable services, and commands that were only planned do not
count as passing evidence.

**Complete when:** every planned evidence item has a final outcome, exact command
and protected risk, or is named as unexecuted with residual impact.

## Final Answer Template

```text
Verification evidence:
- tested: <command and result> protects <risk>
- checked: <command and result> protects <risk>
- not covered/skipped: <reason> leaves <risk>
- residual risk: <specific remaining gap>
```

## Architecture Hand-off

When validating an architecture plan, ADR, message flow, or sequence diagram,
report claims separately:

```text
Architecture evidence:
- proven: <claim> via <test or observed runtime evidence>
- checked: <claim> via <static validation, dry-run, or smoke>
- assumed: <claim> because <threshold or policy was not specified>
- unproven: <claim> needs <load, contract, environment, or recovery evidence>

Goal coverage:
- <goal>: <evidence or none> / <residual risk>

Skipped/unavailable:
- <evidence or environment> -> <architecture risk left open>
```

**Complete when:** every architecture goal is proven, checked, assumed, or
unproven; assumptions and unavailable evidence are never reported as passing.
