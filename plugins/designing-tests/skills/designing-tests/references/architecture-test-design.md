# Architecture Test Design

Use this when the test input is an architecture proposal, ADR, component diagram, sequence diagram, message flow, or system design note. The goal is to verify architecture design goals, not to mechanically test every arrow in a diagram.

## Core Principle

Treat the architecture document as a set of claims:

- ownership: which component owns state, decisions, and side effects
- contracts: which APIs, messages, schemas, and callbacks must remain compatible
- qualities: consistency, durability, resilience, throughput, latency, security, observability, operability, and maintainability
- failure behavior: retry, timeout, rollback, compensation, deduplication, backpressure, and recovery

Design tests that would falsify those claims if the implementation violates them.

## Architecture Reading Workflow

1. Extract architecture design goals.
   - Examples: "exactly one work item starts", "consumer can retry safely", "read model converges within one polling window", "tenant data never crosses boundaries".
2. Build an interaction inventory.
   - Actors, entry points, services, stores, queues, workers, schedulers, callbacks, third parties, trust boundaries, and owned state.
3. Classify hotspots.
   - High-call, high-loss, high-concurrency, high-fanout, cross-boundary, security-sensitive, hard-to-observe, or historically fragile.
4. Split the flow into phases.
   - For each phase, record owner, input contract, output contract, durable state before/after, side effects, and observable signal.
5. Turn each architecture claim into tests.
   - Use the lowest boundary that can disprove the claim in the same way production would fail.
6. Name assumptions.
   - If the architecture doc omits retry policy, consistency window, ordering guarantee, ownership, SLO, capacity target, recovery objective, or observability signal, state the assumption and design one test that would expose the risky ambiguity.

## Goal Coverage Matrix

Architecture validation must include a traceability matrix. Every architecture design goal needs evidence or an explicit gap:

| Goal | Claim to verify | Tests / checks | Evidence type | Unproven residual risk |
| --- | --- | --- | --- | --- |
| consistency | command and message persist atomically enough for replay | repository integration, outbox/message integration | durable state + replay result | broker outage recovery not covered |
| resilience | duplicate callbacks do not regress final state | callback handler integration | final state + audit/diagnostic | cross-region duplicate not covered |
| observability | failed consumer emits actionable diagnostic | consumer failure test | log/metric/trace/audit field | production alert routing not covered |

If a goal has no test, do not hide it in prose. Put `none` in the tests column and name the residual risk.

## Sequence Phase Matrix

For sequence diagrams, produce a matrix like this before writing tests:

| Phase | Design goal | Risk | Test boundary | Required cases |
| --- | --- | --- | --- | --- |
| API accepts command | reject invalid or unauthorized work before side effects | bad admission creates durable garbage | API/integration | valid, invalid, unauthorized |
| transaction commits | state and outbox/message are atomic enough for recovery | partial write or lost message | repository/integration | commit, rollback, duplicate command |
| message consumed | downstream state advances once | duplicate, retry, out-of-order, poison message | consumer/integration | canonical message, duplicate, malformed, retry |
| callback handled | external result does not regress state | repeated callback, late callback, mismatched owner | handler/integration | success, duplicate success, stale failure |
| read model updates | user sees converged status | stale read or missing event | seam/E2E where needed | eventual convergence, missing event diagnostic |

Do not keep the example phases if they do not match the actual design. Replace them with the phases in the user's diagram.

## Message-Driven Systems

Separate the tests by claim:

- **Producer contract:** the producer emits the right topic, key, headers, schema version, idempotency key, correlation id, and payload.
- **Consumer behavior:** construct a canonical message directly and feed the consumer to verify state changes, side effects, retry, deduplication, dead-letter, and diagnostics.
- **Broker integration:** verify routing, serialization, partitioning/ordering, ack/nack, retry, and dead-letter behavior when the broker itself is part of the risk.

It is valid to skip the producer in a consumer behavior test. The message must come from a stable contract source: generated type, schema fixture, golden event, or consumer-driven contract sample. A hand-built message that drifts from the producer contract is `shallow` at best.

## State Ownership Gates

For every stateful component or aggregate in the design, identify the authoritative writer and prove that ownership boundary holds:

- authoritative writer and allowed transitions
- rejected non-owner mutation
- stale owner, expired lease, or old generation cannot overwrite newer state
- duplicate owner/worker contention resolves deterministically
- read model, cache, projection, or UI snapshot cannot become the write-side fact source
- cross-component conflict is rejected, reconciled, or surfaced through an observable signal

When ownership is delegated through leases, sessions, callbacks, or worker claims, include stale-token/stale-owner tests. When ownership is implicit or undocumented, list it as an assumption in the Goal Coverage Matrix.

## Async, Callback, And Concurrency Gates

If the design includes retry, callback, queue, scheduler, worker pool, same-resource writes, leader election, leases, or eventual consistency, require one of these tests or state why not:

- duplicate command/message/callback
- concurrent same-resource mutation
- retry after partial failure
- out-of-order delivery or stale callback
- timeout and recovery path
- idempotency key or dedup store behavior
- backpressure, queue saturation, or rate-limit behavior for high-call paths
- observable diagnostic when recovery cannot complete

These tests should assert durable state and externally visible behavior. Avoid fixed sleep; use condition-based waits tied to state, event, log, metric, or trace evidence.

## Quality Threshold Assumptions

Non-functional goals need measurable thresholds or explicit residual risk. Extract or ask for:

- latency: p95/p99, timeout, retry deadline, polling/convergence window
- throughput and capacity: requests/sec, messages/sec, queue depth, worker count, backpressure behavior
- recovery: retry budget, recovery time, replay bounds, manual recovery expectations
- availability and degradation: circuit breaker, fallback, partial dependency outage behavior
- observability: required log fields, metrics, trace/span attributes, audit records, correlation ids, alert signal
- security: token scope, tenant boundary, redaction, privilege escalation denial
- compatibility: old/new API, message, database, generated-client, and migration coexistence window

If the architecture doc only says "fast", "scalable", "observable", or "resilient", convert that into a stated assumption before designing tests. If no defensible assumption can be made, mark the goal as unverified.

## Architecture Goal Coverage

Map each selected test to the architecture goal it protects:

- **Consistency:** no partial state, no stale overwrite, bounded eventual convergence
- **Durability:** committed work survives restart/retry and is recoverable
- **Resilience:** retries, timeouts, poison messages, and downstream failures are contained
- **Scalability:** hot paths tolerate concurrency, queue pressure, and duplicate work
- **Security:** trust boundaries, tenant boundaries, ownership, and token scope hold
- **Compatibility:** old/new API, message, database, and generated-client contracts work
- **Observability:** failures emit useful logs, metrics, traces, audit records, or diagnostics
- **Operability:** startup, shutdown, migrations, replays, and manual recovery are testable

## Output Format

```
Architecture Test Design
Intent source: <architecture doc / sequence diagram / ADR>
Architecture design goals:
- <goal and quality attribute>

Interaction inventory:
- <entry> -> <component> -> <state/message/external dependency>

Risk heat map:
- high: <risk> because <reason>
- medium: <risk> because <reason>

Sequence Phase Matrix:
- <phase>: <design goal> / <risk> / <test boundary> / <cases>

Goal Coverage Matrix:
- <goal>: <claim> / <tests or none> / <evidence type> / <unproven residual risk>

State ownership gates:
- <state>: <authoritative writer> / <rejected non-owner or stale-owner case> / <observable conflict signal>

Quality threshold assumptions:
- <quality>: <threshold or assumption> / <test evidence or residual risk>

Test list:
- [ ] <boundary>: <scenario> -> <expected architectural proof>

Residual architecture risk:
- <what remains unproven and why>
```

## Common Mistakes

- Testing every diagram arrow equally instead of prioritizing architecture goals.
- Using one end-to-end happy path to claim resilience, idempotency, or compatibility.
- Testing the producer and consumer only together, making consumer failure modes hard to isolate.
- Constructing direct messages from guesses instead of a stable schema or fixture.
- Treating eventual consistency as "sleep and hope" instead of asserting a bounded convergence condition.
- Ignoring design goals that are not functional outputs, such as observability, operability, isolation, and recovery.
- Listing architecture goals without a Goal Coverage Matrix that shows tests or explicit residual risk.
- Treating state ownership as a diagram label without stale owner, non-owner write, or conflict tests.
