---
name: ddd-modeling
description: Language-neutral strategic DDD guidance for EventStorming, Ubiquitous Language, authority, Aggregate candidates, Bounded Contexts, lifecycles, and collaboration views.
---

# DDD Modeling

Use this reference to reason about business meaning. It does not authorize project writes, choose implementation mechanisms, or turn an EventStorming board into Tactical Design.

## Rule strength

- **[DDD Principle]** A durable DDD meaning or boundary supported by domain evidence.
- **[House Rule]** A deliberate `ddd-expert` modeling constraint. Apply it only when its stated concern is present; once applicable, preserve it consistently.
- **[Heuristic]** A question or pressure signal. It invites investigation and never proves a conclusion alone.

## 1. Event-first causal modeling

- **[DDD Principle]** A Domain Event names a business fact that has already happened. Use past tense and business language.
- **[Heuristic]** Start by asking what outcome became true, not which page, service, table, message, or class exists.
- **[Heuristic]** Order material events in business time, then work backward to Commands and actors and forward through policies, reactions, and stable outcomes.
- **[DDD Principle]** A Command expresses an actor's intent; a policy or rule explains why the business admits, rejects, derives, or reacts; an Event states the resulting fact.
- **[House Rule]** An EventStorming event is analytical evidence, not automatic authority for a Domain Event class, Integration Message, asynchronous transport, Event Sourcing, or event-driven architecture.
- **[Heuristic]** Replay failure, duplication, cancellation, expiry, recovery, and concurrency only when they could change business meaning.

## 2. Ubiquitous Language

- **[DDD Principle]** A Bounded Context owns a coherent language shared by domain experts and implementers.
- **[DDD Principle]** The same term may have different meanings in different contexts. Explicit translation is safer than one forced enterprise object model.
- **[Heuristic]** Look for synonyms describing one fact, one noun with competing definitions, and state words whose authority or terminal meaning is unclear.
- **[Heuristic]** Treat nouns copied from screens, schemas, protocols, packages, and current code as evidence, not ready-made business objects.
- **[House Rule]** Retain a term in the confirmed Model only when it carries supported authority, identity, lifecycle, rule, or a distinct scenario outcome.

## 3. Authority

- **[DDD Principle]** Every material fact has an authority: the role, policy, context, or external source entitled to establish it.
- **[Heuristic]** Ask who proposes, decides, confirms, changes, reverses, expires, observes, and publishes a fact; these may be different authorities.
- **[Heuristic]** Record what information the decision maker has at decision time and whose rights, obligations, value, or next action changes.
- **[House Rule]** Code and current storage prove observed behavior, not business authority. Conflicts between code and an authoritative business source remain visible until resolved.
- **[House Rule]** When authority is external to a local context, represent the accepted external fact and translate it at the boundary instead of importing the external model as local Domain language.

## 4. Lifecycle and fact timeline

- **[DDD Principle]** Identity is continuity across change. A lifecycle explains creation, material transitions or derivations, and terminal or archival meaning.
- **[Heuristic]** For each state word, identify the event that establishes it, prior facts required, actions it enables or forbids, and whether it can be reversed, superseded, or expire.
- **[Heuristic]** Distinguish a business obligation's lifecycle from execution facts when either can advance independently.
- **[Heuristic]** Use a transition table for genuinely discrete state changes; use a fact timeline, lineage, derivation, or orthogonal dimensions when an FSM would be artificial.
- **[House Rule]** Preserve limiting semantics such as `only`, `never`, `at most`, terminality, and same-outcome guarantees across diagrams and prose.

## 5. Aggregates and core business objects

- **[DDD Principle]** An Aggregate is a consistency and mutation boundary governed by one root. Table joins, packages, RPCs, and current transaction shape do not define it.
- **[Heuristic]** Ask what must be true immediately after a Command and which invalid state cannot safely wait for retry, compensation, reconciliation, or a later reaction.
- **[Heuristic]** Independent identity, lifecycle, authority, external reference, unbounded collections, and high write contention pressure objects toward separate Aggregates.
- **[House Rule]** Choose the smallest Aggregate candidate that protects each supported immediate invariant. Do not split an owned Entity or Value Object merely because no cross-object invariant was mentioned.
- **[Heuristic]** For a non-trivial Aggregate, state a boundary thesis and test the closest credible split, merge, or deletion against one concrete invariant, concurrency path, or failure scenario.
- **[House Rule]** Strategic EventStorming may confirm an Aggregate boundary and root but does not invent Repository APIs, schemas, handlers, DTOs, Process Managers, or other tactical realization.
- **[House Rule]** A Bounded Context model with no supported identity, invariant, lifecycle, or concurrency boundary records an explicit evidence-based `No supported Aggregate` result. Never fabricate an Aggregate to satisfy a template; Aggregate-scoped confirmation is unavailable until an Aggregate is supported.

## 6. Bounded Contexts and abstraction pressure

- **[DDD Principle]** A Subdomain is part of the problem space. A Bounded Context is a boundary within which one model and language apply; they are not necessarily one-to-one.
- **[Heuristic]** Consider a context boundary when language, authority, lifecycle, policy, model purpose, change cadence, or organizational ownership diverges materially.
- **[Heuristic]** Name a context for its supported business authority and model. A process, use-case, feature, or scenario label does not establish a narrower context unless it also has independent language, authority, lifecycle, or model purpose.
- **[Heuristic]** Shared storage, deployment, UI, library, or technology does not prove one context. Separate deployment, package, or service does not prove two.
- **[House Rule]** Never promote a vendor, runtime, framework component, or technical mechanism to a Bounded Context without supported business language, authority, lifecycle, and model purpose.
- **[Heuristic]** When several areas appear to repeat one mechanism, compare:
  1. one shared domain mechanism with coherent language, lifecycle, rules, and business ownership;
  2. one shared technical Module that owns no business decision; and
  3. distinct local semantics connected through translations.
- **[House Rule]** Choose shared domain ownership only when the semantic evidence is genuinely common. Choose local models when similar shapes hide different authorities or lifecycles. Technical reuse never requires a shared Domain model.

### Repetition and abstraction pressure

- **[Heuristic]** Apply DRY to duplicated knowledge and sources of truth, not merely repeated syntax or similarly shaped call chains.
- **[Heuristic]** Cohesion and SRP favor one owner when the behavior changes for the same reason; they favor separation when callers have independent policy, lifecycle, or release pressure.
- **[Heuristic]** A shared technical Module earns its seam when a small Interface hides meaningful complexity, gives several callers leverage, and concentrates change locally. A pass-through wrapper or hypothetical future reuse is not depth.
- **[Heuristic]** Balance common reuse against coupling: a shared Module is harmful when callers must coordinate for rules they do not share or learn an Interface nearly as complex as their local implementations.
- **[Heuristic]** YAGNI and avoidance of hasty abstraction restrain extraction until observed variation supports a stable seam. Deliberate local duplication can be cheaper than the wrong shared abstraction.
- **[Heuristic]** Treat these principles as competing design forces, not a scorecard: none has automatic precedence, and the relevant evidence and tradeoff must be stated for the concrete mechanism.
- **[House Rule]** These software-design principles decide whether and where a shared seam may pay for itself. They do not establish business language, authority, lifecycle, or a Bounded Context; domain evidence still decides those.

## 7. Context collaboration

Mainstream DDD includes symmetric patterns such as Partnership and Shared Kernel. `ddd-expert` deliberately uses an acyclic semantic dependency map and models runtime/business interaction separately.

- **[House Rule]** A Model Dependency edge is `U -> D`: upstream owns a named published meaning or contract whose model may influence the downstream model. It is not a runtime-call arrow.
- **[House Rule]** Model Dependency self-loops, reciprocal edges, longer cycles, bidirectional arrows, Partnership, and Shared Kernel are unsupported. Rework authority, language, ownership, or translation rather than drawing mutual semantic dependency.
- **[House Rule]** Both ends of a dependency name the same contract and endpoints: upstream states published meaning and guarantee; downstream states accepted meaning and local translation.
- **[House Rule]** An Interaction edge is `initiator -> receiver` between accepted project Bounded Contexts and records a runtime or business exchange, including trigger or intent and result or failure feedback. It may oppose a Model Dependency and may participate in a cycle. External actors, systems, and technical components stay on EventStorming views unless independent business evidence establishes them as contexts.
- **[DDD Principle]** Request/response direction does not decide model ownership. One interaction can use an upstream-owned or downstream-owned semantic contract without adding a reverse model dependency.
- **[Heuristic]** Revisit a dependency when authority, consumer count, translation cost, change cadence, or guarantees change materially.

### Canonical Local View wireframes

Local View connectors are validated syntax: connector cells touch the context boxes, and a multi-neighbor view uses one connected branch rather than several unrelated arrows. Use these shapes and substitute the confirmed context names without adding spaces between a box and its connector.

One dependency:

```text
+---+   +---+
| A |-->| B |
+---+   +---+
```

Fan-out from the current context:

```text
+---+         +---+
| A |--+----->| B |
+---+  |      +---+
       |
       |      +---+
       +----->| C |
              +---+
```

Fan-in to the current context:

```text
+---+
| B |--+
+---+  |
       |
+---+  |      +---+
| C |--+----->| A |
+---+         +---+
```

## 8. Constructive challenge, Hotspots, and confirmation

- **[DDD Principle]** A Hotspot makes a gap, contradiction, ambiguity, assumption, risk, or deferred branch visible. It is valuable modeling output, not a defect to hide.
- **[Heuristic]** Challenge the weakest material assumption with the strongest credible alternative or counterexample. Stop when further cases have diminishing decision value rather than trying to exhaust every theoretical path.
- **[Heuristic]** Ask a fact, example, or counterexample only when plausible answers would materially change the causal story, language, authority, Aggregate, context boundary, or collaboration.
- **[Heuristic]** Use participant/authority, scenario variation, and model pressure as complementary perspectives. Select only the perspective that can change the current decision.
- **[House Rule]** Supported individual facts do not make their aggregate composition authoritative. Local answers are working confirmations; final confirmation applies to the exact integrated scope, views, decisions, assumptions, and non-blocking Hotspots the user saw.
- **[House Rule]** An Aggregate-scoped confirmation cannot silently authorize its whole Bounded Context; a context-scoped confirmation cannot silently authorize a cross-context topology.
- **[House Rule]** A corrected integrated model replaces the previous candidate as a whole. Do not combine partial acceptance of an older diagram with an unseen revision.
- **[House Rule]** A blocking Hotspot has a plausible answer that would change an in-scope timeline, material rule, Aggregate, Bounded Context, or collaboration direction. Resolve it or narrow the scope before confirmation; retain non-blocking Hotspots explicitly.
- **[Heuristic]** A model is ready to present when material Scenario Threads are coherent, all ten EventStorming dimensions relevant to the scope are visible, the strongest known model-changing alternatives were tested, collaboration views are distinct, and remaining uncertainty is explicit.
