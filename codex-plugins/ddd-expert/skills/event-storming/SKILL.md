---
name: event-storming
description: Use when a backend user story, business scenario, specification, or existing domain model needs collaborative EventStorming to a user-confirmed Strategic Model and synchronized project documentation.
---

# Event Storming

Facilitate EventStorming with the user. Bring architectural judgment and constructive challenge; let the user remain the domain decision authority. The goal is not an autonomous "correct model". The goal is a model both parties have tested from several perspectives, that the user understands and confirms.

```text
EventStorming Board
-> ten EventStorming steps
-> integrated model and adversarial review
-> explicit user confirmation
-> synchronized documentation
-> model_ready
```

Load this plugin's internal `maintain-artifacts` skill in the same run. Use `inspect` while discovering evidence, `validate-proposed-model` before presenting an integrated model, and `apply-confirmed-model` only after the user confirms that model. Keep Tactical Design, implementation, and Codify outside this workflow.

## Authority and states

Keep three levels of authority distinct:

- **Supported Modeling Fact**: supplied project evidence or a domain-authority answer supports it;
- **Working Confirmation**: the user accepts a local conclusion so discussion can advance; later evidence may reopen it;
- **Integrated Model Confirmation**: the user accepts the current complete integrated model after seeing its diagrams, decisions, assumptions, and non-blocking Hotspots.

Before Integrated Model Confirmation, keep every project file byte-identical. Existing accepted artifacts remain authoritative while the EventStorming Board evolves. A local answer, accepted Aggregate, or source fact is never write authority.

Use three visible states:

- `working`: the current step has an unresolved material question;
- `awaiting_confirmation`: the ten steps and adversarial review are complete and the integrated model is visible;
- `model_ready`: the confirmed model and its documentation closure were applied and verified.

## EventStorming Board

Use an **EventStorming Board** as temporary conversation state, separate from any Aggregate, Bounded Context, or Context Map. Track:

- the modeling destination, scope, and exclusions;
- the current one of the ten steps;
- supported facts and working-confirmed decisions;
- the current **frontier** question;
- blocking and non-blocking Hotspots;
- fog that is in scope but cannot yet be phrased as a precise question; and
- explicit out-of-scope areas.

Show only the board delta during ordinary turns. Show the complete low-resolution board when changing steps, reopening an earlier step, resuming a long exchange, and before integrated confirmation. Never persist the board, rejected alternatives, source coverage, or conversation history as domain artifacts.

## Conversation contract

Advance through live exchange rather than a batch questionnaire.

1. Investigate facts available from Specs, PRDs, ADRs, Glossaries, accepted DDD artifacts, code, and tests instead of asking the user to retrieve them. Code proves current behavior, not business authority.
2. Present discovered information in useful groups, but put only one frontier question to the user per turn. Choose the question with the highest downstream impact and information gain within the current step, and briefly state why it is next.
3. For a **fact probe**, state the evidence and ask for the missing fact, example, or counterexample without recommending what the business truth should be.
4. For a **design decision**, state the supported facts and tension, give a recommended answer with reasons, steelman the strongest credible alternative, then ask for one decision.
5. When the user disagrees, investigate the business evidence behind their position and replay the affected scenario. Change the recommendation when new evidence warrants it; otherwise preserve the professional objection and consequences. The informed user has final decision authority, and residual disagreement becomes an assumption or Hotspot.
6. When neither party can answer, inspect available evidence, construct discriminating business cases, or identify the domain participant who can answer. Keep the gap as a Hotspot rather than inventing certainty.
7. Give a decision working confirmation only when its supporting facts are clear, its strongest known counterexample was considered, the user understands the tradeoff, and no known model-level blocker remains. Stop challenging when further cases have diminishing decision value.

Conflicting project sources are evidence, not an automatic precedence rule. Present the exact conflict. Promote it to the frontier when it blocks the current model; otherwise retain it as a Hotspot until its dependent branch becomes current.

## The ten EventStorming steps

Run these steps in order. The frontier orders questions within the current step; it does not authorize a later-step conclusion. Record an early Aggregate or Bounded Context idea as a hypothesis and return to it only when its preceding evidence exists.

Advance when the current step has a coherent working model, its key contradictions are handled, and every remaining uncertainty is an explicit Hotspot. New evidence reopens the earliest affected step and invalidates dependent conclusions.

1. **Clarify the modeling scope**: define the problem, desired business outcome, actors or affected parties, time horizon, included and excluded scenarios, and whether the confirmation unit is an Aggregate, one Bounded Context, or a cross-context slice.
2. **Place Domain Events first**: shallow-scan the scoped evidence and place material facts that have already happened, in past tense and business language. Start neither from pages, systems, APIs, database tables, nor a desired class structure.
3. **Arrange events on the timeline**: create a rough business-time sequence quickly, then move events as knowledge improves. Replay the happy path first and add only exceptional paths that could change business meaning.
4. **Find Commands**: identify the business action or intent that could cause each material Event. A Command is not automatically a handler, endpoint, DTO, or message.
5. **Add actors and external systems**: identify who proposes, decides, confirms, changes, reverses, expires, and publishes material facts, including scheduled policies and external authorities.
6. **Mark business rules and policies**: place invariants, admission rules, decision policies, timing rules, and reactions between Commands and Events. State who owns each rule and what rights, obligations, value, or next action it changes.
7. **Mark problems and ambiguities**: expose missing facts, contradictions, disputed language, assumptions, risks, and deferred branches. Resolve the material ones through evidence, examples, counterexamples, and focused questions.
8. **Identify Aggregates and core business objects**: only after the causal timeline is coherent, cluster behavior around identity, lifecycle, immediate invariants, and concurrency responsibility. Test credible split, merge, and deletion alternatives. Record `No supported Aggregate` at Bounded Context scope when the evidence supports none; never invent a root to satisfy a template.
9. **Identify Bounded Contexts**: group responsibilities where one coherent language, business authority, lifecycle, policy, and model purpose fit. Names, packages, services, teams, storage, calls, transaction shape, and current runtime components are evidence, never boundary authority.
10. **Establish context collaboration**: record responsibility, authority, named contracts, and translations. Keep the semantic Model Dependency View (`U -> D`, upstream model influence to downstream model) separate from the runtime/business Interaction View (`initiator -> receiver`). Derive both from domain evidence; call direction does not decide model ownership.

## Constructive challenge

Challenge the weakest material assumption, not every imaginable edge case. Select cases that could change the model from these perspectives:

- **participant and authority**: different actors, decision rights, available information, and external authority;
- **scenario variation**: rejection, cancellation, timeout, duplicate intent, retry, concurrency, partial completion, compensation, and rule changes;
- **model pressure**: language, lifecycle, invariants, ownership, change reasons, coupling, and translation cost.

Treat repeated behavior as **abstraction pressure**, not a conclusion. Apply DRY to duplicated knowledge rather than repeated syntax, and balance cohesion/SRP, information hiding, coupling, and YAGNI. Compare a shared domain mechanism, a shared technical Module, and distinct local semantics with translations. Software-design principles help find a seam; business language, authority, lifecycle, policy, and model purpose determine whether that seam is a Bounded Context.

An unresolved Hotspot is **blocking** when plausible answers could change an in-scope event timeline, material rule, Aggregate boundary, Bounded Context, or collaboration direction. Resolve it or narrow the scope before confirmation. Retain non-blocking Hotspots and their assumptions visibly.

## Integrated model and confirmation

After all ten steps, present one current integrated model for adversarial review. If a challenge changes it, reopen the affected step, replace the candidate as a whole, and review the new candidate. Do not combine partial acceptance of an earlier diagram with an unseen revision.

Present:

1. the exact scope and exclusions;
2. a complete EventStorming diagram for every affected Aggregate or Bounded Context;
3. the event timeline, Commands, actors and external systems, rules and policies, Aggregates or explicit no-Aggregate conclusion, Bounded Contexts, and collaborations;
4. key design decisions with their business reasons; and
5. assumptions and non-blocking Hotspots.

Use versionable Mermaid `flowchart LR` diagrams. Show connected `actor/external -> Command -> policy/rule -> past-tense Event` scenario threads, the relevant Aggregate and Bounded Context boundaries, and visible Hotspots. For a cross-context model, show the Model Dependency View separately from the Interaction View. Persist the confirmed diagrams in the affected `model.md` files; persist the complete confirmed collaboration projections in `context-map.md`.

Ask for explicit confirmation of the current integrated model. The user confirms the domain model, not a per-file change plan. Any semantic correction returns to `working` and requires a complete revised presentation.

## Documentation closure

Model confirmation authorizes synchronization of the confirmed meaning into relevant project-owned DDD artifacts and living Specs, PRDs, ADRs, and Glossaries. Determine the minimal semantic consistency closure after confirmation; do not ask the user to approve a document-impact inventory.

Render every affected terminal document from the confirmed model and repository policy, stage and validate the whole consistency set outside the project workspace, recheck observed pre-states, then apply it once through `maintain-artifacts.apply-confirmed-model`. Persist the exact confirmed diagrams and do not introduce new domain meaning while rendering.

If document synchronization requires a semantic decision absent from the confirmed model, return that one decision to the EventStorming Board. Preserve historical ADR rationale and use a superseding ADR when repository policy requires it. Inspection alone never makes a source document writable, and external documents remain outside project scope.

## Completion

Finish with one of:

- `needs_clarification`: show the board delta and ask the one frontier question;
- `awaiting_confirmation`: show the complete integrated model and ask for explicit confirmation;
- `model_ready`: cite the confirmed scope, changed paths, Model revisions, diagram persistence, Context Map validation, and synchronized documentation;
- `no_change`: cite the already confirmed model and current artifacts proving no change is needed;
- `blocked`: identify the authority, validation, transaction, or external failure and exact filesystem state.

The terminal outcome is Strategic Model readiness. EventStorming never creates or rewrites Tactical Design and never claims `codify_ready`.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) when reasoning about language, authority, lifecycle, Aggregate boundaries, Bounded Contexts, abstraction pressure, or collaboration.
