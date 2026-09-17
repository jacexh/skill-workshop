---
name: event-storming
description: Use when a backend story, business scenario, specification, or existing domain model needs collaborative strategic discovery of Bounded Contexts and Aggregate Roots.
---

# Event Storming

Discover the smallest strategic model that explains the business. The user owns domain decisions; the facilitator supplies repository evidence, counterexamples, and a recommended answer for each design fork.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts.

```text
business purpose
-> causal discussion
-> Bounded Contexts and Aggregate Roots
-> integrated confirmation
-> current strategic artifacts
```

## Start with the user

Infer the requested outcome when it is explicit. Otherwise ask what the user wants to understand or decide before evaluating the model.

Choose the shortest useful entry:

- **discovery** builds a model from a story or scenario;
- **thesis review** tests an existing proposed model at its weakest assumption;
- **model challenge** revisits a strategic conclusion contradicted by later concrete evidence.
- **recording** writes a complete already-confirmed strategic model using the artifact steps below.

An explanation request remains an explanation request. A local change inside an accepted model does not require repository-wide discovery.

For **recording**, use the accepted integrated proposal and proceed directly to
the artifact steps below. Read affected current artifacts to preserve unrelated
meaning. Ask only if missing or contradictory business meaning prevents an
accurate write; formatting differences are resolved through the templates.

## Conversation contract

Use the shared [design interview presentation](../../references/workflow.md#design-interview-presentation) for questions, recommendations, changes, and conflicts.

- Inspect relevant Specs, PRDs, ADRs, glossary entries, current DDD artifacts, code, and tests first. If a fact is available there, look it up instead of asking the user. For changes to existing behavior, compare the accepted model, observed implementation, and requested outcome; focus discussion on affected differences and conflicts.
- Ask one material unresolved question at a time about product goals, user scenarios, business rules, or strategic boundaries. A gap can merit an interview before its effect on Bounded Contexts or Aggregates is known. Wait for the answer before settling conclusions that depend on it.
- For a business fact, explain what evidence is missing. For a design choice, give a recommended answer, its reason, and the strongest credible alternative.
- Treat disagreement and examples as evidence. Revise the model when they defeat the current explanation.
- Move to the integrated proposal when the scoped goals, key success and failure scenarios, business rules, and affected strategic boundaries are supported by evidence, and remaining uncertainty does not block the proposal.

Keep unresolved material uncertainty visible. Never manufacture business authority from existing code or DDD terminology.

## Conversational board

During discovery, maintain the lightest useful EventStorming board in the conversation: the current Workshop Event timeline, causing Commands and Roles, constraints and Hotspots, and candidate Aggregate and Bounded Context clusters. Show the working scenario or timeline as it develops so the user can correct missing or misunderstood meaning before the integrated proposal. When an answer changes it, show the affected part.

Use a compact text timeline, table, or arrow chain only when it makes a causal gap or boundary decision materially easier to inspect. These working views and alternatives remain in the conversation; never write them to the repository or treat their notation as separate approval.

## The ten EventStorming steps

Use all ten steps in causal order during discovery. Advance through explicit interviews where material knowledge is missing, reusing established evidence where it already answers a step. Steps may span or share turns; advance when the step's conclusions have evidence and its blocking questions are answered. Revisit affected earlier conclusions when later answers change them. A thesis review may acknowledge evidence already established and resume at the first step capable of changing the thesis.

1. **Scope**: establish the business outcome, affected parties and authorities, time horizon, included success scenarios, and exclusions.
2. **Workshop Events**: identify material past-tense business occurrences without assuming they become production events.
3. **Timeline**: arrange the occurrences into replayable business-time sequences.
4. **Commands**: identify the business intent that causes each material change.
5. **Roles and external authorities**: identify who may decide or initiate the intent in business terms.
6. **Constraints and required next intents**: expose authoritative facts, rules, and any occurrence that requires or enables another business action; clarify whether the occurrence stands as a successful business fact independently of that action.
7. **Problems and ambiguity**: make contradictions, assumptions, missing facts, and material Hotspots explicit.
8. **Aggregates and core business objects**: cluster identity and immediate consistency around candidate Aggregate Roots; test a credible split, merge, or deletion.
9. **Bounded Contexts**: separate language, authority, policy, lifecycle, and model purpose where they diverge.
10. **Context collaboration**: identify semantic dependencies, named published contracts, translation, and downstream reliance. Use a published synchronous command/query when the caller needs an immediate authoritative answer, a producer-owned Published Fact Contract when another context relies on what occurred, and a receiver-owned Asynchronous Intent Contract when one context asks another authority to act later. Record each dependency once as `Upstream -> Downstream`; the upstream owns the named meaning, and the accepted map remains acyclic.

Workshop Events stay in the conversation as analytical evidence. A proposed production Domain Event remains a candidate until the Actual Domain Event rules select it; Tactical Design owns the object-level recording of any selected event.

Derive strategic boundaries from business language, authority, policy, lifecycle, and model purpose. Admit a concern only when it changes a business right, obligation, value, authority, decision, outcome, or required next action. Treat implementation observations as evidence about that business meaning; later design owns the realization.

Derive Business Rules precise enough for a concrete scenario to contradict and for Tactical Design to derive essential business pressures. When drafting or revising them, apply the [strategic rule writing guidance](../../templates/artifact-layout.md#strategic-rule-writing).

## Current strategic artifacts

Persist only accepted current knowledge:

- `docs/ddd-expert/context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `docs/ddd-expert/context/<context-slug>/model.md` owns one context's purpose, essential language, Aggregate Roots, and strategic business rules.

`model.md` remains strategic. Tactical Design records object definition, Facts, Lifecycle State, behavior, Domain-owned Ports where present, and actual Domain Events in `domain-objects.md`; conversational working state remains transient.

## Confirmation and writing

Present one compact integrated proposal:

- scope and exclusions;
- Bounded Contexts and their purpose;
- Aggregate Roots and their consistency boundary;
- strategic business rules;
- semantic dependencies and named contracts;
- remaining non-blocking uncertainty.

Reuse an already-confirmed integrated proposal. Otherwise obtain its confirmation under the workflow contract before writing.

Before writing, read the [artifact layout and write checks](../../templates/artifact-layout.md), [Context Map template](../../templates/context-map.md), and [Model template](../../templates/model.md). Update only accepted current meaning that changed. Validate each changed Context Map with the linked script and verify affected Model links before declaring the write complete.

Then classify the next step:

- use Tactical Design when Aggregate internals or domain-object behavior still needs a decision;
- use Codify when the accepted `domain-objects.md` already covers the change;
- stop when the user requested design only.

## Completion

End with the strategic result, supporting evidence, changed artifacts, and write-check results. If a material decision remains, ask the decisive question with the current proposal. Continue to Tactical Design or Codify only when that work is in scope.
