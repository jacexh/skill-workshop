# DDD Expert Artifacts

<!-- Remove template comments and placeholders from the written artifact. -->

## Bounded Contexts

<!-- Keep one Markdown link per confirmed Bounded Context, ordered by context name. Replace the example with real names and paths. -->

- [<Bounded Context>](context/<context-slug>/model.md)

Every linked Model contains the exact confirmed EventStorming diagram and uses `model_status: model_ready`. Semantic dependencies, runtime/business interactions, and named contracts are authoritative in [context-map.md](context-map.md).

An existing `design.md` lives beside its context's `model.md` only when separately accepted Tactical Design authority exists. EventStorming does not create or update it. A Model revision may therefore leave Design absent or stale until a separate tactical-design task resolves it.
