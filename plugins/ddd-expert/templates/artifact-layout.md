# DDD Expert Artifact Layout

Project-owned DDD artifacts contain only accepted current knowledge:

```text
docs/ddd-expert/
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        |-- domain-objects.md   # created when Tactical Design confirms its first object description
        |-- architecture.md     # created when Architecture Design confirms its first catalog
        `-- architecture.html   # generated from architecture.md and the other artifacts
```

## Ownership

- `context-map.md` owns the Bounded Context inventory and semantic dependencies, naming each contract. See [Context Map writing](#context-map-writing).
- `model.md` owns one context's purpose, essential language, Aggregate Roots, every Business Rule of the context, and the Policies the context decides.
- `domain-objects.md` owns confirmed current Root, Entity, and Domain Service descriptions in the [domain-object template](domain-objects.md): Roots and their Entities are grouped by Aggregate, and Domain Services have a separate context-level section. A Behavior cites its governing Business Rules by name.
- `architecture.md` owns one context's closed contract catalog in the [architecture template](architecture.md): its Query Repositories, Application Ports, Inbound Sources, tasks, and technical mechanisms on seams. See [Architecture writing](#architecture-writing).
- `architecture.html` is the generated view of the whole context for people. It owns no content.

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, implementation sequence, or duplicated project decision. `architecture.html` is their only diagram, and only the [view renderer](../scripts/render-architecture.mjs) writes it.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Architecture Design writes `architecture.md` after the user confirms its design review, then regenerates `architecture.html`. Codify and Guard treat all artifacts as read-only.

A Domain Service follows the same object confirmation and write checks. Completing its slice includes accepted changes to affected collaborator descriptions and Business Rules.

## Artifact writing

Write artifact content in English, in ASD-STE100 Simplified Technical English
at about 80% strictness. Ubiquitous Language terms take the place of STE
technical names; every other word keeps one meaning. Each sentence is active, has at most 25
words, and states one fact, rule, or behavior.

In `context-map.md`, `model.md`, and `domain-objects.md`, each field records
business meaning in the shape its template gives. Display, persistence,
coordination, transport, migration history, and design rationale belong in
project decisions or code. `architecture.md` records software structure only
in the shape that [Architecture writing](#architecture-writing) gives.

Each meaning has one home: a Business Rule or Policy in `model.md`, its owning
Behavior in `domain-objects.md`, and a term definition in Essential Language. Other entries
refer to that home by name. State each meaning as what holds or what happens.

When a write changes an entry's meaning, rewrite that whole entry to this section. A rewrite that keeps every accepted condition and outcome is a wording change. A rewrite that splits, merges, or renames a Business Rule or Policy changes accepted content, so it needs confirmation under the workflow contract.

## Context Map writing

The Context Map names contracts; it does not document them. Each cell holds
what a reader needs to find the right model and contract source.

- **Purpose** is one sentence: the business authority the context owns.
- **Published contract** lists each contract as `**<Name> Contract:**`
  followed by one sentence stating the meaning the upstream owns. A Published
  Fact Contract name ends in `Published Fact Contract`, and an Asynchronous
  Intent Contract name ends in `Intent Contract`. A surface with commands and
  queries is two entries. Operations, fields, failures, and timing live in the
  upstream's contract source and Business Rules.
- **Downstream use** is one sentence stating how the downstream relies on the
  contracts, followed by `; Policy` references for its reactions. The
  downstream's own Business Rules stay in its `model.md`, cited by name when
  the reliance needs them.

A map written before these rules fails the validator. Slim it in the same
write. A detail that has no home in a `model.md` or contract source becomes a
proposed Business Rule of its owning context and needs confirmation before it
leaves the map.

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

## Architecture writing

`architecture.md` is the closed contract catalog of one context, in the
[architecture template](architecture.md). It lists only contracts and
mechanisms that the other artifacts do not fix. Roots, Repositories, Domain
Services, Domain-owned Ports, Domain Events, event handlers, Integration
Message subscribers, and the Application entry follow from `domain-objects.md`,
`model.md`, `context-map.md`, and House Style, and the catalog does not repeat
them. Application methods and their coordination are implementation latitude.
Ordering that the business requires is a Business Rule, a Policy, or a project
decision.

| Section | One row per | Default granularity | A second row needs this Reason |
|---|---|---|---|
| Query Repositories | concept read: a Root or a read model this context maintains | one per concept | a different store or a separately maintained read model |
| Application Ports | authority: another context, an external system, this context's own publisher, or its task queue | one per authority | for one authority, a different capability with its own adapter; for a role Port across authorities, the Domain fact that selects the realization |
| Inbound Sources | external system, not a Bounded Context, that sends this context input | one per authority | a different input kind with its own adapter |
| Tasks | object that a task advances | one per object | a different worker or a different retry semantics |
| Mechanisms | technical mechanism on one seam | one per delivery constraint or Policy failure outcome | — |

- **Read needs** come from Business Rules in `model.md`, query contracts that
  `context-map.md` says this context supplies, and delivery constraints. Name
  each read need with the modeled facts it returns. A read need that needs a
  fact that `model.md` or `domain-objects.md` does not hold is a correction to
  that artifact, not a new query concept. Query and presentation code assemble
  views from modeled facts.
- A **Query Repository** reads only data that this context writes. A read of
  data that another authority writes goes through an Application Port to that
  authority.
- An **Application Port** covers capabilities in its authority's published
  language. The publisher for this context's Published Fact Contracts and the
  task enqueue port are Application Ports too.
- An Integration Message subscriber follows from `context-map.md` and is
  never an Inbound Source.
- A **task** names its key and what enqueues it: a Policy, the Application, an
  Inbound Source, or another task. A periodic task names `Every <interval>,
  <timezone>` instead.
- A **mechanism** sits on one seam: `Application` for an entry mechanism of
  synchronous APIs, a Root's Repository, a Domain-owned Port, a cataloged Query
  Repository, Application Port, Inbound Source, or task, or `<Context>
  subscriber` for the subscriber of a context that the Context Map says this
  context reacts to. It serves a delivery constraint
  or a Policy failure outcome, stated in full. A mechanism that only realizes a
  command-time Business Rule is Codify's realization of that rule and is not
  listed.
- Every **Reason** names its accepted source: a read need, a Context Map
  contract, a delivery constraint, a Policy, or a project decision. Existing
  code is evidence of the current state, never a Reason. Each cell states the
  current structure; issues, pull requests, and design history stay in the
  spec.

The catalog is **closed**. Implementation realizes each listed row in its
layer and maps every read and outbound call onto a listed row. A method
belongs to a row when it stays inside the row's Reads or Covers and returns
modeled facts, named after those facts. Everything else is **outside the
catalog**:

- a Query Repository, Application Port, Inbound Source, or task that the
  catalog does not list;
- a method that returns a concept that `model.md` and `domain-objects.md` do
  not hold, or a second method that returns the same facts as an existing one;
- a read or outbound call that bypasses the listed contracts;
- a listed row or mechanism removed or moved off its seam.

Implementation adds a mechanism only for a delivery constraint that no listed
mechanism serves, and reports it. The
[view renderer](../scripts/render-architecture.mjs) generates
`architecture.html` from `architecture.md` and the context's other artifacts.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Before an architecture write, use
the [architecture template](architecture.md). Keep template headings and table
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
For every changed `model.md` or `domain-objects.md`, and for each context whose
Semantic Dependencies row changed, run the
[Model validator](../scripts/validate-model.mjs) on that context's `model.md`.
It cross-checks the sibling `domain-objects.md` and the Context Map:

```sh
node "<plugin-root>/scripts/validate-model.mjs" "<project-root>/docs/ddd-expert/context/<context-slug>/model.md"
```

An `invalid Model:` line is a failed validation: a citation or a Lifecycle
State transition that resolves nowhere. A `note:` line names a gap that the
accepted model may intend. The check is complete when every note that names an
entry this write changed is corrected or reported with the reason it stands.

The view depends on every artifact of its context. After a write to
`architecture.md`, or to `model.md`, `domain-objects.md`, or `context-map.md`
of a context that has `architecture.md`, regenerate each affected view with the
[view renderer](../scripts/render-architecture.mjs), then run the
[Architecture validator](../scripts/validate-architecture.mjs). The validator
checks the catalog shape, resolves each mechanism seam against the catalog and
the sibling `domain-objects.md` and `context-map.md`, and fails when
`architecture.html` differs from a fresh render:

```sh
node "<plugin-root>/scripts/render-architecture.mjs" "<project-root>/docs/ddd-expert/context/<context-slug>"
node "<plugin-root>/scripts/validate-architecture.mjs" "<project-root>/docs/ddd-expert/context/<context-slug>/architecture.md"
```

A successful script exit shows that names and structure agree. Business
correctness rests on the reread above.
