# Architecture Test Design

Use this when the input is an architecture proposal, ADR, component diagram,
sequence diagram, message flow, or system design note. The goal is to choose
evidence for architecture design goals, not to mechanically test every arrow in
a diagram.

## Core Principle

Treat the architecture document as claims:

- ownership: which component owns state, decisions, and side effects
- contracts: which APIs, messages, schemas, and callbacks must remain compatible
- qualities: consistency, durability, resilience, throughput, latency, security,
  observability, operability, and maintainability
- failure behavior: retry, timeout, rollback, compensation, deduplication,
  backpressure, and recovery

Design evidence that would falsify those claims if implementation violates
them. Evidence can be tests, static checks, dry-runs, smoke checks, manual
recovery drills, or explicit residual risk.

## Architecture Reading Workflow

1. Extract architecture design goals.
2. Build an interaction inventory: actors, entry points, services, stores,
   queues, workers, schedulers, callbacks, third parties, trust boundaries, and
   owned state.
3. Classify hotspots: high-call, high-loss, high-concurrency, high-fanout,
   cross-boundary, security-sensitive, hard-to-observe, or historically fragile.
4. Split the flow into phases: owner, input contract, output contract, durable
   state before/after, side effects, and observable signal.
5. Choose the lowest-cost reliable evidence that can disprove each architecture
   claim in the same way production would fail.
6. Name assumptions when the design omits retry policy, consistency window,
   ordering guarantee, ownership, SLO, capacity target, recovery objective, or
   observability signal.

## Goal Risk Evidence Matrix

Architecture validation must include a traceability matrix. Every design goal
needs evidence or an explicit gap:

| Goal | Claim | Risk if false | Evidence | Residual risk |
| --- | --- | --- | --- | --- |
| consistency | command and message persist atomically enough for replay | partial write or lost message | repository integration + replay check | broker outage recovery not covered |
| resilience | duplicate callbacks do not regress final state | stale callback overwrites success | handler integration | cross-region duplicate not covered |
| observability | failed consumer emits actionable diagnostic | incident cannot be triaged | log/metric/trace assertion | production alert routing not covered |

If a goal has no evidence, put `none` in the evidence column and name the
residual risk.

## Sequence Evidence Matrix

For sequence diagrams, produce a matrix before writing tests:

| Phase | Design goal | Risk | Evidence | Required cases |
| --- | --- | --- | --- | --- |
| API accepts command | reject invalid or unauthorized work before side effects | bad admission creates durable garbage | API/integration | valid, invalid, unauthorized |
| transaction commits | state and outbox/message are atomic enough for recovery | partial write or lost message | repository/integration | commit, rollback, duplicate command |
| message consumed | downstream state advances once | duplicate, retry, out-of-order, poison message | consumer integration or contract | canonical, duplicate, malformed, retry |
| read model updates | user sees converged status | stale read or missing event | seam/E2E where needed | bounded convergence, missing-event diagnostic |

Replace these example phases with the phases in the user's diagram.

## State Ownership Gates

For every stateful component or aggregate, identify the authoritative writer and
prove or check that the ownership boundary holds:

- authoritative writer and allowed transitions
- rejected non-owner mutation
- stale owner, expired lease, or old generation cannot overwrite newer state
- duplicate owner/worker contention resolves deterministically
- read model, cache, projection, or UI snapshot cannot become the write-side
  fact source
- cross-component conflict is rejected, reconciled, or surfaced through an
  observable signal

When ownership is implicit or undocumented, list it as an assumption in the Goal
Risk Evidence Matrix.

## Async, Callback, And Concurrency Gates

If the design includes retry, callback, queue, scheduler, worker pool,
same-resource writes, leader election, leases, or eventual consistency, require
evidence for the relevant risks or state why not:

- duplicate command/message/callback
- concurrent same-resource mutation
- retry after partial failure
- out-of-order delivery or stale callback
- timeout and recovery path
- idempotency key or dedup store behavior
- backpressure, queue saturation, or rate-limit behavior for high-call paths
- observable diagnostic when recovery cannot complete

Tests should assert durable state and externally visible behavior. Avoid fixed
sleep; use state, event, log, metric, trace, or other observable conditions.

## Quality Threshold Assumptions

Non-functional goals need measurable thresholds or explicit residual risk:

- latency: p95/p99, timeout, retry deadline, polling/convergence window
- throughput and capacity: requests/sec, messages/sec, queue depth, worker
  count, backpressure behavior
- recovery: retry budget, recovery time, replay bounds, manual recovery
  expectation
- availability and degradation: circuit breaker, fallback, partial dependency
  outage behavior
- observability: log fields, metrics, trace/span attributes, audit records,
  correlation ids, alert signal
- security: token scope, tenant boundary, redaction, privilege escalation denial
- compatibility: old/new API, message, database, generated-client, and
  migration coexistence window

If no defensible threshold exists, mark the goal as unverified instead of
turning vague claims like "fast" or "resilient" into fake tests.

## Output Format

```text
Architecture Test Design
Intent source: <architecture doc / sequence diagram / ADR>

Architecture design goals:
- <goal and quality attribute>

Interaction inventory:
- <entry> -> <component> -> <state/message/external dependency>

Risk heat map:
- high: <risk> because <reason>

Goal Risk Evidence Matrix:
- <goal>: <claim> / <risk> / <evidence or none> / <residual risk>

Sequence Evidence Matrix:
- <phase>: <design goal> / <risk> / <evidence> / <cases>

State ownership gates:
- <state>: <authoritative writer> / <stale or non-owner case> / <observable signal>

Quality threshold assumptions:
- <quality>: <threshold or assumption> / <evidence or residual risk>

Evidence list:
- <test/check/dry-run/smoke/manual/residual>: <scenario> -> <expected proof>

Residual architecture risk:
- <what remains unproven and why>
```

## Common Mistakes

- Testing every diagram arrow equally instead of prioritizing architecture goals.
- Using one E2E happy path to claim resilience, idempotency, or compatibility.
- Constructing direct messages from guesses instead of a stable schema, fixture,
  generated type, golden event, or contract sample.
- Treating eventual consistency as "sleep and hope".
- Ignoring observability, operability, isolation, and recovery claims.
- Listing goals without a matrix that shows evidence or explicit residual risk.
