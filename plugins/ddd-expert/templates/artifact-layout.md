# DDD Expert Artifact Layout

Project-owned DDD artifacts contain only accepted current knowledge:

```text
docs/ddd-expert/
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        `-- domain-objects.md   # created when Tactical Design confirms its first Root
```

## Ownership

- `context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `model.md` owns one context's purpose, essential language, Aggregate Roots, and strategic business rules.
- `domain-objects.md` owns confirmed Aggregate Root slices: their Entities, definition, Facts, Lifecycle State, behavior, and actual Domain Events.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates one Root slice immediately after that Root is confirmed, preserving every other confirmed slice. Codify and Guard treat all three artifact types as read-only.
