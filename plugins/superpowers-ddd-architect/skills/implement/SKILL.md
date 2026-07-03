---
name: implement
description: Use when implementing or refactoring DDD/backend code after a design direction exists or when backend code placement could cross Domain/Application/Infrastructure boundaries.
---

# Implement DDD Model

Use this skill when an accepted DDD model or explicit existing model will be translated into code. Implementation maps model decisions to files and tests; it does not invent model decisions.

## When To Use

- Use after a design direction exists and before placing or editing backend code.
- Use during refactors when code movement could cross Domain/Application/Infrastructure boundaries.
- If bounded context, data authority, or invariant ownership is unknown, stop and use `design` first.
- If the work is only evaluating an existing diff, use `review`.

## Workflow

1. Confirm a design direction exists. If bounded context, data authority, invariant ownership, or layer ownership is missing, stop and use `design`.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for shared risk-card routing. Rewrite probe examples to match the calibrated repo shape before using them.
3. Run Placement Translation Gates before choosing files. Record the Accepted model source and load only the deeper reference needed to translate that model into code.
4. Follow Design input check, Model-to-code placement, boundary mapping, mechanism containment, and Implementation trace.
5. Use the Minimum Output Contract: keep small layer-local changes small, use the full template when boundaries or mechanisms change, and stop when design direction is missing.
6. Read only the deeper references needed by touched implementation paths:
   - [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for task classification, must-not rules, and completion checks.
   - Active language guide for file/module/package shape.
   - Event/message, queue/scheduler, runtime, or database references only when those concerns are touched.
7. When adding or moving generated IDL/RPC adapters, calibrate existing adapter placement before creating files. In repos that use a language-specific shortcut, generated adapter implementations stay in the existing entry point and remain thin; do not create a physical `interfaces/` package only because the generic layer model names an Interface layer. If implementation exposes a missing or contradictory model decision, stop and use `design`.

## Placement Translation Gates

Run these gates before choosing files. A gate is triggered by touched paths, generated artifacts, or a proposed new boundary; when triggered, record the accepted model source, the translation decision, and the deeper reference needed for code placement.

- **Accepted model source:** name the design/spec/Architecture Gate/existing model decision being implemented. If no accepted model exists and the change is not a small layer-local refactor, stop and return to design.
- **Adapter and entrypoint translation:** map accepted protocol, adapter, and composition decisions to existing repo conventions before creating packages or files. Use `ddd-risk-router.md` for high-risk adapter, generated-type, and entrypoint cards.
- **Boundary mapping translation:** record where DTO/protocol/data-object mapping happens and which layer owns each translation.
- **Mechanism containment translation:** place database, broker, retry, runtime, scheduler, and SDK mechanics behind the semantic owner named by the design.
- **Test translation:** map each accepted model decision to the narrowest verification target that can catch a regression.

If implementation exposes a missing or contradictory model decision, stop and return to design. Do not make the implementation patch become the design authority.

## Thinking Framework

### 1. Design input check

Before editing, confirm the model names:

- bounded context/capability;
- stable language and data authority;
- aggregate, policy, service, or explicit none;
- invariants and state lifecycle;
- commands, queries, events, messages, or reactions to implement;
- layer ownership and known stop conditions.

If these are missing and material, stop and use `design`.

### 2. Model-to-code placement

Map each model decision to code:

- **Domain:** Aggregate methods, Value Objects, Domain Services, Domain Events, Repository interfaces, domain policies.
- **Application:** command/query handlers, orchestration services, QueryRepository/read facades, DTO assemblers, event/message coordination.
- **Interface:** HTTP/RPC adapters, request/response validation, protocol mapping.
- **Infrastructure:** Repository implementations, database objects, message adapters, runtime wiring, external clients, generated protocol adapters.

For generated IDL/RPC adapters, first record the calibrated adapter placement. If the repository uses a language-specific shortcut, keep the generated adapter implementation in that existing entry point and make it thin: map request, delegate once to command/query/application service, map response/error. Do not propose a new `interfaces/` package solely because the generic layer model has an Interface layer.

For every new or changed file, write why that layer owns it.

### 3. Boundary mappings

Keep boundary translations explicit:

- protocol DTO/proto to Domain command/value object;
- Domain entity/value object to application DTO/read model;
- Domain entity to data object and back;
- Domain Event to Integration Message;
- Application request to Infrastructure mechanism hidden behind the semantic owner.

### 4. Mechanism containment

Check that database, broker, retry, routing, runtime, and SDK mechanics stay behind Repository, QueryRepository, event/message publisher, ACL, or Infrastructure adapters unless the design names them as semantic capabilities.

### 5. Implementation trace

For each change, record:

- model decision or risk card that required it;
- file/module/package touched;
- boundary mapping used;
- test or verification target;
- unresolved conflict or stop condition.

## Minimum Output Contract

Use the smallest output that preserves traceability.

- **Small change:** emit only Design input check, changed files, layer ownership, boundary mapping if any, references loaded, and tests/verification. Use this when the accepted model is unchanged and the patch stays inside one known layer.
- **Full implementation:** emit the complete output below. Use this when the change adds or moves a command/query/event/reaction, introduces a port/repository/adapter, touches generated type mapping, crosses layers, changes runtime/taskqueue/event/database behavior, or implements an accepted model decision.
- **Stop-only:** if design direction, data authority, invariant ownership, or layer ownership is missing, stop and ask for design rather than guessing a placement.

## Output

```text
DDD implementation:
- Design input check:
- Accepted model source:
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

Do not use implementation convenience to justify generated protocol leaks, fat generated adapter methods, umbrella processors, command-side Application ports without classification, provider-heavy entrypoint/composition wiring, or database/message/runtime mechanics escaping into the model.
