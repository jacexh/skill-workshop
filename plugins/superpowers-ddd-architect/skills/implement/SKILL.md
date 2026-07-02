---
name: implement
description: Use when implementing or refactoring DDD/backend code after a design direction exists: placing code by layer, package paths, ports, DTO/proto mapping, repository/event/taskqueue/runtime/database wiring, Python or TypeScript backend modules, or guarding against boundary leaks.
---

# Implement DDD Code Placement

Use this skill to map accepted DDD decisions into code structure without crossing boundaries.

## When To Use

- Use after a design direction exists and before placing or editing backend code.
- Use during refactors when code movement could cross Domain/Application/Infrastructure boundaries.
- If bounded context, data authority, or invariant ownership is unknown, stop and use `design` first.
- If the work is only evaluating an existing diff, use `review`.

## Workflow

1. Calibrate the repository shape: bounded-context roots, layer names, generated-code locations, RPC handlers, runtime wiring, taskqueue/message conventions, and architecture tests/docs.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first. Rewrite probe examples to match the calibrated repo shape before using them.
3. Read [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for task classification, must-not rules, and completion checks.
4. Read only the references needed by the touched implementation path:
   - [../../references/ddd-golang.md](../../references/ddd-golang.md) for Go layers, package layout, repositories, CQRS, RPC adapters, and logging.
   - [../../references/ddd-python.md](../../references/ddd-python.md) for Python layers, modules, repositories, events, dependency-injector assembly, and tests.
   - [../../references/ddd-typescript.md](../../references/ddd-typescript.md) for TypeScript layers, modules, repositories, events, composition roots, and tests.
   - [../../references/ddd-golang-events-messages.md](../../references/ddd-golang-events-messages.md) for Domain Event handlers, Boundary Publishers, Integration Message handlers, and message runtime boundaries.
   - [../../references/ddd-golang-taskqueue.md](../../references/ddd-golang-taskqueue.md) for task processors, schema registry, periodic producers, polling, and asynq wiring.
   - [../../references/ddd-golang-runtime.md](../../references/ddd-golang-runtime.md) for `cmd`, `fx`, config, lifecycle, graceful shutdown, and runtime module assembly.
   - [../../references/database.md](../../references/database.md) for schema, query, migration, and persistence choices.

## Output

```text
DDD implementation:
- Repo calibration:
- Code placement by layer:
- Boundary mappings:
- Risk cards:
- Tests / verification:
- Conflicts:
```

Do not use implementation convenience to justify generated protocol leaks, fat RPC methods, umbrella processors, command-side Application ports without classification, or provider-heavy `cmd` wiring.
