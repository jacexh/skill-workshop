---
name: tactical-design
description: Use when a confirmed strategic model still needs a relentless, user-confirmed design of Aggregate internals, domain-object Facts, Lifecycle State, behavior, or actual Domain Events.
---

# Tactical Design

Turn confirmed Aggregate Roots and Business Rules into a sparse current domain-object design. The conversation is a relentless comparison of responsibility candidates, not an entity inventory. The user decides; the facilitator investigates facts, recommends answers, and attacks weak object boundaries.

```text
confirmed Aggregate Root and Business Rules
-> essential business pressures
-> behavior probes and candidate concepts
-> alternative object compositions
-> per-Root confirmation
-> current domain-objects.md slice
-> next Root
```

## Entry boundary

Read the affected `context-map.md`, `model.md`, relevant project decisions, and existing `domain-objects.md`. For the current Root, treat the context purpose, Root definition and consistency boundary, and Business Rules as business authority. Confirm which Aggregate Root is first and what implementation need makes its internals material.

Route changed business meaning, Bounded Context boundaries, Aggregate Root identity, or strategic business rules to EventStorming. Keep the discussion here when the strategic model holds and the open question is which Domain objects realize it.

## Relentless interview contract

- If a fact can be found in the repository, look it up instead of asking the user.
- Ask one question at a time, wait for the answer, and resolve its dependent branch before moving sideways.
- Every decision question includes a recommended answer, concise reasoning, and the strongest credible alternative or deletion case.
- Challenge both user proposals and agent proposals. An existing class or table proves current implementation, not the correct object boundary.
- Stop asking when another answer would not change this Aggregate Root's business pressures, responsibility ownership, object composition, or descriptions.

Work one Aggregate Root at a time. Within it, follow the smallest affected business-pressure slice; when a Root has no accepted slice, cover every Business Rule that shapes it. Account for every retained or changed object, but do not interview through an entity checklist or reopen unaffected objects without evidence.

## Derive essential business pressures

For the current slice, derive the smallest complete set of **essential business pressures** from `model.md`. A pressure is a business decision, Lifecycle State transition, actual Domain Event, or invariant that the object model must realize. Together, the pressures are the working expression of the Root's essential complexity, not a score or a claim that only one phrasing is possible. Group interacting rules when their difficulty comes from being true together; one Business Rule need not produce one pressure.

Every pressure names the governing Business Rules in the working conversation. Stories, specifications, and code may challenge whether those rules are complete, but they do not add confirmed business meaning here. When a material pressure cannot be traced to the Model or the rules contradict it, return the smallest contradiction to EventStorming. Keep the pressure set transient; it is reasoning input, not another artifact.

## Probe behavior ownership

For each pressure, explore candidate responsibility with short behavior statements:

```text
<Subject> <domain verb> <Object>.
```

Treat the slots semantically:

- **Subject** is the candidate behavior owner;
- **domain verb** names the business action in the owning Bounded Context's language;
- **Object** is the Domain target the behavior acts on.

When a behavior transitions the object's Lifecycle State, name the transition:

```text
<Subject> <domain verb> <Object>, transitioning <Lifecycle State name> from <before> to <after>.
```

Do not force this clause onto behavior that has no Lifecycle State transition. There is no universal result slot.

During exploration, vary the Subject when different owners are credible. Resolve every material Subject and Object as the current Root, an owned Entity, a Value Object, a Fact owned by one of those objects, an identity reference to another Root, or an external role or authority, and name each Lifecycle State transition explicitly. Explicit resolution does not promote every noun into a Domain object.

In the accepted design, the object whose behavior is described becomes the grammatical Subject and behavior owner. Name the behavior with an intention-revealing Domain verb phrase, not a technical implementation action. The sentence describes Domain meaning, not a method signature or call graph.

When a candidate Domain Event appears, load the Domain Event rules in `ddd-collaboration.md` and apply their selection predicate. List a selected event separately as `<Event> — recorded by <Behavior>`; the entry contains no selection reason. Analytical Workshop Events never appear in `domain-objects.md`.

## Compare object compositions

Construct the smallest credible candidate set, including no new split and the strongest relevant split, merge, move, or deletion alternative. Do not enumerate combinations that no confirmed pressure distinguishes.

For each candidate, map every pressure to a behavior owner and compare the design burden it introduces: knowledge exposed to callers or the Root, cross-object coordination and ordering, duplicated state or decisions, additional identity and lifecycle, and extra mapping or test surface. Treat this burden as accidental complexity introduced by the candidate composition, not as an invitation to speculate about runtime mechanisms. A candidate remains viable only when it realizes every pressure and keeps the Root able to protect cross-object invariants.

Prefer the viable candidate that localizes each decision with the state it needs while exposing less knowledge and coordination. Keep a child Entity when it has Domain identity or lifecycle plus cohesive state, rules, or transitions, and merging it would concretely spread or duplicate decision knowledge. Otherwise use the simpler supported representation. The Root composes owned-object behavior; callers do not inspect internal state to reproduce its decisions.

Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or guarantee. Express that constraint through the affected object's Facts, Lifecycle State, behavior, or actual Domain Event, or through the project's decision mechanism when it is a hard-to-reverse project choice.

## Complete the Root slice

For the accepted candidate, determine only:

1. which Domain Entities belong inside the Root's consistency boundary;
2. each retained object's business definition;
3. each retained object's Facts;
4. each retained object's Lifecycle State, or that it has no explicit Lifecycle State;
5. each retained object's behavior, including any Lifecycle State transition it makes;
6. actual Domain Events recorded by a named behavior.

Identity is written in the object heading when meaningful. Facts are the business-significant facts owned by the object and required to understand a Behavior or Invariant; they are neither a field inventory nor Domain Events. Lifecycle State records the object's named state-machine states and their Domain meaning. Use the concrete Domain name, such as `PlayerState` or `HandStatus`, rather than an unnamed lifecycle flag. Behavior already expresses responsibility and names a Lifecycle State transition when one occurs. Domain Events are listed separately and point to the behavior that records them; a Lifecycle State transition alone does not require an event. Name material Value Objects and references where their meaning affects Facts or behavior, but do not inventory fields or methods. Do not add separate responsibility, collaboration, caller, or impact sections.

## Per-Root confirmation and writing

Show the complete compact slice for the current Aggregate Root and its Entities. Before asking for confirmation, verify that every pressure is traceable and assigned, every retained object's material Facts and Lifecycle State are recorded, every material Subject, Object, and Lifecycle State transition is resolved, every actual Domain Event points to the behavior that records it, every retained or changed object has a reason to exist, the strongest credible alternative was compared under the same pressures, and no remaining answer would change composition or ownership.

Write one Aggregate Root slice as soon as the user confirms that Root. Update or replace only that Root's section in `docs/ddd-expert/context/<context-slug>/domain-objects.md`, preserving other confirmed Root slices. Never write an unconfirmed Aggregate Root. Do not wait for every Aggregate Root in the Bounded Context, and do not bundle unrelated files into the write.

After the write, continue with the next affected Root. `domain-objects.md` contains only current accepted Root slices. Essential-pressure sets, candidate assignments, rejected alternatives, and design-burden comparisons remain conversational working state.

## Completion

End with the current Root outcome and cite any confirmed or updated slice. Ask
the one unresolved question or request confirmation of the exact proposed slice;
after a write, name the next affected Root. Name EventStorming when a pressure
cannot be traced to confirmed authority, cite every required slice when
implementation can begin, and report any blocker with current filesystem state.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Business Rule-to-pressure, Aggregate, and Entity boundary reasoning.
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when Entity, Value Object, Domain Service, Repository, or layer ownership affects the object decision.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) when a candidate Domain Event or cross-context contract appears.
