# DDD Expert Artifact Layout

Project-owned DDD artifacts use this canonical structure:

```text
docs/ddd-expert/
|-- README.md
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        `-- design.md
```

## Context directory

One directory represents one confirmed Bounded Context. `<context-slug>` is the stable lower-kebab-case form of its confirmed name. A package, service, team, table, or deployment name is not a substitute when it differs from the business context name.

Separate Bounded Contexts use separate directories. The root does not contain a shared `model.md` or `design.md`, and one context artifact does not collect another context's internal model or tactical design.

`model.md` contains only a user-confirmed Strategic Model and therefore uses `model_status: model_ready`. Unconfirmed work exists only on the temporary EventStorming Board; there is no partially accepted or `evolving` Model write.

Because one `model.md` may contain several Aggregates, an Aggregate-scoped confirmation preserves every excluded sibling diagram and semantic range byte-for-byte. A change to shared Bounded Context meaning or a sibling Aggregate requires Bounded Context scope and a newly presented integrated model.

`design.md` is optional existing Tactical Design authority. EventStorming never creates, rewrites, moves, promotes, or deletes `design.md`. It may be absent, externally supplied, stale, or orphaned after a confirmed Model revision or topology change; reconciliation belongs to a separate tactical workflow. Codify requires a canonical `model_ready` Model plus a separately accepted, revision-matched `design_status: codify_ready` Design whenever implementation needs tactical choices.

## Artifact meaning

| Artifact | Semantic authorizer | Content |
|---|---|---|
| `README.md` | EventStorming (`apply-confirmed-model`) | Navigation to the confirmed Bounded Contexts |
| `context-map.md` | EventStorming (`apply-confirmed-model`) | Separate semantic-dependency and runtime/business-interaction views, plus each context's responsibility, authority, local dependency view, interactions, and named contract projections |
| `context/<context-slug>/model.md` | EventStorming (`apply-confirmed-model`) | Exact confirmed EventStorming diagram and that context's language, authority, Aggregates/core objects, lifecycle, invariants, policies, failure semantics, Hotspots, dependencies, revision, and `model_ready` status |
| `context/<context-slug>/design.md` | Separate accepted Tactical Design authority | Revision-bound Aggregate realization and tactical implementation decisions; read-only to EventStorming |

The EventStorming Board, sticky-note inventory, rejected alternatives, source-coverage notes, and confirmation conversation are temporary. The confirmed diagram is not temporary: its exact Mermaid source is a first-class part of `model.md`.

## Context Map projections

`context-map.md` starts with one global Mermaid `graph LR`. It declares every confirmed project Bounded Context exactly once, including isolated contexts, using a unique `lower_snake_case` Mermaid identifier and accepted context name. Each plain, unlabeled edge points from upstream (`U`) to downstream (`D`) and means model or published-contract influence. The dependency graph is a DAG: no self-loop, reciprocal edge, longer cycle, bidirectional arrow, Partnership, or Shared Kernel.

The separate Interaction View repeats the same nodes. Each labeled edge points from runtime/business initiator to receiver. Interaction direction may oppose model dependency and interactions may form cycles; they never create ownership or a reverse Context Map dependency.

Each context has:

- one fenced `text` Local View with itself and exactly its direct semantic-dependency neighbors, dependency arrows from upstream to downstream, and no Mermaid or U/D labels;
- an optional `Interactions` projection for each interaction it initiates, including receiver, trigger or intent, and result or failure feedback;
- Downstream Contracts for semantic contracts it publishes; and
- Upstream Dependencies for semantic contracts it consumes and translates.

Every semantic edge has the same named contract and endpoints on both sides. Every interaction appears once in the Interaction View and once under its initiator. Runtime request/response through a contract does not add a reverse dependency.

## Confirmed documentation closure

Spec, PRD, ADR, and Glossary documents remain in their project-defined locations. They are not copied under `docs/ddd-expert/`. After the user confirms the integrated model, EventStorming derives the minimal affected set and `apply-confirmed-model` updates it in one logical consistency transaction. The user confirms domain meaning, not a per-file impact inventory. If synchronization requires a semantic decision absent from the model, return that decision to the EventStorming Board before writing.

Living Specs, PRDs, and Glossaries may be updated. ADR handling follows repository policy; an accepted historical ADR is preserved and a changed decision is recorded in a superseding ADR, with only an allowed status or superseded-by pointer added to the old record. Unrelated or external documents are not absorbed into the transaction.

## Context topology changes

A confirmed context rename, split, merge, or removal updates root navigation, Context Map, and all affected Models together. Old Model files are deleted only when their absence follows mechanically from the confirmed context inventory; a context directory is removed only when it contains no retained Tactical Design or unrelated files.

A retained Design is not rewritten to fit the new topology and may become stale or orphaned. It remains visible for a later Tactical Design decision.

## File templates

- Use [README.md](README.md) for the project artifact entry point.
- Use [context-map.md](context-map.md) for semantic dependencies and runtime/business interactions.
- Use [model.md](model.md) for one confirmed Bounded Context Model and exact EventStorming view.
- Use [design.md](design.md) only to inspect or consume separately accepted Tactical Design.
- Omit only the explicitly optional sections and remove all template comments and placeholders from written artifacts.
