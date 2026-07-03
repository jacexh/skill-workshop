---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: One high-value service, bounded context, or main module.

     SLOT CONTRACT:
     - Owner: one module's responsibility, non-responsibility, internal architecture model, interactions, state/invariants, scenario refs, source refs.
     - Required shape: Module Identity; Internal Architecture Model; Interactions; State And Invariants; Scenario refs; Source refs.
     - Conditional shape: use this shard when architecture.md would become noisy or query cannot answer the module directly.
     - Shard rule: one high-value service, bounded context, or main module per file.
     - Must not include: full cross-service chains, package tours, method signatures, field lists, or duplicated feature prose.
     - Verify coverage: module shard routing, Scenario refs, source refs, stale refs.

     Use this template for `architecture-<module>.md` shards when a module's
     internal architecture needs direct query-grade answers. Do not copy full
     cross-service chains here; link named scenario shards instead.

     TARGET: direct answers for responsibility, non-responsibility, internal
     architecture model, interactions, state/invariants, participating scenarios,
     and source refs. -->

# Architecture: [Module / Service / Bounded Context]

## Module Identity

**Responsibility:** [what this module owns]
**Non-responsibility:** [what it explicitly does not own]
**Path / entry:** `path/to/entry` -> `path/to/module`

## Internal Architecture Model

<!-- Prefer source-defined architecture terms: planes, subsystems, workflows,
     processors, policies, gates, projections, read models, materializers,
     coordinators, routers, or adapters. Do not stop at generic
     `domain/application/infrastructure` labels when richer source docs exist. -->

- **[Plane / subsystem / workflow]:** [stable role and boundary]
- **[Policy / processor / projection]:** [stable role and boundary]

## Interactions

**Upstream:** [callers, commands, events, APIs]
**Downstream:** [callees, stores, buses, external systems]
**Contracts:** [proto/OpenAPI/events/messages/read models]

## State And Invariants

- [owned state, lifecycle, ordering, authorization, consistency, idempotency, or isolation rule]

## Scenario refs

- [architecture-<scenario>.md](architecture-<scenario>.md) — [what this module contributes to that scenario]

## Source refs

- `path/to/design-or-source`
- `path/to/canonical-code`
