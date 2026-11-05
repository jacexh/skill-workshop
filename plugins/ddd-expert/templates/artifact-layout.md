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
- `model.md` owns one context's purpose, Subdomain classification, essential language, Aggregate Roots, every Business Rule of the context, and the Policies the context decides.
- `domain-objects.md` owns confirmed current Root, Entity, and Domain Service descriptions in the [domain-object template](domain-objects.md): Roots and their Entities are grouped by Aggregate, and Domain Services have a separate context-level section. A Behavior cites its governing Business Rules by name.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, diagrams, implementation sequence, or duplicated project decision.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Codify and Guard treat all three artifact types as read-only.

A Domain Service follows the same object confirmation and write checks. Completing its slice includes accepted changes to affected collaborator descriptions and Business Rules.

## Artifact writing

Write artifact content in English, in ASD-STE100 Simplified Technical English
at about 80% strictness. Ubiquitous Language terms take the place of STE
technical names; every other word keeps one meaning. Each sentence is active, has at most 25
words, and states one fact, rule, or behavior.

Each field records business meaning in the shape its template gives.
Display, persistence, coordination, transport, migration history, and design
rationale belong in project decisions or code.

Each meaning has one home: a Business Rule or Policy in `model.md`, its owning
Behavior in `domain-objects.md`, and a term definition in Essential Language. Other entries
refer to that home by name. State each meaning as what holds or what happens.

When a write changes an entry's meaning, rewrite that whole entry to this section. A rewrite that keeps every accepted condition and outcome is a wording change. A rewrite that splits, merges, or renames a Business Rule or Policy changes accepted content, so it needs confirmation under the workflow contract.

## Business rule writing

Write each Business Rule as one sentence in an EARS pattern: one claim that a
concrete scenario can contradict.

| Pattern | Shape |
|---|---|
| Ubiquitous | `<Concept> <always holds or does> ...` |
| Event | `When <trigger>, <concept> ...` |
| State | `While <state>, <concept> ...` |
| Unwanted | `If <condition>, then <concept> <response> ...` |
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

## Policy writing

A Policy is a stateless reaction: when a named fact or time occurs, a
reacting concept performs one intent. Name the trigger in Ubiquitous Language
as a business occurrence in the same context, a Published Fact Contract, or a
business time. Tactical Design selects the Domain Event that realizes a
same-context occurrence. Write each Policy in the Model shape: one Event
sentence, then one Unwanted sentence for the business outcome when the intent
cannot complete. A Policy
completes after its trigger, because a reaction that must succeed together
with it belongs inside one consistency boundary; add `within <duration>` only
when the business sets a limit.

A Policy lives in the `model.md` of the context that decides to react, the
downstream context of its dependency. For a Published Fact Contract, that is
the context that consumes the fact. For an Asynchronous Intent Contract, that
is the sender that decides to ask; the receiver handles the request as a
Command under its own Business Rules. A Domain Event `Consumed by` line and a
Context Map `Downstream use` cell cite the Policy by name. A reaction that must
remember earlier progress is a Process, recorded as an Aggregate Root with its
Lifecycle State instead of a Policy.

Omit the Policies section when the context decides no Policy.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Keep template headings and table
headers; write content to [Artifact writing](#artifact-writing).
Replace placeholders and omit inapplicable optional entries.

For each added or revised entry, reread the whole entry against
[Artifact writing](#artifact-writing), and each Business Rule also against
[Business rule writing](#business-rule-writing), and each Policy also against
[Policy writing](#policy-writing). Split, merge, or rewrite
affected entries until each Business Rule expresses one claim and each Policy
keeps its Model shape in its home, preserving accepted conditions, outcomes,
and unrelated meaning. A split found at write time returns to confirmation
before the write.

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
