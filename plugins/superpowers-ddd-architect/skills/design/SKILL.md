---
name: design
description: Use when designing DDD/backend behavior before implementation: bounded contexts, aggregates, ubiquitous language, technical capability classification, Domain/Application/Infrastructure ownership, events/messages, taskqueue/runtime boundary decisions, or database-backed persistence design.
---

# Design DDD Boundaries

Use this skill to turn a backend change request into explicit DDD boundaries before code is placed.

## Workflow

1. Confirm the work is DDD/backend architecture-sensitive. For non-backend work, stop using this plugin.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first. Use it to identify likely design risks; its probe examples are calibration aids, not fixed commands.
3. Do not scan generic `design-patterns/` directories for this plugin. This plugin's shared references live under [../../references/](../../references/).
4. Read [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for bounded contexts, stable language, aggregate boundaries, technical capability classification, and Architecture Gate fields.
5. Read [../../references/ddd-core.md](../../references/ddd-core.md) when design choices involve layer ownership, ports, Domain Events, Integration Messages, or generated protocol boundaries.
6. Read Go/runtime/taskqueue/database references only when the design decision needs those constraints.

## Output

```text
DDD design:
- Bounded context / capability:
- Stable language and data authority:
- Aggregate, policy, or service boundary:
- Technical capability classification:
- Layer ownership:
- Risk cards:
- Proceed / Stop:
```

Stop before implementation when the bounded context, data authority, invariant, or technical capability classification is unknown.
