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
-> validated `draft` EventStorming minutes and console summary
-> explicit user confirmation
-> `ready` minutes and synchronized Models
-> Design Delta check
-> Tactical Design when material, otherwise Codify
```

Load this plugin's internal `maintain-artifacts` skill in the same run. Use `inspect` while discovering evidence, `validate-proposed-model` after adversarial review, `write-event-storming-draft` to materialize the minutes, and `apply-ready-event-storming` only after the user confirms that exact draft. Keep implementation and software collaboration design outside this workflow. A verified `ready` result proceeds to Tactical Design only when a real Design Delta remains; otherwise it is ready for Codify.

## Authority and states

Keep three levels of authority distinct:

- **Supported Modeling Fact**: supplied project evidence or a domain-authority answer supports it;
- **Working Confirmation**: the user accepts a local conclusion so discussion can advance; later evidence may reopen it;
- **Integrated Model Confirmation**: the user accepts the current complete integrated model after seeing its diagrams, decisions, assumptions, and non-blocking Hotspots.

Before the ten steps and adversarial review produce one complete candidate, keep every project file byte-identical. Then write only the `draft` EventStorming minutes and its unchecked README entry; keep every canonical Model byte-identical until confirmation. A local answer, accepted Aggregate, source fact, or draft minutes file is never implementation authority.

Use three visible states:

- `working`: the current step has an unresolved material question;
- `awaiting_confirmation`: the ten steps and adversarial review are complete, and the exact integrated candidate is visible in one `draft` minutes file;
- `ready`: the confirmed minutes, affected Models, and documentation closure were applied and verified for implementation.

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
4. For a **design decision**, state the supported facts and tension, give a recommended answer with reasons, steelman the strongest credible alternative, then ask for one decision using the Decision Frame below.
5. When the user disagrees, investigate the business evidence behind their position and replay the affected scenario. Change the recommendation when new evidence warrants it; otherwise preserve the professional objection and consequences. The informed user has final decision authority, and residual disagreement becomes an assumption or Hotspot.
6. When neither party can answer, inspect available evidence, construct discriminating business cases, or identify the domain participant who can answer. Keep the gap as a Hotspot rather than inventing certainty.
7. Give a decision working confirmation only when its supporting facts are clear, its strongest known counterexample was considered, the user understands the tradeoff, and no known model-level blocker remains. Stop challenging when further cases have diminishing decision value.

Conflicting project sources are evidence, not an automatic precedence rule. Present the exact conflict. Promote it to the frontier when it blocks the current model; otherwise retain it as a Hotspot until its dependent branch becomes current.

A **Tactical Design Model Challenge** is one consolidated falsification batch, not revised business authority or one handback per question. Verify its originating draft path and fingerprint, challenged minutes and Model revisions, every known concrete scenario or counterexample in the batch, affected design paths, and the current frontier question. Rebuild the Board once from current authority and that evidence, reopen the earliest affected EventStorming step, preserve every unaffected conclusion, and work through the supplied batch one frontier at a time. Test each counterexample and its strongest credible business alternative; never promote the Tactical Design mechanism itself into the Model. Return `no_change` when the current Model survives. When it changes, settle the complete batch before writing one correction draft, then keep rewriting that same draft until integrated confirmation; do not create one EventStorming record per challenge question.

Render each design decision as one compact **Decision Frame**. Preserve this visual hierarchy:

```markdown
### ✅ Recommendation — <short name>

<recommended answer in one or two sentences>

- **Why:** <business reasons>
- **Trade-off:** <main cost>

> **🔀 Alternative — <short name>**
>
> <credible alternative in one or two sentences>
>
> **Prefer when:** <condition that makes this alternative better>

**👉 Decision:** <one frontier question>
```

Keep the recommendation as the primary reading path and the blockquoted alternative visually subordinate but substantively complete. Fact probes do not use a Decision Frame.

## The ten EventStorming steps

A **Workshop Event** is this workflow's distinguishing label for a material past-tense business fact placed on the Board to discover the causal story. It is analytical by default: the fact node does not by itself authorize a Domain Event, Published Fact Contract, persistence or dispatch, asynchronous transport, Event Sourcing, or event-driven architecture.

Run these steps in order. The frontier orders questions within the current step; it does not authorize a later-step conclusion. Record an early Aggregate or Bounded Context idea as a hypothesis and return to it only when its preceding evidence exists.

Advance when the current step has a coherent working model, its key contradictions are handled, and every remaining uncertainty is an explicit Hotspot. New evidence reopens the earliest affected step and invalidates dependent conclusions.

1. **Clarify the modeling scope**: define the problem, desired business outcome, actors or affected parties, time horizon, included and excluded scenarios, and whether the confirmation unit is an Aggregate, one Bounded Context, or a cross-context slice.
2. **Place Workshop Events first**: shallow-scan the scoped evidence and place material facts that have already happened, in past tense and business language. Label each fact `Workshop Event: <Past-tense business fact>`. Keep given facts and preconditions as `Given fact:` inputs. Normalize a material past-tense `Outcome` into a Workshop Event; when a branch establishes nothing new, terminate it as a `No-new-fact result:` instead. Start neither from pages, systems, APIs, database tables, nor a desired class structure.
3. **Arrange events on the timeline**: create a rough business-time sequence quickly, then move events as knowledge improves. Replay the happy path first and add only exceptional paths that could change business meaning. Steps 2-3 are complete when every included material scenario has at least one supported Workshop Event or an explicit no-new-business-fact result, every Workshop Event belongs to at least one replayable business-time thread, and no timeline-critical fact remains only in prose.
4. **Find Commands**: identify the business action or intent that could cause each material Workshop Event. Normalize repeated occurrences by the intent chosen by the actor or issuing policy: reuse one canonical Command across pre-state and scenario variants when the requested outcome is the same, and retain distinct Commands only when the initiator chooses materially different business commitments. A Command is not automatically a handler, endpoint, DTO, or message.
5. **Add actors and external systems**: identify who proposes, decides, confirms, changes, reverses, expires, and publishes material facts, including scheduled policies and external authorities.
6. **Mark business rules and policies**: distinguish the two causal positions: a decision rule admits or rejects one Command; a Reaction Policy observes an established fact and issues the next intent. State who owns each rule and what rights, obligations, value, or next action it changes. Persist only business-required reactions; implementation-only callback or transport wiring is not Model authority.
7. **Mark problems and ambiguities**: expose missing facts, contradictions, disputed language, assumptions, risks, and deferred branches. Resolve the material ones through evidence, examples, counterexamples, and focused questions.
8. **Identify Aggregates and core business objects**: only after the causal timeline is coherent, cluster behavior around identity, lifecycle, immediate invariants, and concurrency responsibility. Capture the business facts Codify will need to choose tactical forms: object identity and continuity, ownership, lifecycle, validity, equality, normalization or units, and cross-Aggregate reference meaning when material. Project each normalized state-changing Command onto one or more owned Aggregate Root capabilities or explicit Application/cross-Aggregate coordination. Treat a capability as one stable business operation that guides the Root's intention-revealing Domain method surface: record only its source Command or Commands, common required authoritative facts, guaranteed business result, and stable rejection contract. Do not split capabilities by pre-state or scenario branch, copy Application orchestration into a capability row, prescribe method signatures, or require one exact method count. Check both directions before advancing: every in-scope Command is accounted for, every new or changed capability has a source Command, and overlapping rows do not restate one intent. Test credible split, merge, and deletion alternatives. Record `No supported Aggregate` at Bounded Context scope when the evidence supports none; never invent a root to satisfy a template.
9. **Identify Bounded Contexts**: group responsibilities where one coherent language, business authority, lifecycle, policy, and model purpose fit. Names, packages, services, teams, storage, calls, transaction shape, and current runtime components are evidence, never boundary authority.
10. **Establish context collaboration**: record responsibility, authority, named contracts, translations, downstream reliance, and upstream-owned authority, ordering, durability, or failure guarantees in the semantic Model Dependency View (`U -> D`, upstream model influence to downstream model). Derive ownership from domain evidence; runtime call direction does not decide model ownership and does not belong in the Context Map merely because a call exists.

## Constructive challenge

Challenge the weakest material assumption, not every imaginable edge case. Select cases that could change the model from these perspectives:

- **participant and authority**: different actors, decision rights, available information, and external authority;
- **scenario variation**: rejection, cancellation, timeout, duplicate intent, retry, concurrency, partial completion, compensation, and rule changes;
- **model pressure**: language, lifecycle, invariants, ownership, change reasons, coupling, and translation cost.

Treat repeated behavior as **abstraction pressure**, not a conclusion. Apply DRY to duplicated knowledge rather than repeated syntax, and balance cohesion/SRP, information hiding, coupling, and YAGNI. Compare a shared domain mechanism, a shared technical Module, and distinct local semantics with translations. Software-design principles help find a seam; business language, authority, lifecycle, policy, and model purpose determine whether that seam is a Bounded Context.

An unresolved Hotspot is **blocking** when plausible answers could change an in-scope event timeline, material rule, Aggregate boundary, Bounded Context, or collaboration direction. Resolve it or narrow the scope before confirmation. Retain non-blocking Hotspots and their assumptions visibly.

## Integrated model and confirmation

After all ten steps, assemble one current integrated model for adversarial review. If a challenge changes it, reopen the affected step, replace the candidate as a whole, and review the new candidate. Do not combine partial acceptance of an earlier diagram with an unseen revision.

The integrated candidate must contain:

1. the exact scope and exclusions;
2. a complete EventStorming diagram for every affected Aggregate or Bounded Context;
3. the Workshop Event timeline, normalized Commands, actors and external systems, decision rules, required Reaction Policies, explicit Command-to-Capability or coordination mappings, Aggregates, Bounded Contexts, and collaborations;
4. key design decisions with their business reasons; and
5. assumptions and non-blocking Hotspots.

Before confirmation, consider every Workshop Event once and apply the Domain Event and Published Fact selection rules routed by `ddd-modeling`. Unannotated Workshop Events remain analytical; do not label each one `Analytical`. For a selected Domain Event, annotate its original node `Domain Event: <Canonical past-tense fact>`. For selected published meaning, label the original cross-context edge with its named Published Fact Contract, owner, and permitted downstream reliance. The connected scenario threads are the single source of truth for the iteration's Workshop Events. Do not add a parallel manual Event Index.

Before requesting confirmation, replay every material scenario as a connected `actor/external -> Command -> policy/rule -> Aggregate Capability or explicit coordination -> Workshop Event` thread, or as an explicit terminal branch where no new business fact is established. Reuse the same canonical Command and capability nodes across state variants instead of renaming them per branch. When the business requires a next action, continue the same causal story as `selected Domain Event or Published Fact Contract -> Reaction Policy -> Command -> Aggregate Capability or explicit coordination`, and replay through its resulting fact or no-new-fact outcome. Ensure every Workshop Event belongs to at least one thread. For each selected Domain Event, show its owning context or Aggregate, establishing behavior, required local reaction or purpose for preserving independent-occurrence evidence, and material failure semantics. For each required reaction, name the reacting context, business policy and owner, issued Command, target capability or coordination, and business failure/recovery meaning. For each Published Fact Contract, show its producing owner, permitted downstream reliance, translation, and material guarantee. Ensure the integrated model also supplies the other business meaning implementation must preserve: Aggregate boundaries and capabilities; core-object identity, continuity, validity, and equality semantics; lifecycle and immediate invariants; cross-Aggregate progress and completion obligations; collaboration translations and guarantees; and material failure or recovery semantics. Persist only business facts that constrain realization, not a tactical design log. Repository APIs, CQRS shape, package placement, persistence schema, adapters, runtime wiring, and verification mechanics remain Codify decisions inside accepted seams. Transaction, state, concurrency, event-publication, failure/recovery, or durable Interface ownership that is not already accepted becomes a Design Delta for Tactical Design.

Use versionable Mermaid `flowchart LR` diagrams. Show connected `actor/external -> Command -> policy/rule -> Workshop Event` scenario threads, continuing through required fact-to-intent reactions when present, plus relevant Aggregate and Bounded Context boundaries and visible Hotspots. Use the template's distinct `Given fact:`, `Workshop Event:`, and `No-new-fact result:` labels and styles; reserve `:::event` for Workshop Events. Label a published cross-context edge `Published Fact Contract: <name>`. For a cross-context model, include the Model Dependency View. Persist complete scenario interactions in the EventStorming minutes; project only selected Domain Events and the exact Required Reactions into the reacting context's conditional `Domain Events and Reactions` section, and only each context's other durable conclusions into its `model.md`; persist confirmed semantic dependencies and named contracts in `context-map.md` after confirmation.

After adversarial review, run `validate-proposed-model`, then use `maintain-artifacts.write-event-storming-draft` to write one complete minutes file with `status: draft` and one unchecked README entry. In the console, summarize the scope, draft minutes path, validation result, key decisions, assumptions, non-blocking Hotspots, and affected Models, then ask for explicit confirmation of those exact minutes. The user confirms the domain model, not a per-file change plan.

Any semantic correction returns to `working`, requires a complete revised candidate, and rewrites the same validated `draft` minutes before confirmation is requested again. After explicit confirmation, transition the exact displayed minutes to `ready` and synchronize the affected canonical Models with incremented revisions and `last_changed_by`; if the candidate fingerprint differs, do not apply it as the confirmed model.

## Documentation closure

Model confirmation authorizes the exact minutes' `draft -> ready` transition and synchronization of the confirmed meaning into affected Models, the Context Map, root DDD README, and relevant project-owned living Specs, PRDs, ADRs, and Glossaries. Determine the minimal semantic consistency closure after confirmation; do not ask the user to approve a document-impact inventory.

Whenever a later confirmed EventStorming correction replaces an unimplemented iteration, apply the new `ready` minutes and Models, and transition each replaced `ready` minutes record to `superseded` with an exact `superseded_by` link. Replacement is determined by the old `ready` state, overlapping scope, and a new affected Model revision that explicitly replaces its meaning—not by where the correcting evidence originated. Replace the old unchecked README TODO with one plain lineage entry; superseded minutes are history and never become implementation authority. When the correction resolves a Model Challenge, the new ready result also cites the frozen Tactical Design draft so Tactical Design can rebase it. If any unimplemented ready Tactical Design instead names a newly superseded minutes record, route to Tactical Design to replace or retire that invalidated authority and its Architecture sources before Codify.

Render every affected terminal document from the confirmed minutes and repository policy, stage and validate the whole consistency set outside the project workspace, recheck observed pre-states, then apply it once through `maintain-artifacts.apply-ready-event-storming`. Keep the complete diagram in the minutes and do not introduce new domain meaning while projecting durable conclusions into Models.

For a confirmed context-boundary change, keep existing BC Architecture aligned mechanically: an identity-preserving rename may move the file and update only its owning-context label and navigation links, while a split, merge, or removal deletes the retired file from the current set. EventStorming never edits or reassigns its decision rows; any decision that must survive the new boundary returns to Tactical Design before Codify.

If document synchronization requires a semantic decision absent from the confirmed model, return that one decision to the EventStorming Board. Preserve historical ADR rationale and use a superseding ADR when repository policy requires it. Inspection alone never makes a source document writable, and external documents remain outside project scope.

## Completion

Finish with one of:

- `needs_clarification`: show the board delta and ask the one frontier question;
- `awaiting_confirmation`: summarize the integrated model, cite the canonical `draft` minutes path and fingerprint, and ask for explicit confirmation;
- `ready`: cite the confirmed scope, minutes path, changed Model revisions, Context Map validation, and synchronized documentation;
- `no_change`: cite the already confirmed model and current artifacts proving no change is needed;
- `blocked`: identify the authority, validation, transaction, or external failure and exact filesystem state.

The terminal outcome is a confirmed Model ready for a Design Delta check. Do not create Tactical Design merely because implementation follows. A `ready` result proceeds to Tactical Design only when a real Design Delta remains; otherwise it is ready for Codify.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) when reasoning about Workshop Events, language, authority, lifecycle, Aggregate boundaries, Bounded Contexts, abstraction pressure, or collaboration.
