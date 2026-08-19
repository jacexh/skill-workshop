---
name: ddd-modeling
description: Strategic DDD guidance for EventStorming, language, Aggregate Roots, Bounded Contexts, and semantic Context Maps.
---

# DDD Modeling

## Rule strength

- **[DDD Principle]** A durable DDD meaning or boundary.
- **[House Rule]** A deliberate constraint adopted by `ddd-expert`.
- **[Heuristic]** A question or pressure signal that requires evidence.

## 1. Evidence and authority

- **[DDD Principle]** Domain experts and accepted business authority decide business meaning. Code, tests, schemas, and package structure prove current implementation, not desired meaning.
- **[Heuristic]** Use examples and counterexamples to test a model. A label that sounds like DDD is not evidence.
- **[House Rule]** Keep analytical conversation separate from accepted current artifacts. Persist the smallest accepted model that downstream work needs.
- **[House Rule]** A `model.md` Business Rule is one independently challengeable claim about an accepted business decision, permission, transition, required outcome, or invariant. Name the governed business concept or collaboration and any condition that changes the meaning. A concrete scenario must be able to contradict the rule, and downstream design must be able to use it without replaying the workshop. Do not assign tactical behavior ownership or prescribe an implementation mechanism in the rule.
- **[House Rule]** Ask one material question at a time. Investigate facts available in the repository before asking the user to retrieve them.
- **[Heuristic]** For each design decision, recommend one answer and explain the strongest credible alternative.

## 2. The ten EventStorming steps

Use the complete causal sequence. Depth may vary with the scope; the sequence does not become a documentation checklist.

1. **Scope** — business outcome, affected parties and authorities, time horizon, success scenarios, and exclusions.
2. **Workshop Events** — material past-tense business occurrences.
3. **Timeline** — replayable business-time ordering.
4. **Commands** — business intent that causes change.
5. **Roles and external authorities** — business decision rights.
6. **Constraints and required next intents** — authoritative facts, rules, and required reactions.
7. **Problems and ambiguity** — contradictions, assumptions, missing facts, and Hotspots.
8. **Aggregates and core business objects** — identity and immediate consistency boundaries.
9. **Bounded Contexts** — language, authority, policy, lifecycle, and model purpose boundaries.
10. **Context collaboration** — semantic dependency, published meaning, translation, and reliance.

- **[Heuristic]** A thesis review may resume at the first step capable of changing an already-supported conclusion.
- **[House Rule]** Workshop Events remain analytical conversation. They are not persisted as a meeting inventory or treated as production events.
- **[Heuristic]** Stop when the relevant Bounded Context and Aggregate Root conclusions withstand the strongest known counterexample and another question has diminishing decision value.

## 3. Workshop Events and actual Domain Events

- **[DDD Principle]** A past-tense occurrence may help explain the business without becoming a Domain Event.
- **[DDD Principle]** A Domain Event is a selected local domain fact needed for a named reaction or as durable evidence of the occurrence itself.
- **[House Rule]** Record an actual Domain Event with the object behavior that establishes or consumes it. Omit it when production code needs only the resulting state.
- **[Heuristic]** Cross-context consumers rely on a producer-owned published contract, not the producer's internal Domain Event type.

## 4. Aggregate Roots and owned objects

- **[DDD Principle]** An Aggregate is a consistency boundary. Its Root is the only external reference point for changing the Aggregate.
- **[Heuristic]** Cluster facts that must be valid together immediately after one business intent; require a concrete invariant to justify the grouping.
- **[Heuristic]** Ask which invariant cannot safely wait for a later reaction. If none exists, separate Aggregates may be more honest.
- **[House Rule]** A candidate Root needs supported identity, authority, business rules, and an immediate consistency boundary. Record `No supported Aggregate` when evidence does not support one.
- **[DDD Principle]** An Entity has identity across change. A Value Object is defined by its value.
- **[Heuristic]** Identity or a distinct lifecycle alone may instead reveal an owned Entity rather than another Aggregate Root.
- **[House Rule]** Owned Entities may hold distinct state and behavior inside the Root's consistency boundary. The Root composes their responsibilities; it does not have to absorb every behavior.
- **[Heuristic]** For the current Root or affected slice, group interacting Business Rules into essential business pressures: decisions, state transitions, required results, and invariants that the object model must realize. Keep every pressure traceable to its governing rules.
- **[Heuristic]** Probe each pressure as `<Subject> <acts on object>, producing <result>.` Vary the Subject to test ownership and resolve each material target and result before preserving an object; a noun alone does not establish an Entity.
- **[Heuristic]** Test each proposed object by reassigning the same pressures under the strongest relevant split, merge, move, or deletion alternative. Keep it when it localizes cohesive state and decisions that the alternative would duplicate or expose elsewhere.
- **[House Rule]** Express an object's current design through definition, state, behavior, and actual Domain Events. Identity belongs in its heading when meaningful.

## 5. Bounded Contexts

- **[DDD Principle]** A Bounded Context is a boundary within which one model and language apply. Its boundary is justified by distinct semantics, authority, policy, lifecycle, or model purpose.
- **[Heuristic]** Consider a boundary when language, authority, policy, lifecycle, model purpose, change cadence, or organizational ownership diverges materially.
- **[House Rule]** Name a context only when evidence supports a distinct business authority, purpose, and model.
- **[Heuristic]** Similar code may represent shared domain knowledge, a shared technical module, or distinct local semantics. Compare language and authority before extracting reuse.
- **[Heuristic]** Apply DRY to duplicated knowledge, not similar syntax. Balance cohesion, information hiding, coupling, and YAGNI.

## 6. Context Map

- **[House Rule]** A semantic dependency is `Upstream -> Downstream`: the upstream owns a named published meaning that influences the downstream model.
- **[DDD Principle]** Model ownership follows semantic authority.
- **[House Rule]** Record each dependency once with both endpoints, the named contract, and the downstream use or translation.
- **[House Rule]** Keep the dependency graph acyclic. Rework authority or translation rather than recording reciprocal semantic ownership.
- **[Heuristic]** No dependency row is better than a runtime-call arrow with no model influence.

## 7. Confirmation and current knowledge

- **[House Rule]** Local answers are working decisions until the user sees and confirms the integrated strategic model.
- **[House Rule]** Strategic confirmation covers scope, Bounded Contexts, Aggregate Roots, business rules, semantic dependencies, and visible uncertainty.
- **[House Rule]** Current artifacts contain only accepted knowledge required by downstream work.
- **[House Rule]** Tactical object design is confirmed one Aggregate Root at a time, following the smallest affected business-pressure slice rather than an Entity checklist. Each confirmed Root slice may be persisted without waiting for unrelated Roots.
- **[Heuristic]** When evidence defeats a conclusion, revisit the smallest dependent model that can restore a coherent explanation rather than patching local names.

## Related references

- [ddd-core.md](ddd-core.md) for Entity, Value Object, Domain Service, Repository, and layer realization.
- [ddd-collaboration.md](ddd-collaboration.md) for actual Domain Events and cross-context contracts.
