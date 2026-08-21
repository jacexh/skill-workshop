# ADR 0010: Classify Material Causal Continuations Before Realization

- Status: Accepted
- Date: 2026-08-21
- Refines: the pressure-led Tactical Design and implementation-latitude decisions in [ADR 0009](0009-sparse-current-ddd-artifacts.md)

## Context

Real project sessions exposed a repeated failure. The workflow described what a Domain Event is and how to realize an accepted one, but Tactical Design only loaded those rules "when a candidate Domain Event appears." The model therefore had to invent the candidate before receiving the decision rule.

Without an explicit event suggestion, the agent repeatedly collapsed a completed business fact and its required next intent into a direct call, callback, sink, or dispatcher. Being inside one Aggregate or Bounded Context was treated as sufficient reason for direct composition. Once a user named the missing event, the same agent could apply the existing rules correctly. The gap was candidate generation and classification, not Domain Event syntax.

Codify amplified the gap by treating artifact silence as software-structure latitude, while Guard checked faithful realization of selected events but did not identify an unclassified continuation. More reminders to "use Domain Events" would bias every workflow toward events and would not establish when direct composition is correct.

## Decision

EventStorming step 6 preserves each material occurrence-to-next-intent causal pair and establishes its business success relationship without selecting a software mechanism.

Tactical Design actively probes every material causal continuation in the affected Root slice, even when neither the user nor the model mentions an event. It treats the first occurrence as a candidate fact, asks whether it remains a successful business fact when the next intent cannot complete, then applies the normative Reaction Probe in `ddd-collaboration.md`. Only after classification does the design claim when that fact becomes true. The probe classifies the continuation as:

1. one success guarantee;
2. an independent local reaction;
3. a cross-context published fact; or
4. no selected event.

Aggregate and Bounded Context membership and synchronous or asynchronous delivery do not decide the classification. Direct calls, callbacks, hooks, sinks, dispatchers, and mailboxes are realization choices after classification, not evidence for one.

For a selected independent local reaction, the event is the causal handoff: the producing behavior records it, and event handling initiates the separately owned next intent. Keeping a direct producer-to-reaction path beside the event would preserve the original coupling and reduce the event to an observation, so Codify must not realize that duplicate path and Guard reports it as model drift.

The need to preserve an occurrence itself as durable Domain evidence is tested independently. It may select a Domain Event with no later intent, or alongside directly composed behavior, without changing that behavior's success guarantee.

The sparse artifact contract does not change. Classification reasoning remains conversational. A selected event is still recorded only as `<Event> — recorded by <Behavior>`, and a resulting next intent remains a separate behavior under its own owner. There is no consumer field, event catalogue, sequence diagram, or collaboration ledger.

Codify retains implementation latitude only after the success relationship and next-intent owner are accepted. Guard reports code that silently invents those semantics as an unclassified business continuation; it does not demand a Domain Event merely because a follow-up exists.

Repository and Anti-Corruption Layer ownership are outside this decision.

## Consequences

- Event candidates are generated from business causality instead of waiting for an event keyword.
- The explicit no-event and one-success-guarantee outcomes resist indiscriminate eventing.
- Same-Context workflows can be decoupled when the producer fact truly stands independently, while immediate invariants remain directly composed.
- Current DDD artifacts stay sparse and keep one owner per fact.
- Codify and Guard can distinguish software-structure latitude from missing business collaboration semantics.

## Verification

- Static release checks assert the active probe, all four outcomes, the producer-only artifact entry, mirror parity, and Codify/Guard guardrails.
- Provider behavior probes omit Domain Event vocabulary and cover an independent local reaction, a same-guarantee counterexample, a cross-context published fact, and a callback-shaped ambiguity.
- The independent-reaction probe is compared with the pre-hotfix baseline; a keyword match alone is not treated as sufficient evidence.
