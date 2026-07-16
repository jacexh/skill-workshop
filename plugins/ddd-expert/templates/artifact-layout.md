# DDD Expert Artifact Layout

Project-owned DDD artifacts use this canonical structure:

```text
docs/ddd-expert/
|-- README.md
|-- context-map.md
`-- context/
    `-- <context-slug>/
        `-- model.md
```

## Context directory

One directory represents one complete candidate or confirmed Bounded Context. `<context-slug>` is the stable lower-kebab-case form of its candidate name. A package, service, team, table, or deployment name is not a substitute when it differs from the business context name.

Separate Bounded Contexts use separate directories. The root does not contain a shared `model.md`, and one context artifact does not collect another context's internal model.

`model.md` is written only after the ten EventStorming steps and adversarial review produce one complete approval candidate. That candidate increments `model_revision` and uses `model_status: draft`. Explicit approval promotes the exact same revision to `model_status: model_ready`; a semantic correction writes another incremented draft revision. Earlier exploration exists only on the temporary EventStorming Board. A canonical `model_ready` Model enters Codify directly.

Because one `model.md` may contain several Aggregates, an Aggregate-scoped confirmation preserves every excluded sibling diagram and semantic range byte-for-byte. A change to shared Bounded Context meaning or a sibling Aggregate requires Bounded Context scope and a newly presented integrated model.

## Artifact meaning

| Artifact | Semantic authorizer | Content |
|---|---|---|
| `README.md` | EventStorming (`apply-confirmed-model`) | Navigation to the confirmed Bounded Contexts |
| `context-map.md` | EventStorming (`apply-confirmed-model`) | Context inventory, semantic dependencies, optional focused Local Views, and one authoritative detail record per named contract |
| `context/<context-slug>/model.md` | EventStorming (`write-model-draft`, then `apply-confirmed-model`) | Exact complete EventStorming candidate and that context's language, authority, Aggregates/core objects, lifecycle, invariants, policies, failure semantics, Hotspots, dependencies, revision, and `draft` or `model_ready` status |

The EventStorming Board, sticky-note inventory, rejected alternatives, source-coverage notes, and confirmation conversation are temporary. The complete approval candidate is not temporary: its exact Mermaid source is a first-class part of the `draft` `model.md` and remains unchanged when promoted.

## Context Map projections

`context-map.md` starts with one global Mermaid `graph LR`. It declares every confirmed project Bounded Context exactly once, including isolated contexts, using a unique `lower_snake_case` Mermaid identifier and accepted context name. Each plain, unlabeled edge points from upstream (`U`) to downstream (`D`) and means model or published-contract influence. The dependency graph is a DAG: no self-loop, reciprocal edge, longer cycle, bidirectional arrow, Partnership, or Shared Kernel.

Each context has:

- one core responsibility, business authority, and link to its canonical Model; and
- an optional fenced `text` Local View only when a direct-neighbor focus materially improves readability over the Global View. When present, it contains exactly that context and its direct semantic-dependency neighbors, with dependency arrows from upstream to downstream and no Mermaid or U/D labels.

Each named semantic contract appears once under `Model Dependency Contracts`, with its upstream, downstream, published meaning, downstream reliance, local translation, and guarantee. Runtime request/response direction does not determine model ownership or add a reverse dependency.

## Confirmed documentation closure

Spec, PRD, ADR, and Glossary documents remain in their project-defined locations. They are not copied under `docs/ddd-expert/`. After the user confirms the integrated model, EventStorming derives the minimal affected set and `apply-confirmed-model` updates it in one logical consistency transaction. The user confirms domain meaning, not a per-file impact inventory. If synchronization requires a semantic decision absent from the model, return that decision to the EventStorming Board before writing.

Living Specs, PRDs, and Glossaries may be updated. ADR handling follows repository policy; an accepted historical ADR is preserved and a changed decision is recorded in a superseding ADR, with only an allowed status or superseded-by pointer added to the old record. Unrelated or external documents are not absorbed into the transaction.

## Context topology changes

A confirmed context rename, split, merge, or removal updates root navigation, Context Map, and all affected Models together. Old Model files are deleted only when their absence follows mechanically from the confirmed context inventory; a context directory is removed only when it contains no unrelated files.

## File templates

- Use [README.md](README.md) for the project artifact entry point.
- Use [context-map.md](context-map.md) for semantic dependencies and runtime/business interactions.
- Use [model.md](model.md) for one complete candidate or confirmed Bounded Context Model and exact EventStorming view.
- Omit only the explicitly optional sections and remove all template comments and placeholders from written artifacts.
