---
name: explore
description: Use when domain discovery must turn backend user stories or equivalent business scenarios into accepted facts before Tactical Design, or clarify business language, authority, lifecycle, rules, or bounded-context boundaries.
---

# Explore

Turn product evidence into one accepted, replayable business model that `shape` can design from.

## DDD model artifact

Explore is the exclusive semantic authorizer of root README, Context Map, and Model changes. It never writes DDD artifacts directly and never authorizes a Design change. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute its `inspect` or `apply-model` operation in the same run with authority `explore`.

The model describes the current accepted state, not a change log or discovery transcript. It contains only material DDD facts:

- ubiquitous language;
- bounded contexts, business authority, and directional context dependencies;
- scenarios, past-tense business facts, and lifecycle;
- invariants, policies, and decision ownership;
- business semantics for duplication, failure, cancellation, compensation, and recovery.

Read feature descriptions, prose, Gherkin, ADRs, tickets, acceptance criteria, incident narratives, architecture documents, implementation status, conversation, and code as evidence. An explicit authoritative business decision in the source may be accepted as a fact. A mechanism embedded in a specification or implementation -- such as a singleton, mailbox, storage choice, handler, or scheduler -- is a hypothesis unless the source explicitly makes it authoritative business meaning. Code is evidence of the current system, never business authority by itself. Tactical classifications and implementation decisions belong to `shape` and `codify`.

## Discovery units

- A **source item** is the coverage unit: one material scenario, decision, rule, or direct terminology or authority question. Preserve a source ID when one exists; otherwise use a short source locator. Never require or invent a Story ID.
- A **Scenario Thread** is the traversal unit: an end-to-end business path across the affected contexts from intent or accepted fact to decisions, established facts, changed rights or obligations, reactions, and accounted outcome.
- An unresolved business judgment is the question unit. Ask one such question at a time only when evidence leaves a real choice.

Maintain a temporary source-coverage ledger during a long discovery so no material source item is silently omitted. It may live in untracked scratch space while the run is active, but it is not a DDD artifact, receives no revision, and must be removed when the run ends. Report uncovered or deferred source items in the final response.

## Workflow

1. **Inspect accepted artifacts and evidence**: run the read-only artifact operation, read the request and the smallest relevant accepted artifacts, and shallow-scan every material source item before descending into one thread. Look up recorded facts before asking the user to restate them. An `invalid_layout` remains inspection evidence rather than migration authority. Before considering a retired legacy Context Map migration, override the usual narrow read and inspect the complete DDD artifact root: the legacy set is the Map, every Model in that root that still uses the retired `## Context Relationships` heading, and the root README when it still says `Context relationships are authoritative`. Use their readable content as defeasible evidence while deriving one complete replacement; every omitted legacy artifact or unrelated current artifact invalidity blocks apply.
2. **Reconstruct the current baseline when needed**: treat an existing Context Map as the defeasible baseline and reopen only boundaries affected by new evidence. When an existing system has no DDD artifacts, reconstruct a candidate current Bounded Context map from code, README, ADRs, architecture, APIs, and data ownership; explain the evidence and uncertainty, then obtain baseline confirmation before projecting a requested change. Make the confirmation question self-contained: summarize each candidate context's distinct business authority, the proposed directional dependencies, and the repository evidence and uncertainty that support them; never ask the user to accept an unseen "three-context baseline" or topology. Baseline confirmation establishes the working premise and never authorizes an intermediate artifact write or revision. If the task only documents the current model, present that baseline as the final integrated target and its acceptance may create revision 1. If a change is also requested, keep the confirmed baseline as working state and write only the final integrated target.
3. **Build and traverse Scenario Threads**: project every material source item through local language, authority, lifecycle, invariants or policies, accepted external facts, handoffs, and outcomes. Replay normal, failure, duplicate, cancellation, recovery, and concurrency paths only where they create a different model path. A direct language, authority, or boundary question needs no invented scenario.
4. **Derive or challenge boundaries from the threads**: assign every material decision and fact to one coherent language and business authority. Treat story grouping, packages, services, teams, storage, calls, and event timing as evidence rather than boundary proof or dependency direction. For each new or reopened boundary, test the closest credible merge or split alternative and explain which accepted language, authority, lifecycle, policy, or failure evidence rejects it. Multiple contexts using one execution capability do not create a Shared Kernel; when that capability owns distinct language or authority, model it as an independent upstream supporting or generic context with fan-out dependencies.
5. **Reconcile directional dependencies**: for every affected `U -> D` edge, name the upstream-owned contract, published meaning and guarantee, downstream accepted meaning and local translation, and material failure or recovery meaning. Runtime request/response does not create a reverse model dependency. If evidence implies a self-loop, reciprocal edge, or longer dependency cycle, do not normalize it into two arrows; reopen ownership and boundary reasoning.
6. **Ask only evidence-bearing questions**: state the evidence, the unresolved business judgment, and a recommendation briefly; ask exactly one focused question and end the turn. When an accepted artifact target omits observed legacy content, name the exact retired marker and omission, recommend completing the target while keeping files unchanged, then ask the one removal-or-retention decision needed to proceed. The recorded question itself must include that recommendation and zero-write consequence; a bare removal-or-retention question is incomplete. Do not ask the user to select a DDD label. When all material facts are already explicit and consistent, clarification may be unnecessary.
7. **Replay and expose one integrated proposal**: after all Scenario Threads close, replay their material paths against the proposed Context Map and Models. Present one integrated model proposal including affected contexts, language and authority, lifecycles and rules, dependency contracts, boundary alternatives considered, and any residual source-coverage gaps. Acceptance of this final target is the only artifact write-authorization gate; earlier baseline confirmation cannot authorize a write. Intermediate topology, context, relationship, or "checkpoint" writes are forbidden.
8. **Apply once after acceptance**: after explicit acceptance of the integrated proposal, run one atomic `apply-model` transaction through `maintain-artifacts` for the Context Map, root navigation when affected, and every semantically affected Model. To replace a retired invalid Context Map, declare `context_map_migration: true` only after explicit acceptance of the final integrated target and provide the complete accepted replacement plus every affected Model; omit the flag for ordinary applies. Each changed Model revision advances at most once. The written artifacts must not introduce a decision that was absent from the accepted proposal.

Explore is `shape_ready` only when replay needs no invented business fact, the Context Map is a valid directed acyclic dependency graph, every affected Model agrees with it at an exact current revision, and every material source item is covered or explicitly reported as deferred.

## Completion

Finish with one of:

- `changed`: the accepted integrated model was written once; name every affected context, path, and revision, report coverage gaps, then route to `shape`.
- `no_change`: existing sections already satisfy the complete replay; cite them, report coverage gaps, and route affected contexts to `shape`.
- `needs_clarification`: ask the single active business question and stop without writing unaccepted facts.
- `blocked`: an external constraint prevents reading or applying the artifact transaction; state the constraint and intended path.

There is no partial-model completion state. Only a `shape_ready` result routes affected contexts to `shape`. Keep the final response short. Do not paste the model unless asked.

## References

- Load references when Scenario Thread traversal exposes a material hotspot.
- Use only the relevant section of [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for language, authority, lifecycle, invariant, failure tolerance, subdomain, bounded-context, Aggregate, or coordination analysis.
- Do not load implementation, language, runtime, database, or `ddd-core.md` references during `explore`.
