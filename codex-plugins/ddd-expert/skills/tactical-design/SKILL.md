---
name: tactical-design
description: Use when a confirmed strategic model still needs a relentless, user-confirmed design of Aggregate internals, domain-object Facts, Lifecycle State, how objects operate, behavior, or actual Domain Events.
---

# Tactical Design

Turn confirmed Aggregate Roots and Business Rules into a sparse current domain-object design. The conversation is a relentless comparison of responsibility candidates, not an entity inventory. The user decides; the facilitator investigates facts, recommends answers, and attacks weak object boundaries.

```text
confirmed Aggregate Root and Business Rules
-> essential business pressures
-> behavior probes and candidate concepts
-> causal continuation classification
-> alternative object compositions
-> confirmed Entity descriptions as they close
-> integrated Root confirmation and current artifacts
-> next Root
```

## Entry boundary

Read the affected `context-map.md`, `model.md`, relevant project decisions, and existing `domain-objects.md`. For the current Root, treat the context purpose, Root definition and consistency boundary, and Business Rules as business authority. Confirm which Aggregate Root is first and what implementation need makes its internals material.

If tactical refinement exposes a needed correction to business meaning, a Bounded Context boundary, Aggregate Root identity, or a strategic Business Rule, resolve it with the user in the current conversation and carry the accepted change into the Root-level artifact review. Do not force a workflow switch or leave the tactical model built on a known contradiction.

## Relentless interview contract

- If a fact can be found in the repository, look it up instead of asking the user.
- Ask one question at a time, wait for the answer, and resolve its dependent branch before moving sideways.
- Every decision question includes a recommended answer, concise reasoning, and the strongest credible alternative or deletion case.
- Challenge both user proposals and agent proposals. An existing class or table proves current implementation, not the correct object boundary.
- Stop asking when another answer would not change this Aggregate Root's business pressures, responsibility ownership, object composition, or descriptions.

Work one Aggregate Root at a time. Within it, follow the smallest affected business-pressure slice; when a Root has no accepted slice, cover every Business Rule that shapes it. Account for every retained or changed object, but do not interview through an entity checklist or reopen unaffected objects without evidence.

## Derive essential business pressures

For the current slice, derive the smallest complete set of **essential business pressures** from `model.md`. A pressure is a business decision, Lifecycle State transition, invariant, accepted actual Domain Event, or material candidate occurrence and required next intent whose relationship the object model must resolve. A newly selected actual Domain Event may realize that relationship; do not assume it before classification. Together, the pressures are the working expression of the Root's essential complexity, not a score or a claim that only one phrasing is possible. Group interacting rules when their difficulty comes from being true together; one Business Rule need not produce one pressure.

Every pressure names the governing Business Rules in the working conversation. Stories, specifications, and code may challenge whether those rules are complete, but they add no confirmed business meaning until the user accepts it. When a material pressure cannot be traced to the Model or the rules contradict it, resolve the smallest strategic correction with the user before continuing and include it in the Root-level review. Keep the pressure set transient; it is reasoning input, not another artifact.

## Probe behavior ownership

Whenever proposing a candidate Root or Entity, explain together what it represents and how it operates, then introduce its candidate Behaviors immediately in the owning Bounded Context's Domain language. If no precise Domain verb follows from that account, keep clarifying the proposal instead of assigning a technical placeholder name.

A straightforward object may need only one sentence. Where operation is material, follow how it makes Domain progress or produces a result, including any autonomous progress, external-decision boundary, or owned-object result flow. Use that account to discover and connect Behaviors rather than waiting for scenario-by-scenario probing to stall. Keep the How as conversational working reasoning, carrying only an operating characteristic essential to what the object is into its Definition.

For each pressure, explore candidate responsibility with short behavior statements:

```text
<Subject> <domain verb> <Object>.
```

The Subject is the candidate behavior owner and the Object is its Domain target.

When a behavior transitions the object's Lifecycle State, name the transition:

```text
<Subject> <domain verb> <Object>, transitioning <Lifecycle State name> from <before> to <after>.
```

Do not force this clause onto behavior that has no Lifecycle State transition. There is no universal result slot.

During exploration, vary the Subject when different owners are credible. Resolve every material Subject and Object as the current Root, an owned Entity, a Value Object, a Fact owned by one of those objects, an identity reference to another Root, or an external role or authority, and name each Lifecycle State transition explicitly. Explicit resolution does not promote every noun into a Domain object.

In the accepted design, the object whose behavior is described becomes the grammatical Subject and behavior owner. The sentence describes Domain meaning, not a method signature or call graph.

When a Root exposes a capability by composing an owned Entity's behavior, connect the accepted Behavior entries with this optional Root form:

```text
<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.
```

`<Entity>.<Entity Behavior>` references the Entity-owned Domain behavior; it does not prescribe a method call. Keep the Root entry about aggregate capability and composition, and the Entity entry authoritative for its owned decision instead of repeating that decision under the Root. Use the ordinary Subject form when no owned behavior is composed.

## Classify causal continuations

For every behavior that establishes a material past-tense fact, actively scan the governing Business Rules and in-scope scenarios for a business action that the fact requires or enables. Also test whether the occurrence itself, rather than only its resulting state, is required as durable Domain evidence even when no next intent exists. Do this even when neither the user nor the existing model mentions an event. Treat a continuation as material only when it is needed to explain a business right, outcome, owner, guarantee, or observable failure; ordinary method chaining is not a causal continuation.

State each candidate relationship in the working conversation without assuming that the first fact is independently complete:

```text
<Behavior> would establish <candidate past-tense fact>; <owner> must or may <next intent>.
```

If their success relationship is missing, ask the decisive business question: if the next intent cannot complete, is the preceding fact still a successful business fact? Give a recommended answer from the available evidence and the strongest credible alternative.

Load the Reaction Probe and Domain Event rules in `ddd-collaboration.md` for every material continuation. Classify it as one success guarantee, an independent local reaction, a cross-context published fact, or no selected event before choosing a realization. Then restate when the fact becomes true: under one success guarantee it exists only after the composed required outcome succeeds; under an independent reaction or published fact it exists before the later intent. For a selected independent local reaction, recommend the event as the causal handoff to the separately owned next intent; do not retain a direct invocation from the producing behavior as the primary or parallel path. Apply the durable-occurrence evidence test independently rather than using it to split a success guarantee. Being inside one Aggregate or Bounded Context does not decide the classification. A callback, hook, sink, dispatcher, mailbox, or direct call is not evidence for one; these are realization choices only after the Domain relationship is accepted.

Keep the classification and its reason in the conversation. List a selected event separately as `<Event> — recorded by <Behavior>`; the entry contains no selection reason or consumer. Model a resulting next intent separately under its own behavior owner. Analytical Workshop Events never appear in `domain-objects.md`.

## Compare object compositions

Construct the smallest credible candidate set, including no new split and the strongest relevant split, merge, move, or deletion alternative. Do not enumerate combinations that no confirmed pressure distinguishes.

For each candidate, map every pressure to a behavior owner and compare the design burden it introduces: knowledge exposed to callers or the Root, cross-object coordination and ordering, duplicated state or decisions, additional identity and lifecycle, and extra mapping or test surface. Treat this burden as accidental complexity introduced by the candidate composition, not as an invitation to prescribe implementation techniques. A candidate remains viable only when it realizes every pressure and keeps the Root able to protect cross-object invariants.

Prefer the viable candidate that localizes each decision with the state it needs while exposing less knowledge and coordination. Keep a child Entity when it has Domain identity or lifecycle plus cohesive state, rules, or transitions, and merging it would concretely spread or duplicate decision knowledge. Otherwise use the simpler supported representation. The Root composes owned-object behavior; callers do not inspect internal state to reproduce its decisions. Follow a retained Entity's behavior through any material Domain result that the Root or another owned object composes next. When the Root exposes the same capability, describe the Root's composition and the Entity's owned decision without duplicating that decision.

Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or guarantee. Express that constraint through the affected object's Facts, Lifecycle State, behavior, or actual Domain Event, or through the project's decision mechanism when it is a hard-to-reverse project choice.

## Complete the Root slice

For the accepted candidate, determine only:

1. which Domain Entities belong inside the Root's consistency boundary;
2. each retained object's business definition;
3. each retained object's Facts;
4. each retained object's Lifecycle State, or that it has no explicit Lifecycle State;
5. each retained object's behavior, including any Lifecycle State transition it makes;
6. actual Domain Events recorded by a named behavior.

Identity is written in the object heading when meaningful. Facts are the business-significant facts owned by the object and required to understand a Behavior or Invariant; they are neither a field inventory nor Domain Events. Lifecycle State records the object's named state-machine states and their Domain meaning. When the Domain has no distinct lifecycle term, qualify the generic `State` with its owner as `<Object>.State` instead of inventing a concatenated type-style name. Definition includes an essential operating characteristic only when it changes what the object represents; do not add a separate mechanism section. Behavior records the accepted Domain actions and any Lifecycle State transition. Domain Events are listed separately and point to the behavior that records them; a Lifecycle State transition alone does not require an event. Name material Value Objects and references where their meaning affects Facts or behavior, but do not inventory fields or methods. Do not add separate responsibility, collaboration, caller, or impact sections.

## Entity and Root confirmation

When one retained Entity's definition, Facts, Lifecycle State, behavior, and Root composition are coherent, show its complete compact description with any directly affected Root or owned-object wording. After the user confirms it, update those descriptions in `docs/ddd-expert/context/<context-slug>/domain-objects.md` and continue the current Root. An Entity confirmation gathers the decisions that close its responsibility; individual answers remain conversational working state.

When the Root's composition is complete, show its integrated compact slice. Before asking for confirmation, verify that every pressure is traceable and assigned, every material causal continuation has an accepted classification, every retained object's material Facts and Lifecycle State are recorded, every material Subject, Object, and Lifecycle State transition is resolved, every actual Domain Event points to the behavior that records it, every retained or changed object has a reason to exist, the strongest credible alternative was compared under the same pressures, and no remaining answer would change composition or ownership.

After the user confirms that Root, write or replace its complete section while preserving other accepted descriptions. At that Root confirmation, revisit the affected `ddd-expert` current artifacts and relevant project decisions as a whole, updating only accepted content changed by the completed design. Then continue with the next affected Root. `domain-objects.md` contains only current accepted object descriptions grouped by Root. Essential-pressure sets, candidate assignments, rejected alternatives, and design-burden comparisons remain conversational working state.

## Completion

End with the current Entity or Root outcome and cite any confirmed or updated
descriptions. Ask the one unresolved question or request confirmation of the
exact proposed object or Root. After an Entity write, name the next unresolved
object or boundary; after a Root write, name the next affected Root. Name any
accepted strategic correction when a pressure could not be traced to prior
authority, cite every required slice when implementation can begin, and report
any blocker with current filesystem state.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Business Rule-to-pressure, Aggregate, and Entity boundary reasoning.
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when Entity, Value Object, Domain Service, Repository, or layer ownership affects the object decision.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for every material causal continuation or cross-context contract.
