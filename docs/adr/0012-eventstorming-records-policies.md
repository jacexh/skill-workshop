# ADR 0012: EventStorming Records Policies

- Status: Accepted
- Date: 2026-11-03
- Refines: the Model content in [ADR 0009](0009-sparse-current-ddd-artifacts.md) and [ADR 0011](0011-ddd-artifact-writing-contract.md)

## Context

EventStorming already discussed required next intents (step 6), the
Now-or-later aggregate probe, and context collaboration (step 10). Their
conclusions stayed in the conversation. Tactical Design works one Aggregate
Root at a time, so it cannot own a reaction whose trigger and target sit in
different Aggregates or contexts.

In a long-lived project that uses this plugin, the longest entries with the
most clarifications described cross-Aggregate reactions: waking a recipient
after Mail delivery, delivering a patrol round, and Mail-driven continuation.
With no home, this knowledge spread across Aggregate Behaviors, Domain Event
`Consumed by` lines, a Domain Service, and Business Rules. Codify then chose
consistency and failure handling as technical convenience suggested.

## Decision

1. A **Policy** is a stateless reaction: when a named fact or time occurs, a
   reacting concept performs one intent. EventStorming names the trigger in
   Ubiquitous Language as a same-context business occurrence, a Published
   Fact Contract, or a business time. It does not name a Domain Event,
   because Tactical Design selects Domain Events later.
2. `model.md` gains an optional `## Policies` section after Business Rules.
   Each entry has one Event sentence and one Unwanted sentence for the
   business outcome when the intent cannot complete, with an optional
   `within <duration>`. A Policy always completes after its trigger; a
   reaction that must succeed together with it stays inside one consistency
   boundary. The two sentences are a deliberate exception to the
   one-sentence rule contract.
3. A Policy lives in the context that decides the reaction, the downstream
   context of its dependency: the consumer of a Published Fact Contract, or
   the sender that decides to use an Asynchronous Intent Contract. The
   receiver of an intent handles it as a Command under its own rules.
4. Domain Events and Integration Messages stay producer-owned facts. A
   `Consumed by` line and a Context Map `Downstream use` cell cite the Policy
   by name and do not restate the reaction.
5. A reaction that must remember earlier progress is a **Process**, modeled as
   an Aggregate Root with its Lifecycle State, not as a Policy.
6. EventStorming owns Policies through four Policy probes (Reaction, Together
   or later, Memory, Failed reaction). Its integrated proposal is ready only
   when every required next intent is a Policy or a Process Aggregate Root.
   Tactical Design may surface a local reaction and records it as a Policy
   through its existing strategic-correction path. No separate skill is added.
7. The dependency runs from Policy to Domain Event: an accepted Policy that
   reacts to a same-context occurrence is the reason Tactical Design's
   Occurrence probe selects an actual Domain Event, whose `Consumed by` line
   cites that Policy. A same-context occurrence that this context publishes as
   a Published Fact Contract also selects a Domain Event, which names that
   contract.
8. Codify realizes each Policy's failure outcome, and that outcome selects the
   delivery mechanism; Guard checks that the realized delivery keeps it.

## Consequences

- Cross-Aggregate and cross-context reactions have one findable home, and
  Guard locates each affected Policy as part of its coverage criterion.
- EventStorming produces more than Bounded Contexts and Aggregate Roots; its
  discovery becomes longer. If trials show it skipping the Policy probes,
  splitting Policy design into its own skill is the next option.
- Retry, outbox, and idempotency mechanisms remain Codify realization choices,
  constrained by the business outcome each Policy states.
