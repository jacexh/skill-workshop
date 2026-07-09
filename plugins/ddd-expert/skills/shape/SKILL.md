---
name: shape
description: Use when backend architecture planning, technical design, solution design, ticket breakdown, implementation planning, or design review needs to turn accepted requirements or model notes into concrete backend design before coding. Helps decide boundaries, responsibilities, data ownership, transaction shape, interfaces, events/messages, and test seams.
---

# Shape

## Workflow

Turn confirmed domain model content from project docs into the smallest useful DDD/backend design before coding.

1. Read inputs: target PRD/spec, confirmed domain model sections, glossary/terminology docs, `CONTEXT.md`, `CONTEXT-MAP.md`, domain docs, ADRs, current design notes, relevant code/tests/contracts, [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md), [../../references/ddd-modeling.md](../../references/ddd-modeling.md), and [../../references/ddd-core.md](../../references/ddd-core.md). Read deeper references only for touched surfaces.

2. Reference routing: load only the narrow reference for the touched design surface. For language/framework placement, load the active guide: [../../references/ddd-golang.md](../../references/ddd-golang.md), [../../references/ddd-python.md](../../references/ddd-python.md), or [../../references/ddd-typescript.md](../../references/ddd-typescript.md). For Go, load `ddd-golang.md` first and follow its router for domain, application, infrastructure, CQRS, events/messages, taskqueue, runtime, scaffold, or generated-code surfaces. Load [../../references/database.md](../../references/database.md) only for schema, migration, index, or SQL decisions. Load [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) only when shaping execution handoff, stop conditions, self-checks, or reporting constraints.

3. Check phase fit: if material user scenario, event timeline, authority, policy, lifecycle, data authority, or bounded-context facts are still missing, stop and return to `explore`. If the model facts are accepted but a tactical placement or mechanism decision is still unclear, resolve it in `shape`; ask one focused design question if evidence is insufficient.

4. Shape decisions: accepted model facts first, modeling gates second, collaboration model before mechanism, tactical mechanisms third, implementation constraints last. Use the modeling gates before naming Aggregates, Repositories, ports, handlers, layers, files, schemas, transactions, or event payloads; do not name them before the accepted model and relevant gates are clear.

5. Gate-review output: before writing Tactical Design, review the shaped result against [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md) as an internal gate checklist: story before nouns, event timeline before objects, authority before ownership, lifecycle before type, invariant before aggregate, failure tolerance before transaction, language before integration, and coordination before abstraction. If a material gate fails, do not publish the design; return to `explore` for missing model facts or ask one focused design question for accepted-model placement/mechanism uncertainty. Do not print the gate checklist in project docs or the final response unless a failed gate changes the decision.

## Design rules

Normal-shape concepts: state the normal DDD path before naming deviations. Aggregates own invariants; Repositories persist one write-side Aggregate Root; Domain Events model same-BC past-tense facts after state change; Integration Messages are cross-context contracts; QueryRepositories/read facades serve product reads. Aggregate Boundary Conflict returns to `explore`; it is not a design option. Return routing: Return to explore for missing model facts such as aggregate boundary, lifecycle, invariant, fact language, bounded context, data authority, or failure tolerance. Return to shape for placement or mechanism decisions after the model is accepted: layer ownership, CQRS split, port placement, adapter boundary, repository API shape, task/runtime wiring. Implementation transaction shape is not model evidence. If a proposed exception depends on persistence convenience, cross-table writes, or semantic store names, stop and reopen modeling.

Only shape decisions that are material before implementation: tactical objects and responsibilities, boundary/consistency choices, collaboration model, required commands/queries/events/messages, repository or port boundaries, transaction/idempotency/failure rules, layer ownership, mechanism containment, and verification seams. Omit categories that do not affect this change.

Do not produce schemas, DTOs, file lists, repository inventories, event payloads, API details, or implementation plans unless that detail is the design decision itself. Do not output alternative candidates; decide from the accepted model or ask a focused question. If any Implementation handoff item is material to codification and unknown, stop before implementation.

## Documentation output

Write the accepted tactical design back to the project docs. Prefer an existing design doc, architecture/domain doc, ADR, or PRD/spec design section. If no dedicated carrier exists, append a concise `Tactical Design` section to the current PRD/spec.

Write only the decisions `codify` must obey. Every Tactical Design update should name the accepted model source and the responsibility being shaped. Use these compact tactical design sections only when material: Model Decisions, Boundary / Consistency, Implementation Constraints, Verification Seams.

- **Model Decisions**: tactical objects and responsibilities; aggregate, policy, service, read-model, command, query, event, or message choices that must exist.
- **Boundary / Consistency**: aggregate boundary, invariant owner, data authority, transaction boundary, idempotency, failure handling, and cross-context ownership.
- **Implementation Constraints**: layer ownership, ports, repositories, adapters, generated/protocol boundaries, runtime/task/message containment, and forbidden shortcuts.
- **Verification Seams**: the smallest domain, application, contract, or integration checks that prove the accepted model and tactical decisions.

The Tactical Design section is the Implementation handoff; do not create a separate agent-to-agent report.

Add a Mermaid or text diagram only when it clarifies aggregate boundaries, lifecycle, collaboration, or consistency better than prose. Do not add ERDs, component diagrams, deployment diagrams, API call graphs, schemas, DTO shapes, or file-layout diagrams.

Final response: list the files updated and summarize the accepted tactical decisions in one or two bullets. Do not paste the full design unless the user asks.
