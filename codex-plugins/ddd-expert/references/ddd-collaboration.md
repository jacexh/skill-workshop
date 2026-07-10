---
name: ddd-collaboration
description: Language-neutral DDD guidance for published APIs, Domain Events, Integration Messages, Process Managers, and conditionally adopted reliable delivery.
---

# DDD Collaboration

Choose collaboration from language ownership, consistency, and failure semantics
before selecting RPC, broker, scheduler, or storage mechanics.

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
| Durable multi-step coordination | Process Managers and Orchestrated Sagas |
| Handoff, idempotency, and recovery | Reliable Delivery |
| Compatible published-language change | Contract Evolution |

## 1. Collaboration Choices

| Mechanism | Relevant fact |
|---|---|
| Published command API | Another context sends intent to the authority and requires an immediate admission result |
| Published query API | Another context needs a current read-only snapshot owned by the source |
| Domain Event | One context reacts to a selected local past-tense fact |
| Published Fact Contract | Other contexts consume a stable fact selected by the producing authority |
| Asynchronous Intent Contract | A sender requests work from another authority without an immediate admission result |
| Process Manager / Orchestrated Saga | Coordination itself has durable progress, correlation, timeout, retry, cancellation, or compensation |
| Anti-Corruption Layer | External or upstream language must be translated into the local model |
| Separate Ways | Integration cost exceeds its business value |

- **[DDD Principle]** The authority for a contract's semantics controls its meaning and admissible change.
- **[Heuristic]** Before choosing a mechanism, ask which inconsistency is tolerable, who retries, who compensates, and what proves completion.
- **[Heuristic]** Synchronous calls add temporal and availability coupling; asynchronous delivery adds state, duplication, ordering, and recovery obligations.
- **[House Rule]** Do not introduce Outbox, Inbox, Process Manager, Saga, or another reliability mechanism merely because collaboration is asynchronous. Adopt one only after relevant facts expose its need and the design is explicitly accepted; once accepted, use the prescribed House Style rather than an improvised substitute.

## 2. Published Synchronous APIs

- **[DDD Principle]** A context may publish a synchronous Application API without exposing its internal Domain objects, Repository, tables, or implementation types.
- **[DDD Principle]** Commands express intent and return an admission decision or outcome; queries return read-only contracts.
- **[House Rule]** When a synchronous cross-context API is accepted, publish it as an Open Host Service / Published Language and translate at each context boundary.
- **[House Rule]** The published contract must make authorization, timeout, error, consistency, and version semantics clear enough for its consumers.
- **[Heuristic]** Prefer synchronous collaboration when the caller cannot proceed without an immediate authoritative answer and the availability coupling is accepted.

## 3. Domain Events

- **[DDD Principle]** A Domain Event is a selected past-tense fact in the language of one Bounded Context.
- **[DDD Principle]** A fact discovered during modeling becomes a Domain Event only when the model needs a named local reaction or durable fact.
- **[DDD Principle]** DDD does not prescribe one universal dispatch point before or after commit.
- **[House Rule]** When a Domain Event is used, record it with the Domain behavior that establishes the fact; Application coordinates dispatch according to the accepted transaction and failure semantics.
- **[House Rule]** When same-context post-commit follow-up is explicitly accepted as best effort, persistence succeeds before dispatch and dispatch failure cannot roll back the committed command. The language Flow Guide owns the executable sequence.
- **[Heuristic]** Before-commit handlers participate in the command consistency boundary; after-commit in-process handlers create a crash gap; durable handoff adds persistence, replay, and idempotency obligations.
- **[Heuristic]** Calling `Save` does not necessarily mean commit. Inspect the real transaction boundary before reasoning about timing.

## 4. Integration Messages

- **[DDD Principle]** An Integration Message is a consumer-visible contract crossing a context boundary. It is not the producing Domain Event type reused for convenience.
- **[House Rule]** A Published Fact Contract is owned by the producing authority because it describes what that authority says happened.
- **[House Rule]** An Asynchronous Intent Contract is owned by the receiving authority because it describes what that authority promises to consider or perform.
- **[House Rule]** When publishing a fact, the producer translates a selected Domain fact into its own stable Published Language at the Application boundary.
- **[House Rule]** When sending asynchronous intent, the sender translates its local intent through a semantic port or ACL into the receiver-owned contract; the sender Application does not treat the receiver's generated contract as its own model.
- **[House Rule]** A consuming Interface adapter decodes the envelope and payload, maps them to one local Application command, and delegates once; Domain validity remains owned by the Domain. Provider acknowledgement, retry, offset, and dead-letter behavior remain outside Application.
- **[House Rule]** Integration Message payloads carry stable identity and the occurrence-time facts promised by the contract. They do not embed a full Aggregate or expose internal Domain types.
- **[Heuristic]** Minimal payload means minimal for the promised collaboration, not the fewest possible fields.
- **[Heuristic]** Assume duplicate delivery and define ordering only within the business scope that requires it; broker admission is not consumer completion.

## 5. Process Managers and Orchestrated Sagas

- **[DDD Principle]** A Process Manager owns coordination state for a multi-step process; it does not own participating Aggregates' invariants.
- **[DDD Principle]** It reacts to outcomes, issues the next intent, correlates steps, and records completion, timeout, cancellation, or compensation.
- **[House Rule]** In this House Style, an orchestrated Saga uses a Process Manager as its coordinator. A choreographed Saga consists of independent message reactions and is not given central coordination state merely because the word Saga is used.
- **[House Rule]** Use a Process Manager only when the accepted collaboration has a durable coordination lifecycle that cannot be represented as one direct use case or an independent reaction.
- **[House Rule]** When restart, delay, or duplicate delivery must not lose progress, persist the accepted process state and its idempotency evidence.
- **[Heuristic]** A stateless Domain decision is a Domain Service or policy; a single asynchronous reaction does not by itself justify a Process Manager.

## 6. Reliable Delivery

### Outbox

An Outbox atomically stores a publishable record with source state so publication can continue after the source transaction commits.
- **[House Rule]** Use an Outbox only when the accepted design requires source-state commit and publishable handoff not to be lost independently. Once applicable, record both in the same local transaction and publish through a separate relay.
- **[House Rule]** Do not keep a second direct-publish path for the same fact after the Outbox path is accepted.
- **[Heuristic]** Relay delivery is normally at least once: publication may succeed before progress is recorded, so consumers still need an accepted idempotency strategy.

### Inbox and Idempotency

Idempotency means repeated processing has the same accepted business effect, not merely that a handler returns success twice.
- **[House Rule]** When duplicate effects are material, use an accepted consumer-scoped message identity or business idempotency key and record it atomically with the same local transactional side effect. An external RPC, broker publish, or file write is not made atomic with MySQL by an Inbox row; it requires an accepted downstream-idempotency, Outbox, Process Manager, or recovery protocol.
- **[House Rule]** Use an Inbox only when the accepted idempotency and recovery design requires durable receipt or outcome tracking; natural idempotency or an Aggregate-owned business key may be sufficient in other cases.
- **[Heuristic]** Global deduplication, per-consumer Inbox, and Aggregate-owned idempotency facts have different ownership, retention, and contention tradeoffs.

### Failure and Recovery

Retry, compensation, reconciliation, and manual repair are different business or operational commitments.
Compensation is a new business action, not a technical rollback of an already committed external fact.
- **[House Rule]** When reliable asynchronous delivery is accepted, distinguish transient retry from permanent rejection and make exhausted work observable and recoverable according to that design.

## 7. Contract Evolution

Published contracts evolve under consumer-aware compatibility, deprecation, and ownership rules independent of internal Domain refactoring.
- **[House Rule]** When evolving a published contract, prefer additive compatible change, tolerate unknown fields, and remove a field or version only after consumer evidence permits it.
- **[Heuristic]** A handler or relay that exists in code but lacks production registration, permissions, or lifecycle wiring does not establish a working collaboration path.

## Related References

- [ddd-modeling.md](ddd-modeling.md) for authority, language, Bounded Contexts, and Context Maps.
- [ddd-core.md](ddd-core.md) for layer ownership, ports, Repository, and conditional CQRS.
- [database.md](database.md) for physical Outbox, Inbox, constraints, indexes, migrations, and concurrency rules.
