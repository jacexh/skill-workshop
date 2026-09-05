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
- `domain-objects.md` owns confirmed current Root and Entity descriptions, grouped by Aggregate Root: definition, Facts, Lifecycle State, behavior, Domain-owned Ports where present, and actual Domain Events. A Definition may include an essential way the object operates when it changes the object's meaning.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Codify and Guard treat all three artifact types as read-only.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Keep template headings and table
headers; descriptions and business vocabulary may use the user's language.
Replace placeholders and omit inapplicable optional entries.

After writing, reread changed artifacts for accepted meaning and preservation of
unaffected content. Check that each affected relative Model link resolves.
For every changed Context Map, run the
[Context Map validator](../scripts/validate-context-map.mjs):

```sh
node "<plugin-root>/scripts/validate-context-map.mjs" "<project-root>/docs/ddd-expert/context-map.md"
```

Resolve `<plugin-root>` from this template's installed location, not the project
working directory. If validation fails, correct the representation while
preserving accepted meaning and rerun. A contradiction requiring a new business
decision remains for the user; report the exact failure and current file state.
Model and domain-object files have no automatic semantic validator: review their
template conformance and accepted ownership directly. A successful script exit
does not establish business correctness.
