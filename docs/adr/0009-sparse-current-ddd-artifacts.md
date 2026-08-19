# ADR 0009: Sparse Current DDD Artifacts and Depth-First Tactical Design

- Status: Accepted
- Date: 2026-08-19
- Supersedes: the artifact lifecycle, meeting-minutes, diagram, BC Architecture, implementation-exploration, and design-reconciliation decisions in [ADR 0003](0003-event-storming-whole-model-confirmation.md), [ADR 0004](0004-model-ready-enters-codify-directly.md), [ADR 0005](0005-event-storming-minutes-and-current-models.md), [ADR 0007](0007-conditional-tactical-design-and-claims.md), and [ADR 0008](0008-design-artifacts-are-falsifiable-candidates.md)
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

The optimization applies to artifacts, not discussion quality. Workshop Events, temporary boards, alternatives, and diagrams remain in conversation. After the user confirms the integrated strategic model, EventStorming updates only current strategic authority:

- `docs/ddd-expert/context-map.md`;
- `docs/ddd-expert/context/<context-slug>/model.md`.

The Context Map contains only Bounded Contexts and semantic dependencies. A Model contains only purpose, essential language, Aggregate Roots, and strategic business rules. There are no meeting records, workflow statuses, revisions, historical links, or staged multi-file write protocol.

### Tactical Design is a depth-first grilling interview

Tactical Design asks one question at a time, waits for the answer, gives a recommended answer and strongest credible alternative, and retrieves repository facts instead of asking the user. It proceeds depth-first:

```text
Aggregate Root A -> Entity B -> Entity C -> Aggregate Root B
```

For each Root, it decides only the included Domain Entities and each object's:

- definition;
- state;
- behavior;
- actual Domain Events.

Identity is included in the object heading when meaningful. State expresses lifecycle. Behavior expresses responsibility. Direct effects are described by behavior; asynchronous effects are described by actual Domain Events.

Each behavior is one concise semantic sentence with subject, action, object, and result. The described Root or Entity is the grammatical subject and behavior owner.

Once the user confirms one complete Root slice, Tactical Design writes or replaces that section in `domain-objects.md` immediately. It preserves other confirmed Root slices and does not wait for every Root in the Bounded Context. Unconfirmed Roots remain conversation only.

There are no UML or sequence diagrams, design iteration files, call graphs, generic mechanism sections, claims ledgers, or separate software-architecture artifact. Transaction, concurrency, recovery, or call direction is discussed only when a confirmed requirement makes it material, and the resulting domain constraint is expressed through the relevant object's state, behavior, or actual Domain Event.

### Object behavior constrains implementation shape

A behavior listed under a Root or Entity is normally realized as a method on that object. A free function is reserved for:

- construction;
- a pure calculation with no natural Domain owner;
- a private algorithm invoked behind the owning method.

A function that primarily accepts one Domain object to inspect or change its state is receiver-shaped design pressure and requires a concrete reason not to be a method.

### Codify and Guard do not edit design

Codify reads the current strategic and domain-object artifacts as authority. It never changes them during implementation. When concrete evidence contradicts strategic meaning, Codify stops for EventStorming; when it contradicts object definition, state, behavior, or an actual Domain Event, Codify stops for Tactical Design. Implementation resumes only after the relevant authority is confirmed.

Local tests and minimum-diff guidance cannot justify retaining a removed object, compatibility projection, parallel responsibility carrier, or receiver-shaped helper. Structural deletion is complete only when the old responsibility is gone, not renamed.

Guard independently and read-only reviews the implementation against the current Context Map, Models, and Domain Object slices. It routes strategic contradictions to EventStorming, object-design contradictions to Tactical Design, and plain implementation drift to Codify. Guard never closes or mutates an artifact lifecycle because no such lifecycle exists.

## Consequences

- EventStorming keeps the discussion depth that improved Aggregate Root discovery while artifact generation becomes small and direct.
- Tactical Design produces a low-resolution object contract that is cheap to update and hard for Codify to reinterpret.
- Confirmation and writing happen per Aggregate Root, so long Bounded Context discussions do not defer all useful artifacts.
- Current facts have one owner; conversation history remains outside downstream context.
- Codify loses implementation-time design freedom and gains a clear stop-and-return boundary.
- Existing historical records remain repository history but are no longer required input for new work.
- Automated checks validate the sparse file shapes, mirrored plugin content, one-question interaction boundary, depth-first per-Root writing, and method ownership without scoring a preferred domain model.
