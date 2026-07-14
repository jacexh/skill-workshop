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

One directory represents one accepted Bounded Context. `<context-slug>` is the stable lower-kebab-case form of its accepted name. A package, service, team, table, or deployment name is not a substitute when it differs from the business context name.

Separate Bounded Contexts use separate directories. The root does not contain a shared `model.md` or `design.md`, and one context artifact does not collect another context's internal model or tactical design.

The tree above is the settled state. `design.md` is intentionally absent after Explore first creates or changes a Model until Shape successfully creates or revalidates the Design. A context topology change may also retain an obsolete Design temporarily for Shape to reconcile; this is not a valid input to Codify.

## Artifact meaning

| Artifact | Semantic authorizer | Content |
|---|---|---|
| `README.md` | Explore | Project artifact entry point and navigation to the accepted Bounded Contexts |
| `context-map.md` | Explore | Global upstream/downstream dependency DAG plus each context's responsibility, authority, direct-neighbor view, and named contract projections |
| `context/<context-slug>/model.md` | Explore | That context's business language, authority, lifecycle, invariants, policies, failure semantics, and view of its dependencies |
| `context/<context-slug>/design.md` | Shape | That context's accepted Model realization, Aggregate and Domain-object boundaries, lifecycle, policies, coordination, context contracts, and design-significant technical or verification obligations |

Software Design EventStorming boards, sticky-note inventories, hot-spot notes, alternative drafts, and acceptance conversations are temporary Shape working material, not additional artifact slots. The Design retains only the integrated accepted conclusions and the evidence needed to review them.

## Cross-context facts

`context-map.md` starts with one global Mermaid `graph LR`. It declares every accepted project Bounded Context exactly once, including isolated contexts, using the context's lower-kebab-case slug with hyphens replaced by underscores as its node identifier and its accepted name as its visible label. Each plain, unlabeled arrow points from upstream (`U`) to downstream (`D`) and means model or published-contract influence, never runtime call flow. The entire graph is a DAG: no self-loop, reciprocal edge, longer cycle, bidirectional arrow, Partnership, or Shared Kernel. The diagram contains only project Bounded Contexts and directed dependencies between them. Its nodes and edges are a mechanical projection of each context's Local View and named contract details, not a second source of domain facts.

`context-map.md` owns dependencies between contexts. Every context lists only direct neighbors. Every edge has at least one identically named contract on both ends: upstream records the downstream endpoint, published meaning, and guarantee; downstream records the upstream endpoint, accepted meaning, and local translation. Runtime request/response through that contract does not add a reverse edge. Each affected Model and Design records only its own side:

- `model.md` states local language, authority, accepted external facts, and translation boundaries;
- `design.md` states local contract ownership, coordination, delivery, failure, and recovery responsibilities.

Do not create a shared cross-context object model. When several contexts participate in one change, Explore updates the Context Map and each affected model for the facts that context owns; Shape updates each affected design for its local collaboration responsibilities. Directional DDD collaboration patterns are optional annotations after dependency direction and contract ownership are known, never alternate edge types.

## File templates

- Use [README.md](README.md) for the project artifact entry point.
- Use [context-map.md](context-map.md) for the strategic Context Map.
- Use [model.md](model.md) for one context's Domain Model structure.
- Use [design.md](design.md) for one context's Tactical Design structure.
- Omit inapplicable sections and remove template comments and placeholders from written artifacts.
