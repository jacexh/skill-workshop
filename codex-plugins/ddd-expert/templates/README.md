# DDD Expert Artifacts

<!-- Remove template comments and placeholders from the written artifact. -->

## Bounded Contexts

<!-- Keep one Markdown link per confirmed Bounded Context, ordered by context name. Replace the example with real names and paths. -->

- [<Bounded Context>](context/<context-slug>/model.md)

Every linked Model contains the exact EventStorming approval candidate. It uses `model_status: draft` while awaiting confirmation and `model_status: model_ready` after the exact revision is approved. Semantic dependencies, runtime/business interactions, and named contracts are authoritative in [context-map.md](context-map.md). A `model_ready` Model is ready for Codify.
