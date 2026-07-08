---
name: ddd-core
description: Compact DDD + Clean Architecture rule cards for backend services. Use when a phase skill or DDD risk card routes to layer ownership, dependency direction, repositories, Domain Events, Integration Messages, CQRS, cross-context contracts, or architecture conformance rules.
---

# Backend Architecture Rule Cards

**Scope**: Language-agnostic DDD/Clean Architecture constraints.
**Routing**: This is not an entrypoint. Start from the active phase skill. Use [`ddd-modeling.md`](ddd-modeling.md) first when the domain model, bounded context, aggregate boundary, or Architecture Gate is unsettled. Load this file when the phase needs tactical architecture rules.

> **Phase routing**: Agent entrypoints are [`domain-modeling`](../skills/domain-modeling/SKILL.md), [`design`](../skills/design/SKILL.md), [`implement`](../skills/implement/SKILL.md), and [`review`](../skills/review/SKILL.md).

## 1. Architecture Principles

### 1.1 Core Philosophy

- Domain behavior is independent of frameworks, UI, databases, generated protocols, and transport.
- Dependencies point inward. Inner layers define semantic contracts; outer layers adapt mechanisms.
- Organize by bounded context first, technical layer second.
- Test business rules through Domain and Application seams, not through adapter internals.

### 1.2 Layered Architecture

Layer names describe responsibilities, not mandatory directories:

```text
Interface       -> protocol/request/response mapping, format validation
Application     -> use-case orchestration, transaction boundary, auth, DTO/read models
Domain          -> rules, invariants, aggregates, value objects, domain services, write repositories, events
Infrastructure  -> DB/cache/broker/RPC/SDK/framework adapters and generated-code integration
```

Generated RPC shortcuts may place a thin adapter in an existing Application entrypoint when a language guide explicitly allows it. The method must still do only map request -> delegate once -> map response/error.

### 1.3 Dependency Rule

- Domain imports no framework, ORM, DB/queue/cache/RPC/client package, generated protocol package, Infrastructure package, or another bounded context's Domain package.
- Application depends on Domain and on interfaces it owns. It does not depend on Infrastructure implementations.
- Infrastructure implements Domain Repository, Application QueryRepository/read facade, event/message publisher, ACL, and other adapter contracts.
- Interface depends inward and maps protocol types at the boundary.
- General-purpose implementation-independent libraries are allowed in Domain when they do not couple Domain to an external system.

## 2. Directory Structure

### 2.1 Overall Layout

Use vertical bounded-context organization. Flat horizontal `controllers/`, `models/`, `repositories/` layouts are not the target shape.

```text
cmd/ or apps/                 process entrypoints
configs/ or config/           configuration
internal/<context>/            one bounded context
  domain/
  application/
  interfaces/                  optional physical layer
  infrastructure/
proto/ or contracts/           generated protocol/schema sources
```

Language guides choose concrete path names. Do not create a physical `interfaces/` package only because this generic model names an Interface layer; calibrate existing repository conventions first.

### 2.2 Bounded Context Internal Structure

Expected responsibilities:

```text
domain/          Aggregate roots, Entities, Value Objects, Domain Services, write Repository interfaces, Domain Events
application/     Commands, Queries, handlers, DTOs/read models, assemblers, QueryRepository/read facades, coordination services
interfaces/      HTTP/RPC/MQ adapters, protocol validation and mapping
infrastructure/  Repository implementations, data objects, converters, external clients, message/runtime adapters
```

Keep context Infrastructure flat by default. Use semantic capability names, not technology directories, unless multiple implementations coexist. Shared technology components belong in shared technical packages.

## 3. Layer Responsibilities

### 3.1 Domain Layer

Domain owns business facts, state transitions, and invariants.

Use these mechanisms before considering an Application command-side port:

| Need | Default owner |
|---|---|
| Persist/load aggregate collection | Domain Repository |
| Rule over one aggregate | Aggregate method or Value Object |
| Named decision spanning aggregates | Domain Service after ruling out aggregate redesign or decision aggregate |
| Repeated same-BC reaction after state changes | Domain Event + Domain Event Handler |
| Cross-context propagation | Integration Message translated at the boundary |
| External/legacy model translation | ACL |
| Product/API/report read model | Application QueryRepository/read facade |
| DB/cache/broker/RPC/SDK/routing/topology/retry | Infrastructure adapter behind a semantic owner |

Constraints:

- State changes go through Aggregate methods or Domain policies. External field mutation is prohibited.
- Constructors/factories create valid objects and call `Validate()` or equivalent internal validation.
- External layers call Domain validation methods; they do not run external reflection/schema validators directly against Domain types.
- Domain Events are collected by aggregates and drained by Application after successful persistence.
- Domain generates IDs using infrastructure-independent schemes. Database auto-increment IDs must not be required to create a valid aggregate.
- Technical-facing capabilities are Domain-facing when they own stable language, states, admission/routing policy, ownership semantics, or invariants; otherwise use Application or Infrastructure per [`ddd-modeling.md §0.1`](ddd-modeling.md).

Domain Event collection:

```text
aggregate.method()        # collect internal events
repo.Save(aggregate)      # persist succeeds
events = aggregate.DrainEvents()
dispatcher.Dispatch(events)
```

Repository never drains events. Application drains once after `Save()`.

### 3.2 Application Layer

Application owns orchestration, not business rules.

Command flow:

```text
load aggregate -> call Aggregate/Domain Service -> Save -> drain/dispatch events
```

Query flow:

```text
call QueryRepository/read facade -> return DTO/read model
```

Rules:

- Commands modify state; Queries return read models and do not mutate state.
- Application constructs Domain inputs, calls Domain methods/validation, maps Domain errors outward, and manages transaction boundaries.
- Default transaction boundary is one aggregate write per command.
- A Repository is a write-side Aggregate collection. `Save(ctx, aggregate)` saves one mutable Aggregate Root; owned child rows may be persisted with it, but independent Aggregate Roots normally coordinate through Domain Events, process managers, reconcilers, Integration Messages, or compensation.
- A semantic repository method name is not proof; an API saving or coordinating several candidate roots is Aggregate Boundary Conflict until modeling proves one aggregate or event-driven coordination.
- Implementation transaction shape is not Repository design evidence. Cross-table writes are persistence mapping evidence only when they persist one accepted aggregate.
- After `Repository.Save()`, the in-memory aggregate is stale. Reload before further operations.
- Query Handler structs are optional when they only delegate once to a QueryRepository.
- Application command-side port pressure returns to modeling/design before implementation. It requires the Architecture Gate placement extension and the semantic fake test.

#### Default-First Concept Map

- Aggregate default: one Aggregate owns one consistency boundary and protects invariants through behavior methods.
- Repository default: one Repository is a collection for one write-side Aggregate Root; it does not serve product reads or bundle independent roots.
- Domain Event default: same bounded-context, past-tense business fact recorded after Domain state changes for repeated local reactions.
- Integration Message default: stable cross-context contract derived from a selected Domain fact or explicit published fact.
- Application Port default: QueryRepository/read facade for reads, ACL/Infrastructure adapter for mechanisms, and Domain Repository/Domain Service/Domain Event for command-side domain needs.
- CQRS default: commands mutate Domain aggregates; queries return DTO/read models without loading aggregates for UI history or detail pages.
- Bounded Context default: product language, authority, lifecycle, and invariant ownership define the boundary, not technology nouns.
- FSM default: state-specific behavior lives in state methods and aggregate methods delegate to the current state, not raw state mutation.
- Exception pressure returns to domain-modeling when it concerns model facts; tactical placement gaps return to design. Do not present exception-shaped mechanisms as alternatives in implementation or review.

#### Return Routing Rule

- Return to domain-modeling for aggregate boundary, lifecycle, invariant, fact language, or bounded-context uncertainty.
- Return to design for layer ownership, CQRS split, port placement, adapter boundary, or repository API shape after the model is accepted.
- Report a violation directly when evidence proves the accepted model or architecture rule is broken and no new model/design decision is needed.
- Red-flag evidence such as semantic repository transaction, lifecycle transaction, cross-table transaction, same persistence boundary, ORM session, or multi-record lifecycle writes is implementation evidence. transaction-shaped evidence cannot satisfy Repository design.
- Accepted design is evidence, not waiver. If a design contains synchronous writes across several lifecycle owners, review still requires invariant owner, failure tolerance, and event/process rationale.
- Build/runtime blockers only block executable verification; Independent static model review still runs. Compile blocker is never a positive model signal.
- Rules Satisfied is scoped to one rule; it must not cover aggregate boundary or event-collaboration risk in the same flow.
- Absence of forbidden nouns is not model proof. A positive model-alignment conclusion requires every triggered lifecycle, event, recovery, repository-boundary, FSM, and CQRS depth family to be classified as positive-shape-no-finding, violation, return-to-modeling/design, or evidence gap.
- Counterfactual Review Gateway: A positive-shape decision is provisional until it survives falsification; draft findings are not final. Counterfactual falsification evidence asks what evidence would make each positive-shape/no-finding/Rules Satisfied decision false across durable fact precedence, owner proof, reaction/recovery reachability, state language, and CQRS read/write semantics. No concrete finding is not a positive decision until the falsifier question and inspected evidence are named.
- Positive-shape decisions require proof artifacts. Aggregate/repository rows require candidate classification and owner proof; event/reaction rows require fact-to-owner-to-recovery timelines; split or terminal flows require authorization, execution, and aggregate closure fact separation; CQRS rows require caller semantics, returned model family, write-side overlap, and adapter overlap evidence.
- Production wiring visibility gate: A reconciler, handler, or recovery command that exists in code but lacks production entrypoint, scheduler, route, subscription, or runtime registration is a separate recovery-wiring evidence gap or finding. Repository candidate-owner rows must not use grouped method examples or broad Save* lists as final proof. Collaboration mechanism rows stay independent even when repository or fact-precedence findings already exist. CQRS method inventory must be visible for every read-shaped write repository or shared adapter method before any product-read no-finding.
- Accepted design proof rule: accepted design is evidence, not a waiver; a positive-shape decision that relies on accepted design must also name independent code evidence that implements the accepted decision, or downgrade to return/evidence gap.
- CQRS semantic proof artifact: QueryRepository names, DTO packages, or shared adapter names are not proof; the review must classify port/interface methods by caller semantics and write/read overlap before claiming CQRS positive-shape-no-finding.
- Lifecycle depth completion gate: Required depth proof artifacts must be present when a positive-shape no-finding is claimed for lifecycle, repository, event/reaction, terminal/execution, or CQRS scope. Broad positive-flow summaries do not satisfy depth proof; missing proof artifacts become evidence gaps or return routes.
- Evidence Matrix prohibition: Evidence Matrix, summary tables, and free-form matrices are commentary only; they cannot replace depth proof artifacts or carry positive-shape decisions. Free-form matrices are commentary only.
- Compact depth evidence is invalid when it hides triggered axes. Missing triggered depth evidence is an evidence gap.
- Negative depth decisions run before findings for lifecycle/repository/event/CQRS scope. Triggered depth families start unresolved; Family proof is the only promotion path to positive-shape-no-finding. Findings are generated from negative depth decisions after the depth decision is complete. Pre-written findings cannot satisfy depth decisions.
- Positive-shape promotion requires non-transaction model proof. Transaction shape, accepted design, semantic repository naming, DTO/query naming, or package separation cannot be the strongest positive evidence; if they are the strongest evidence, downgrade to return/evidence gap/finding. command transaction is not a final collaboration mechanism; accepted atomic transaction requires explicit model decision and failure-tolerance proof. State-language inventory must enumerate every discovered or declared parent state word; Missing configured state words force evidence gap. CQRS depth evidence must be one method or port each when sibling methods drive different judgments; Grouped CQRS evidence cannot support positive-shape-no-finding.
- Depth decisions are decision gates, not summaries. A depth decision that cites a caveat or another finding cannot be positive-shape-no-finding; inherit the stronger decision from the caveat or downgrade to return/evidence gap. Summary rows covering several methods, flows, states, or ports cannot support positive-shape-no-finding until each member has its own decision row.
- Method-level candidate proof: use one row per Repository/API method that saves or coordinates multiple candidates, with each candidate's role, owner proof, owned-child proof, invariant or command outcome, transaction evidence, coordination alternative, and decision/return route.
- Collaboration-model proof: synchronous command path is evidence, not a collaboration decision. Linked lifecycle behavior must classify the mechanism as Domain Event, process manager, reconciler, task processor, Integration Message, accepted atomic transaction, or evidence gap.
- Parent-state language proof: if a parent aggregate state is named after a child process outcome, prove the parent lifecycle fact and owner before claiming positive-shape-no-finding; otherwise return to modeling/design or record an evidence gap.
- CQRS positive-shape-no-finding requires semantic proof beyond names, DTOs, packages, and absent imports. Classify caller intent, returned model family, write-side product-read overlap, query-adapter write authority, shared storage/adapter coupling, and whether reads influence write-side decisions.
- Finding extraction gate: any depth decision with finding, return, or evidence gap must become a Finding paragraph or cite an existing finding with the same scope; important risks cannot remain only in working evidence.
- Split or multi-execution outcomes require one row per execution fact with authorization source, amount/result scope, idempotency/replay rule, failure recovery, and exact aggregate closure condition; command sequencing alone cannot prove terminal/execution separation.
- State-language enumeration must inspect every parent state whose vocabulary looks like pending, failed, cancelled, succeeded, authorized, executed, completed, refunded, settled, or closed.
- CQRS read-shaped method inventory must inspect every read-shaped method on write repositories or shared adapters before claiming read/write split positive-shape-no-finding.
- positive-shape decisions inherit the strongest negative decision unless independence is proven; related findings, returns, evidence gaps, and caveats dominate positive local proof.
- Family proof tuple: family scope, model fact, owner proof, coordination proof, forbidden evidence scrub, final decision. Category-level positive decisions are invalid; grouped method/flow/state/port categories and prose summaries are commentary, not admission decisions. semantic lifecycle transaction is red-flag evidence only. synchronous command plus transaction cannot support positive collaboration without an accepted atomic-transaction model decision and failure-tolerance proof. caller-location-only CQRS proof is insufficient; command-side caller location must be paired with returned model family, product-read overlap, write-side influence, and adapter/storage overlap. positive-shape with inherited negative is not positive-shape-no-finding unless family-local independence proof removes the negative.
- For lifecycle/repository/event/CQRS scope, do not start with Findings; start with breadth and depth. Positive flows are provisional until depth proof is complete. Missing depth evidence invalidates related positive-shape decisions. Depth proof sections are working evidence. Grouped family scopes cannot support positive-shape-no-finding.
- Section-coverage summary claims are invalid. Do not write that lifecycle axes are covered without positive correct-shape evidence. Irreversible fact command-admission matrix: Every durable succeeded, authorized, completed, or executed fact must be tested against later cancel, retry, reopen, or refund commands that can act from stale parent state.
- CQRS write-side inventory gate: Inventory every read-shaped method on write repositories and shared adapters before CQRS positive-shape-no-finding. Query DTO or read facade evidence alone cannot satisfy CQRS; each positive row must name the write-side method/adapter, caller semantics, returned model family, write-side influence, storage/adapter overlap, and why no read facade should own it. All-positive contradiction gate: Do not write all families positive when any triggered family is finding, return, evidence gap, grouped, compressed, or missing depth proof.
- Hard downgrade positive-shape filter: Forbidden proof tokens in positive-shape evidence force downgrade. caveated proof, design accepts, accepted by design, xorm tx, accepted atomic write, command-side check, or synchronous command path cannot be decisive positive-shape proof. Accepted atomic transaction requires model decision id and failure-tolerance rule in the same row; otherwise downgrade. Terminal/event timing gate: Terminal/execution positive-shape decisions must inspect lifecycle event emission timing and durable fact ordering; command/domain guards alone cannot prove terminal/execution separation.
- Positive-conclusion quarantine: If any lifecycle/repository/event/CQRS family is finding, return, evidence gap, or grouped, omit broad positive Rules Satisfied entries. Residual-risk summary replaces positive-flow summary while negative decisions exist.
- Negative-scope lock: When any lifecycle/repository/event/CQRS family is finding, return, evidence gap, grouped, or missing depth proof, every same-scope positive decision is invalid. Use evidence gap or return instead of positive-shape-no-finding while the lock is active. Grouped method, flow, candidate, state, port, or execution evidence cannot support positive-shape-no-finding. Independent-scope positive exception requires family-local scope boundary proof.
- Not-claimed extraction gate: not claimed cannot be a final depth decision. Every not-claimed lifecycle/repository/event/CQRS family must become evidence gap, return, or finding. Positive-word scrub: covered, reachable, shape matches, appears guarded, or no blocker found are positive conclusions; downgrade them while negative decisions exist. Bare method-name lists are not CQRS inventory; each row needs caller semantics, returned model family, write influence, storage overlap, and read-facade ownership.
- Inventory completeness gate: Triggered depth families are incomplete unless accepted model and code seeds for that family are inventoried. A blocker cannot shrink lifecycle scope; continue independent flow inventory after high-severity findings. One-family depth decisions are incomplete when multiple commands, methods, states, events, flows, or read-shaped methods need separate judgments. Depth seeds: lifecycle flows, repository/API methods, collaboration trigger facts, terminal execution facts, parent state vocabulary, domain event names, and read-shaped write-side methods/shared adapters. Collaboration policy inventory: Collaboration rows must include every accepted lifecycle reaction, external side effect, reversal/compensation path, closure/settlement fact, exception/dispute path, and cross-owner reaction found in expected model or code seeds. Each collaboration row must classify mechanism as domain event, process manager, reconciler, task processor, integration message, accepted atomic transaction with failure tolerance, or evidence gap. Full FSM parent-state vocabulary inventory: Every parent state word must be classified as parent lifecycle fact or child/process outcome. Stale-command rights matrix must enumerate retry/start, cancel, reopen, reversal/compensation, execution, and closure commands after durable facts. No terminal/execution no-finding without positive evidence per execution fact and aggregate closure fact. No CQRS no-finding without positive evidence per read-shaped write-side method or shared adapter method. Collaboration mechanism rows cannot use application coordination, repository semantic transaction, same DB transaction, or command transaction as final mechanism. Parent-state vocabulary must include pending-like configured parent states, not only failed-like or cancelled-like states. Not admitted cannot be a final depth decision. Every not-admitted lifecycle/repository/event/CQRS/terminal/state/collaboration family must become same-scope finding, evidence gap, or return route. Finding extraction map must be one-to-one: unrelated rows cannot be grouped under a broad gap id. Stale-command rights matrix rows must contain exactly one durable fact and one later command; grouped command cells such as cancel/retry/execute are invalid. A collaboration row using command transaction, application coordination, repository semantic transaction, or same DB transaction becomes evidence gap/finding/return unless the same row names an accepted atomic decision and failure-tolerance proof. Depth-axis completion preflight: final findings wait for each triggered lifecycle, repository/API, collaboration, parent-state, and CQRS axis to have a depth decision or evidence gap. Severe findings cannot abbreviate triggered depth axes; continue inventories after Blocker or Critical findings. Residual positive claims are forbidden when any triggered depth axis is missing, incomplete, grouped, or skipped. One discovered stale command cannot stand in for the remaining later commands after the same durable fact. Naming, package separation, DTO/query names, and caller location are routing clues only, not final positive proof.
- Lifecycle/repository/event/CQRS scope is a depth-axis gate, not a final-output proof-dump gate. No broad summary, no-finding claim, Rules Satisfied entry, or residual-risk summary may clear a triggered axis without a depth decision or evidence gap. For lifecycle scope, triggered depth axes are non-optional. A triggered depth axis may not be omitted. Absence of depth evidence becomes a missing-axis evidence gap. Missing depth axes block same-scope positive claims, not final artifact emission. Finding paragraphs are generated only from completed depth decisions. A broad finding cannot stand in for missing repository/API, collaboration, parent-state, or CQRS depth decisions. Forbidden positive decisions: scoped OK, no issue found, product reads separated, accepted by design, names look correct, used by commands. Axis completion summary is not evidence. Wildcard row families such as RC-*, COL-*, or CQ-* cannot support completion or no-finding claims unless the corresponding working evidence appears in findings, gaps, returns, not-applicable rows, or selected evidence. Accepted-design match cannot soften Repository/API candidate classification; missing owner or coordination proof still routes to modeling/design. Collaboration mechanism inventory must extract missing external side effect, reversal/compensation, exception/dispute, settlement/closure, split execution/closure, and recovery mechanism rows independently; recovery or terminal-fact findings cannot stand in for linked behavior mechanisms. CQRS no-finding requires positive method-level evidence with caller semantics, returned model family, write-side influence, storage/adapter overlap, and read-facade ownership.
- Dangerous shape default-deny: shape sentinels run before proof promotion. Repository/API methods that save or coordinate several aggregate or lifecycle-owner candidates start as return/evidence gap/finding, not positive-shape-no-finding or no-claim. Candidate classification chooses the return route; it does not promote the row. Promotion requires row-local proof that every additional candidate is an owned child/value object under one lifecycle owner, or that coordination is handled by a named Domain Event, process manager, reconciler, task processor, Integration Message, or accepted atomic-transaction model decision with failure-tolerance proof. Semantic repository names, accepted design, same transaction/session, cross-table writes, or command-side synchronous coordination cannot waive the sentinel.
- First-principles shape challenge: after inventory questions and before admitting any tactical shape, ask: Is this shape genuinely necessary for the business invariant, or compensating for a wrong aggregate/lifecycle boundary? If the answer depends on accepted design, transaction shape, semantic names, DTO/package separation, command sequencing, or local convention without explicit model and failure-tolerance proof, keep the default-deny decision.
- Terminal-closure default-deny gate: inventory every terminal lifecycle fact and terminal lifecycle event emission from accepted model sources and code, then map each one to all required execution facts before any positive-shape terminal/execution decision. A terminal lifecycle event or aggregate closure can be positive-shape-no-finding only when durable ordering proves every required execution fact is authorized, completed or explicitly separated, idempotent/replay-safe, and recoverable before the terminal event is emitted. If code emits terminal lifecycle closure/events before, during, or without proof of all required execution facts, default to finding, return, or evidence gap. Command sequencing, domain guards, same transaction, closure method names, or event names alone cannot admit the row.
- Parallel depth-axis review: Run shape-sentinel, lifecycle-spec, and evidence-admission axes independently as depth checks, then aggregate them side by side. One risk axis cannot clear another risk axis. A positive-shape, evidence-gap, return, finding, or not-applicable decision in one axis cannot satisfy, waive, or mask another triggered axis. If triggered lifecycle depth evidence is missing, do not mark the related axis positive or Rules Satisfied. Missing triggered depth evidence becomes evidence gap.
- Positive conclusion calibration: when later scoring feedback or known issues contradict a review, convert the miss reason into a generic rule, protocol, output contract, or eval assertion instead of memorizing project-specific examples.
- Depth coverage matrix: lifecycle reviews classify irreversible fact precedence, event/recovery reachability, candidate aggregate/lifecycle-owner classification, terminal lifecycle facts versus execution facts, FSM API compatibility, FSM state polymorphism, CQRS split, and state-language semantics before any broad alignment claim.
- Lifecycle depth axes remain required when lifecycle scope is present, even when findings already exist. A compile/build blocker cannot remove lifecycle depth checks; it only limits executable verification.
- Positive-shape proof rule: a positive-shape row must name concrete evidence, the exact rule satisfied, and why the risk is not a finding; otherwise it is an evidence gap or return route. A split execution fact such as partial money movement does not equal aggregate terminal closure until all required execution facts and closure rules are reconciled.
- Owned-child proof is required before a multi-candidate repository row can be positive-shape-no-finding. Without proof that every coordinated candidate is one aggregate-owned child/value object under one lifecycle owner, classify the row as return-to-modeling, return-to-design, evidence gap, or finding.

#### Review Order Rule

For lifecycle/repository/event reviews, reason in this order: command -> past-tense fact -> invariant owner -> reaction/process -> consistency/failure tolerance -> repository mechanism.

#### Irreversible Fact Precedence Rule

Durable succeeded, accepted, completed, authorized, executed, or externally committed facts outrank open workflow states. A lagging projection, event handler, or reconciler does not reopen retry, cancellation, refund, or mutation rights unless the accepted model explicitly says so. Review terminal lifecycle facts and execution facts separately: lifecycle closure records the product obligation state; execution facts record money, shipment, notification, or external side effects. If either side can advance without the other, require an explicit reaction/process/reconciler and failure-tolerance rule before marking Rules Satisfied. Split or multi-execution outcomes require one row per execution fact with authorization source, amount/result scope, idempotency/replay rule, failure recovery, and exact aggregate closure condition; command sequencing alone cannot prove terminal/execution separation.

#### CQRS Read/Write Split Rule

When one repository shape mixes aggregate saves with product list/detail/summary/page reads, treat it as CQRS split pressure: keep command-side aggregate loading in the Domain Repository and move product read models to QueryRepository/read facade unless the read is a command-side Domain fact needed to decide a write.

#### CQRS Port Granularity

Expose ports by caller semantics, not storage operations:

| Caller need | Port shape |
|---|---|
| Same write-side aggregate collection | Extend existing Domain Repository |
| Same product read-model family | Add method to existing QueryRepository |
| Different freshness/auth/pagination/failure/consistency/data-source/test-substitute semantics | New QueryRepository/read facade |
| Cross-context read | Published facade owned by source context |
| Routing, peer lookup, hop headers, queue subjects, retry knobs, topology | Infrastructure, not Application query port |

Do not create one QueryRepository per screen, RPC, SQL statement, or minor filter. Do not create storage-shaped omnibus ports that mix producer writes, UI history, audit lookup, projection bootstrap, and unrelated reads.
Do not merge write-side Repository and read-side QueryRepository responsibilities merely because one adapter or table can serve both. CQRS read-shaped method inventory must inspect every read-shaped method on write repositories or shared adapters before claiming read/write split positive-shape-no-finding.

#### Aggregate Boundary Conflict Gate

Default path is one aggregate per command. If a Repository/API appears to save
or coordinate several candidate roots, do not justify it with transaction
evidence. Classify Aggregate Boundary Conflict and return to `domain-modeling`
unless a prior modeling discussion already changed the aggregate boundary.

Reopened modeling must answer:

- Are these truly separate lifecycle/invariant owners, or one Aggregate with owned children/value objects?
- Which past-tense Domain Event, process manager, reconciler, Integration Message, or compensation should express behavior linkage?
- Which command outcome must be immediately true, and which inconsistency is recoverable?
- Which table writes are only Infrastructure mapping for one accepted Aggregate?
- What accepted model decision replaced the conflict? Without that decision, do not mark it Rules Satisfied.

#### Command Handler Port-Pressure Heuristic

Count semantic outbound dependencies only: Repositories, QueryRepositories used by commands, ACLs, external semantic gateways, command-side ports.

| Count | Review action |
|---|---|
| 1-2 | Normal |
| 3 | Informal placement review |
| 4 | Mandatory port-pressure review |
| 5+ | Presumptively unresolved abstraction |

When count is 4+, check capability merge, rule extraction to Aggregate/Domain Service, event/message extraction, and mechanism sinking into Infrastructure.

### 3.3 Interface Layer

Interface owns protocol transformation only:

- request/response mapping;
- format/schema validation;
- actor/context extraction;
- protocol error mapping;
- one delegate call to Application.

No business rules, transaction control, repository calls, aggregate mutation, or adapter orchestration.

Error mapping defaults:

| Error | HTTP | gRPC |
|---|---|---|
| Not found | 404 | `NOT_FOUND` |
| Invalid Domain input | 400 | `INVALID_ARGUMENT` |
| Business precondition | 422 | `FAILED_PRECONDITION` |
| Concurrent modification | 409 | `ABORTED` |
| Infrastructure failure | 500 | `INTERNAL` |

### 3.4 Infrastructure Layer

Infrastructure owns technical implementation:

- Repository and QueryRepository implementations;
- data objects and converters;
- DB transactions, optimistic lock SQL, soft-delete columns;
- cache/broker/RPC/SDK/file/K8s/framework adapters;
- generated protocol adapter glue;
- retry, topology, routing mechanics.

Repository rules:

- Repository is a collection of aggregate roots, not a DAO.
- `Save()` covers create, update, and state-driven soft delete. Do not expose `Insert/Update/Delete` to Domain/Application.
- Write Repository interfaces live in Domain; QueryRepository/read facade interfaces live in Application or published API boundary.
- Infrastructure may compose multiple mechanisms behind one semantic port. Do not expose `RedisStore`, `MysqlReader`, `BrokerPublisher`, `TxManager`, `Peer`, `Directory`, or `Router` inward unless the use case names a semantic lifecycle and the Architecture Gate accepts it.
- Infrastructure increments optimistic-lock versions through storage semantics. Domain treats version as a read-only token.
- Business-driven delete is modeled as Domain state; `deleted_at` remains Infrastructure.

## 4. DDD Tactical Design Reference

| Concept | Owner | Notes |
|---|---|---|
| Aggregate Root | Domain | Guards invariants; repository operates on root |
| Entity | Domain | Stable identity |
| Value Object | Domain | Equality by value, immutable/replaceable |
| Domain Service | Domain | Named business decision spanning aggregates |
| Repository | Domain interface + Infrastructure impl | Write-side aggregate collection |
| QueryRepository/read facade | Application/API interface + Infrastructure impl | Product read model, DTOs |
| Domain Event | Domain | Same-BC fact after state change |
| Integration Message | Boundary/Application/Infrastructure contract | Cross-context published fact |
| Command/Query Handler | Application | Orchestration and transaction boundary |
| DTO/protocol message | Interface/Application/Infrastructure | Never a Domain entity |

## 5. Cross-Context Communication

### 5.1 Direct Calls Are Prohibited

Do not call another context's Domain model, Application Service, Repository, or database table directly. Cross-context interaction uses the mechanisms in §5.2.

### 5.2 Legitimate Cross-Context Mechanisms

| Mechanism | Use when |
|---|---|
| Integration Messages | State changes in one context trigger reactions elsewhere |
| Cross-context Queries | Read-only current snapshot is needed |
| ACL | External/legacy/upstream model must not pollute local language |
| Protocol Contracts | Cross-service/repository structured schema is needed |

### 5.3 Domain Events and Integration Messages

Domain Events are internal same-bounded-context facts. Integration Messages are cross-context contracts.
Event-storming facts are earlier modeling evidence: not every fact becomes a Domain Event, and not every Domain Event is published. Classify each fact by language scope, consumer, timing, and failure policy before choosing Domain Event, Integration Message, state, read model, process coordination, or no code artifact.

| Property | Domain Event | Integration Message |
|---|---|---|
| Scope | One bounded context | Crosses bounded contexts |
| Vocabulary | Publisher's ubiquitous language | Stable published language |
| Evolution | Refactor with Domain | Additive/deprecated schema discipline |
| Consumer coupling | Internal only | External consumers depend on it |

Async reaction roles:

- **Domain Event Handler**: consumes one same-BC Domain Event and performs a local reaction.
- **Boundary Publisher**: consumes same-BC Domain Event and publishes Integration Message.
- **Integration Message Handler**: consumes another context/service's contract and maps into local language.

One concrete handler has one role. Multi-kind handlers require same role, source context/contract family, target side effect, transaction boundary, failure policy, and dependency set.

Failure policy labels: best-effort, log-and-continue, return subscriber/adapter error, or explicit stronger reliability requirement.

### 5.4 Integration Message Payload Design

Messages carry aggregate ID plus minimum necessary facts at occurrence time. Never embed full aggregates/entities. Consumers treat payloads as historical snapshots, not current state.

### 5.5 Cross-Context Queries

Cross-context reads go through a facade/query port or protocol contract published by the owning context. They return DTOs/read models, have no side effects, and never return Domain objects. Avoid chains across more than two contexts.

### 5.6 Anti-Corruption Layer (ACL)

ACL translates external/legacy/upstream language into local Domain language. It lives in Infrastructure or a boundary adapter. Domain does not import external shapes.

### 5.7 Protocol Contracts

Schemas (Protobuf/OpenAPI/GraphQL/etc.) are contracts, not Domain models.

- Generated types stay outside Domain.
- Domain-facing ports use Domain-owned input/output types.
- Map generated types at Interface/Application/Infrastructure boundaries.
- Schema evolution is additive; deprecate before removing.

## 6. Domain Events and Dispatch Timing

### 6.1 Dispatch Timing

Correct order:

```text
call Domain method -> persist aggregate -> drain Domain Events -> dispatch/publish
```

Never dispatch before persistence succeeds.

### 6.2 Cross-process delivery

Cross-context Integration Messages default to broker at-least-once delivery plus idempotent consumers. If pre-publish loss is unacceptable, record an explicit reliability design and keep its mechanism inside Repository/Infrastructure adapters; do not leak `OutboxWriter`, `BrokerPublisher`, or `TransactionalEventPublisher` as inward ports.

## 7. Naming Conventions

Use conceptual names; apply language casing locally.

| Concept | Pattern |
|---|---|
| Domain Event | `<Name>Event` |
| Command | `<Action><Target>Command` |
| Query | `Find<Target>Query` or product-specific read name |
| Repository | `<Aggregate>Repository` |
| QueryRepository | `<ReadModelFamily>QueryRepository` |
| DTO | `<Purpose>DTO` |
| Domain Error | `<Description>Error` or `Err<Description>` |

Suspicious Application/Domain interface names are governed by [`ddd-modeling.md §0.2.3`](ddd-modeling.md).

## 8. Error Handling

### 8.1 Error Classification

| Error | Defined in | Handling |
|---|---|---|
| Domain error | Domain | Normal business flow; no log; map to 4xx/protocol equivalent |
| Infrastructure error | Infrastructure | Add context; log once at execution boundary; map to 5xx |
| Format validation error | Interface | Return at boundary; do not propagate inward |

### 8.2 Error Propagation

Domain returns business errors. Infrastructure wraps technical errors with operation/ID context. Application logs only when it owns the execution boundary. Interface maps errors to protocol responses.

## 9. Testing Strategy

### 9.1 Per-Layer Approach

| Layer | Evidence |
|---|---|
| Domain | Pure tests for invariants, transitions, errors, events |
| Application | Use-case tests through Repository/QueryRepository/event/message fakes |
| Infrastructure | Real adapter/schema tests where practical |
| Interface | Protocol mapping and error-code tests |

### 9.2 Domain Layer Test Priorities

Cover lifecycle transitions, invalid transitions, invariant violations, value object validation, and Domain Event emission.

### 9.3 Mock Usage Rules

Mock/stub cross-layer seams, not Domain objects. Domain tests instantiate real aggregates/value objects. Infrastructure tests prefer real dependencies or representative integration tests over pure mocks.

## 10. Architecture Review Checklist

- Modeling gate and accepted model source are present when needed.
- Domain import boundaries are clean.
- Layer ownership matches §3.
- Technical capability classification was done before package/port placement.
- Inward interfaces are defined by inward layers.
- CQRS ports follow caller semantics and product read-model families.
- Aggregate Boundary Conflict returns to modeling through §3.2.
- Cross-context interaction uses §5 mechanisms.
- Generated protocol types do not enter Domain.
- Async handlers have one role and justified granularity.
- Repeated same-BC reactions use Domain Events selected from business facts; cross-context facts use Integration Messages.
- New command-side Application ports have Architecture Gate exception and semantic fake evidence.

## 11. Key Principles Summary

1. Domain has no concrete implementation dependencies.
2. Organize by bounded context.
3. Domain owns rules; Application orchestrates; Interface maps protocols; Infrastructure adapts mechanisms.
4. Repositories are write-side aggregate collections; QueryRepositories/read facades are product read models.
5. Application command-side port pressure returns to modeling/design; it is not a default.
6. Aggregates guard non-repairable invariants.
7. Events dispatch after successful persistence.
8. Integration Messages are cross-context contracts; Domain Events are internal facts.
9. Generated protocol types are contracts/DTOs, not Domain types.
10. Technology mechanics stay in Infrastructure unless the use case names a semantic lifecycle.

## Appendix A: Strategic Modeling

Use [`ddd-modeling.md`](ddd-modeling.md) for bounded-context discovery, aggregate boundary probes, Architecture Gate, planning gates, technical capability classification, and port granularity.

## Appendix B: Language-Specific Implementation Guides

Use the active language guide for package names, concrete code shape, dependency injection, generated-code placement, logging, runtime, taskqueue, and database conventions:

- [`ddd-golang.md`](ddd-golang.md)
- [`ddd-python.md`](ddd-python.md)
- [`ddd-typescript.md`](ddd-typescript.md)
