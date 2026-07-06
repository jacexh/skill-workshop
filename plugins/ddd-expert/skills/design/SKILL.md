---
name: design
description: Use when producing concrete DDD/backend design from an accepted Domain Modeling Brief, product spec, change request, or explicit existing model before implementation.
---

# Design

Turn an accepted Domain Modeling Brief into the smallest useful DDD/backend design.

First read the brief, current spec/docs/code evidence, and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md). The brief may be PRD-shaped: Problem Statement, Solution / Scenario, User Stories, Strategic Decisions, Testing Decisions, Out of Scope, Further Notes.

If material user scenario, event timeline, authority, policy, lifecycle, data authority, or bounded-context facts are still missing, stop and return to `domain-modeling`.

Use the brief this way:

- Problem / Solution / User Stories -> product semantics and capability.
- Strategic Decisions / Out of Scope -> boundaries, rules, and rejected alternatives.
- Testing Decisions -> highest useful verification seams.
- Further Notes / DDD handoff -> candidate tactics to re-check, not commands to obey.

Design in this order: strategic model first, tactical mechanisms second, implementation placement last. Do not name Aggregates, ports, handlers, layers, files, schemas, or event payloads before the strategic model is clear.

Read deeper references only when needed:

- [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for subdomain, bounded context, aggregate, lifecycle, and technical-capability classification.
- [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Domain Events, Integration Messages, and generated protocol boundaries.
- [../../references/database.md](../../references/database.md) after data authority and aggregate/read-model boundaries are clear.

Write the shortest useful DDD design. Default shape:

- **Design problem** — the backend decision this design resolves.
- **Strategic model** — capability, bounded context, language, authority, data authority, and out-of-scope boundaries.
- **Tactical decisions** — only changed or disputed mechanisms: aggregate/policy/service boundary, commands/queries/events, consistency/failure rules.
- **Testing seams** — the highest seams that prove the user stories and strategic decisions.
- **Open questions / Stop** — facts still needed before implementation.

Omit empty sections. Do not produce schemas, DTOs, file lists, repository inventories, or event payloads unless they are the design decision itself.

Common mistakes: rejecting a terse prose brief because it is not a filled template; treating a DDD handoff as already-decided design; starting from tables, RPC methods, files, or framework packages; inventing missing invariants instead of stopping.
