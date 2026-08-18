---
name: event-storming
description: Use when a backend story, business scenario, specification, existing domain model, or proposed domain thesis needs collaborative EventStorming to a user-confirmed Strategic Model and synchronized project documentation.
---

# Event Storming

Discover or challenge the business model with the user. The goal is a compact explanation of the supported facts, not autonomous production of a "correct architecture". The user remains the domain decision authority; the facilitator supplies evidence, counterexamples, and professional judgment.

```text
business evidence or an existing thesis
-> EventStorming Board
-> integrated business model and adversarial review
-> exact draft minutes
-> explicit confirmation
-> ready minutes and synchronized current Models
-> Design Delta check
```

## Start with the user's purpose

Infer the purpose when the request already states it; otherwise ask before evaluating anything. Distinguish:

- **discovery**: facts and boundaries are still unknown, so build the model from evidence;
- **thesis review**: the user or another agent already proposes objects, ownership, or boundaries, so restate that thesis and test the assumptions most likely to overturn it;
- **model challenge**: Tactical Design or implementation evidence provides concrete counterexamples, so reopen the earliest affected conclusion and reconsider the whole dependent thesis.

Do not turn an observational or explanatory request into a process-compliance audit. Do not force a thesis review to replay every discovery question when its evidence is already available.

## Authority and artifacts

Keep these distinctions visible:

- **confirmed business facts and constraints** bind downstream work until explicit evidence reopens them;
- **Bounded Context, Aggregate, capability, and core-object decomposition** is the current falsifiable structural hypothesis that explains those facts;
- **working conclusions** support conversation but authorize no write;
- **integrated confirmation** accepts the displayed current whole as `ready` for implementation evidence, not as immutable truth.

Code and tests prove current behavior, not business authority. They may provide counterexamples to a structural hypothesis. Before integrated review, keep project files byte-identical. Then write only one `draft` minutes file and its unchecked README entry. Confirmation applies that exact draft plus the synchronized Models and Context Map.

Use the EventStorming Board as temporary conversation state: scope, supported facts, current hypotheses, the highest-impact unresolved question, Hotspots, and exclusions. Never persist rejected alternatives, source-coverage notes, or conversation history as domain authority.

Do not load `maintain-artifacts` while establishing purpose, discovering facts, or challenging a thesis. Read existing DDD files as project evidence when needed and keep them unchanged. Load the internal skill in full only when a coherent candidate needs structural validation or a write, or when an actual artifact-status ambiguity prevents identifying authority. It owns mechanics, never modeling decisions.

## Conversation contract

Investigate Specs, PRDs, ADRs, Glossaries, accepted DDD artifacts, code, and tests before asking the user to retrieve facts already present. Ask one question only when its answer could materially change the current model, and briefly explain the fork it controls. A fact probe asks for evidence without recommending business truth. A design decision gives a recommendation and one credible alternative:

```markdown
### ✅ Recommendation — <short name>

<recommended answer and reasons>

> **🔀 Alternative — <short name>**
>
> <when this alternative is better>

**👉 Decision:** <one high-impact question>
```

Treat disagreement as evidence: replay the affected scenario, revise when warranted, and retain a concise professional objection when not. Stop when further questioning has diminishing decision value. Conflicting sources and unresolved non-blocking uncertainty remain visible Hotspots rather than invented certainty.

When two corrections share one object-responsibility, authority, or lifecycle cause—or the model gains mechanisms without gaining business scenarios—stop preserving supposedly unaffected structural conclusions. Rebuild the smallest whole hypothesis from the supported facts.

## The ten EventStorming lenses

Use these in causal order during discovery. A thesis review may acknowledge already-supported lenses and go directly to the first one that could falsify the thesis.

1. **Scope**: business outcome, affected parties and authorities, time horizon, included success scenarios, and exclusions.
2. **Workshop Events**: material past-tense business facts. A Workshop Event is analytical by default and does not authorize persistence, dispatch, messaging, or Event Sourcing.
3. **Timeline**: a replayable business-time sequence for each included success path.
4. **Commands**: the initiating business intent. Reuse one Command across state variants when the chosen commitment is the same.
5. **Roles and external authorities**: business decision rights, not IAM or transport identity.
6. **Constraints and required next intents**: authoritative facts and rules; preserve event-triggered Commands only when a selected fact requires a next business action.
7. **Problems and ambiguity**: missing facts, contradictions, assumptions, and material Hotspots.
8. **Aggregates and core business objects**: cluster around identity, lifecycle, immediate invariant, and concurrency responsibility. For each core object, capture the facts it owns, lifecycle and change reasons, rules, semantic result, relationships to other owned objects, and why the Root composes rather than absorbs that responsibility. Map each state-changing Command to a Root capability or explicit coordination, and test a credible split, merge, or deletion. These are business-level structural hypotheses; class shape and call direction belong to Tactical Design.
9. **Bounded Contexts**: coherent language, business authority, lifecycle, policy, and model purpose. Packages, services, tables, teams, and runtime calls are evidence, never boundary authority.
10. **Context collaboration**: semantic responsibility, authority, named contracts, translation, downstream reliance, and upstream-owned guarantees. Runtime call direction does not decide model ownership.

A **Workshop Event** remains in the integrated diagram only when it changes a business right, obligation, value, or required next action. Apply the same positive materiality test before modeling an adverse path. Technical timeout, retry, rollback, or recovery behavior without such a consequence belongs to Tactical Design, implementation, or verification—not the business model.

## Integrated candidate

Present one current whole for review:

- exact scope and exclusions;
- complete, readable Mermaid `flowchart LR` scenario threads;
- supported business facts and constraints;
- current Bounded Context, Aggregate, capability, and core-object responsibility hypotheses;
- selected Domain Events, Published Fact Contracts, and event-triggered Commands only where their business purpose is explicit;
- decisions, assumptions, and non-blocking Hotspots.

Use connected `Role or external authority -- Command --> Aggregate Capability or explicit coordination --> Workshop Event` threads. Keep Roles outside Aggregates. A selected Domain Event annotates the establishing Workshop Event; a producer-owned Published Fact Contract remains distinct from its eventual Integration Message. Do not add a parallel Event Index or mapping table.

Replay each included success scenario. Ensure every projected capability and structural hypothesis has visible supporting evidence, but do not complete generic rejection, failure, retry, or recovery catalogues. Repository APIs, transactions, state authority, package placement, persistence, adapters, and runtime wiring remain outside the Strategic Model unless an accepted business fact directly constrains them.

After adversarial review, validate the candidate and use `write-event-storming-draft`. Summarize the path, fingerprint, facts, structural hypotheses, decisions, and Hotspots; ask for explicit confirmation of that exact whole. A correction rewrites the same draft after reconsidering its dependent hypotheses. Confirmation applies `draft -> ready`, increments affected Model revisions, and synchronizes the minimal documentation closure.

## Later falsification and closure

A Tactical Design Model Challenge is one consolidated batch of concrete scenarios and affected hypotheses, not revised authority. Return `no_change` when the current model survives. When it changes, create one correction draft and let the confirmed replacement supersede unimplemented ready minutes; never rewrite accepted history.

If a ready Tactical Design depends on superseded EventStorming authority, route it back to Tactical Design before Codify or Guard. EventStorming does not edit BC Architecture decisions. A confirmed boundary rename may move its file mechanically; a split, merge, or removal returns any surviving software decision to Tactical Design.

## Completion

Finish with one of:

- `needs_clarification`: show the board delta and ask the one decisive question;
- `awaiting_confirmation`: cite the exact draft path and fingerprint and summarize the current whole;
- `ready`: cite the confirmed facts, current structural hypotheses, minutes, Model revisions, and synchronized documents;
- `no_change`: cite the evidence showing that the current model survived the challenge;
- `blocked`: identify the exact authority, validation, write, or external failure and filesystem state.

A `ready` result proceeds to Tactical Design only for a real Design Delta; otherwise it proceeds to Codify.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Workshop Event selection, language, authority, lifecycle, Aggregate and Bounded Context reasoning, and collaboration semantics.
