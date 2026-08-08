# ADR 0006: Guard Is a Bounded Semantic-Structure Review

- Status: Accepted
- Date: 2026-08-08
- Supersedes: the Guard coordinator, parallel-axis workers, exhaustive changed-path inventory, and recursive depth-review decisions in [ADR 0001](0001-ddd-expert-reference-architecture.md); the two-axis Guard decision in [ADR 0004](0004-model-ready-enters-codify-directly.md); and clear-Guard-alone closure sufficiency in [ADR 0005](0005-event-storming-minutes-and-current-models.md)

## Context

Guard exists to independently judge whether a concrete backend change expresses the accepted Model in the `ddd-expert` House Style. Its previous implementation also tried to prove review-process completeness: a coordinator froze every changed path and specialized surface, dispatched independent Model Realization and House-Style Conformance workers, reconciled exact coverage unions, and optionally dispatched depth workers.

That control plane made a useful review impractical. On the historical non-clean evaluation snapshot, the main implementation took 1,148.395 seconds, used three agents and 7,985,166 tokens, and repeatedly re-read authority, references, implementation, and verification surfaces. The dominant work became coverage certification rather than DDD architectural judgment. A single-reviewer experiment was faster, but an unbounded behavior-slice workflow still drifted into tests, runtime probes, and ordinary bug review.

The target is not a comprehensive code review. Guard must prioritize structural realization: semantic ownership, Aggregate and lifecycle boundaries, Domain Events, Application orchestration and semantic ports, Repository and adapter boundaries, Interface translation, Runtime composition, dependency direction, and mechanism isolation. Implementation bodies remain evidence where needed, but ordinary SQL, provider, protocol, frontend, performance, and edge-case defects belong primarily to Codify's producer verification and other review workflows.

## Decision

Guard runs once in one fresh, read-only agent context distinct from the implementer. It does not delegate. Model realization and House-Style conformance are judged together while tracing the same architecture unit inside-out; independence exists between the producer and reviewer, not between two review workers.

Codify incrementally prepares a neutral Review Handoff containing:

- governing claim sources and fingerprints;
- an immutable base/target or complete staged, unstaged, and untracked snapshot;
- atomic architecture review units with authority, applicable House Rules, one falsifiable responsibility assertion, and the changed symbols that define or connect that seam;
- producer-check receipts and a snapshot-bound producer checkpoint.

The handoff is navigation, not authority, a verdict, or proof of completeness. Guard pins the complete source before opening it and derives a finite unit set from only two seeds: architecture responsibilities claimed by the request or ready minutes, and DDD-significant declarations or wiring edges changed in the target. Changed paths, tests, migrations, generated output, configuration values, mechanisms, endpoints, and speculative failure modes do not independently create review units.

Guard audits compound responsibilities into atomic assertions before freezing IDs. Every source assertion and governing reference remains represented in the child union. A working adapter cannot clear a mechanism-shaped or over-broad inner contract. Each frozen unit ends exactly once as `clear`, `violation`, or `evidence_gap`, and the terminal report exposes the source-assertion-to-unit table before merging shared root causes.

Review depth follows responsibility rather than layer exclusion. Domain and Application receive primary scrutiny. Infrastructure, Interface, and Runtime are reviewed at their structural seams. `Interface` is the language-neutral responsibility; Go names its physical package `transport`. Guard asks one falsifiable architectural question before opening deeper adapter or Runtime implementation and stops when that question is settled.

Guard consumes matching producer receipts but does not rerun tests, builds, migrations, query experiments, environment probes, containers, databases, networks, or deployment checks. Test bodies and frontend behavior are not search surfaces for backend architecture findings. It rechecks source and governing-artifact fingerprints before reporting. A clear structural verdict closes a ready iteration only when the matching producer checkpoint is also complete.

## Consequences

- Guard remains an independent review skill and iteration-closure gate, but is no longer a general code review or a proof that every changed path was semantically scanned.
- Codify carries a small amount of incremental navigation bookkeeping so Guard can spend attention on judgment instead of reconstructing the implementation search history.
- One reviewer removes worker dispatch, duplicated reference loading, coverage-union reconciliation, and recursive fan-out. Atomic units and their terminal table retain an auditable completion boundary.
- Ordinary implementation defects may not be reported by Guard. That is intentional unless they contradict accepted Domain behavior or expose misplaced architectural ownership.
- Full source and artifact drift detection, fresh reviewer isolation, authority ordering, fail-closed incomplete execution, and the narrow `ready -> implemented` transition remain in force.

## Evaluation Evidence

On the same historical non-clean snapshot, the accepted Codex candidate completed naturally in 607.320 seconds with one agent, 24 tool calls, and 2,473,591 tokens. Relative to the main baseline, wall time fell 47.12%, token use fell 69.02%, and review agents fell from three to one. It produced terminal judgments for 21 frozen units, reported four independently verified structural findings, detected the previously persistent generic transaction-capability leak, and did not inspect tests/frontend or execute producer verification. The measured 10:07.320 runtime was accepted for this fixture; no universal time limit is encoded in the skill.

## Verification

- Release tests assert the single-reviewer, finite-unit, neutral-handoff, terminal-ledger, no-reverification, and closure contracts.
- The behavior-result schema and scorer validate source-assertion crosswalk uniqueness, terminal unit states, verdict-to-unit linkage, and a compound contract/adapter fixture where adapter fidelity cannot clear a mechanism-shaped inner contract.
- Claude and Codex Guard and Codify skill bodies remain mirrored.
- Performance and finding quality remain evaluation concerns; they are not replaced by string-level workflow assertions.
