---
name: implement
description: Use when implementing or refactoring DDD/backend code after a design direction exists or when backend code placement could cross Domain/Application/Infrastructure boundaries.
---

# Implement DDD Model Placement

Use this skill to map accepted DDD model decisions into code structure without crossing boundaries.

## When To Use

- Use after a design direction exists and before placing or editing backend code.
- Use during refactors when code movement could cross Domain/Application/Infrastructure boundaries.
- If bounded context, data authority, or invariant ownership is unknown, stop and use `design` first.
- If the work is only evaluating an existing diff, use `review`.

## Workflow

1. Run the Design input check before editing. Confirm the accepted design or Architecture Gate names the bounded context/capability, stable language/data authority, aggregate/policy/service boundary, invariants, commands/queries/events, and layer ownership. If these are missing, stop and use `design` first.
2. Calibrate the repository shape: bounded-context roots, layer names, generated-code locations, RPC handlers, runtime wiring, taskqueue/message conventions, and architecture tests/docs.
3. Build the Model-to-code placement plan:
   - each command/query/event/reaction/read model to implement;
   - owning layer and file/module/package;
   - Domain type versus DTO/proto/data-object mapping boundary;
   - Repository, QueryRepository, port, event/message, runtime, or database mechanism involved;
   - transaction, failure, idempotency, and event-drain boundary;
   - test or verification target for the behavior.
4. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) first. Rewrite probe examples to match the calibrated repo shape before using them.
5. Read [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for task classification, must-not rules, and completion checks.
6. Read only the references needed by the touched implementation path:
   - [../../references/ddd-golang.md](../../references/ddd-golang.md) for Go layers, package layout, repositories, CQRS, RPC adapters, and logging.
   - [../../references/ddd-python.md](../../references/ddd-python.md) for Python layers, modules, repositories, events, dependency-injector assembly, and tests.
   - [../../references/ddd-typescript.md](../../references/ddd-typescript.md) for TypeScript layers, modules, repositories, events, composition roots, and tests.
   - [../../references/ddd-golang-events-messages.md](../../references/ddd-golang-events-messages.md) for Domain Event handlers, Boundary Publishers, Integration Message handlers, and message runtime boundaries.
   - [../../references/ddd-golang-taskqueue.md](../../references/ddd-golang-taskqueue.md) for task processors, schema registry, periodic producers, polling, and asynq wiring.
   - [../../references/ddd-golang-runtime.md](../../references/ddd-golang-runtime.md) for `cmd`, `fx`, config, lifecycle, graceful shutdown, and runtime module assembly.
   - [../../references/database.md](../../references/database.md) for schema, query, migration, and persistence choices.
7. Keep an Implementation trace: every new or changed file should be traceable to a model decision, boundary mapping, or risk card. Do not add files only because a framework or adapter exposes a convenient shape.

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
