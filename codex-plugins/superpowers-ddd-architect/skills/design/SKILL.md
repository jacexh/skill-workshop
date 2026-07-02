---
name: design
description: Use when designing DDD/backend behavior before implementation from a product-oriented spec, change request, or unclear backend boundary.
---

# Design DDD Boundaries From Product Semantics

Use this skill to turn product semantics into explicit DDD boundaries before code is placed.

## When To Use

- Use before file placement or implementation when the bounded context, aggregate/policy/service boundary, data authority, or layer ownership is not explicit.
- Do not use as a code audit checklist. Use `review` once a diff, plan, or concrete file set exists.
- Do not use as an implementation placement checklist. Use `implement` after the design direction is accepted.

## Workflow

1. Confirm the work is DDD/backend architecture-sensitive. For non-backend work, stop using this plugin.
2. Build the Product semantics intake from the request/spec before file placement, schema design, or layer decisions:
   - actors/users;
   - business capability;
   - user actions and system triggers;
   - product-visible outcomes;
   - business rules and invariants;
   - data authority/source of truth;
   - state lifecycle;
   - external collaborators;
   - read/query needs;
   - unknowns that would change the model.
3. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first as the reference router. Use it to identify likely design risks; its probe examples are calibration aids, not fixed commands.
4. Do not scan generic `design-patterns/` directories for this plugin. This plugin's shared references live under [../../references/](../../references/).
5. Read [../../references/ddd-modeling.md](../../references/ddd-modeling.md) as the modeling method for bounded contexts, stable language, aggregate boundaries, technical capability classification, and Architecture Gate fields. Do not treat the reference list as a substitute for modeling the spec.
6. Read [../../references/ddd-core.md](../../references/ddd-core.md) when design choices involve layer ownership, commands, queries, ports, Domain Events, Integration Messages, or generated protocol boundaries.
7. Read the active language reference only when the design decision needs implementation-shape constraints:
   - [../../references/ddd-golang.md](../../references/ddd-golang.md) for Go.
   - [../../references/ddd-python.md](../../references/ddd-python.md) for Python.
   - [../../references/ddd-typescript.md](../../references/ddd-typescript.md) for TypeScript.
8. Read Go runtime/taskqueue/event-message or database references only when the design decision explicitly needs those constraints. Database guidance is not part of the default design intake; load it after data authority and aggregate/read-model boundaries are clear.
9. Keep a Spec trace: every bounded context, invariant, command, query, event/message, and stop question should point back to a product requirement or an explicit unknown.

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
