# ADR 0009: Sparse Current DDD Artifacts and Pressure-Led Tactical Design

- Status: Accepted
- Date: 2026-08-19
- Supersedes: the artifact lifecycle, meeting-minutes, diagram, BC Architecture, implementation-exploration, design-reconciliation, and Guard review-mechanics decisions in [ADR 0003](0003-event-storming-whole-model-confirmation.md), [ADR 0004](0004-model-ready-enters-codify-directly.md), [ADR 0005](0005-event-storming-minutes-and-current-models.md), [ADR 0006](0006-guard-is-a-semantic-structure-review.md), [ADR 0007](0007-conditional-tactical-design-and-claims.md), and [ADR 0008](0008-design-artifacts-are-falsifiable-candidates.md)
- Retains: the complete EventStorming discussion method and integrated user confirmation from ADR 0003, conditional House Style, and the independent read-only Guard boundary from [ADR 0006](0006-guard-is-a-semantic-structure-review.md)

## Context

Real use showed a mismatch between modeling quality and delivery quality. EventStorming materially improved Bounded Context and Aggregate Root discovery, but persisting the workshop board, diagrams, statuses, revisions, links, and synchronized write sets consumed disproportionate time.

Tactical Design added more detail—object diagrams, state-authority tables, sequences, claims, projection records, implementation exploration, and later design reconciliation—without reliably constraining Codify. Confirmed decisions such as removing a second Player representation were repeatedly weakened into locally convenient helper types or free functions. The documentation cost did not buy dependable implementation ownership.

The failure was structural rather than a missing prompt reminder:

- accepted current knowledge and meeting history shared the same workflow;
- Tactical Design described participants and sequences more strongly than object behavior ownership;
- implementation was allowed to modify or test the design while coding;
- local RED-to-GREEN and shortest-diff pressure could satisfy tests without realizing the global object model.

## Decision

### EventStorming keeps all ten discussion steps

EventStorming retains Scope, Workshop Events, Timeline, Commands, Roles and external authorities, Constraints and required next intents, Problems and ambiguity, Aggregates and core business objects, Bounded Contexts, and Context collaboration.

The optimization applies to artifacts, not discussion quality. EventStorming may maintain a lightweight text timeline, table, or arrow chain in the conversation when it clarifies a causal gap or boundary choice. The strategic model admits a concern only when it changes a business right, obligation, value, authority, decision, outcome, or required next action; implementation observations are evidence, while later design owns realization. After the user confirms the integrated strategic model, EventStorming updates only current strategic authority:

- `docs/ddd-expert/context-map.md`;
- `docs/ddd-expert/context/<context-slug>/model.md`.

The Context Map contains only Bounded Contexts and semantic dependencies. A Model contains only purpose, essential language, Aggregate Roots, and strategic business rules. Each Business Rule is one scenario-falsifiable claim that names its governed business concept or collaboration, material condition, and accepted decision, permission, transition, required outcome, or invariant. It does not assign tactical behavior ownership or prescribe an implementation mechanism. There are no meeting records, workflow statuses, revisions, historical links, or staged multi-file write protocol.

### Tactical Design is a pressure-led, one-Root interview

Tactical Design asks one question at a time, waits for the answer, gives a recommended answer and strongest credible alternative, and retrieves repository facts instead of asking the user. It works one Aggregate Root at a time:

```text
Business Rules
-> essential business pressures
-> behavior ownership probes
-> alternative object compositions
-> confirmed Aggregate Root slice
```

For the current Root or affected slice, Tactical Design groups interacting Business Rules into essential business pressures: the decisions, Lifecycle State transitions, actual Domain Events, and invariants that the object model must realize. These pressures are the working expression of the Root's essential complexity, not a score. Every pressure remains traceable to confirmed authority. A pressure that cannot be traced, or a contradiction in that authority, returns to EventStorming rather than becoming new tactical meaning.

Each pressure is explored through `<Subject> <domain verb> <Object>.` During exploration, different credible Subjects expose alternative behavior owners. The verb uses the owning Bounded Context's Domain language rather than a technical implementation action. When the behavior transitions Lifecycle State, the sentence names the concrete state and its prior and next values. Every material Subject, Object, and transition is resolved without promoting every noun into an object.

Tactical Design compares no new split with the strongest relevant split, merge, move, or deletion alternative under the same pressures. A viable candidate realizes every pressure and keeps the Root able to protect cross-object invariants. Among viable candidates, it prefers the composition that localizes decisions with their state while introducing less accidental complexity through exposed knowledge, coordination, duplicated state or decisions, identity and lifecycle, mapping, and test burden. A child Entity earns its place through Domain identity or lifecycle plus cohesive state, rules, or transitions whose deletion would spread decision knowledge elsewhere.

For the accepted composition, Tactical Design records only the included Domain Entities and each retained object's:

- definition;
- Facts;
- Lifecycle State;
- behavior;
- actual Domain Events.

Identity is included in the object heading when meaningful. Facts are the business-significant facts owned by the object and required to understand a Behavior or Invariant; they are not a field inventory or Domain Events. Lifecycle State records named state-machine states and their Domain meaning, or explicitly records that none exists. Behavior expresses responsibility and names a Lifecycle State transition when one occurs. Actual Domain Events are listed separately and point to the behavior that records them; a Lifecycle State transition alone does not require an event.

Each behavior is one concise Domain sentence with a subject, Domain verb, and object. The described Root or Entity is the grammatical subject and behavior owner. Meaningful Value Objects and references are named where they affect Facts, Lifecycle State, or behavior; fields and methods are not inventoried.

Before confirmation, every pressure is assigned, every retained object's material Facts and Lifecycle State are recorded, every material behavior owner, target, and Lifecycle State transition is resolved, every actual Domain Event points to the behavior that records it, every retained or changed object has a reason to exist, and the strongest credible alternative has been compared under the same pressures. Once the user confirms one complete Root slice, Tactical Design writes or replaces that section in `domain-objects.md` immediately. It preserves other confirmed Root slices and does not wait for every Root in the Bounded Context. Pressure sets, candidate assignments, alternatives, and burden comparisons remain conversation only.

There are no UML or sequence diagrams, design iteration files, call graphs, generic mechanism sections, claims ledgers, or separate software-architecture artifact. A realization concern enters Tactical Design only when a confirmed Business Rule changes the required ownership or guarantee, and the resulting domain constraint is expressed through the relevant object's Facts, Lifecycle State, behavior, or actual Domain Event.

### Object behavior constrains implementation shape

A behavior listed under a Root or Entity is normally realized as a method on that object. A free function is reserved for:

- construction;
- a pure calculation with no natural Domain owner;
- a private algorithm invoked behind the owning method.

A function that primarily accepts one Domain object to inspect or change its state is receiver-shaped design pressure and requires a concrete reason not to be a method.

### Codify realizes the model through House Style

Codify reads the current strategic and domain-object artifacts as read-only semantic constraints, not a complete software design. Their silence about remaining software structure is implementation latitude. Codify implements the requested behavior and fills that latitude directly through accepted project constraints and the active-language House Style, loading only guidance for code actually touched.

Codify leaves one coherent realization of each accepted responsibility and removes obsolete parallel responsibility exposed by the change. It verifies the resulting code with tests and checks proportionate to the changed behavior and risk.

Guard independently and read-only reviews the implementation against the current Context Map, Models, and Domain Object slices. It also judges non-Domain abstractions introduced, materially changed, or required by the affected behavior. Model silence is implementation latitude rather than missing authority: project constraints and applicable House Style govern that space. An abstraction earns its cost when it hides present complexity, passes the deletion test, provides interface leverage and locality, and justifies its indirection, mapping, configuration, lifecycle, and test burden. Pattern names such as CQRS, Repository, or Job are neither requirements nor justification. Guard reports evidence-backed findings without workflow routing or terminal-state accounting, and never closes or mutates an artifact lifecycle because no such lifecycle exists.

## Consequences

- EventStorming keeps the discussion depth that improved Aggregate Root discovery while artifact generation becomes small and direct.
- Tactical Design produces a low-resolution object contract that is cheap to update and hard for Codify to reinterpret.
- Confirmation and writing happen per Aggregate Root, so long Bounded Context discussions do not defer all useful artifacts.
- Current facts have one owner; conversation history remains outside downstream context.
- Codify gains broad implementation latitude inside accepted semantics and resolves it through project and active-language House Style without a modeling return loop.
- Guard catches both model drift and unjustified software abstractions without turning model silence or named patterns into a checklist.
- Existing historical records remain repository history but are no longer required input for new work.
- Automated checks validate the sparse file shapes, mirrored plugin content, one-question interaction boundary, pressure-led per-Root writing, the Domain behavior and event-link contract, House Style realization latitude, method ownership, and Guard's independent model-and-abstraction review without scoring a preferred domain model.
