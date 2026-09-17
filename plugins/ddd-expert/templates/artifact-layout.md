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
- `domain-objects.md` owns confirmed current Root, Entity, and Domain Service descriptions in the [domain-object template](domain-objects.md): Roots and their Entities are grouped by Aggregate, and Domain Services have a separate context-level section.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Codify and Guard treat all three artifact types as read-only.

A Domain Service follows the same object confirmation and write checks. Completing its slice includes accepted changes to affected collaborator descriptions and strategic rules.

## Strategic rule writing

Write each Model Business Rule as one independently challengeable claim: name the
governed business concept or collaboration, its material conditions, and the
accepted decision, permission, transition, required outcome, or invariant.
Tactical behavior ownership belongs in `domain-objects.md`.

Express the promised behavior or authority at the Model level. Technical concepts
may be Domain language: "Stopping execution preserves the Session's persistent
assets" is a domain guarantee; retaining a JuiceFS PVC is its current realization
and belongs with project implementation decisions. Preserve a named technology
when the accepted business contract itself depends on it.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Keep template headings and table
headers; descriptions and business vocabulary may use the user's language.
Replace placeholders and omit inapplicable optional entries.

For each added or revised Model rule, reread its whole entry against
[Strategic rule writing](#strategic-rule-writing). Split, merge, or rewrite affected
entries until each expresses one claim at that level, preserving accepted
conditions, outcomes, and unrelated meaning.

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
