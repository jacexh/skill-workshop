# DDD Expert Artifacts

<!-- Remove template comments and placeholders from the written artifact. -->

## Bounded Contexts

<!-- Keep one Markdown link per confirmed Bounded Context, ordered by context name. Replace the example with real names and paths. -->

- [<Bounded Context>](context/<context-slug>/model.md)<!-- When present, append: ` — optional [Architecture](context/<context-slug>/architecture.md)`. Remove `optional` in the written link. -->

Every linked Model is the current domain authority for that Bounded Context. A linked Architecture file is optional current software-design authority for that context. Semantic dependencies and named contracts are authoritative in [context-map.md](context-map.md).

## EventStorming Iterations

<!-- Keep one entry per EventStorming meeting. Use `[ ]` for `draft` or `ready`; use `[x]` only when its minutes use `status: implemented`. For `superseded`, use a plain lineage entry: `- [<Old scope>](event-storming/<old-slug>.md) — superseded by [<New scope>](event-storming/<new-slug>.md)`. -->

- [ ] [<EventStorming scope>](event-storming/<event-storming-slug>.md)

## Tactical Design Deltas

<!-- Omit this section when the project has no Tactical Design records. Keep one link per material Design Delta. Use `[ ]` for `draft` or `ready`; use `[x]` only when its record uses `status: implemented`. For `superseded`, use a plain lineage entry linking the old delta to its replacement ready Tactical Design or to the ready EventStorming authority left sufficient when newer business authority or reconciled implementation evidence eliminated the delta. -->

- [ ] [<Design Delta>](tactical-design/<tactical-design-slug>.md)
