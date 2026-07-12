# Architecture Test Design

Use this when the input is an architecture proposal, ADR, component diagram,
sequence diagram, message flow, or system design note. Choose evidence for
architecture design goals rather than mechanically exercising every arrow.

## Contents

- [Core Principle](#core-principle)
- [Architecture Reading Workflow](#architecture-reading-workflow)
- [Goal Risk Evidence Matrix](#goal-risk-evidence-matrix)
- [Sequence Evidence Matrix](#sequence-evidence-matrix)
- [State Ownership](#state-ownership)
- [Async And Concurrency](#async-and-concurrency)
- [Quality Thresholds](#quality-thresholds)
- [Output Format](#output-format)

## Core Principle

Treat the architecture document as claims:

- ownership: which component owns state, decisions, and side effects
- contracts: which APIs, messages, schemas, and callbacks remain compatible
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
   state before and after, side effects, and observable signal.
5. Feed each claim through the main skill's Intent, Risk, and Evidence workflow.
6. Name assumptions when the design omits retry policy, consistency window,
   ordering guarantee, ownership, SLO, capacity target, recovery objective, or
   observability signal.

**Complete when:** every stated design goal, flow phase, authoritative state
owner, and measurable quality threshold has evidence or explicit residual risk.

## Goal Risk Evidence Matrix

Every design goal needs evidence or an explicit gap:

| Goal | Claim | Risk if false | Evidence | Residual risk |
| --- | --- | --- | --- | --- |
| consistency | command and message persist atomically enough for replay | partial write or lost message | repository integration + replay check | broker outage recovery not covered |
| resilience | duplicate callbacks preserve final state | stale callback overwrites success | handler integration | cross-region duplicate not covered |
| observability | failed consumer emits actionable diagnostic | incident cannot be triaged | log/metric/trace assertion | production alert routing not covered |

Put `none` in the evidence column when a goal remains unverified, then name the
residual risk.

## Sequence Evidence Matrix

For sequence diagrams, produce a matrix before writing tests:

| Phase | Design goal | Risk | Evidence | Required cases |
| --- | --- | --- | --- | --- |
| API accepts command | reject invalid or unauthorized work before side effects | bad admission creates durable garbage | API/integration | valid, invalid, unauthorized |
| transaction commits | state and outbox/message are atomic enough for recovery | partial write or lost message | repository/integration | commit, rollback, duplicate command |
| message consumed | downstream state advances once | duplicate, retry, out-of-order, poison message | consumer integration or contract | canonical, duplicate, malformed, retry |
| read model updates | user sees converged status | stale read or missing event | seam/E2E where needed | bounded convergence, missing-event diagnostic |

Replace the example phases with the phases in the supplied design.

## State Ownership

For every stateful component or aggregate, identify the authoritative writer and
design proof for the relevant ownership rules:

- authoritative writer and allowed transitions
- rejected non-owner mutation
- stale owner, expired lease, or old generation cannot overwrite newer state
- duplicate owner or worker contention resolves deterministically
- read model, cache, projection, or UI snapshot remains a read-side view
- cross-component conflict is rejected, reconciled, or surfaced observably

When ownership is implicit or undocumented, record it as an assumption in the
Goal Risk Evidence Matrix.

## Async And Concurrency

When the design includes retries, callbacks, queues, schedulers, worker pools,
same-resource writes, leader election, leases, or eventual consistency, account
for the relevant risks:

- duplicate command, message, or callback
- concurrent same-resource mutation
- retry after partial failure
- out-of-order delivery or stale callback
- timeout and recovery
- idempotency key or dedup-store behavior
- backpressure, queue saturation, or rate-limit behavior
- actionable diagnostic when recovery cannot complete

Apply the main workflow's Control and Proof criteria to each selected async or
concurrency test.

## Quality Thresholds

Non-functional goals need measurable thresholds or explicit residual risk:

- latency: p95/p99, timeout, retry deadline, polling or convergence window
- throughput and capacity: requests/sec, messages/sec, queue depth, worker count,
  and backpressure behavior
- recovery: retry budget, recovery time, replay bounds, and manual recovery
- availability and degradation: circuit breaker, fallback, and partial outage
- observability: log fields, metrics, spans, audit records, correlation ids, and
  alert signals
- security: token scope, tenant boundary, redaction, and privilege denial
- compatibility: old/new API, message, database, generated-client, and migration
  coexistence windows

When no defensible threshold exists, mark the goal as an assumption or residual
risk rather than converting a vague quality into a passing test.

## Output Format

```text
Architecture Test Design
Intent source: <architecture doc / sequence diagram / ADR>

Architecture goals:
- <goal and quality attribute>

Interaction inventory:
- <entry> -> <component> -> <state/message/external dependency>

Goal Risk Evidence Matrix:
- <goal>: <claim> / <risk> / <evidence or none> / <residual risk>

Sequence Evidence Matrix:
- <phase>: <goal> / <risk> / <evidence> / <cases>

State ownership:
- <state>: <authoritative writer> / <stale or non-owner case> / <signal>

Quality thresholds:
- <quality>: <threshold or assumption> / <evidence or residual risk>

Residual architecture risk:
- <what remains unproven and why>
```
