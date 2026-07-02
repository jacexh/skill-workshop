---
name: design
description: Use when designing DDD/backend behavior before implementation: bounded contexts, aggregates, ubiquitous language, technical capability classification, Domain/Application/Infrastructure ownership, language-specific backend layout, events/messages, taskqueue/runtime boundary decisions, or database-backed persistence design.
---

# Design DDD Boundaries

Use this skill to turn a backend change request into explicit DDD boundaries before code is placed.

## When To Use

- Use before file placement or implementation when the bounded context, aggregate/policy/service boundary, data authority, or layer ownership is not explicit.
- Do not use as a code audit checklist. Use `review` once a diff, plan, or concrete file set exists.
- Do not use as an implementation placement checklist. Use `implement` after the design direction is accepted.

## Workflow

1. Confirm the work is DDD/backend architecture-sensitive. For non-backend work, stop using this plugin.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first. Use it to identify likely design risks; its probe examples are calibration aids, not fixed commands.
3. Do not scan generic `design-patterns/` directories for this plugin. This plugin's shared references live under [../../references/](../../references/).
4. Read [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for bounded contexts, stable language, aggregate boundaries, technical capability classification, and Architecture Gate fields.
5. Read [../../references/ddd-core.md](../../references/ddd-core.md) when design choices involve layer ownership, ports, Domain Events, Integration Messages, or generated protocol boundaries.
6. Read the active language reference only when the design decision needs implementation-shape constraints:
   - [../../references/ddd-golang.md](../../references/ddd-golang.md) for Go.
   - [../../references/ddd-python.md](../../references/ddd-python.md) for Python.
   - [../../references/ddd-typescript.md](../../references/ddd-typescript.md) for TypeScript.
7. Read Go runtime/taskqueue/event-message or database references only when the design decision needs those constraints.

## Output

```text
DDD design:
- Repo calibration:
- Bounded context / capability:
- Stable language and data authority:
- Aggregate, policy, or service boundary:
- Technical capability classification:
- Layer ownership:
- Risk cards:
- Proceed / Stop:
```

Stop before implementation when the bounded context, data authority, invariant, or technical capability classification is unknown.
