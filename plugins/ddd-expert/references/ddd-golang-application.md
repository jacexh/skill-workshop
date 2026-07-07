---
name: ddd-golang-application
description: Go / go-jimu Application-layer reference. Use when implementing or reviewing command handlers, Application services, generated RPC shortcut methods, event/message handler placement, task processor delegation, transaction orchestration, event dispatch timing, or execution-boundary logging.
---

# Go Application Layer Reference

Use this file after the model/design has accepted the use case and layer owner. Application coordinates Domain objects and ports; it does not decide Domain boundaries.

## 0. Go / go-jimu Application Building Block Lookup

| Object | Start here |
|---|---|
| Command Handler | §0.1 Command Handler Card |
| Application Service / coordination service | §0.2 Application Service Card |
| Domain Event Handler | §0.3 Domain Event Handler Placement Card |
| Boundary Publisher | §0.4 Boundary Publisher Placement Card |
| Integration Message Handler | §0.5 Integration Message Handler Placement Card |
| Task processor delegation | §0.6 Task Processor Placement Card |
| Generated RPC shortcut | §0.7 Generated RPC Shortcut Card |
| Execution-boundary logging | §0.8 Logging Card |

### 0.1 Command Handler Card

**Placement**

- `internal/business/<context>/application/command/<use_case>.go`
- Command types and command handlers live together unless the package already uses a narrower split.
- Exceptional command-side ports live beside the command that owns them, not in a generic `application/port` package.

**Required flow**

1. Map accepted command input into Domain values.
2. Load the aggregate through a Domain Repository.
3. Call Domain method(s) or Domain Service/policy.
4. Save the aggregate through the Repository.
5. Drain/dispatch Domain Events exactly once after successful save.
6. Log completion if this handler is the active execution boundary.

**Rules**

- Default write transaction changes one aggregate. Multi-aggregate same-transaction writes are high-risk deviations and require the deviation gate in `ddd-core.md`.
- Do not implement business rules by branching over aggregate state in the handler. Move the rule to Domain.
- Do not pass raw transactions, sessions, ORM objects, broker clients, Redis clients, or generated protocol DTOs into Domain.
- Do not dispatch events before successful persistence.
- After `Save()`, treat the aggregate instance as stale.

**Tests**

- Application tests mock Repository / QueryRepository / external boundary interfaces only.
- Test command-to-domain orchestration, transaction/event timing, error mapping, and completion-log outcome when logging is owned here.

### 0.2 Application Service Card

Use a named Application service when the use case has meaningful orchestration that is not a single command handler:

- coordinates multiple accepted ports;
- composes a command with read-side lookup, ACL, event/message publisher, or task enqueue;
- owns a use-case-level policy such as authorization, masking, idempotency, or retry admission.

Keep the service in `application/` or the relevant `application/<role>/` package. It should depend on Domain and Application-owned ports, not concrete Infrastructure.

If the service begins to classify Domain state, enforce lifecycle rules, or mutate multiple aggregates because it is convenient, return to `design`.

### 0.3 Domain Event Handler Placement Card

Role: same bounded-context reaction to a Domain Event after the producing aggregate has been saved.

- Place in `application/eventhandler/<event>.go`.
- Implement the handler contract described in [`ddd-golang-events-messages.md §0.3`](ddd-golang-events-messages.md).
- Handler may call Application services/ports, update read models, enqueue follow-up work, or publish messages through a Boundary Publisher path.
- Handler errors do not roll back the producing command.
- Handler owns idempotency posture and completion logging.

Do not consume another bounded context's Domain Event type. Use Integration Messages instead.

### 0.4 Boundary Publisher Placement Card

Role: translate selected same-BC Domain Events or explicit published facts into stable Integration Messages.

- Place in `application/messagepublisher/<event>_publisher.go`.
- Follow [`ddd-golang-events-messages.md §0.4`](ddd-golang-events-messages.md).
- Do not mutate aggregates.
- Do not consume Integration Messages.
- Map from Domain language to published language at this boundary.

### 0.5 Integration Message Handler Placement Card

Role: consume a published cross-context Integration Message.

- Place in `application/messagehandler/<message>.go`.
- Follow [`ddd-golang-events-messages.md §0.5`](ddd-golang-events-messages.md).
- Translate payload into receiving-context commands/Domain values.
- Own idempotency, skip/retry/failure outcome, transaction boundary, and completion log.
- Keep broker offsets/topics/partitions and Kafka failure policy in Infrastructure/runtime.

### 0.6 Task Processor Placement Card

Role: execute one durable task contract.

- Place processor in `application/taskprocessor/<task>.go`.
- Follow [`ddd-golang-taskqueue.md §0.2`](ddd-golang-taskqueue.md).
- Processor decodes validated payload, calls an Application use case or Domain workflow, handles retry/skip/idempotency, and logs completion.
- Task schema, periodic producer, enqueue policy, and asynq runtime wiring are separate concerns routed by `ddd-golang-taskqueue.md`.
- Domain never imports taskqueue.

### 0.7 Generated RPC Shortcut Card

The Go shortcut is allowed only when the repository already implements generated ConnectRPC/gRPC service stubs from `application/application.go`, or the accepted design chooses that convention.

Allowed in `application/application.go`:

- protocol request -> command/query mapping;
- small actor/auth extraction needed to build the command/query;
- one delegate call to a command/query handler or trivial QueryRepository read;
- protocol response/error mapping.

Prohibited:

- Repository calls;
- aggregate mutation;
- transaction control;
- event dispatch;
- task enqueueing;
- multi-port orchestration;
- business condition branches;
- generated/protocol types leaking into Domain or use-case packages.

When a generated RPC method grows beyond `map -> delegate once -> map response/error`, move orchestration to `application/command`, `application/query`, or a named Application service.

### 0.8 Logging Card

If Application is the execution boundary, it emits one completion log for every success, failure, skip, or retry.

Required fields:

- `operation`
- `outcome`
- `duration_ms`
- relevant business IDs (`tenant_id`, `aggregate_id`, `message_id`, etc.)
- `sloghelper.Error(err)` on failure

Do not duplicate an error log already emitted by outer middleware. Do not replace completion logs with only `started` or `requested` logs.

## Application File Layout

| Path | Contents |
|---|---|
| `application/application.go` | Application constructor and optional generated RPC shortcut |
| `application/command/<use_case>.go` | command type, handler, command-owned exceptional port |
| `application/query/**` | see [`ddd-golang-cqrs.md`](ddd-golang-cqrs.md) |
| `application/eventhandler/<event>.go` | same-BC Domain Event Handler |
| `application/messagepublisher/<event>_publisher.go` | Domain Event -> Integration Message Boundary Publisher |
| `application/messagehandler/<message>.go` | Integration Message Handler |
| `application/taskprocessor/<task>.go` | taskqueue Processor |
| `application/assembler.go` | DTO/protocol/Data Object mapping helpers when shared by Application boundary code |

## Common Misplacements

- Generic `application/port` package containing unrelated interfaces.
- Command handler introduces `Cacher`, `Peer`, `Directory`, `TxManager`, `UnitOfWork`, or broker client ports without the modeling gate.
- Generated RPC handler directly saves aggregates or dispatches events.
- Event handler and message handler share one umbrella processor with mixed roles.
- Handler logs inside Domain or logs the same returned error twice.
