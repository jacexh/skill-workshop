---
name: ddd-typescript-runtime
description: TypeScript House Style for composition, configuration, Pino logging, telemetry, active loops, and shutdown.
---

# TypeScript Runtime

## Applies When

Load this leaf when TypeScript process composition, configuration, shared
resources, logging, telemetry, listeners, workers, or shutdown is touched.

## Composition

Runtime validates configuration before opening resources. Composition uses
typed factories and ordinary variables. Construct shared Kysely/mysql2, Pino,
Fastify, and accepted provider resources, pass the minimum dependencies into
each `<context>.ts`, combine returned routes/subscribers/processors, then start
active loops.

Platform owns the Fastify listener and interceptors, Kysely pool, Kafka loops,
BullMQ workers/schedulers, readiness, and provider registration. A constructed
subscriber or processor becomes live only when Runtime registers and starts its
owner.

## Logging and Errors

Use Pino structured records with one completion owner per execution boundary:
Fastify for HTTP/Connect, Kafka Runtime for messages, and BullMQ Runtime for
tasks. Stable fields include applicable `operation`, `outcome`, `duration_ms`,
`request_id`, `message_id`, `task_id`, `attempt`, `trace_id`, and `span_id`.

Log `Error` objects under Pino's configured error field. Application emits only
independently useful business semantics; Domain remains logging-free.
Configuration/startup logging uses an allow-list and excludes environments,
DSNs, credentials, certificates, and payloads.

## Telemetry and Lifecycle

When telemetry is accepted, initialize OpenTelemetry JS 2 Node SDK and OTLP
before instrumented libraries. The compiled ESM artifact uses the current
loader hook required by its instrumentation. Runtime propagates W3C context and
owns SDK shutdown.

Startup orders telemetry/configuration, shared clients, Bounded Contexts,
listeners, consumers, and workers. Shutdown stops admission, drains with a
configured bound, closes provider clients and Kysely, then shuts down telemetry.
Unexpected loop exit is reported to the process entrypoint.

## Verification

Verify config validation/redaction, complete registrations, resource sharing,
listener and worker reachability, one completion record, representative tracing
when present, startup cleanup, and bounded shutdown in the compiled artifact.
