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
- `model.md` owns one context's purpose, essential language, Aggregate Roots, and every Business Rule of the context.
- `domain-objects.md` owns confirmed current Root, Entity, and Domain Service descriptions in the [domain-object template](domain-objects.md): Roots and their Entities are grouped by Aggregate, and Domain Services have a separate context-level section. A Behavior cites its governing Business Rules by name.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Codify and Guard treat all three artifact types as read-only.

A Domain Service follows the same object confirmation and write checks. Completing its slice includes accepted changes to affected collaborator descriptions and strategic rules.

## Artifact writing

Write artifact content in English, in ASD-STE100 Simplified Technical English
at about 80% strictness. Ubiquitous Language terms are the technical names;
every other word keeps one meaning. Each sentence is active, has at most 25
words, and states one fact, rule, or behavior.

Each field records business meaning in the shape its template gives.
Display, persistence, coordination, transport, migration history, and design
rationale belong in project decisions or code.

Each meaning has one home: a Business Rule in `model.md`, its owning Behavior in
`domain-objects.md`, and a term definition in Essential Language. Other entries
refer to that home by name. State each meaning as what holds or what happens.

When a write touches an entry, rewrite the whole entry to this section.

## Business rule writing

Write each Business Rule as one sentence in an EARS pattern: one claim that a
concrete scenario can contradict.

| Pattern | Shape |
|---|---|
| Ubiquitous | `<Concept> <always holds or does> ...` |
| Event | `When <trigger>, <concept> ...` |
| State | `While <state>, <concept> ...` |
| Unwanted | `If <condition>, then <concept> rejects ...` |
| Optional | `Where <feature applies>, <concept> ...` |

Split a claim that needs a second sentence into separate rules. A permission
rule names the Role that may act, for example: `If the caller is not the Mail
recipient, then MailDelivery rejects Record read.` Tactical
behavior ownership belongs in `domain-objects.md`, which cites the rule by name.

Express the promised behavior or authority at the Model level. Technical concepts
may be Domain language: "Stopping execution preserves the Session's persistent
assets" is a domain guarantee; retaining a JuiceFS PVC is its current realization
and belongs with project implementation decisions. Preserve a named technology
when the accepted business contract itself depends on it.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Keep template headings and table
headers; write content to [Artifact writing](#artifact-writing).
Replace placeholders and omit inapplicable optional entries.

For each added or revised entry, reread the whole entry against
[Artifact writing](#artifact-writing), and each Business Rule also against
[Business rule writing](#business-rule-writing). Split, merge, or rewrite
affected entries until each expresses one claim in its home, preserving accepted
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
