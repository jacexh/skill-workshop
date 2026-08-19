---
name: event-storming
description: Use when a backend story, business scenario, specification, or existing domain model needs collaborative strategic discovery of Bounded Contexts and Aggregate Roots.
---

# Event Storming

Discover the smallest strategic model that explains the business. The user owns domain decisions; the facilitator supplies repository evidence, counterexamples, and a recommended answer for each design fork.

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

An explanation request remains an explanation request. A local change inside an accepted model does not require repository-wide discovery.

## Conversation contract

- Inspect relevant Specs, PRDs, ADRs, glossary entries, current DDD artifacts, code, and tests first. If a fact is available there, look it up instead of asking the user.
- Ask one question at a time and wait for the answer. Each question must be capable of changing the current strategic model.
- For a business fact, explain what evidence is missing. For a design choice, give a recommended answer, its reason, and the strongest credible alternative.
- Treat disagreement and examples as evidence. Revise the model when they defeat the current explanation.
- Stop when Bounded Context and Aggregate Root conclusions are supported and another question would not change them.

Keep unresolved material uncertainty visible. Never manufacture business authority from existing code or DDD terminology.

## Conversational board

During discovery, maintain the lightest useful EventStorming board in the conversation: the current Workshop Event timeline, causing Commands and Roles, constraints and Hotspots, and candidate Aggregate and Bounded Context clusters. Update that working view when answers change instead of turning every intermediate state into a document.

Use a compact text or Mermaid diagram when it makes a causal gap or boundary decision materially easier to inspect. Temporary boards, alternatives, and diagrams remain conversational working state; never write them to the repository or treat their notation as separate approval.

## The ten EventStorming steps

Use all ten steps in causal order during discovery. A thesis review may acknowledge evidence already established and resume at the first step capable of changing the thesis.

1. **Scope**: establish the business outcome, affected parties and authorities, time horizon, included success scenarios, and exclusions.
2. **Workshop Events**: identify material past-tense business occurrences without assuming they become production events.
3. **Timeline**: arrange the occurrences into replayable business-time sequences.
4. **Commands**: identify the business intent that causes each material change.
5. **Roles and external authorities**: identify who may decide or initiate the intent in business terms.
6. **Constraints and required next intents**: expose authoritative facts, rules, and any occurrence that requires another business action.
7. **Problems and ambiguity**: make contradictions, assumptions, missing facts, and material Hotspots explicit.
8. **Aggregates and core business objects**: cluster identity and immediate consistency around candidate Aggregate Roots; test a credible split, merge, or deletion.
9. **Bounded Contexts**: separate language, authority, policy, lifecycle, and model purpose where they diverge.
10. **Context collaboration**: identify semantic dependencies, named published contracts, translation, and downstream reliance.

Workshop Events stay in the conversation as analytical evidence. They do not create a production event, persisted meeting record, or diagram. A local occurrence becomes a Domain Event only when the implemented domain needs that occurrence as a named fact; Tactical Design records it on the object that produces or consumes it.

Package, service, table, runtime component, team, and call direction are evidence, not strategic boundaries. Generic retry, transaction, concurrency, recovery, and deployment concerns do not enter the model unless a confirmed business requirement makes them material.

## Current strategic artifacts

Persist only accepted current knowledge:

- `docs/ddd-expert/context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `docs/ddd-expert/context/<context-slug>/model.md` owns one context's purpose, essential language, Aggregate Roots, and strategic business rules.

Keep Entities, object state, methods, implementation calls, and actual Domain Events out of `model.md`; Tactical Design owns them in `domain-objects.md`. Keep discussion history, rejected alternatives, workshop boards, diagrams, and implementation mechanics out of both strategic files.

## Confirmation and writing

Present one compact integrated proposal:

- scope and exclusions;
- Bounded Contexts and their purpose;
- Aggregate Roots and their consistency boundary;
- strategic business rules;
- semantic dependencies and named contracts;
- remaining non-blocking uncertainty.

Include the compact conversational board or diagram when it materially helps the user confirm the whole model. It remains transient and creates no additional artifact.

Write nothing while that proposal is still changing. When the user explicitly confirms the integrated strategic model, update only `context-map.md` and affected `model.md` files whose current meaning changed. Write those files directly; there is no meeting-minutes lifecycle or cross-file staging ceremony.

Then classify the next step:

- use Tactical Design when Aggregate internals or domain-object behavior still needs a decision;
- use Codify when the accepted `domain-objects.md` already covers the change;
- stop when the user requested design only.

## Completion

Finish with one result:

- `needs_clarification`: show the current model delta and ask the one decisive question;
- `awaiting_confirmation`: show the compact integrated proposal and request explicit confirmation;
- `tactical_design_required`: cite the confirmed strategic files and the unresolved Aggregate internals;
- `codify_ready`: cite the confirmed strategic files and existing tactical authority;
- `no_change`: cite evidence that the current strategic model still holds;
- `blocked`: identify the missing authority or write failure and current filesystem state.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Workshop Event selection, language, Aggregate, Bounded Context, and Context Map reasoning.
