# DDD Expert Artifacts

<!-- Remove template comments and placeholders from the written artifact. -->

## Bounded Contexts

<!-- Keep one Markdown link per accepted Bounded Context, ordered by context name. Replace the example with real names and paths. -->

- [<Bounded Context>](context/<context-slug>/model.md)

## Structure

```text
docs/ddd-expert/
|-- README.md
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        `-- design.md
```

`model.md` contains accepted business facts for one Bounded Context. `design.md` contains its accepted Tactical Design. Context relationships are authoritative in `context-map.md`.
