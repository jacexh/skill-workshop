---
name: design
description: Use when producing concrete DDD/backend design from an accepted Domain Modeling Brief, product spec, change request, or explicit existing model before implementation.
---

# Design

Turn an accepted Domain Modeling Brief into the smallest useful DDD/backend design.

First read the brief, current spec/docs/code evidence, [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md), and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md). The brief may be PRD-shaped: Problem Statement, Solution / Scenario, User Stories, Strategic Decisions, Model Decisions, Testing Decisions, Out of Scope, Further Notes.

If material user scenario, event timeline, authority, policy, lifecycle, data authority, or bounded-context facts are still missing, stop and return to `domain-modeling`.

Use the brief this way:

- Problem / Solution / User Stories -> product semantics and capability.
- Strategic Decisions / Out of Scope -> boundaries, rules, and rejected alternatives.
- Testing Decisions -> highest useful verification seams.
- Further Notes / DDD handoff -> candidate tactics to re-check, not commands to obey.

Design in this order: strategic model first, modeling gate summary second, collaboration model before mechanism, tactical mechanisms third, implementation placement last. Use the modeling gates before naming Aggregates, Repositories, ports, handlers, layers, files, schemas, transactions, or event payloads; do not name them before the strategic model and relevant gates are clear.

Default-first key concepts: state the normal DDD path before naming deviations. Aggregates own invariants; Repositories persist one write-side Aggregate Root; Domain Events model same-BC past-tense facts after state change; Integration Messages are cross-context contracts; QueryRepositories/read facades serve product reads; Application command-side ports and synchronous multi-aggregate transactions are high-risk deviations. Synchronous multi-aggregate transactions are not collaboration models. High-risk deviations are not design options; record them only as explicit risk with default path rejected and residual coupling stated.

Read deeper references only when needed:

- [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for subdomain, bounded context, aggregate, lifecycle, and technical-capability classification.
- [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Domain Events, Integration Messages, and generated protocol boundaries.
- [../../references/database.md](../../references/database.md) after data authority and aggregate/read-model boundaries are clear.

Write the shortest useful DDD design. Small is acceptable only when implementation still knows which source to trust and where each touched responsibility belongs. Default shape:

- **Design problem** — the backend decision this design resolves.
- **Strategic model** — capability, bounded context, language, authority, data authority, and out-of-scope boundaries.
- **Modeling gate summary** — only gates that materially shaped the design: story, authority, lifecycle, invariant, failure tolerance, integration language, or coordination kind.
- **Tactical decisions** — only changed or disputed mechanisms: aggregate/policy/service boundary, commands/queries/events, consistency/failure rules.
- **Testing seams** — the highest seams that prove the user stories and strategic decisions.
- **Implementation handoff** — list only decisions the next implementation will depend on:
  - Accepted model source.
  - Capability / bounded context / language.
  - Data authority and out-of-scope boundary.
  - Aggregate, policy, service, read model, or explicit none.
  - Modeling gate decisions that justify those tactical objects.
  - Collaboration model: aggregate-internal behavior, same-BC Domain Event/reaction, Integration Message, process manager/reconciler, query/read facade, or explicit high-risk deviation.
  - Commands / queries / Domain Events / Integration Messages / reactions, or explicit none.
  - Consistency / transaction / idempotency / failure boundary.
  - Layer ownership and mechanism containment.
- **Open questions / Stop** — facts still needed before implementation.

If any handoff item is material to implementation and unknown, Stop. Send missing business facts back to `domain-modeling`; keep placement and layer questions in `design`.

Omit empty sections. Do not produce schemas, DTOs, file lists, repository inventories, or event payloads unless they are the design decision itself.

Common mistakes: rejecting a terse prose brief because it is not a filled template; treating a DDD handoff as already-decided design; starting from tables, RPC methods, files, or framework packages; inventing missing invariants instead of stopping.
