---
name: standards
description: Use before designing, implementing, refactoring, or reviewing DDD/backend architecture, Go services, domain boundaries, ports, events/messages, taskqueue/runtime boundaries, or database-backed backend persistence.
---

# Apply DDD Architecture Guardrails

Use this skill for DDD/backend architecture-sensitive work. This plugin is not a general standards router; it is a DDD-first backend guardrail.

## Workflow

1. Identify whether the task touches backend services, DDD/Clean Architecture boundaries, Go service structure, Domain/Application/Infrastructure ownership, ports, generated protocol DTOs, events/messages, taskqueue/runtime boundaries, or database-backed persistence.
2. Read [references/ddd-risk-router.md](references/ddd-risk-router.md) first. Use its risk cards to decide which deeper references are required.
3. Treat the files under [references/](references/) as this plugin's canonical DDD/backend reference set. Do not scan generic `design-patterns/` directories for this plugin; project-specific standards belong in explicit project docs or the legacy general architect plugin.
4. Read [references/ddd-agent-contract.md](references/ddd-agent-contract.md) when work touches DDD/business code, Go backend layering, event/message handlers, taskqueue processors, runtime module wiring, or code review of those areas.
5. Read deeper files only when the risk router, the task, or the Architecture Gate requires them:
   - [references/ddd-modeling.md](references/ddd-modeling.md) for bounded contexts, aggregate boundaries, technical capability classification, and Architecture Gate fields.
   - [references/ddd-core.md](references/ddd-core.md) for language-neutral layer ownership, ports, Domain Events, Integration Messages, generated protocol boundaries, and review checklist.
   - [references/ddd-golang.md](references/ddd-golang.md) for Go package layout, ConnectRPC shortcut, repositories, CQRS, logging, and Go DDD implementation.
   - [references/ddd-golang-events-messages.md](references/ddd-golang-events-messages.md) for Domain Event handlers, Boundary Publishers, Integration Message handlers, `message.Runner`, and Kafka adapter boundaries.
   - [references/ddd-golang-runtime.md](references/ddd-golang-runtime.md) for `cmd`, `fx`, config, lifecycle, graceful shutdown, and runtime module assembly.
   - [references/ddd-golang-taskqueue.md](references/ddd-golang-taskqueue.md) for taskqueue, polling, periodic producers, schema registry, processors, and asynq wiring.
   - [references/database.md](references/database.md) for schema/query/migration/persistence design.
6. State which DDD/backend standards apply and which risk cards triggered deeper reading.
7. If the request conflicts with an applicable DDD/backend standard, call out the conflict and choose the smallest compliant approach unless the user overrides it.

## DDD Architecture Gate

For DDD/backend implementation planning, execution, refactor, or code review, include a short architecture-standards note before code changes or review approval:

```text
Architecture standards:
- Applies: <patterns read>
- Risk cards: <cards triggered or none>
- Key constraints: <constraints affecting plan, code, or review>
- Not relevant: <patterns skipped, if useful>
- Conflicts: <none or explicit conflict>
```

When `ddd-modeling.md` is present and defines a richer DDD Architecture Gate, use that richer gate for business/domain changes. Do not emit both the generic note and the full DDD gate.

Stop before implementation or approval when a required gate answer is unknown, when a triggered full pattern has not been read, or when current code conflicts with dependency rules.

## Review Checklist

For DDD/backend reviews, check at least:

- Cross-context boundaries: no direct imports or calls into another context's Domain or Application layer.
- Generated protocol boundaries: Domain and semantic command-side ports do not depend on generated protocol DTOs.
- Application thickness: generated RPC methods remain thin protocol adapters.
- Port ownership: command-side Application ports exist only after capability classification rejects Domain, event/message, ACL, Repository, and Infrastructure homes.
- Async role isolation: Domain Event Handlers, Boundary Publishers, Integration Message Handlers, and task processors do not collapse into one umbrella processor.
- State decisions: business state classification lives behind Aggregate methods or Domain policies.
- Runtime boundaries: `cmd` selects modules and runs the app; provider-heavy wiring belongs in bounded-context modules, ACL/Infrastructure, or shared runtime modules.

For non-backend work, skip this plugin and use another explicit standards source if needed.
