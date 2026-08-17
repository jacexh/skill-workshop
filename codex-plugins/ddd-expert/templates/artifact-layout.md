# DDD Expert Artifact Layout

Project-owned DDD artifacts use this canonical structure:

```text
docs/ddd-expert/
|-- README.md
|-- context-map.md
|-- event-storming/
|   `-- <event-storming-slug>.md
|-- tactical-design/
|   `-- <tactical-design-slug>.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        `-- architecture.md       # optional
```

## Iteration minutes

One file under `event-storming/` records one EventStorming meeting and its implementation handoff. Use a stable, unique lower-kebab-case slug derived from the Spec, issue, or modeling scope. A later iteration creates another file; completed minutes are not current domain authority.

Questions discovered during Tactical Design remain temporary conversation state while one Model Review Batch is assembled. A settled batch that actually changes business authority creates at most one correction draft, and every revision before confirmation rewrites that same draft. Do not create one minutes file per challenge question, and do not rewrite an already confirmed record to avoid honest lineage.

The normal minutes lifecycle is `draft -> ready -> implemented`; a confirmed pre-implementation correction adds the branch `ready -> superseded`:

- `draft`: the complete candidate is visible for confirmation; canonical Models remain unchanged.
- `ready`: the user confirmed the minutes and EventStorming synchronized every affected Model and document.
- `implemented`: Guard cleared the reviewed semantic structure, the matching producer checkpoint was complete, and Guard closed this iteration.
- `superseded`: a later confirmed EventStorming correction replaced this `ready` iteration before implementation; `superseded_by` links the replacement, and this record never becomes implementation authority.

The root README keeps one entry per minutes file. `draft` and `ready` remain unchecked; Guard checks the item only with the `implemented` transition. A superseded record becomes a plain lineage entry linking its replacement, never a checked implementation item.

## Tactical Design deltas

One file under `tactical-design/` records one material Design Delta for an implementation slice. It may reference one or more ready EventStorming iterations and one or more affected Bounded Contexts. Do not create one file mechanically per meeting or Model. No Design Delta means no Tactical Design file.

A Tactical Design record normally follows `draft -> ready -> implemented`; invalidation before implementation adds `ready -> superseded`. `draft` exposes the complete collaboration design for confirmation, `ready` is accepted Codify and Guard authority only while its governing EventStorming links remain ready, `implemented` means Guard cleared the matching realization with a complete producer checkpoint, and `superseded` is invalidated pre-implementation history. A superseded record links through `superseded_by` to either its replacement ready Tactical Design or the newer ready EventStorming authority that eliminated its delta.

When newer confirmed Models eliminate the Design Delta or materially replace its implementation-slice identity, remove an unconfirmed Tactical Design draft and its README entry instead of retaining cancelled design history. Never discard a confirmed record. Replace an invalidated unimplemented `ready` record with a new confirmed Tactical Design when a material delta remains, or retire it directly when no replacement delta remains; in either case transition it to `superseded`, replace its README TODO with plain lineage, and replace or remove every current BC Architecture source from its claims in the same consistency write. Ordinary `no_design_change` is a separate zero-write result valid only when no draft or invalidated ready authority awaits cleanup. An `implemented` record remains provenance and never changes status.

When a reviewed implementation is governed by both ready EventStorming and Tactical Design records, Guard closes the complete scoped set together. A partial close would falsely claim that business meaning or collaboration design was implemented independently.

## Context Models

One context directory represents one Bounded Context. `<context-slug>` is the stable lower-kebab-case form of its accepted name. A package, service, team, table, or deployment name is not a substitute when it differs from the business context name.

Models remain the current domain authority. A confirmed EventStorming iteration increments each semantically changed `model_revision`, updates `last_changed_by` to those minutes, and integrates only durable conclusions owned by that context. Complete iteration diagrams and cross-context scenario flow stay in the minutes instead of being copied into every Model.

## Bounded Context Architecture

`context/<context-slug>/architecture.md` is optional current software-architecture authority for one Bounded Context. Create it lazily only when that context has at least one durable, context-specific architecture decision that outlives one Design Delta and materially constrains a future Codify choice. Do not create a root `docs/ddd-expert/architecture.md` catch-all.

Tactical Design projects each accepted current decision into the context that owns its responsibility. Project each cross-context decision once into the context that owns the responsibility; other contexts reference their own obligations, and `context-map.md` continues to own contract meaning. Generic House Style, canonical Model facts, complete collaboration sequences, code structure, and historical rationale stay with their existing owners. Replace or remove superseded rows rather than retaining history, and remove an Architecture file when it has no current rows.

An identity-preserving context rename mechanically moves its Architecture without changing decision rows or revision; only the owning-context label and navigation links may follow the confirmed name. A split, merge, or removal deletes the retired context Architecture from the current set without reassigning any row. A decision that must survive a changed boundary requires a new Tactical Design projection before Codify.

## Artifact meaning

| Artifact | Writer | Content |
|---|---|---|
| `README.md` | EventStorming and Tactical Design; Guard only for iteration closure | Navigation to Models plus EventStorming and Tactical Design TODO indexes |
| `context-map.md` | EventStorming | Context inventory, semantic dependencies, optional Local Views, and one authoritative detail record per named contract |
| `event-storming/<event-storming-slug>.md` | EventStorming; Guard only for `ready -> implemented` | One iteration's complete scope, integrated business-success diagrams with Role/fact-to-Capability Command edges, decisions and reasons, affected Models, assumptions, Hotspots, and status or correction lineage |
| `tactical-design/<tactical-design-slug>.md` | Tactical Design; Guard only for `ready -> implemented` | One Design Delta, complete critical collaboration sequences, ownership, changed Interfaces, claims, non-goals, discretion, and status or invalidation lineage |
| `context/<context-slug>/model.md` | EventStorming | Current context language, authority, Aggregates/core objects, full Aggregate Capability contracts, lifecycle, selected Domain Events, event-triggered Commands, invariants, policies, failure semantics, Hotspots, dependencies, revision, and latest minutes link |
| `context/<context-slug>/architecture.md` | Tactical Design | Optional current BC-specific architecture decisions, revision, and confirming claim links |

## Context Map projections

`context-map.md` starts with one global Mermaid `graph LR`. It declares every confirmed project Bounded Context exactly once, including isolated contexts, using a unique `lower_snake_case` Mermaid identifier and accepted context name. Each plain, unlabeled edge points from upstream (`U`) to downstream (`D`) and means model or published-contract influence. The dependency graph is a DAG: no self-loop, reciprocal edge, longer cycle, bidirectional arrow, Partnership, or Shared Kernel.

Each context has one core responsibility, business authority, and link to its canonical Model. Add a fenced `text` Local View only when a direct-neighbor focus materially improves readability over the Global View. Each named semantic contract appears once under `Model Dependency Contracts`, with its upstream, downstream, published meaning, downstream reliance, local translation, and guarantee.

## Documentation closure

Before EventStorming confirmation, write only the `draft` minutes and its unchecked README entry. After confirmation, stage the `ready` minutes, affected Models, Context Map, README, and relevant project-owned living Specs, PRDs, ADRs, and Glossaries outside the workspace, then apply the complete consistency set once. If synchronization requires a semantic decision absent from the minutes, return that decision to the EventStorming Board.

Whenever a ready write replaces an unimplemented EventStorming iteration, include every replaced minutes record and its README lineage entry in the same consistency set. Change only its status to `superseded` and add `superseded_by`; the replacement ready minutes become the Models' `last_changed_by` source. The same rule applies whether the correction began as a Tactical Design Model Challenge, direct user correction, or other accepted evidence.

Before Tactical Design confirmation, write only its `draft` record and unchecked README entry. After confirmation, stage the exact `ready` transition, README, affected BC Architecture projections, and relevant ADR closure as one consistency set. No durable BC-specific decision means no Architecture creation or update. Tactical Design never changes canonical Models; a business-meaning correction returns to EventStorming.

When newer ready EventStorming authority invalidates an unimplemented ready Tactical Design, Codify and Guard stop at Tactical Design until the stale record is replaced or retired. A replacement ready write includes the old `ready -> superseded` lineage and complete Architecture reprojection; each changed surviving Architecture points `last_changed_by` to the replacement ready Tactical Design. If no replacement Design Delta remains, a retirement write points `superseded_by` to the newer ready minutes and removes every Architecture row sourced from the stale claims. It preserves unrelated rows and Sources byte-for-byte; when the file survives, its incremented revision points `last_changed_by` to the just-superseded record solely as retirement provenance, not current claim authority. Delete the optional file when no rows remain.

Guard closure changes only the reviewed EventStorming and Tactical Design statuses plus README items. BC Architecture remains current until a later confirmed Tactical Design replaces or removes its decisions; implemented Tactical Design remains provenance rather than living authority.

Preserve accepted historical ADR rationale and create a superseding ADR when repository policy requires it. A confirmed context rename, split, merge, or removal updates root navigation, Context Map, affected Models, and the mechanical Architecture lifecycle above together.

## File templates

- Use [README.md](README.md) for project navigation and the iteration TODO index.
- Use [context-map.md](context-map.md) for semantic dependencies.
- Use [event-storming.md](event-storming.md) for one complete EventStorming iteration.
- Use [model.md](model.md) for one current Bounded Context Model.
- Use [architecture.md](architecture.md) only for current architecture decisions owned by one Bounded Context.
- Use [tactical-design.md](tactical-design.md) for one material Design Delta.
- Omit only explicitly optional sections and remove all template comments and placeholders from written artifacts.
