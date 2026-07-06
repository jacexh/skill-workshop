# Integration Quality

Use this when the Evidence Gate selects an integration, API, contract, seam, or
E2E test. A high-value integration test proves that production components
cooperate at the boundary where real outages happen.

## Boundary Definitions

| Type | Purpose | Typical boundary | Does not prove |
| --- | --- | --- | --- |
| API | Externally visible interface contract | HTTP, gRPC, Connect, GraphQL, CLI | full internal workflow unless real collaborators are included |
| Integration | Production components cooperate | handler + service + repository + DB, producer + broker + consumer | browser journey or full deployment health |
| Seam / Contract | Two sides continue to agree | generated client/server, schema, topic, event, serializer | every business branch |
| E2E | Critical user/system journey works end to end | UI/client + backend + real dependencies | detailed rule coverage |

## Real Integration Test Requirements

A `real` integration test should satisfy these conditions unless there is a
stated, defensible exception:

1. At least two production components run together.
2. The risky internal collaborator is not mocked.
3. Production-like wiring is used closely enough to fail the same way: DI,
   middleware, migrations, serialization, config, broker/client, or storage.
4. Assertions check behavior, contract-visible state, durable state, messages,
   logs, metrics, traces, or key side effects.
5. Data is isolated and deterministic.
6. Async completion uses observable conditions, not fixed sleep.
7. Failure output gives enough context to locate the broken segment.

If the test mocks the service, repository, database, broker, storage layer, auth
middleware, generated contract, or config loader that carries the claimed risk,
it is not `real` for that risk.

## When To Choose Integration Or Contract Tests

Choose this evidence when lighter checks cannot catch:

- transaction boundaries, partial writes, optimistic locks, uniqueness, or
  migration drift
- request/response mapping, error codes, auth claims, tenancy filters, or
  resource ownership
- JSON/Protobuf/Avro/schema serialization, null semantics, enum drift, time
  precision, or timezone handling
- producer/consumer compatibility, topic/route wiring, retry, deduplication,
  dead-letter, or out-of-order delivery
- cache consistency, stale reads, idempotency keys, duplicate requests, or
  concurrent updates
- feature flags, environment variables, connection pools, timeouts, startup, or
  graceful shutdown
- security-sensitive paths such as path traversal, redaction, token scope,
  permission denial, or privilege escalation

## Coverage Shape

Do not duplicate every unit branch at the integration layer. Cover scenario
risks:

- API entry: route + parsing + auth + service + repository + side effect
- Write path: command + transaction + event/message/audit side effect
- Read path: filters + permission scope + pagination/sort + stale/cache behavior
- Async path: producer + broker/log + consumer/subscriber + eventual durable
  state
- Cross-service path: generated client + server + timeout/error mapping +
  compatibility assertion
- Migration path: current code reads historical data and writes the new shape
  safely
- Observability path: critical failure emits actionable diagnostic evidence

## Skip And Environment Rules

- A skipped integration test is not evidence for the current hand-off.
- Conditional skips are acceptable only when the missing dependency and residual
  risk are reported.
- Core integration tests should run in CI with pinned dependencies or controlled
  containers.
- Tests must not depend on local developer state, shared accounts, execution
  order, or persistent dirty data.
- Flaky integration tests must be fixed, quarantined with owner and reason, or
  excluded from evidence.
