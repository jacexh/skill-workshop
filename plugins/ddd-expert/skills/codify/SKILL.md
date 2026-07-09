---
name: codify
description: Use when writing or changing backend code, including implementing tickets, refactoring, bug fixes, API/RPC handlers, persistence, migrations, messages/jobs, runtime wiring, logging, or tests after requirements or design decisions exist. Helps keep code placement, adapters, database/message/runtime mechanics, and verification aligned with the accepted model.
---

# Codify

Turn an accepted Tactical Design / Implementation handoff into code that conforms to the active reference implementation shape. Codification maps decisions to repository scaffold, package boundaries, adopted libraries, abstract interfaces, adapters, persistence/runtime/message mechanics, and verification; it does not create domain facts.

## Workflow

1. **Read accepted sources** — start from the Tactical Design / Implementation handoff in project docs, current PRD/spec/ticket, relevant code/tests/contracts, local conventions, and [../../references/ddd-core.md](../../references/ddd-core.md). Small layer-local refactors may use an explicit existing model from code/ADR/spec; otherwise missing accepted design returns upstream before editing.
2. **Handoff check** — confirm the **Accepted model source**, target responsibility, boundary/consistency decision, implementation constraints, verification seams, modeling evidence needed by implementation, and accepted collaboration model. Return to `explore` for missing business/model facts; return to `shape` for missing layer ownership, CQRS split, port placement, adapter boundary, Repository API shape, runtime/task/message containment, or verification seam.
3. **Surface preflight** — classify language and touched surfaces from requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and local conventions: Domain, Application, Infrastructure, Interface, Runtime, database, generated protocol, events/messages, taskqueue, or tests.
4. **Reference routing** — load only the smallest reference set:
   - **Language:** Go -> [../../references/ddd-golang.md](../../references/ddd-golang.md) and its Object Shape Router, Layer Reference Map, File Quick Index, package boundary rules, and adopted library defaults; Python -> [../../references/ddd-python.md](../../references/ddd-python.md); TypeScript -> [../../references/ddd-typescript.md](../../references/ddd-typescript.md). If language is unclear, infer it from touched files and local conventions before choosing.
   - **Use:** scaffold/layout -> active language scaffold/layout guidance; Domain object, Aggregate, Entity, Value Object, Domain Service, or Repository interface -> active language Domain guidance plus [../../references/ddd-core.md](../../references/ddd-core.md); command/query/RPC/application handlers -> Application/CQRS guidance; persistence, DO/converter, schema, migration, index, or SQL -> Infrastructure guidance plus [../../references/database.md](../../references/database.md); events/messages -> events/messages guidance; jobs/tasks/schedulers/periodic work -> taskqueue plus runtime guidance; runtime/config/module/lifecycle/logging -> runtime guidance.
   - **Agent contract:** load [../../references/ddd-agent-contract.md](../../references/ddd-agent-contract.md) before adding or changing ports/interfaces, adopted component libraries, runtime/taskqueue/message wiring, stop decisions, or self-checks.
   - **Conflict:** if local conventions conflict with the reference shape, stop for user direction unless an accepted exception already exists.
5. **Codify reference shape** — map accepted decisions to the reference-prescribed scaffold, package path, layer owner, abstract interface, adapter, DO/converter, generated/protocol boundary, adopted library, transaction/retry/idempotency rule, runtime wiring, migration, and test seam. Do not invent local substitutes for adopted libraries or place mechanics by convenience.
6. **Verify reference shape** — run the smallest checks that prove the accepted user stories, design decisions, touched technology rules, and reference conformance. Use tests/build/static checks/import grep/migration dry runs as appropriate to the touched surfaces.

## Coding rules

Normal-shape concepts: codify the normal DDD path unless the accepted shape reopened exploration and produced a new model decision. Aggregates own invariants; Repositories persist one write-side Aggregate Root; Domain Events model same-BC past-tense facts after state change; Integration Messages are cross-context contracts; QueryRepositories/read facades serve product reads. Aggregate Boundary Conflict returns to `explore`. Implementation transaction shape is not Repository design evidence; cross-table writes are persistence mapping evidence only when they persist one accepted aggregate.

Return routing: Return to explore for aggregate boundary, lifecycle, invariant, fact language, or bounded-context uncertainty. Return to shape for layer ownership, CQRS split, port placement, adapter boundary, or repository API shape after the model is accepted.

If business facts or modeling evidence are missing or contradictory, return to `explore`. If placement, layer ownership, mechanism containment, adopted library choice, scaffold/package placement, or reference conformance is missing, return to `shape`. If the handoff asks Repository/API code to save or coordinate several candidate roots, classify Aggregate Boundary Conflict and return to `explore` before editing. If the accepted aggregate is clear but Repository API shape, CQRS split, or adapter mapping is wrong or missing, return to `shape`. If the conflict is an explicit user requirement, ask the user before editing.

If a guard finding includes `Model correction` that changes lifecycle owner, invariant owner, aggregate boundary, or failure tolerance, return to `shape` unless that correction is already accepted by the user or shape handoff.

Common mistakes: implementing from a vague PRD without accepted design; treating references as optional advice; inventing object classification; inventing local substitutes for adopted component libraries; leaking generated/protocol/storage types into Domain; placing database/message/runtime mechanics by convenience instead of the semantic owner; skipping local convention conflicts or reference-conformance checks.
