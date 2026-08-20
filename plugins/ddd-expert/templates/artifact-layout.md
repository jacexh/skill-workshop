# DDD Expert Artifact Layout

Project-owned DDD artifacts contain only accepted current knowledge:

```text
docs/ddd-expert/
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        `-- domain-objects.md   # created when Tactical Design confirms its first object description
```

## Ownership

- `context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `model.md` owns one context's purpose, essential language, Aggregate Roots, and strategic business rules.
- `domain-objects.md` owns confirmed current Root and Entity descriptions, grouped by Aggregate Root: definition, Facts, Lifecycle State, behavior, and actual Domain Events. A Definition may include an essential way the object operates when it changes the object's meaning.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Codify and Guard treat all three artifact types as read-only.
