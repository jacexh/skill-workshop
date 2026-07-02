---
name: DDD Implement Playbook
description: Phase playbook for mapping accepted DDD model decisions into code placement, boundary mappings, and tests.
---

# DDD Implement Playbook

Use this with `ddd-risk-router.md` when a design direction exists and code will be created, moved, or refactored. The goal is a trace from model decisions to files and tests.

## Inputs

- Accepted DDD design, Architecture Gate, or explicit user decision.
- Repo calibration from the risk router.
- Touched language, bounded context, APIs, generated code, runtime, events/messages, taskqueue, database, and tests.

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

## Reference Routing

- Read the active language guide when file/package/module shape matters.
- Read `ddd-agent-contract.md` when task classification or must-not rules matter.
- Read `ddd-core.md` for layer ownership, ports, event/message boundaries, and generated type boundaries.
- Read event/message, taskqueue, runtime, or database references only when the touched path enters that concern.

## Minimum Output Contract

Use the smallest output that preserves traceability.

- **Small change:** emit only Design input check, changed files, layer ownership, boundary mapping if any, references loaded, and tests/verification. Use this when the accepted model is unchanged and the patch stays inside one known layer.
- **Full implementation:** emit the complete output below. Use this when the change adds or moves a command/query/event/reaction, introduces a port/repository/adapter, touches generated type mapping, crosses layers, changes runtime/taskqueue/event/database behavior, or implements a new model decision.
- **Stop-only:** if design direction, data authority, invariant ownership, or layer ownership is missing, stop and ask for design rather than guessing a placement.

## Output

```text
DDD implementation:
- Design input check:
- Repo calibration:
- Model-to-code placement:
- Boundary mappings:
- Mechanism containment:
- Implementation trace:
- References loaded:
- Tests / verification:
- Conflicts / stop conditions:
```

## Common Mistakes

- Treating implementation convenience as design approval.
- Adding command-side Application ports before capability classification.
- Letting generated protocol types enter Domain or semantic command-side ports.
- Placing runtime/module/provider wiring in `cmd` because it is easy to wire there.
- Creating one interface per adapter method instead of one semantic capability lifecycle.
