# DDD Expert Artifact Layout

Project-owned DDD artifacts use this canonical structure:

```text
docs/ddd-expert/
|-- README.md
|-- context-map.md
|-- event-storming/
|   `-- <event-storming-slug>.md
`-- context/
    `-- <context-slug>/
        `-- model.md
```

## Iteration minutes

One file under `event-storming/` records one EventStorming meeting and its implementation handoff. Use a stable, unique lower-kebab-case slug derived from the Spec, issue, or modeling scope. A later iteration creates another file; completed minutes are not current domain authority.

The minutes follow `draft -> ready -> implemented`:

- `draft`: the complete candidate is visible for confirmation; canonical Models remain unchanged.
- `ready`: the user confirmed the minutes and EventStorming synchronized every affected Model and document.
- `implemented`: Guard cleared the implementation and closed this iteration.

The root README keeps one TODO link per minutes file. `draft` and `ready` remain unchecked; Guard checks the item only with the `implemented` transition.

## Context Models

One context directory represents one Bounded Context. `<context-slug>` is the stable lower-kebab-case form of its accepted name. A package, service, team, table, or deployment name is not a substitute when it differs from the business context name.

Models remain the current domain authority. A confirmed EventStorming iteration increments each semantically changed `model_revision`, updates `last_changed_by` to those minutes, and integrates only durable conclusions owned by that context. Complete iteration diagrams and cross-context scenario flow stay in the minutes instead of being copied into every Model.

## Artifact meaning

| Artifact | Writer | Content |
|---|---|---|
| `README.md` | EventStorming; Guard only for iteration closure | Navigation to Models plus the EventStorming TODO index |
| `context-map.md` | EventStorming | Context inventory, semantic dependencies, optional Local Views, and one authoritative detail record per named contract |
| `event-storming/<event-storming-slug>.md` | EventStorming; Guard only for `ready -> implemented` | One iteration's complete scope, integrated diagram, decisions and reasons, affected Models, assumptions, Hotspots, and status |
| `context/<context-slug>/model.md` | EventStorming | Current context language, authority, Aggregates/core objects, lifecycle, invariants, policies, failure semantics, Hotspots, dependencies, revision, and latest minutes link |

## Context Map projections

`context-map.md` starts with one global Mermaid `graph LR`. It declares every confirmed project Bounded Context exactly once, including isolated contexts, using a unique `lower_snake_case` Mermaid identifier and accepted context name. Each plain, unlabeled edge points from upstream (`U`) to downstream (`D`) and means model or published-contract influence. The dependency graph is a DAG: no self-loop, reciprocal edge, longer cycle, bidirectional arrow, Partnership, or Shared Kernel.

Each context has one core responsibility, business authority, and link to its canonical Model. Add a fenced `text` Local View only when a direct-neighbor focus materially improves readability over the Global View. Each named semantic contract appears once under `Model Dependency Contracts`, with its upstream, downstream, published meaning, downstream reliance, local translation, and guarantee.

## Documentation closure

Before confirmation, write only the `draft` minutes and its unchecked README entry. After confirmation, stage the `ready` minutes, affected Models, Context Map, README, and relevant project-owned living Specs, PRDs, ADRs, and Glossaries outside the workspace, then apply the complete consistency set once. If synchronization requires a semantic decision absent from the minutes, return that decision to the EventStorming Board.

Preserve accepted historical ADR rationale and create a superseding ADR when repository policy requires it. A confirmed context rename, split, merge, or removal updates root navigation, Context Map, and all affected Models together.

## File templates

- Use [README.md](README.md) for project navigation and the iteration TODO index.
- Use [context-map.md](context-map.md) for semantic dependencies.
- Use [event-storming.md](event-storming.md) for one complete EventStorming iteration.
- Use [model.md](model.md) for one current Bounded Context Model.
- Omit only explicitly optional sections and remove all template comments and placeholders from written artifacts.
