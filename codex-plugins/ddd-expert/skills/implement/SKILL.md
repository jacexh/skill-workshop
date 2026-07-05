---
name: implement
description: Use when implementing or refactoring DDD/backend code after a design direction exists, especially when code placement could cross Domain/Application/Infrastructure boundaries or touch backend runtime, generated RPC/protocol, persistence/database, logging, or test seams.
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
3. Run the Preflight Rule Gate before file edits. Turn explicit user requirements into acceptance items, classify touched surfaces, load required references, and write placement decisions.
4. Run Placement Translation Gates before choosing files. Record the Accepted model source and load only the deeper reference needed to translate that model into code.
5. Follow Design input check, Model-to-code placement, boundary mapping, mechanism containment, and Implementation trace.
6. Use the Minimum Output Contract: keep small layer-local changes small, use the full template when boundaries or mechanisms change, and stop when design direction is missing.
7. Read only the deeper references needed by touched implementation paths:
   - [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) for task classification, must-not rules, and completion checks.
   - Active language guide for file/module/package shape.
   - Event/message, queue/scheduler, runtime, or database references only when those concerns are touched.
8. When adding or moving generated IDL/RPC adapters, calibrate existing adapter placement before creating files. In repos that use a language-specific shortcut, generated adapter implementations stay in the existing entry point and remain thin; do not create a physical `interfaces/` package only because the generic layer model names an Interface layer. If implementation exposes a missing or contradictory model decision, stop and use `design`.

## Preflight Rule Gate

Run this gate before file edits. Do not start implementation after only saying that a reference was read; classify the change from evidence, record the triggered rule surfaces, and write the concrete checks that will decide whether the change is acceptable.

1. Turn explicit user requirements into acceptance items. Include named technologies, protocol choices, placement requirements, config layout, database engine/schema rules, logging requirements, and test expectations stated by the user.
2. Classify touched surfaces from user requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and existing conventions.
3. Use the surface router below to choose references and pre-edit checks. The table is a router, not an inventory. Add or rename surfaces from repository evidence when the change touches a stable capability not named here, such as a product projection, security/auth boundary, cache, external API, scheduler, search/indexing adapter, or observability boundary.
4. If a surface is triggered, load the required reference before choosing files and carry its checklist into the implementation trace. Do not stop at these rows when the repository evidence points to another rule family.
5. Write placement decisions for each triggered surface before editing files. If a decision conflicts with the accepted model or user acceptance item, stop and return to `design` or ask the user.
6. After implementation, fill the Rules Satisfied / Not Applicable / Exception table. Exceptions need an explicit user or local-repo reason; convenience is not an exception.

| Trigger evidence | Required route | Required pre-edit checks |
|---|---|---|
| `cmd/**, configs/**, internal/pkg/**`, `fx.Module`, `fx.Lifecycle`, `OnStart`, `OnStop`, server/client runtime wiring | `ddd-golang-runtime.md` plus active language guide | `cmd/<service>/main.go` only loads config, supplies aggregate `Option`, selects modules, sets process options such as `fx.StopTimeout`, and calls `app.Run()`; component `Option` structs live with their component; shared middleware/runtime adapters live in `internal/pkg/<capability>`; process entrypoint does not construct repositories, muxes, route handlers, or raw clients except with a written process-owned exception. |
| `proto/**, pkg/gen/**, ConnectRPC, gRPC`, generated handlers, request/response codecs | active language guide and Generated Protocol/Fat Generated RPC risk cards | Prefer generated proto/client/handler contracts over handwritten DTO/codec unless explicitly accepted; Domain and use-case packages do not import generated/protocol types; when the Go RPC shortcut applies, `application/application.go` implements the generated stub directly and each method stays map -> delegate once -> map response/error; do not create `interfaces/grpc`, `interfaces/connectrpc`, or similar packages only to house generated RPC adapters. |
| `scripts/sql/**, migrations/**, repository/DO/persistence`, schema, optimistic lock, SQL timestamps | `database.md` plus active language guide persistence section | Tables include the standard fields; SQL time columns use `bigint NOT NULL DEFAULT '0'` Unix milliseconds, not `timestamp`/`datetime`; DOs use the project timestamp value type when present and converters map Domain time explicitly; soft-delete queries filter `deleted_at`; optimistic lock increments happen in SQL (`version = version + 1` / ORM increment), not by mutating Domain version in Go. |
| `slog`, `sloghelper`, execution-boundary logs, lifecycle/worker/handler logging | `ddd-golang.md` logging section and `ddd-golang-runtime.md` runtime logging section | Process logger uses the adopted logging helper where required; each execution boundary emits one completion log with `operation`, `outcome`, `duration_ms`, relevant IDs, and `sloghelper.Error(err)` for errors; start/request logs do not replace completion logs. |
| Any other repository-specific surface | Relevant risk-router card, local convention, spec/ADR, neighboring implementation, and active language/runtime reference | Name the semantic capability, owner, boundary mapping, failure behavior, required tests, and any accepted exception before editing. |

Placement decisions to record when triggered:

- **Surface classification:** evidence that triggered each standard or repo-specific surface and why no other high-risk surface applies.
- **Generated RPC placement:** generated code path, handler/stub convention, whether the shortcut applies, and where request/proto mapping happens.
- **Runtime/config placement:** aggregate `Option` location, component `Option` owners, selected fx modules, lifecycle owner, and shutdown order impact.
- **Persistence placement:** repository/query repository owner, DO/converter boundary, schema/migration location, timestamp representation, version increment strategy, and transaction boundary.
- **Logging placement:** execution boundary that owns the completion log and whether an outer middleware already logs the operation.
- **Acceptance checklist:** each explicit user requirement mapped to a file/test/verification target.

Test seam suggestions from the gate:

- Generated RPC mapping test for request -> command/query, single delegate, response/error mapping.
- real schema test or migration/schema verification for MySQL standard fields, timestamp types, indexes, and optimistic-lock SQL.
- fx graph/config profile test for aggregate `Option`, profile loading, module selection, and config ownership.
- lifecycle test for synchronous listen/start failure, graceful shutdown, and completion-log behavior when runtime work is touched.

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
- User acceptance checklist:
- Repo calibration:
- Preflight rule gate:
  - Triggered surfaces:
  - References loaded:
  - Placement decisions:
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
- Rules Satisfied / Not Applicable / Exception:
  - Rule:
  - Status:
  - Evidence or exception reason:
- Tests / verification:
- Conflicts / stop conditions:
```

Do not use implementation convenience to justify generated protocol leaks, fat generated adapter methods, umbrella processors, command-side Application ports without classification, provider-heavy entrypoint/composition wiring, or database/message/runtime mechanics escaping into the model.
