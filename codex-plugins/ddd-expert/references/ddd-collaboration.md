---
name: ddd-collaboration
description: Language-neutral DDD guidance for published APIs, Domain Events, Integration Messages, and compatible contract evolution.
---

# DDD Collaboration

Choose collaboration from language ownership and the accepted need for an
immediate reply or a later reaction before selecting transport mechanics.

## Rule Strength

- **[DDD Principle]** A durable DDD meaning or boundary. Apply it through the accepted domain model rather than as a mechanical code rule.
- **[House Rule]** A conditional implementation or architecture constraint. It does not apply before its stated condition is true; once applicable, it is mandatory.
- **[Heuristic]** A question or pressure signal. It invites investigation and never proves a conclusion alone.

Unless a rule states a narrower condition, its House Rule applies to accepted
collaboration governed by `ddd-expert`.

## Navigation

| Need | Section |
|---|---|
| Select a collaboration form | Collaboration Choices |
| Immediate cross-context command/query | Published Synchronous APIs |
| Local facts and dispatch timing | Domain Events |
| Cross-context asynchronous contracts | Integration Messages |
| Compatible published-language change | Contract Evolution |

## 1. Collaboration Choices

| Mechanism | Relevant fact |
|---|---|
| Published command API | Another context sends intent to the authority and requires an immediate admission result |
| Published query API | Another context needs a current read-only snapshot owned by the source |
| Domain Event | One context reacts to a selected local past-tense fact |
| Published Fact Contract | Other contexts consume a stable fact selected by the producing authority |
| Asynchronous Intent Contract | A sender requests work from another authority without an immediate admission result |
| Anti-Corruption Layer | External or upstream language must be translated into the local model |
| Separate Ways | Integration cost exceeds its business value |

- **[DDD Principle]** The authority for a contract's semantics controls its meaning and admissible change.
- **[House Rule]** Use the direct collaboration form established by accepted business meaning: a published synchronous API for an immediate authoritative answer, a Domain Event for a selected local fact, or an Integration Message for an accepted cross-context contract.
- **[Heuristic]** Synchronous calls require the receiver to answer now; asynchronous messages establish a separate consumer execution boundary.

## 2. Published Synchronous APIs

- **[DDD Principle]** A context may publish a synchronous Application API without exposing its internal Domain objects, Repository, tables, or implementation types.
- **[DDD Principle]** Commands express intent and return an admission decision or outcome; queries return read-only contracts.
- **[House Rule]** When a synchronous cross-context API is accepted, publish it as an Open Host Service / Published Language and translate at each context boundary.
- **[House Rule]** The published contract must make authorization, timeout, error, consistency, and version semantics clear enough for its consumers.
- **[Heuristic]** Prefer synchronous collaboration when the caller cannot proceed without an immediate authoritative answer and the availability coupling is accepted.

## 3. Domain Events

- **[DDD Principle]** A Domain Event is a selected past-tense fact in the language of one Bounded Context.
- **[DDD Principle]** A modeled past-tense fact becomes a Domain Event only when the model needs either a named local reaction to the occurrence or the occurrence itself, not merely the resulting state, as durable domain evidence.
- **[DDD Principle]** DDD does not prescribe one universal dispatch point before or after commit.
- **[House Rule]** When a Domain Event is used, record it with the Domain behavior that establishes the fact; Application coordinates the dispatch point selected by the accepted use case.
- **[House Rule]** Strategic discovery may identify that an occurrence needs a local reaction or published meaning. Tactical object design records a selected actual Domain Event under the object behavior that records it. Provider delivery attempts, lease changes, retry notifications, worker status, and log records remain execution observations.
- **[House Rule]** Keep a local Domain Event distinct from its producer-owned Published Fact Contract. They may use different names and payload meaning: the Domain Event is local Domain evidence, while an Integration Message realizes the consumer-visible contract across the boundary.
- **[House Rule]** When an actual Domain Event or Published Fact Contract leads to a next intent, model that intent separately as a Command or behavior under its own Domain owner. A Domain Event entry records the event and its producing behavior; each accepted local reaction names its Event Handler and Domain intent.
- **[House Rule]** When an execution observation itself changes business eligibility, rights, or outcomes, the corresponding business fact and authority must be established before it is named as Domain behavior.
- **[Heuristic]** Calling `Save` does not necessarily mean commit. Inspect the real transaction boundary before reasoning about timing.

## 4. Integration Messages

- **[DDD Principle]** An Integration Message is a consumer-visible contract crossing a context boundary. It is not the producing Domain Event type reused for convenience.
- **[House Rule]** A Published Fact Contract is owned by the producing authority because it describes what that authority says happened.
- **[House Rule]** An Asynchronous Intent Contract is owned by the receiving authority because it describes what that authority promises to consider or perform.
- **[House Rule]** When publishing a fact, the producer translates a selected Domain fact into its own stable Published Language at the Application boundary.
- **[House Rule]** When sending asynchronous intent, the sender translates its local intent through a semantic port or ACL into the receiver-owned contract; the sender Application does not treat the receiver's generated contract as its own model.
- **[House Rule]** A consuming Interface adapter decodes the envelope and payload, maps them to one local Application command, and delegates once; Domain validity remains owned by the Domain.
- **[House Rule]** Integration Message payloads carry stable identity and the occurrence-time facts promised by the contract. They do not embed a full Aggregate or expose internal Domain types.
- **[Heuristic]** Minimal payload means minimal for the promised collaboration, not the fewest possible fields.
- **[Heuristic]** Define ordering only within the business scope that requires it.

## 5. Contract Evolution

Published contracts evolve under consumer-aware compatibility, deprecation, and ownership rules independent of internal Domain refactoring.
- **[House Rule]** When evolving a published contract, prefer additive compatible change, tolerate unknown fields, and remove a field or version only after consumer evidence permits it.
- **[Heuristic]** A handler or relay that exists in code but lacks production registration, permissions, or lifecycle wiring does not establish a working collaboration path.

## Related References

- [ddd-modeling.md](ddd-modeling.md) for authority, language, Bounded Contexts, and Context Maps.
- [ddd-core.md](ddd-core.md) for layer ownership, ports, Repository, and conditional CQRS.
