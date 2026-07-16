# ADR 0003: EventStorming Is an Adversarial HITP Modeling Process

- Status: Accepted
- Date: 2026-07-16
- Supersedes: the EventStorming modeling, acceptance, and artifact-write decisions in [ADR 0001: ddd-expert uses progressive reference knowledge leaves](0001-ddd-expert-reference-architecture.md)

## Context

The first unified `event-storming` workflow treated evidence-supported facts or locally answered questions as accepted artifact slices. It wrote Models and Tactical Design while discovery was still in progress. That allowed a locally plausible answer to solidify an incorrect Aggregate, Bounded Context, or Context Map before one complete business timeline had been discussed.

A later hotfix moved to whole-model confirmation, but over-corrected toward a content-addressed Confirmation Package, pre-confirmation Documentation Impact Set, exact semantic deltas, validator receipts, and behavior cases scored through expected words or conclusions. That machinery made the evaluation surface more precise without making the domain model more reasonable. It also shifted attention from the Skill's collaboration behavior to proving that generated prose resembled an oracle.

An LLM cannot reliably establish a scientifically correct domain model from incomplete project evidence without domain participants. EventStorming is therefore treated as a human-in-the-process knowledge-discovery method. The LLM contributes architectural judgment, investigation, alternatives, and challenge; the user remains the domain decision authority.

## Decision

Keep one public `event-storming` skill and adopt the following contract.

### Ten-step discovery

Run the standard ten steps in order:

1. clarify modeling scope;
2. place past-tense Domain Events first;
3. arrange the event timeline;
4. find Commands;
5. add actors and external systems;
6. mark business rules and policies;
7. mark problems and ambiguities;
8. identify Aggregates and core business objects;
9. identify Bounded Contexts; and
10. establish context collaboration.

The current frontier orders questions within a step. Later-step ideas may be retained as hypotheses but cannot be decided before their evidence exists. A step advances when its working model is coherent, key contradictions are handled, and remaining uncertainty is explicit. New evidence reopens the earliest affected step.

### EventStorming Board

Keep all pre-confirmation work on a temporary EventStorming Board, separate from Aggregates, Bounded Contexts, and the Context Map. It tracks scope, current step, Supported Modeling Facts, Working Confirmations, the frontier question, Hotspots, fog, and out-of-scope areas.

Show board deltas during ordinary turns and the complete low-resolution board at step transitions, model reversals, resumptions, and integrated confirmation. Project files remain byte-identical while the board evolves.

### Adversarial HITP conversation

Investigate facts available in project evidence instead of asking the user to retrieve them. Present discovered information in useful groups, but put only one frontier decision to the user per turn.

- A fact probe presents evidence and asks openly for the missing business fact, example, or counterexample.
- A design proposal presents the Supported Modeling Facts and tension, recommends one answer with reasons, steelmans the strongest credible alternative, and asks for one decision.
- User disagreement triggers evidence gathering and scenario replay. The facilitator changes its recommendation when evidence warrants it; otherwise it preserves the professional objection and consequences. The informed user has final authority.
- When neither party can answer, the gap remains a Hotspot rather than becoming invented certainty.

Select challenges from participant/authority, scenario variation, and model-pressure perspectives. Challenge the weakest material assumption and stop when the strongest known counterexample has been considered and further cases have diminishing decision value.

Local answers are Working Confirmations and may be reopened. Only explicit acceptance of the current complete integrated model is Integrated Model Confirmation.

### Integrated model

After all ten steps, present the exact scope and exclusions, complete EventStorming diagrams, strategic conclusions, key decisions and reasons, assumptions, and non-blocking Hotspots. Blocking Hotspots must be resolved or removed by narrowing scope.

The diagram is a first-class confirmed artifact. Each affected `model.md` persists its exact confirmed EventStorming source. Cross-context work presents semantic Model Dependency (`U -> D`) separately from runtime/business Interaction (`initiator -> receiver`). Corrections replace the candidate as a whole and return to the affected step before confirmation is requested again.

The user confirms the domain model. The confirmation view does not contain a per-file Documentation Impact Set, exact semantic deltas, or validator fingerprints.

### Documentation closure

Integrated Model Confirmation authorizes EventStorming to derive and apply the minimal documentation consistency closure. Synchronize affected DDD artifacts and relevant project-owned living Specs, PRDs, ADRs, and Glossaries once after confirmation. If rendering requires a semantic decision absent from the confirmed model, return that decision to the EventStorming Board.

Stage and validate complete rendered terminal files outside the project workspace, recheck observed pre-states, and then apply supplied bytes through `maintain-artifacts`. Preserve historical ADR rationale and use a superseding ADR when repository policy requires it. Tactical Design remains read-only to EventStorming, including during context topology changes.

### Boundary judgment

Treat repeated behavior as abstraction pressure rather than automatic domain ownership. Apply DRY to duplicated knowledge and balance cohesion/SRP, information hiding, coupling, and YAGNI while comparing a shared domain mechanism, a shared technical Module, and distinct local semantics with translation. Business language, authority, lifecycle, policy, and model purpose determine Bounded Contexts.

Package names, services, runtime components, teams, tables, and call direction remain evidence rather than context boundaries. Model Dependency and Interaction remain separate projections so a chain such as `Agent Runtime -> Orchestrator -> Intent/Work` is investigated from its actual business and runtime evidence rather than inferred from existing package names.

### Strategic stop

EventStorming ends at `model_ready`. It does not create or rewrite Tactical Design and never claims `codify_ready`. Tactical realization requires separately accepted authority.

## Alternatives considered

- **Autonomous architect.** Rejected because incomplete evidence and hidden business knowledge make independently correct domain boundaries an unrealistic contract.
- **Incremental accepted slices.** Rejected because local confirmation cannot establish the validity of an integrated model.
- **Batch interview.** Rejected because it overwhelms the user and prevents answers from reshaping the next question.
- **User confirmation without challenge.** Rejected because HITP becomes a rubber stamp instead of knowledge discovery.
- **Pre-confirm every document change.** Rejected because it returns attention to file operations and recreates incremental approval. Model confirmation already authorizes faithful synchronization.
- **Architecture-answer behavior oracles.** Rejected because expected keywords or fixed BC conclusions reward phrase matching and cannot establish modeling quality.

## Consequences

- EventStorming takes more conversational turns than autonomous generation, but each turn resolves one material frontier decision.
- The facilitator may disagree with the user and preserve a professional objection, while the informed user retains final authority.
- The model may retain explicit non-blocking uncertainty instead of presenting false completeness.
- Project documents change once, after integrated confirmation, and stay synchronized without asking the user to approve a file inventory.
- Skill quality is judged primarily through the collaboration process and human review of representative transcripts. Automated checks remain limited to deterministic workflow and artifact invariants; they do not claim to grade architectural correctness.

## Verification

- Deterministic plugin tests check the ten-step order, frontier conversation contract, pre-confirmation write barrier, integrated diagram confirmation, documentation closure, strategic stop, and Claude/Codex mirroring.
- Model and Context Map validators check persistable structure and projection consistency only; they do not score domain wisdom.
- Representative HITP transcripts are reviewed manually for useful questions, credible alternatives, evidence-based corrections, and absence of invented domain authority. They are not release-gated by keyword matching.
