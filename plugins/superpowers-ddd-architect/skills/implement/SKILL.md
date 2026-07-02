---
name: implement
description: Use when implementing or refactoring DDD/backend code after a design direction exists or when backend code placement could cross Domain/Application/Infrastructure boundaries.
---

# Implement DDD Model

Use this skill as the implementation-phase entry point. It routes the agent to the implementation playbook and keeps the output contract small.

## When To Use

- Use after a design direction exists and before placing or editing backend code.
- Use during refactors when code movement could cross Domain/Application/Infrastructure boundaries.
- If bounded context, data authority, or invariant ownership is unknown, stop and use `design` first.
- If the work is only evaluating an existing diff, use `review`.

## Workflow

1. Confirm a design direction exists. If bounded context, data authority, invariant ownership, or layer ownership is missing, stop and use `design`.
2. Read the default entry pair: [../../references/ddd-implement-playbook.md](../../references/ddd-implement-playbook.md) for the implementation thinking framework and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for risk-card routing. Rewrite probe examples to match the calibrated repo shape before using them.
3. Follow the playbook's Design input check, Model-to-code placement, boundary mapping, mechanism containment, and Implementation trace.
4. Use the playbook's Minimum Output Contract: keep small layer-local changes small, use the full template when boundaries or mechanisms change, and stop when design direction is missing.
5. Read only the deeper references needed by touched implementation paths:
   - [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for task classification, must-not rules, and completion checks.
   - Active language guide for file/module/package shape.
   - Go event/message, taskqueue, runtime, or database references only when those concerns are touched.

## Output

```text
DDD implementation:
- Design input check:
- Repo calibration:
- Model-to-code placement:
  - Command / query / event / reaction:
  - Owning layer and file/module/package:
  - Domain / DTO / proto / data-object mapping:
  - Repository / port / event-message / runtime / database mechanism:
  - Transaction / failure / idempotency boundary:
  - Test or verification target:
- Implementation trace:
- Code placement by layer:
- Boundary mappings:
- Risk cards:
- Tests / verification:
- Conflicts / stop conditions:
```

Do not use implementation convenience to justify generated protocol leaks, fat RPC methods, umbrella processors, command-side Application ports without classification, provider-heavy `cmd` wiring, or database/message/runtime mechanics escaping into the model.
