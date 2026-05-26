# Integration Quality Standard

Use this when writing or reviewing integration, API, contract, seam, or E2E tests. The standard is intentionally stricter than "the test starts two things." A high-value integration test proves that production components cooperate correctly at the boundary where real outages happen.

## Boundary Definitions

| Type | Purpose | Typical boundary | Does not prove |
| --- | --- | --- | --- |
| Unit | One rule or module behaves correctly | pure function, aggregate, reducer, parser | storage, network, runtime wiring |
| API | Externally visible interface contract | HTTP, gRPC, Connect, GraphQL, CLI | full internal workflow unless real collaborators are included |
| Integration | Multiple production components cooperate | handler + service + repository + DB, producer + broker + consumer | browser journey or full deployment health |
| Seam / Contract | Two sides continue to agree | generated client/server, schema, topic, event, serializer | every business branch |
| E2E | Critical user/system journey works end to end | UI/client + backend + real dependencies | detailed rule coverage |

## Real Integration Test Requirements

A `real` integration test should satisfy these conditions unless there is a stated, defensible exception:

1. At least two production components run together.
2. The risky internal collaborator is not mocked.
3. Production-like wiring is used: dependency injection, middleware, migrations, serialization, and config match the real path closely enough to fail the same way.
4. Assertions check behavior, contract-visible state, durable state, messages, logs, metrics, or other key side effects.
5. The test covers at least one meaningful failure mode when the boundary is risk-bearing.
6. Data is isolated and deterministic.
7. Async completion uses observable conditions, not fixed sleep.
8. Failure output gives enough context to locate the broken segment.

If a test mocks the service, repository, database, broker, storage layer, auth middleware, or generated contract that carries the claimed risk, it is not a `real` integration test for that risk.

## High-Value Integration Risks

Prioritize integration tests for failures that unit tests rarely catch:

- transaction boundaries, partial writes, optimistic locks, uniqueness, and migration drift
- request/response mapping, error codes, auth claims, tenancy filters, and resource ownership
- JSON/Protobuf/Avro/schema serialization, null semantics, enum drift, time precision, and timezone handling
- producer/consumer compatibility, topic/route wiring, retry, deduplication, dead-letter, and out-of-order delivery
- cache consistency, stale reads, idempotency keys, duplicate requests, and concurrent updates
- feature flags, environment variables, connection pools, timeouts, startup initialization, and graceful shutdown
- security-sensitive paths: path traversal, redaction, token scope, permission denial, and privilege escalation

## Coverage Shape

Do not duplicate every unit branch at the integration layer. Cover scenario-level risks:

- API entry: route + parsing + auth + service + repository + persisted side effect
- Write path: command + transaction + event/message/audit side effect
- Read path: filters + permission scope + pagination/sort + stale/cache behavior if applicable
- Async path: producer + broker/log + consumer/subscriber + eventual durable state
- Cross-service path: generated client + server + timeout/error mapping + compatibility assertion
- Migration path: current code reads historical data and writes the new shape safely
- Observability path: critical failure emits actionable log/metric/trace signal when that signal is part of operations

## Skip And Environment Rules

- A skipped integration test is not verification evidence for the current hand-off.
- Conditional skips are acceptable only when the missing dependency is documented and the residual risk is reported.
- Core integration tests should run in CI with pinned dependency versions or controlled containers.
- Tests must not depend on local developer state, shared accounts, execution order, or persistent dirty data.
- Flaky integration tests must be fixed, quarantined with an owner and reason, or excluded from hand-off evidence.

## Quality Score

Score integration coverage from 0 to 10 across these dimensions:

| Dimension | 0-2 | 3-5 | 6-8 | 9-10 |
| --- | --- | --- | --- | --- |
| Boundary reality | mostly mocks | one real component plus mocks | most risky collaborators real | production-like assembly |
| Behavior protection | shape/status only | some side effects | main outcomes and failures | catches critical real regressions |
| Data and environment | shared or ad hoc | partially isolated | deterministic and cleaned | isolated, versioned, migration-aware |
| Contracts | unverified | selected fields | key API/message/schema contracts | compatibility and drift checks in CI |
| Async/concurrency | fixed sleeps | simple polling | condition-based eventual state | retry, dedup, ordering, and timeout risks |
| Diagnostics | opaque failures | basic assertion output | useful state dumps | request, response, logs, trace, durable state |

Treat 8+ as strong, 6-7 as acceptable with known gaps, and below 6 as not hand-off grade for critical behavior.
