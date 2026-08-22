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
-> confirmed Entity descriptions
-> integrated Aggregate Root slice
```

For the current Root or affected slice, Tactical Design groups interacting Business Rules into essential business pressures: the decisions, Lifecycle State transitions, material external-authority needs, actual Domain Events, and invariants that the object model must realize. These pressures are the working expression of the Root's essential complexity, not a score. Every pressure remains traceable to confirmed authority. When tactical refinement exposes a missing or contradictory strategic statement, Tactical Design resolves the smallest correction with the user in the current conversation and includes the accepted change in the Root-level artifact review.

Whenever Tactical Design proposes a candidate Root or Entity, it explains together what the object represents and how it operates, then introduces its Behaviors in the owning Bounded Context's Domain language at that first proposal. If no precise verb follows from that account, the proposal remains open instead of receiving a technical placeholder name. Straightforward operation may take one sentence; material autonomous progress, external-decision boundaries, or owned-object result flow are followed far enough to discover connected Behaviors. This How remains conversational reasoning, while an operating characteristic essential to the object may be carried in its definition.

Each pressure is explored through `<Subject> <domain verb> <Object>.` During exploration, different credible Subjects expose alternative behavior owners. When an accepted Root Behavior composes an owned Entity Behavior, it uses `<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.` to reference the Entity-owned decision without repeating it. When the behavior transitions Lifecycle State, the sentence names the concrete state and its prior and next values. Every material Subject, Object, and transition is resolved without promoting every noun into an object.

For every Behavior that needs externally owned Domain data or an authoritative answer, the Capability Probe selects a Supplied Fact when it preserves decision ownership, timing, and authority. Otherwise the Behavior directly invokes a Domain-owned Port whose implementation outer composition supplies. Each Port name expresses its Domain role with a `Port` suffix and groups sparse Methods that state the invoking Behavior, business decision point, and Domain result; exact signatures, source topology, and technical fulfillment policy remain realization choices. When concern about obtaining external data or handling its technical failure starts shaping a candidate Root or Entity, Tactical Design surfaces the hidden Port and continues from its fulfilled Domain result.

Tactical Design compares no new split with the strongest relevant split, merge, move, or deletion alternative under the same pressures. A viable candidate realizes every pressure and keeps the Root able to protect cross-object invariants. Among viable candidates, it prefers the composition that localizes decisions with their state while introducing less accidental complexity through exposed knowledge, coordination, duplicated state or decisions, identity and lifecycle, mapping, and test burden. A child Entity earns its place through Domain identity or lifecycle plus cohesive state, rules, or transitions whose deletion would spread decision knowledge elsewhere.

For the accepted composition, Tactical Design records only the included Domain Entities and each retained object's:

- definition;
- Facts;
- Lifecycle State;
- behavior;
- Domain-owned Ports where present;
- actual Domain Events.

Identity is included in the object heading when meaningful. Definition may include an essential way the object operates when it changes what the object represents. Facts are the business-significant facts owned by the object and required to understand a Behavior or Invariant; they are not a field inventory or Domain Events. Lifecycle State records named state-machine states and their Domain meaning, or explicitly records that none exists; a generic lifecycle concept is qualified by its owner as `<Object>.State`. Behavior expresses responsibility and names a Lifecycle State transition when one occurs. Domain-owned Ports group sparse Methods under the direct Behavior owner without prescribing implementation signatures. Actual Domain Events are listed separately and point to the behavior that records them; a Lifecycle State transition alone does not require an event.

The described Root or Entity is the grammatical subject and behavior owner. Meaningful Value Objects and references are named where they affect Facts, Lifecycle State, or behavior; fields and methods are not inventoried.

A retained Entity becomes ready for confirmation when its definition, Facts, Lifecycle State, behavior, Domain-owned Ports where present, and place in the Root's composition form one coherent responsibility. Its behavior is followed through any material Domain result that the Root or another owned object composes next; a Root capability and an Entity-owned decision describe their relationship without duplicating the decision.

After the user confirms that Entity, Tactical Design updates its description and any directly affected Root or owned-object wording in `domain-objects.md`, then continues the Root interview. Local answers remain conversation until they form that coherent description.

Before Root confirmation, every pressure is assigned, every external-authority need has a Capability Probe classification, every Domain-owned Port Method names its Port, invoking Behavior, business decision point, and Domain result, every retained object's material Facts and Lifecycle State are recorded, every material behavior owner, target, and Lifecycle State transition is resolved, every actual Domain Event points to the behavior that records it, every retained or changed object has a reason to exist, and the strongest credible alternative has been compared under the same pressures. Once the user confirms the integrated Root slice, Tactical Design writes or replaces its complete section and revisits affected current DDD artifacts and relevant project decisions, updating accepted content changed by the completed design. Pressure sets, candidate assignments, alternatives, and burden comparisons remain conversation only.

There are no UML or sequence diagrams, design iteration files, call graphs, generic mechanism sections, claims ledgers, or separate software-architecture artifact. A realization concern enters Tactical Design only when a confirmed Business Rule changes the required ownership or Domain result, and the resulting domain constraint is expressed through the relevant object's definition, Facts, Lifecycle State, behavior, Domain-owned Port Method, or actual Domain Event.

### Object behavior constrains implementation shape

A behavior listed under a Root or Entity is normally realized as a method on that object. A free function is reserved for:

- construction;
- a pure calculation with no natural Domain owner;
- a private algorithm invoked behind the owning method.

A function that primarily accepts one Domain object to inspect or change its state is receiver-shaped design pressure and requires a concrete reason not to be a method.

### Codify realizes the model through House Style

Codify reads the current strategic and domain-object artifacts as read-only semantic constraints, not a complete software design. Their silence about remaining software structure is implementation latitude. Codify implements the requested behavior and fills that latitude directly through accepted project constraints and the active-language House Style, loading only guidance for code actually touched. A Domain-owned Port is defined and invoked in Domain, fulfilled by an Infrastructure implementation that may compose multiple external sources, and supplied by Runtime composition; any accepted fulfillment policy stays behind that implementation.

Codify leaves one coherent realization of each accepted responsibility and removes obsolete parallel responsibility exposed by the change. It verifies the resulting code with tests and checks proportionate to the changed behavior and risk.

Guard independently and read-only reviews the implementation against the current Context Map, Models, and Domain Object slices. It treats technical fulfillment policy or provider failure handling that shapes Domain code as evidence of a missing or violated Domain-owned Port boundary. It also judges non-Domain abstractions introduced, materially changed, or required by the affected behavior. Model silence is implementation latitude rather than missing authority: project constraints and applicable House Style govern that space. An abstraction earns its cost when it hides present complexity, passes the deletion test, provides interface leverage and locality, and justifies its indirection, mapping, configuration, lifecycle, and test burden. Pattern names such as CQRS, Repository, or Job are neither requirements nor justification. Guard reports evidence-backed findings without workflow routing or terminal-state accounting, and never closes or mutates an artifact lifecycle because no such lifecycle exists.

## Consequences

- EventStorming keeps the discussion depth that improved Aggregate Root discovery while artifact generation becomes small and direct.
- Tactical Design produces a low-resolution object contract that is cheap to update and hard for Codify to reinterpret.
- Confirmed Entity descriptions are written during a long Root interview; integrated Root confirmation still provides the broader artifact review point.
- Current facts have one owner; conversation history remains outside downstream context.
- Codify gains broad implementation latitude inside accepted semantics and resolves it through project and active-language House Style without a modeling return loop.
- Guard catches both model drift and unjustified software abstractions without turning model silence or named patterns into a checklist.
- Existing historical records remain repository history but are no longer required input for new work.
- Automated checks validate the sparse file shapes, mirrored plugin content, one-question interaction boundary, pressure-led Entity and Root writing, Domain behavior, Domain-owned Ports, and event-link contracts, House Style realization latitude, method ownership, and Guard's independent model-and-abstraction review without scoring a preferred domain model.
