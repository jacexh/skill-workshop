# DDD Expert Artifact Layout

Project-owned DDD artifacts contain only accepted current knowledge:

```text
docs/ddd-expert/
|-- context-map.md
`-- context/
    `-- <context-slug>/
        |-- model.md
        |-- domain-objects.md   # created when Tactical Design confirms its first object description
        `-- architecture.html   # created when Architecture Design confirms its first design
```

## Ownership

- `context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `model.md` owns one context's purpose, Subdomain classification, essential language, Aggregate Roots, every Business Rule of the context, and the Policies the context decides.
- `domain-objects.md` owns confirmed current Root, Entity, and Domain Service descriptions in the [domain-object template](domain-objects.md): Roots and their Entities are grouped by Aggregate, and Domain Services have a separate context-level section. A Behavior cites its governing Business Rules by name.
- `architecture.html` owns one context's confirmed software architecture in the [architecture template](architecture.html): its components by layer, their dependencies, and technical mechanisms on seams. See [Architecture writing](#architecture-writing).

Candidates remain in conversation. These files contain no meeting transcript, design history, workflow status, implementation sequence, or duplicated project decision. `architecture.html` is their only diagram.

EventStorming updates strategic files after integrated confirmation. Tactical Design updates an Entity description after its Entity confirmation while the Root interview continues; after Root confirmation, it completes that Root's section and applies accepted changes across affected current DDD artifacts and project decisions, preserving unrelated content. Architecture Design writes `architecture.html` after the user confirms its design review. Codify and Guard treat all four artifact types as read-only.

A Domain Service follows the same object confirmation and write checks. Completing its slice includes accepted changes to affected collaborator descriptions and Business Rules.

## Artifact writing

Write artifact content in English, in ASD-STE100 Simplified Technical English
at about 80% strictness. Ubiquitous Language terms take the place of STE
technical names; every other word keeps one meaning. Each sentence is active, has at most 25
words, and states one fact, rule, or behavior.

In `context-map.md`, `model.md`, and `domain-objects.md`, each field records
business meaning in the shape its template gives. Display, persistence,
coordination, transport, migration history, and design rationale belong in
project decisions or code. `architecture.html` records software structure only
in the shape that [Architecture writing](#architecture-writing) gives.

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

## Architecture writing

`architecture.html` is a copy of the [architecture template](architecture.html).
Edit only its JSON block with `id="architecture-data"`; the renderer stays as
shipped. Domain components carry their accepted names; every other name and
text field is written in English.

| Field | Content |
|---|---|
| `context` | The Bounded Context name |
| `components[]` | `id`, `kind`, `name`, and an optional `note` for technology or provider; an `integration-message` also has `contract` (`published-fact` or `intent`) and `counterpart` (the other context or contexts); a periodic `task` also has `schedule` (cron and timezone) |
| `dependencies[]` | `from` and `to` component ids; the arrow means "depends on" |
| `mechanisms[]` | `name`, `seam` (the `application` entry, an `inbound-adapter`, or an `adapter` id), and `serves` (the delivery constraint or Policy it realizes) |

| Place | Kinds |
|---|---|
| Transport | `inbound-adapter` |
| Application | `application`, `event-handler`, `query-repository`, `application-port` |
| Domain | `aggregate-root`, `domain-service`, `domain-port`, `domain-event`, `repository` |
| Infrastructure | `adapter` |
| Boundary | `integration-message`, `task` |

- `inbound-adapter` is an asynchronous entry: an Integration Message
  subscriber or a task processor. It depends on the `application` entry once
  and on the message or task it receives. Synchronous request and response
  APIs are part of the `application` entry and are not drawn.
- `application` is the context's Application entry. It carries entry
  mechanisms of its synchronous APIs, such as a rate limit.
- `event-handler` reacts to a same-context Domain Event: a Policy, or the
  translation of the event into a Published Fact Contract.
- `integration-message` crosses the context boundary at the one component
  that receives or sends it: the `inbound-adapter` that consumes it, or the
  `adapter` of the `application-port` that sends it. Its `contract` and its
  direction decide whose contract it is: this context owns the Published Fact
  Contracts it sends and the Asynchronous Intent Contracts it receives.
- `task` is an Internal Task Contract: deferred, polling, or periodic work this
  context queues for itself. The context has one task enqueue
  `application-port`, and its `adapter` delivers every task. One task
  processor processes each task. The `application` entry or `event-handler`
  that enqueues a task depends on it; a `schedule` instead makes it a periodic
  task that the task queue enqueues on that schedule.
- `adapter` is an outbound adapter. It implements at least one contract
  (`repository`, `query-repository`, `domain-port`, or `application-port`),
  and every contract has an adapter. Its note names the technology, provider,
  or other context behind it.
- Dependencies point Transport to Application, Application to Application or
  Domain, Domain to Domain, and Infrastructure to Application or Domain.
  Transport and Infrastructure components also depend on the messages and
  tasks they carry, and Application components on the tasks they enqueue. A Root or Domain Service depends on each Domain Event it records.
- Domain components carry names only. `domain-objects.md` holds their meaning,
  and the drawn Root, Domain Service, Domain-owned Port, and Domain Event names
  equal its names. Entities, Value Objects, DTOs, mappers, and helpers stay
  inside their components and are not drawn.

The drawn components, dependencies, and mechanism seams are **core design**.
Implementation keeps each drawn component in its layer with its
responsibility, each drawn dependency, and each mechanism on its seam. Detail
inside a component follows House Style. Implementation reports each component
it adds beyond the drawing, and Architecture Design records it.

## Write checks

Before a strategic write, use the [Context Map](context-map.md) and
[Model](model.md) templates. Before an object write, use the
[domain-object template](domain-objects.md). Before an architecture write, use
the [architecture template](architecture.html). Keep template headings and table
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
For every changed `architecture.html`, run the
[Architecture validator](../scripts/validate-architecture.mjs). It also checks
Domain names against the sibling `domain-objects.md` when one exists:

```sh
node "<plugin-root>/scripts/validate-architecture.mjs" "<project-root>/docs/ddd-expert/context/<context-slug>/architecture.html"
```

Model and domain-object files have no automatic semantic validator: review their
template conformance and accepted ownership directly. A successful script exit
does not establish business correctness.
