# Integration Quality

Use this when the Evidence step selects an integration, API, contract, seam, or
E2E test. Apply the main workflow's Seam, Control, and Proof criteria; the rules
below define the additional fidelity required at integration boundaries.

## Boundary Definitions

| Type | Purpose | Typical boundary | Does not prove |
| --- | --- | --- | --- |
| API | externally visible interface contract | HTTP, gRPC, Connect, GraphQL, CLI | full internal workflow unless real collaborators are included |
| Integration | production components cooperate | handler + service + repository + DB, producer + broker + consumer | browser journey or full deployment health |
| Seam / Contract | two sides continue to agree | generated client/server, schema, topic, event, serializer | every business branch |
| E2E | critical user or system journey works end to end | UI/client + backend + real dependencies | detailed rule coverage |

## Integration Fidelity

An integration claim needs these conditions unless a stated exception narrows
the claim:

1. Run the production components that carry the stated risk together.
2. Use production-like dependency injection, middleware, serialization,
   configuration, protocol clients, and storage wiring where they affect it.
3. For database behavior, apply the production migrations, schema, constraints,
   and database engine needed to reproduce the failure mode.
4. For transaction behavior, assert durable state from a fresh observer after
   the real commit or rollback boundary.
5. Assert behavior, contract-visible state, durable state, messages, diagnostics,
   or key side effects rather than setup interactions.
6. Make failure output identify the scenario and broken segment.

When an emulator, fake adapter, or recorded stub supports a compatibility claim,
run the same contract suite against the real adapter or narrow the claim to what
the substitute actually proves.

**Complete when:** the environment can fail for the claimed production reason,
the risk carrier remains real, and the observable assertion survives the true
commit, transport, or serialization boundary.

## When This Boundary Is Needed

Choose integration or contract evidence when lighter checks cannot catch:

- transaction boundaries, partial writes, optimistic locks, uniqueness, or
  migration drift
- request/response mapping, error codes, auth claims, tenancy filters, or
  resource ownership
- JSON/Protobuf/Avro serialization, null semantics, enum drift, time precision,
  or timezone handling
- producer/consumer compatibility, topic or route wiring, retry, deduplication,
  dead-letter, or out-of-order delivery
- cache consistency, stale reads, idempotency keys, duplicate requests, or
  concurrent updates
- feature flags, environment variables, connection pools, timeouts, startup, or
  graceful shutdown
- security-sensitive paths such as path traversal, redaction, token scope,
  permission denial, or privilege escalation

## Coverage Shape

Cover scenario risks rather than repeating every unit branch:

- API entry: route + parsing + auth + service + repository + side effect
- write path: command + transaction + event, message, or audit side effect
- read path: filters + permission scope + pagination or sort + cache behavior
- async path: producer + broker/log + consumer + eventual durable state
- cross-service path: generated client + server + timeout/error mapping +
  compatibility
- migration path: current code reads historical data and writes the new shape
- observability path: critical failure emits actionable diagnostic evidence

## Environment Gate

- Run core integration tests in CI with pinned dependencies or controlled
  containers.
- Keep data, accounts, ports, processes, and persistent state isolated from
  developer machines and other tests.
- Report an unavailable dependency or conditionally skipped path as unexecuted
  evidence with residual risk.

**Complete when:** the selected scenario set covers each distinct integration
risk once, the controlled environment is reproducible, and every unavailable
boundary is visible in the hand-off.
