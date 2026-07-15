---
name: event-storming
description: Use when a backend user story, business scenario, specification, or existing domain model must be taken through proportionate EventStorming to accepted Strategic Modeling and Tactical Design, or when the requested outcome explicitly stops at Strategic Modeling.
---

# Event Storming

Use one continuous modeling conversation from product evidence to either a ready Strategic Model or a `codify_ready` Tactical Design. Big Picture and Process Modelling feed one convergence loop; Software Design EventStorming is its tactical zoom, not a separate skill or user-orchestrated phase.

The default outcome is a codify-ready design. Stop after Strategic Modeling only when the original request explicitly asks for business discovery, Bounded Contexts, a Context Map, or Domain Models without Tactical Design.

## Modeling and artifact authority

This skill is the exclusive semantic authorizer of root README, Context Map, Model, and Design changes. It never writes DDD artifacts directly. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute its `inspect`, `apply-model`, or `apply-design` operation in the same run with authority `event-storming`.

Operation boundaries preserve meaning inside the single skill:

- `apply-model` may contain only accepted business language, authority, lifecycle, rules, Bounded Contexts, dependencies, and readiness; it never writes a Design.
- `apply-design` may contain only accepted tactical realizations of current Models at their exact revisions; it never changes Model meaning.

In this skill, **accepted** means authoritative enough to persist, not necessarily approved by the user in a separate ceremony. Business meaning is accepted only when established by supplied authority or confirmed by a domain authority. A tactical realization is accepted when it follows from that business meaning, applicable constraints, and a justified DDD choice made by this skill; explicit user acceptance is required only for a remaining user-owned tradeoff that changes a business-visible guarantee, risk, or constraint.

Models and Designs separate acceptance from completeness. `model_status: evolving` and `design_status: evolving` contain accepted statements while material scoped work remains. `model_status: shape_ready` and `design_status: codify_ready` mean their respective replay passed. A statusless legacy artifact contains accepted content but has unproved readiness and must be replayed before Codify may use it.

## Working board and discovery units

The EventStorming board, sticky-note inventory, candidate boundaries, alternatives, hotspots, and source-coverage ledger are temporary working material. Persist only accepted stable Model and Design meaning.

- A **Scenario Thread** follows one end-to-end business path. It connects triggering facts and decision-time information to an authorized actor or external trigger, intent or command, decision or policy, established business fact, changed rights, obligations, or value, affected people or contexts, subsequent reactions, and a stable business outcome.
- A **hotspot** is a visible gap, contradiction, assumption, risk, or deferred branch in that story. It may be resolved by existing evidence, a domain example or counterexample, a user answer, replay, or a design experiment; it is not automatically a user decision or artifact checkpoint.

A scoped Scenario Thread is complete enough to converge when it can be narrated as: `Given <triggering facts and available information>, <authorized actor or external trigger> issues <intent>, <decision or policy> establishes <business fact>, which changes <rights, obligations, value, or the next reaction>, until <stable business outcome>`. Require this coherence for material paths and model-changing exceptions, not every imaginable detail. Big Picture discovery may deliberately leave named Hotspots; Process Modelling and Software Design close the Hotspots required by the requested outcome.

For a long evidence set only, keep temporary coverage notes using existing IDs or short locators so material scenarios do not disappear. Never require or invent Story IDs.

Events placed during discovery are evidence that something happened. They are not automatically Domain Event types, Integration Messages, asynchronous delivery, Event Sourcing, or event-driven architecture. Commands initially express business intent, not handler or DTO types. Actors and external systems expose authority and boundary pressure without becoming Domain objects or Bounded Contexts by default.

Models record accepted business meaning and its authority; they are not discovery transcripts or ledgers of rejected candidates. Do not promote or preserve a source noun merely because it was named. Use a deletion test as a restraint heuristic: if removing the name loses no accepted authority, identity, lifecycle, rule, or distinct scenario outcome, omit it rather than recording why it was rejected.

## EventStorming workflow

Run these steps as a loop, not a ceremony. A simple change inside an accepted context may make several steps one sentence. Completeness comes from source coverage and final replay, not from producing visible output for every board dimension.

1. **Orient and set the modeling range**: inspect the artifact root, request, material evidence and scenarios, relevant code and tests, Context Map, Models, and Designs. Treat feature prose, Gherkin, ADRs, tickets, incidents, architecture, conversation, and code as evidence; code shows current behavior but is never business authority by itself. Frame the affected end-to-end Scenario Threads and a temporary readiness view. In an existing model, begin with the affected accepted Bounded Context and its immediate dependency neighbors. In an uninitialized model, do not assume a context inventory in advance.
2. **Build the event timeline**: shallow-scan the scoped evidence, place material business outcomes and past-tense facts, and order them by business time. Work backward to triggering intents and actors, then forward through decisions, reactions, and accounted outcomes. Replay failure, duplicate, cancellation, expiry, recovery, and concurrency paths only when they change business meaning.
3. **Add commands, roles, systems, rules, and hotspots**: enrich the timeline with business commands or intents, initiating roles, decision-time information, external authorities, policies, invariants, handoffs, affected stakeholders or contexts, and ambiguity markers. Distinguish who proposes, confirms, changes, reverses, expires, and publishes each material fact; what they know when deciding; and whose rights, obligations, value, or next action changes. Skip board dimensions irrelevant to the current Scenario Thread.
4. **Discover model boundaries**: cluster behavior around temporary object, responsibility, and Aggregate candidates, then group responsibilities where one coherent model and language can accommodate their related authorities, lifecycles, policies, and purposes. Contexts emerge from semantic divergence, not merely from too many objects. Test candidate Aggregates inside each candidate context against invariants, immediate consistency, concurrency, and failure; feed the result back into object ownership and context boundaries until both cohere. In an existing project, place new facts in the accepted context while its model still fits; reopen the boundary only for sustained translation, conflicting meanings or authority, independently evolving policy or lifecycle, or incompatible model purpose. Challenge a merge, split, or deletion only when real pressure exists. An Aggregate candidate may help reveal a context, but becomes accepted Tactical Design only after contextual coherence. Never persist candidate clusters or infer a boundary from names, tables, packages, services, teams, storage, calls, or transaction shape.
5. **Establish context collaboration**: for every affected dependency, name the upstream-owned contract, published meaning and guarantee, downstream accepted meaning and local translation, and material failure or recovery meaning. The Context Map's Global View uses one-way `U -> D` model influence and must remain a DAG; runtime request/response does not create a reverse dependency. Each context's Local View is one fenced `text` ASCII wireframe containing that context and exactly its direct neighbors. Draw strict ASCII boxes joined by dependency arrows from upstream to downstream; do not add U/D labels, use Mermaid, or render one relationship per Markdown line. Apply no Partnership, Shared Kernel, reciprocal edge, or inferred contract.
6. **Run Software Design EventStorming**: within accepted or currently coherent contexts, replay each material scenario as `triggering facts and visible information -> actor or trigger -> intent or command -> Aggregate decision -> established fact -> changed rights, obligations, or value -> affected actor, context, policy, or Process Manager -> next intent -> stable business outcome`. Classify tactical objects, local Domain Events, cross-context Integration Messages, Domain Policies, Domain Services, Process Managers, and external references from accepted semantics rather than implementation shape.
7. **Challenge the Tactical Design**: assign each invariant to the smallest sound Aggregate boundary. For every new or materially changed non-trivial Aggregate, state its boundary thesis and test the closest credible split, merge, or deletion against a concrete invariant, concurrency, or failure path. Spell out material transitions or derivations and terminal rules; use a transition table only for a discrete lifecycle and a fact timeline, lineage, derivation rule, or clearer representation otherwise. Retain an Entity, Value Object, Domain Service, Policy, or Process Manager only when an accepted obligation needs its identity, lifecycle, consistency, authority, or recovery ownership. Leave schemas, DTOs, file lists, routine Repository flow, framework wiring, and implementation steps to Codify unless they change an accepted guarantee.

## Convergence protocol

These rules apply throughout the seven-step loop:

1. **Stay proportionate**: the board, candidates, alternatives, hotspots, and coverage notes are temporary. Expand only the dimensions, exception paths, and alternatives that could change a material conclusion; do not perform or report a checklist for its own sake.
2. **Use questions to advance the model**: first apply every independent accepted slice, then continue the simplest coherent baseline while non-blocking uncertainty remains visible as Hotspots. Ask only when the answer belongs to the user or a domain authority and can materially change a scoped Scenario Thread, Model, boundary, dependency, or business-visible guarantee. Focus one coherent Hotspot per turn, not one grammatical interrogative: linked subquestions may close the same causal gap, but never bundle independent Hotspots.
   - A **modeling probe** asks for a fact, example, or counterexample that fills or challenges a missing trigger, available information, actor or authority, intent, decision rule, established fact, affected party, reaction, exception, or stable outcome. Prefer concrete business language and challenge claims such as `always`, `never`, and `immediately`. Do not manufacture a binary choice or provide a recommendation when discovering what the business does.
   - A **decision proposal** is appropriate only when credible alternatives would change an accepted business-visible guarantee, risk, or constraint that the user owns. State the relevant scenario evidence, recommend one choice, and explain the closest alternative's material tradeoff. Do not block merely to obtain approval for a DDD label, Aggregate boundary, lifecycle notation, event classification, or persistence mechanism when accepted semantics and constraints already let this skill choose and challenge the smallest sound design.
   - A question is worthwhile only when plausible answers would produce different board or artifact deltas. Make it self-contained enough to identify the Scenario Thread, visible gap, and why the answer matters, but do not restate every accepted fact inside the question. Preserve exact Ubiquitous Language and limiting semantics such as `only`, `never`, `at most`, terminality, and same-established-outcome guarantees in the working model and accepted artifacts. Never hide context needed to understand a proposal only in verification metadata or internal notes.
   For a semantic gap, first invalidate any affected `shape_ready` Model to `evolving` with a status-only `apply-model`. Never ask the user to choose a DDD label.
3. **Apply accepted slices immediately**: replay the affected Scenario Thread, state the exact semantic or tactical delta, and run `apply-model` or `apply-design` for its smallest consistency closure. A local decision normally changes one Model or Design; context inventory, dependency, or contract decisions include only their semantically coupled artifacts. Advance each changed Model revision once for that accepted semantic slice. Use `evolving` while material work remains; never wait for unrelated hotspots or introduce a decision during artifact generation.
4. **Loop and prove readiness by replay**: when Tactical Design exposes missing language, authority, lifecycle, or a faulty context boundary, return to the relevant earlier step inside this skill, apply only an accepted Model slice, re-inspect, invalidate only affected conclusions, and resume without reopening accepted decisions. Keep Models `evolving` until every material scoped scenario and semantic hotspot is covered, the Context Map is valid and acyclic, and affected Models agree; then promote them to `shape_ready` without advancing semantic revision. If the request explicitly stops at Strategic Modeling, finish there. Otherwise map every material Model obligation to its accepted realization, keep Designs `evolving` while any material tactical question remains, and promote independent or coupled closures to `codify_ready` only when complete replay adds no new decision. Do not request duplicate integrated acceptance.

## Tactical Design artifact

The Design is the current accepted target state, not a feature narrative, change log, ADR summary, task plan, board transcript, or implementation report. Include only material DDD design:

- a compact `Model Realization` from every accepted Model obligation to its accepted owner or mechanism and defining section; an `evolving` Design omits unresolved realizations, while a `codify_ready` Design covers all material obligations;
- Aggregate boundaries, invariant ownership, identity, retained Entities and Value Objects, behavior, lifecycle, Domain Events, concurrency, failure, and boundary evidence;
- policies, Domain Services, durable Process Managers, context contracts, technical constraints, and verification obligations only when accepted correctness requires them.

Define every retained Entity's identity, owner, and lifecycle scope, and every Value Object's meaning, accepted validity rule, and equality semantics. Scheduled, asynchronous, and recovery work has a semantic owner that chooses outcomes; name a separate execution owner only when delivery, concurrency, retry, or execution lifecycle is design-significant.

Do not manufacture Verification Obligations during readiness replay. Persist one only when a design-significant evidence requirement was already accepted. Routine test and evidence selection belongs to Codify and does not block design readiness.

## Readiness and modeling conversation

The readiness view is working state, not a DDD artifact. Surface it when applying a slice, changing readiness, resuming a long conversation, reporting completion, or when the user asks for progress. Keep the following four facts available, but express them naturally; a compact block is optional:

```text
Applied: <accepted semantic and tactical slices>
Active: <one coherent Hotspot or none>
Remaining: <material semantic/tactical obligations or none>
State: model_open | model_ready | design_open | codify_ready
```

For a blocking Hotspot, briefly anchor the relevant Scenario Thread fragment and ask naturally:

- for a modeling probe, expose the missing or contradictory causal edge and ask for the fact, example, or counterexample needed to update the story;
- for a decision proposal, include a concrete recommendation, the closest credible alternative, and the business-visible tradeoff before asking for the owned decision.

There is no required punctuation, heading sequence, or number of subordinate questions. Brevity is useful, but closing one coherent Hotspot is more important than forcing a compound business question into extra turns. A short exchange may report readiness in one sentence; status must not turn the conversation into an approval ceremony.

`codify_ready` requires every material Model obligation to be accounted for, every applicable design choice resolved and justified under the authority rule above, every affected Model `shape_ready`, every affected Design bound to the exact current Model revision, and no business fact or semantic design left for Codify to choose. Scope exclusions are valid only when the original request or an explicit user decision establishes them and resolving them cannot change the handoff.

## Controlled legacy Context Map migration

Before replacing a retired legacy Context Map, inspect the complete DDD artifact root: include the Map, every Model still using `## Context Relationships`, and the root README when it still says `Context relationships are authoritative`. Because the retired graph cannot expose a safe partial replacement, present and obtain acceptance of one complete migration target, declare `context_map_migration: true`, and apply that coordinated set once. Any omitted legacy artifact or current invalidity that prevents validating the migration blocks it.

## Completion

Finish with one of:

- `progressed`: one or more accepted Model or Design slices were applied and scoped work remains; name changed paths, revisions, readiness, and the next active obligation;
- `model_ready`: the explicitly Strategic-only outcome is `shape_ready`; cite affected contexts and revisions and stop;
- `changed`: the requested full outcome is `codify_ready`; name exact Models, Designs, revisions, and readiness evidence;
- `no_change`: existing accepted artifacts already satisfy the requested outcome; cite them;
- `needs_clarification`: show readiness and the active Hotspot, ask the focused modeling probe or decision proposal, and write no unaccepted answer;
- `blocked`: an external constraint prevents inspection, an accepted transaction, or readiness verification; state exact evidence.

Keep the final response short. Do not produce a separate phase handoff or tell the user to invoke another modeling skill.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for language, authority, lifecycle, Bounded Contexts, Context Maps, Software Design EventStorming, and Aggregate-boundary reasoning.
- Load [../../references/ddd-core.md](../../references/ddd-core.md) only when tactical placement needs Aggregate, Entity, Value Object, Domain Service, Repository, or Clean Architecture detail.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) only for event classification, cross-context collaboration, Process Managers, timing, or recovery.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md). For Python or TypeScript, load only the relevant compact language section.
- Load [../../references/database.md](../../references/database.md) only when persistence capabilities constrain an accepted consistency or transaction boundary.
