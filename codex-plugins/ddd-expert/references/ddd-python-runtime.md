---
name: ddd-python-runtime
description: Python House Style for process composition, configuration, logging, telemetry, workers, and shutdown.
---

# Python Runtime

## Applies When

Load this leaf when Python process composition, shared resources, configuration,
logging, tracing, active loops, or shutdown is touched.

## Composition

`runtime/bootstrap.py` loads one `pydantic-settings` object, configures logging
and accepted tracing, constructs process resources, then constructs Bounded
Context adapters, handlers, registries, and Transport registrations. Use plain
constructors and typed registries.

Create one Engine per database and one shared synchronous `httpx.Client` per
compatible policy. Construct Kafka and Celery resources only in their dedicated
worker profiles. Domain/Application constructors perform no I/O.

FastAPI lifespan starts and closes resources in dependency order. Importing a
Domain, Application, Transport, or Infrastructure module registers no process
loop and opens no connection.

## Logging and Errors

Use `structlog` integrated with standard `logging`. The Transport/Runtime
execution owner emits one completion record containing operation, outcome,
duration, and safe identifiers. Application logs an independently valuable
business fact; Domain remains logging-free.

Bind available `request_id`, `trace_id`, `span_id`, and accepted correlation
identity. Configuration logging uses an allow-list of non-secret startup facts.
DSNs, credentials, tokens, payloads, SQL parameters, and unrestricted headers
remain excluded.

Translate a provider error at its first controlled boundary, retain its cause
with `raise StableError(...) from error`, and add further context only where a
new semantic owner exists.

## Telemetry and Shutdown

When tracing is accepted, Runtime configures the OpenTelemetry Python SDK, OTLP,
and applicable instrumentation before the instrumented resource starts. Runtime
owns context propagation, flush, and SDK shutdown; Domain remains telemetry-free.

Shutdown stops inbound admission, drains bounded in-flight work, closes worker
clients and HTTP clients, disposes Engines, then flushes logging/telemetry. Every
background worker has an owner and every wait has a configured bound.

## Verification

Verify settings validation and redaction, complete registration/reachability,
resource sharing, worker-profile selection, one completion record, trace
propagation when present, startup cleanup, and bounded shutdown.
