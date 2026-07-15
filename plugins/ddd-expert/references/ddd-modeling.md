---
name: ddd-modeling
description: Language-neutral DDD guidance for Ubiquitous Language, subdomains, Bounded Contexts, authority, lifecycles, invariants, and model boundaries.
---

# DDD Modeling

This Knowledge Leaf combines established DDD concepts with focused reasoning
probes. It is informed by multiple mainstream DDD viewpoints; no single author
or school is its sole authority.

## Rule Strength

- **[DDD Principle]** A durable DDD meaning or boundary. Apply it through the accepted domain model rather than as a mechanical code rule.
- **[House Rule]** A conditional implementation or architecture constraint. It does not apply before its stated condition is true; once applicable, it is mandatory.
- **[Heuristic]** A question or pressure signal. It invites investigation and never proves a conclusion alone.

Unless a rule states a narrower condition, its House Rule applies to backend
design governed by `ddd-expert` when the stated model facts are established; it
does not require a separate rule-by-rule opt-in.

## Navigation

| Need | Section |
|---|---|
| Establish shared business language | Ubiquitous Language |
| Separate problem space from model boundaries | Subdomains and Bounded Contexts |
| Identify truth and decision owners | Authority |
| Describe relationships between contexts | Context Map |
| Reconstruct identity, facts, and closure | Lifecycle and Fact Timeline |
| Replay accepted scenarios into tactical candidates | Software Design EventStorming |
| Find invariants and Aggregate candidates | Consistency Boundaries |
| Place policy, orchestration, and mechanism | Capability Classification |

## 1. Ubiquitous Language

- **[DDD Principle]** A Bounded Context owns a coherent language shared by domain experts and implementers.
- **[DDD Principle]** The same term may have different meanings in different contexts. Translation is safer than forcing one enterprise-wide object model.
- **[DDD Principle]** Names in the Domain model, Application semantic contracts, and accepted design artifacts express business meaning rather than storage, transport, or vendor vocabulary. Adapter and Runtime names accurately expose the mechanisms they own.
- **[Heuristic]** Start with behavior: who initiates the story, what decision changes business state, what outcome becomes visible, and which exception matters?
- **[Heuristic]** Treat nouns copied from screens, tables, reports, or protocol schemas as unclassified evidence, not ready-made Entities.
- **[Heuristic]** Look for synonyms describing one fact, one noun with competing definitions, and state words whose authority or terminal meaning is unclear.

## 2. Subdomains and Bounded Contexts

- **[DDD Principle]** A Subdomain is part of the business problem space. A Bounded Context is a boundary within which one model and language apply. They are related but not necessarily one-to-one.
- **[Heuristic]** Classify Core, Supporting, or Generic Subdomains only when the distinction changes investment, ownership, sourcing, or boundary decisions.
- **[Heuristic]** Consider a boundary when language, authority, lifecycle, policy, model purpose, change cadence, or team ownership diverges.
- **[Heuristic]** Shared storage, deployment, UI, or technology does not prove one context; separate deployment does not prove two.
- **[Heuristic]** Ask whether a proposed context owns meaningful language and policy or merely wraps a vendor or technical mechanism.
- **[House Rule]** When two areas have distinct accepted language or authority, keep their Domain models separate and integrate through an explicit contract; shared deployment or storage does not waive this rule.

## 3. Authority

- **[DDD Principle]** Business authority owns a decision or fact. Data custody owns only a stored representation.
- **[DDD Principle]** A projection, cache, replica, or downstream consumer cannot grant rights that contradict the authoritative fact.
- **[Heuristic]** For each material fact, ask who proposes, confirms, changes, reverses, expires, and publishes it.
- **[Heuristic]** Distinguish command authority, confirmation authority, observation source, and storage owner when they differ.
- **[Heuristic]** If two contexts both appear to own a fact, identify whether they own different meanings, different lifecycle stages, or an unresolved boundary.
- **[House Rule]** When authority is external to the local context, represent the accepted external fact explicitly and translate it into local language at the boundary; do not import the external model as the local Domain model.

## 4. Context Map

Mainstream DDD includes symmetric collaboration patterns such as Partnership and jointly owned Shared Kernel. `ddd-expert` deliberately narrows that design space: its Context Map uses only one-way model and published-contract dependencies, and the complete graph must remain acyclic.

- **[House Rule]** Every Context Map edge is `U -> D`: upstream owns a named published contract whose meaning may influence the downstream model. It is not a runtime-call arrow.
- **[House Rule]** Self-loops, reciprocal edges, longer dependency cycles, bidirectional arrows, Partnership, and Shared Kernel are unsupported. Rework language, authority, ownership, or translation instead of drawing mutual dependency.
- **[House Rule]** Customer-Supplier, Conformist, Anti-Corruption Layer, and Open Host Service / Published Language may annotate an already established directional edge. They do not determine, reverse, or duplicate its direction. Separate Ways means no edge.
- **[House Rule]** Both ends name the same contract and endpoints: upstream records published meaning and guarantees; downstream records accepted meaning and local translation. Runtime request and response may travel through that one owned contract without creating a reverse edge.
- **[Heuristic]** Several contexts using the same capability do not form a Shared Kernel. If the capability owns coherent language, authority, or lifecycle, test it as an independent upstream supporting or generic context with fan-out consumers; a shared pure technical library is not itself a Bounded Context relationship.
- **[Heuristic]** Revisit an edge when consumer count, team power, change cadence, translation cost, or authority changes materially.

## 5. Lifecycle and Fact Timeline

- **[DDD Principle]** A lifecycle describes identity, admissible transitions, terminal conditions when they exist, and the authority behind each change.
- **[DDD Principle]** A past-tense business fact is modeling evidence; it is not automatically a Domain Event or Integration Message.
- **[Heuristic]** Reconstruct trigger or intent -> decision -> past-tense fact -> reaction, including reversal, cancellation, expiry, retry, compensation, and recovery where material.
- **[Heuristic]** Ask which facts are business-visible, durable, externally confirmed, repeated, or only useful for a projection or audit.
- **[Heuristic]** Separate the lifecycle of a business obligation from execution facts of external work when either can advance independently.
- **[Heuristic]** Check whether a candidate is an Entity, immutable snapshot, attribute, read model, external representation, or durable process state before choosing a tactical type.
- **[Heuristic]** Do not infer precedence between conflicting state words. Identify the authoritative fact and the rights it grants or removes.
- **[House Rule]** When accepted facts establish material discrete transitions, the authoritative Design representation records `From`, `Intent`, `Authority`, `Guard`, `To`, and `Established Fact`. A diagram may aid reading but does not replace those semantics.
- **[House Rule]** Use a fact timeline, lineage, derivation rule, or another fitting representation when an immutable object, append-only history, derived state, or orthogonal state dimensions would make one finite-state machine artificial.
- **[House Rule]** Keep an Aggregate's business lifecycle and a Process Manager's coordination lifecycle distinct. Execution mechanics remain attached correctness constraints unless their state changes business eligibility, rights, or outcomes.

## 6. Software Design EventStorming

Software Design EventStorming is a collaborative tactical analysis of accepted scenarios. Commands expose intent, Aggregate decisions expose invariant ownership, past-tense facts expose outcomes, policies expose reactions, and Process Managers expose durable coordination. Read models and external systems reveal information and boundary needs without becoming Domain objects by default.

- **[House Rule]** EventStorming uses the board to discover and challenge tactical candidates before proposing a Design; it does not treat the first arrangement of notes as a design conclusion.
- **[House Rule]** Boards, sticky-note inventories, hot-spot notes, and alternative drafts are temporary working material. Persist only the accepted stable design and the evidence needed to review it.
- **[DDD Principle]** An event used during analysis is evidence that something happened. It does not by itself require a Domain Event type, an Integration Message, asynchronous delivery, Event Sourcing, or an event-driven implementation architecture.
- **[Heuristic]** Mark a hot spot where authority, invariant ownership, lifecycle, consistency, or failure semantics admit more than one credible tactical answer. A hot spot is a prompt for one design decision, not a document checkpoint.
- **[House Rule]** A replay that exposes a missing business fact is not ready for tactical placement. When accepted facts are complete, tactical placement and mechanism may be resolved without inventing new business meaning.

## 7. Consistency Boundaries

- **[DDD Principle]** An invariant states what must be true at a defined consistency boundary. A policy states how the business decides or reacts.
- **[DDD Principle]** An Aggregate is a consistency and mutation boundary governed by one root; table shape and transaction shape do not define it.
- **[Heuristic]** Ask what must be true immediately after the command and what invalid state cannot be repaired by retry, compensation, reconciliation, or a later reaction.
- **[Heuristic]** Ask what can change independently, what has its own lifecycle, and what external actors reference directly.
- **[Heuristic]** Independent lifecycle, different authority, unbounded collections, and high write contention pressure a boundary toward separate Aggregates.
- **[Heuristic]** Cross-table persistence may represent one Aggregate; one database transaction across several objects does not prove one Aggregate.
- **[House Rule]** Model candidates as separate Aggregates when the accepted facts establish independent identity, lifecycle, authority, or direct external reference and no invariant requires their atomic mutation. Absence of a cross-object invariant alone does not split an owned Entity or Value Object from its root.
- **[House Rule]** When an accepted invariant does require immediate consistency, choose the smallest Aggregate boundary that protects it without loading or locking an unbounded graph.
- **[House Rule]** For every new or materially changed non-trivial Aggregate, state a boundary thesis linking its owned state to the invariant it protects. When a credible split or merge alternative exists, test it against a concrete invariant, concurrency, or failure scenario; do not manufacture an alternative for a self-evident boundary.
- **[Heuristic]** A use case that appears to require one atomic transaction across Aggregate Roots is a boundary alarm. Recheck whether one invariant truly requires immediate consistency, whether the roots should merge, or whether an explicit recoverable process preserves the business outcome before accepting a multi-root transaction.
- **[Heuristic]** An Aggregate Map communicates Roots, owned Entities and Value Objects, and identity-only cross-root references. A database ERD may document a design-significant persistence view, but cannot prove the Domain boundary.

## 8. Capability Classification

- **[DDD Principle]** Stable business language, admission, ownership, eligibility, state, and derivation rules belong to the Domain model even when their subject sounds technical.
- **[DDD Principle]** Use-case sequencing and coordination of already-modeled behavior belong to Application.
- **[House Rule]** Durable coordination state and transition rules for an accepted Process Manager belong to Application. Protocol, persistence, SDK, topology, timer, retry-runner, scheduling, and process-runtime lifecycle mechanics remain in outer adapters or Runtime.
- **[Heuristic]** Separate routing policy from address lookup, scheduling policy from timer mechanics, and ownership rules from lease storage.
- **[Heuristic]** Before naming a Service, Repository, port, handler, task, or Process Manager, ask who owns its rule, state, transaction, retry, and recovery.
- **[Heuristic]** An important Domain judgment with no natural Entity or Value Object owner points toward a Domain Policy or Domain Service. Durable cross-step progress points toward a Process Manager. Mechanical forwarding remains implementation wiring.
- **[Heuristic]** Technology-shaped names and many unrelated dependencies are placement pressure, not automatic violations.
- **[House Rule]** When an inner responsibility needs an external capability, define the contract in the inner caller's language and adapt the mechanism outside it.

## Related References

- [ddd-core.md](ddd-core.md) for DDD tactical building blocks and the integrated DDD + Clean Architecture baseline.
- [ddd-collaboration.md](ddd-collaboration.md) for cross-context contracts and long-running collaboration.
