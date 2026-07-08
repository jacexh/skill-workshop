---
name: implement
description: Use when implementing or refactoring DDD/backend code after accepted domain-modeling and design decisions exist, especially when code placement could cross Domain/Application/Infrastructure boundaries or touch backend runtime, generated RPC/protocol, persistence/database, logging, or test seams.
---

# Implement

Turn an accepted Domain Modeling Brief and DDD design into code. Implementation maps decisions to files, mechanisms, and verification; it does not create domain facts.

First read the accepted sources, current spec/docs/code/tests, local conventions, and [../../references/ddd-core.md](../../references/ddd-core.md). Load strategic references only when the accepted model is unclear, and load active language/layer references only for touched code surfaces. The best input is a design **Implementation handoff**.

## Handoff check

Before editing, name the **Accepted model source** and confirm only the items implementation will depend on:

- capability / bounded context / language;
- data authority and out-of-scope boundary;
- aggregate, policy, service, read model, or explicit none;
- commands, queries, Domain Events, Integration Messages, reactions, or explicit none;
- collaboration model: aggregate-internal behavior, same-BC Domain Event/reaction, Integration Message, process manager/reconciler, query/read facade, or return-to-domain-modeling decision;
- consistency, transaction, idempotency, and failure boundary;
- modeling evidence for lifecycle, authority, invariants, failure tolerance, and collaboration style when those decisions shaped the handoff;
- layer ownership and mechanism containment;
- testing seams or explicit verification target.

Default-first key concepts: implement the normal DDD path unless the accepted design reopened modeling and produced a new model decision. Aggregates own invariants; Repositories persist one write-side Aggregate Root; Domain Events model same-BC past-tense facts after state change; Integration Messages are cross-context contracts; QueryRepositories/read facades serve product reads. Aggregate Boundary Conflict returns to `domain-modeling`. Implementation transaction shape is not Repository design evidence; cross-table writes are persistence mapping evidence only when they persist one accepted aggregate.

Return routing: Return to domain-modeling for aggregate boundary, lifecycle, invariant, fact language, or bounded-context uncertainty. Return to design for layer ownership, CQRS split, port placement, adapter boundary, or repository API shape after the model is accepted.

If business facts or modeling evidence are missing or contradictory, return to `domain-modeling`. If placement, layer ownership, or mechanism containment is missing, return to `design`. If the handoff asks Repository/API code to save or coordinate several candidate roots, classify Aggregate Boundary Conflict and return to `domain-modeling` before editing. If the accepted aggregate is clear but Repository API shape, CQRS split, or adapter mapping is wrong or missing, return to `design`. If the conflict is an explicit user requirement, ask the user before editing.

If a review finding includes `Model correction` that changes lifecycle owner,
invariant owner, aggregate boundary, or failure tolerance, return to `design`
unless that correction is already accepted by the user or design handoff.

## Workflow

1. **Handoff check** — prove the patch has an accepted source. Small layer-local refactors may use an explicit existing model from code/ADR/spec.
2. **Object shape routing** — identify the confirmed object being implemented from the handoff and repository evidence. If object classification is unclear, stop upstream; do not decide Aggregate, Repository, Event, or bounded context inside implementation.
3. **Surface preflight** — classify touched surfaces from requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and local conventions. The surface list is evidence-driven, not an inventory.
4. **Reference routing** — load only the narrow reference needed by the touched surface: active language guide, [../../references/ddd-core.md](../../references/ddd-core.md), [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md), Go domain/application/infrastructure/CQRS/events/taskqueue/runtime/scaffold files, or [../../references/database.md](../../references/database.md).
5. **Placement translation** — map model decisions to files, boundary mappings, transactions, retries, adapters, generated/protocol mapping, persistence, runtime wiring, and tests.
6. **Verify** — run the smallest checks that prove the accepted user stories, design decisions, and touched technology rules.

## Output

Keep the output small. Include only sections that carry evidence for this patch.

```text
DDD implementation:
- Accepted model source:
- Handoff check:
- Collaboration model:
- Surface preflight:
- Object shape routing:
- Placement decisions:
- Changed files by layer:
- Boundary mappings:
- Mechanism containment:
- Rules Satisfied / Not Applicable / Return to domain-modeling / Return to design:
- Tests / verification:
- Conflicts / stop conditions:
```

For a tiny layer-local change, collapse this to accepted source, changed files by layer, rules status, and tests. For a stop, emit only the missing fact and whether it belongs to `domain-modeling`, `design`, or the user.

Common mistakes: implementing from a vague PRD without accepted design; inventing object classification; copying reference tables into the answer; leaking generated/protocol/storage types into Domain; placing database/message/runtime mechanics by convenience instead of the semantic owner.
