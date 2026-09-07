# EventStorming Discovery and Challenge

Read for discovery, thesis review, or a model challenge. Reuse established
evidence and apply the shared workflow contract. Recording a complete confirmed
model uses the skill entry and artifact templates directly.

## Conversation contract

- Inspect relevant Specs, PRDs, ADRs, glossary entries, current DDD artifacts, code, and tests first. If a fact is available there, look it up instead of asking the user.
- Ask one material unresolved question at a time. Each question must be capable of changing the current strategic model.
- For a business fact, explain what evidence is missing. For a design choice, give a recommended answer, its reason, and the strongest credible alternative.
- Treat disagreement and examples as evidence. Revise the model when they defeat the current explanation.
- Stop when Bounded Context and Aggregate Root conclusions are supported and another question would not change them.

Keep unresolved material uncertainty visible. Never manufacture business authority from existing code or DDD terminology.

## Conversational board

During discovery, maintain the lightest useful EventStorming board in the conversation: the current Workshop Event timeline, causing Commands and Roles, constraints and Hotspots, and candidate Aggregate and Bounded Context clusters. Update that working view when answers change instead of turning every intermediate state into a document.

Use a compact text timeline, table, or arrow chain only when it makes a causal gap or boundary decision materially easier to inspect. These working views and alternatives remain in the conversation; never write them to the repository or treat their notation as separate approval.

## The ten EventStorming steps

Use all ten steps in causal order during discovery. A thesis review may acknowledge evidence already established and resume at the first step capable of changing the thesis.

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

Write only Business Rules precise enough for a concrete scenario to contradict and for Tactical Design to derive essential business pressures. Each rule is one independently challengeable claim: name the governed business concept or collaboration, any condition that changes the meaning, and the accepted business decision, permission, transition, required outcome, or invariant. State business meaning without assigning tactical behavior ownership or prescribing an implementation mechanism.
