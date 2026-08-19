---
name: tactical-design
description: Use when a confirmed strategic model still needs a relentless, user-confirmed design of Aggregate internals, domain-object state, behavior, or actual Domain Events.
---

# Tactical Design

Turn confirmed Aggregate Roots into a sparse current domain-object design. The conversation is a relentless design interview, not a document-completion exercise. The user decides; the facilitator investigates facts, recommends answers, and attacks weak object boundaries.

```text
confirmed Aggregate Roots
-> depth-first interview of one Root and its Entities
-> per-Root confirmation
-> current domain-objects.md slice
-> next Root
```

## Entry boundary

Read the affected `context-map.md`, `model.md`, relevant project decisions, and existing `domain-objects.md`. Confirm which Aggregate Root is first and what implementation need makes its internals material.

Route changed business meaning, Bounded Context boundaries, Aggregate Root identity, or strategic business rules to EventStorming. Keep the discussion here when the strategic model holds and the open question is which Domain objects realize it.

## Relentless interview contract

- If a fact can be found in the repository, look it up instead of asking the user.
- Ask one question at a time, wait for the answer, and resolve its dependent branch before moving sideways.
- Every decision question includes a recommended answer, concise reasoning, and the strongest credible alternative or deletion case.
- Challenge both user proposals and agent proposals. An existing class or table proves current implementation, not the correct object boundary.
- Stop asking when another answer would not change this Aggregate Root's object composition or descriptions.

Use depth-first order: Aggregate Root A, every Entity inside A, then Aggregate Root B. For Root A, settle the Root first, then Entity B, then Entity C, including each object's definition, state, behavior, and actual Domain Events. Do not inventory every Root first and fill their Entities later.

## What to decide

For the current Aggregate Root, determine only:

1. which Domain Entities belong inside its consistency boundary;
2. each object's business definition;
3. each object's meaningful state;
4. each object's behavior and semantic result;
5. actual Domain Events that implementation produces or consumes.

Identity is written in the object heading when meaningful. State already expresses lifecycle. Behavior already expresses responsibility. Direct effects belong in behavior descriptions; asynchronous effects belong in actual Domain Events. Do not add separate lifecycle, responsibility, collaboration, caller, or impact sections.

Each behavior needs a short sentence with subject, action, object, and result. The described Domain object is the grammatical subject and behavior owner. Use this shape:

```text
<Subject> <acts on object>, producing <result>.
```

The sentence describes domain meaning, not a method signature or call graph. An actual Domain Event names a fact that production code must emit or consume. Analytical Workshop Events never appear in `domain-objects.md`.

Test the composition with one credible split, merge, move, or deletion. Keep the smallest object set that can own the confirmed state and behavior without duplicating decisions outside the Aggregate.

Only discuss transaction, concurrency, recovery, or call direction when a confirmed requirement makes it material. Express the resulting domain constraint through the affected object's state, behavior, or actual Domain Event. Put a hard-to-reverse project decision in the project's decision mechanism; do not grow a generic design section.

## Per-Root confirmation and writing

Show the complete compact slice for the current Aggregate Root and its Entities. Ask the user to confirm that slice after its strongest alternative has been considered.

Write one Aggregate Root slice as soon as the user confirms that Root. Update or replace only that Root's section in `docs/ddd-expert/context/<context-slug>/domain-objects.md`, preserving other confirmed Root slices. Never write an unconfirmed Aggregate Root. Do not wait for every Aggregate Root in the Bounded Context, and do not bundle unrelated files into the write.

After the write, continue depth-first with the next affected Root. `domain-objects.md` is current accepted design, not meeting history. It contains no discussion transcript, rejected alternatives, status fields, diagrams, implementation sequences, or change ledger.

Codify never edits this file. If implementation evidence contradicts an accepted object definition, state, behavior, or Domain Event, Codify stops and routes that contradiction back to Tactical Design. Resume the interview, confirm the corrected Root slice, update it here, and only then resume implementation.

## Completion

Finish with one result:

- `needs_clarification`: ask the one current Root or Entity question;
- `awaiting_root_confirmation`: show the exact compact Root slice awaiting confirmation;
- `root_confirmed`: cite the updated Root section and name the next depth-first object, if any;
- `codify_ready`: cite all confirmed Root slices needed by the implementation;
- `no_tactical_change`: cite evidence that current object design already covers the work;
- `event_storming_required`: identify the strategic contradiction;
- `blocked`: identify the missing authority or write failure and current filesystem state.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Aggregate and Entity boundary reasoning.
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when Entity, Value Object, Domain Service, Repository, or layer ownership affects the object decision.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) only when an actual Domain Event or cross-context contract is selected.
