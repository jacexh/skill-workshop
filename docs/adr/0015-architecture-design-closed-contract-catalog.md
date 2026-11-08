# ADR 0015: Architecture Design Records a Closed Contract Catalog

- Status: Accepted
- Date: 2026-11-08
- Amends: [ADR 0014](0014-architecture-design-wireframe.md), and the rule in [ADR 0013](0013-subdomain-scaled-design-and-assumption-sweep.md) that delivery constraints never enter DDD artifacts: `architecture.md` cites the read needs and delivery constraints its rows realize

## Context

ADR 0014 made Architecture Design draw one context's complete component
wireframe as `architecture.html`, with every drawn component bound as core
design. The first real use, on a large Core context, showed three problems:

- **Contracts grew per caller.** The first draft held 33 Application Ports and
  14 tasks, copied one to one from the existing code's API surface. Each new
  interface had added its own Port or Query Repository, and each new screen had
  added its own concept, such as a "creation status" for what the model calls
  the Root's state. The user had to consolidate Ports, tasks, and read
  repositories turn by turn. The skill gave no rule for it.
- **Existing code legitimized debt.** The derivation accepted "traces to
  existing code" as a source, and the drawing binds Codify and Guard. A
  reviewer who does not challenge every box freezes current debt as accepted
  design.
- **The drawing was an inventory.** About half of its components (Roots,
  Repositories, Domain Events, event handlers, subscribers, the Application
  entry) follow mechanically from `domain-objects.md`, `model.md`, and
  `context-map.md`. The decisions that only this step makes were lost among
  them. The page was 5500 px wide, and the Application was one box with 24
  dependencies.

The artifact serves first as a constraint for Codify. The picture serves people
who want to understand the whole context; agents do not need it.

## Decision

### Constraint and view are separate files

- `architecture.md` is the constraint. Architecture Design writes it, and it is
  a Markdown artifact in the same family as `model.md` and
  `domain-objects.md`. It follows their writing style, but it records software
  structure, so the ADR 0011 rule that each field records business meaning
  does not apply to it.
- `architecture.html` is a view. `render-architecture.mjs` generates it from
  `architecture.md` and the context's other DDD artifacts. It is committed so
  that a person can open it, and the validator fails when it is out of date.

### The constraint is a closed catalog of contracts

`architecture.md` records only what this step decides and Codify would
otherwise invent:

- **Query Repositories**: one per concept read, with the read needs they serve;
- **Application Ports**: one per authority, with what they cover and the
  adapter technology;
- **Inbound Sources**: inbound adapters for authorities outside the Context
  Map, such as a Kubernetes informer;
- **Tasks**: one per object a task advances, with key and enqueuer or schedule;
- **Mechanisms**: on their seams, each serving a delivery constraint or a
  Policy failure outcome.

Every row has a reason from an accepted source: a read need, the Context Map,
a delivery constraint, a Policy, or a project decision. Existing code is never
a reason. Existing contracts outside the catalog are debt. Architecture Design
hands them on as a consolidation list through the spec, the issue, or the
conversation, and keeps them out of the artifact.

Components that the other artifacts already fix are not recorded. Application
methods and their coordination are not recorded either. Ordering that the
business requires is a Business Rule, a Policy, or a project decision. Other
ordering is implementation latitude.

### Granularity: one default and named reasons to split

- A read need is stated in modeled facts. A read need that needs an unmodeled
  fact is a correction to `model.md` or `domain-objects.md`, not a new query
  concept.
- A Query Repository reads only data that this context writes. A read of data
  that another authority writes goes through an Application Port to that
  authority.
- A second Query Repository over one concept needs a reason: a different store
  or a separately maintained read model.
- A second Application Port to one authority needs a reason. A role Port that
  spans several authorities needs a reason too: a Domain fact selects the
  realization, so Application must not know which authority serves it.
- A second task on one object needs a reason: a different worker or a different
  retry semantics.

The trial conversion of that context needed exactly these split reasons. It
reduced 87 drawn components to about 30 catalog rows.

### Binding: the catalog is closed

- Codify adds methods inside a cataloged contract when they use modeled facts.
  A new Query Repository, Application Port, Inbound Source, or task, or a
  method that needs an unmodeled concept, is a ⚠️ Conflict. Codify leaves
  that part unimplemented, never widens a row or assembles the read ad hoc,
  and states the missing need, the row it checked, and the proposed row with
  its Reason or the unmodeled fact. Architecture Design, or the step that owns
  the missing fact, resolves it.
- Guard also reports a read or outbound call that bypasses the catalog.
- Guard reports a contract or task outside the catalog, and a method that names
  an unmodeled concept.
- Architecture Design now also runs when a change adds a read need or an
  external dependency, so that a new interface cannot bypass the catalog.

### The view

The generated page shows the whole context in three layer bands with wrapped
rows: Transport, Application, and Domain. Adapters fold into the contract they
implement, and Repositories fold into their Root. Mechanisms appear on their
seam. Event-to-Policy, message, and task relations are always visible. The
page draws no relation that the artifacts do not state.

## Consequences

- The catalog is a short list that people can review row by row. The view
  supports understanding and binds nothing.
- Codify loses latitude on contracts and keeps latitude on Application
  methods and coordination.
- The catalog is only as complete as the read needs. A missed read need
  surfaces as a Conflict during Codify. That is the point where the catalog
  grows on purpose.
- A project with an ADR 0014 `architecture.html` converts it when
  Architecture Design next runs for that context. Until then, the old file has
  no validator.
