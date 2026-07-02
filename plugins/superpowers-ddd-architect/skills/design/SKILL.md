---
name: design
description: Use when designing DDD/backend behavior before implementation from a product-oriented spec, change request, or unclear backend boundary.
---

# Design DDD Model

Use this skill as the design-phase entry point. It routes the agent to the design playbook and keeps the output contract small.

## When To Use

- Use before file placement or implementation when the bounded context, aggregate/policy/service boundary, data authority, or layer ownership is not explicit.
- Do not use as a code audit checklist. Use `review` once a diff, plan, or concrete file set exists.
- Do not use as an implementation placement checklist. Use `implement` after the design direction is accepted.

## Workflow

1. Confirm the work is DDD/backend architecture-sensitive. For non-backend work, stop using this plugin.
2. Read the default entry pair: [../../references/ddd-design-playbook.md](../../references/ddd-design-playbook.md) for the design thinking framework and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for risk-card routing. Router probes are calibration aids, not fixed commands.
3. Follow the playbook's Product semantics intake, Spec trace, semantic classification, boundary decision, and stop/proceed gate.
4. Use the playbook's Minimum Output Contract: keep small changes small, use the full template only when the model changes, and emit stop questions instead of guesses.
5. Do not scan generic `design-patterns/` directories for this plugin. This plugin's shared references live under [../../references/](../../references/).
6. Read deeper references only when the design playbook, risk card, or unresolved decision requires them:
   - [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for bounded context, aggregate, state, and technical-capability classification.
   - [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Domain Events, Integration Messages, and generated protocol boundaries.
   - [../../references/database.md](../../references/database.md) after data authority and aggregate/read-model boundaries are clear.
   - Active language or Go support references only when implementation shape constrains the design.

## Output

```text
DDD design:
- Product semantics intake:
  - Actors / users:
  - Business capability:
  - User actions / system triggers:
  - Product-visible outcomes:
  - Business rules / invariants:
  - Data authority / source of truth:
  - State lifecycle:
  - External collaborators:
  - Read/query needs:
- Spec trace:
- Repo calibration:
- Bounded context / capability:
- Stable language and data authority:
- Aggregate, policy, or service boundary:
- Technical capability classification:
- Commands / queries / events:
- Layer ownership:
- Risk cards:
- Stop questions:
- Proceed / Stop:
```

Stop before implementation when the bounded context, data authority, invariant, state lifecycle, cross-context contract, or technical capability classification is unknown.
