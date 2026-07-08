---
name: DDD Risk Router
description: Compact DDD/backend implementation/review risk router. Read with the active DDD phase skill for backend services in Go, Python, or TypeScript, database-backed services, event/message, taskqueue, or runtime-boundary work.
---

# DDD Risk Router

Read this file with the active phase skill for DDD/backend architecture work. Use it as an implementation/review risk router to decide which deeper standards to load. When the problem is modeling ambiguity rather than an observed implementation risk, route to [`ddd-modeling-gates.md`](ddd-modeling-gates.md) and [`ddd-modeling.md`](ddd-modeling.md) before naming tactical objects.

## How Phases Use Cards

- Domain-modeling uses cards to generate high-fidelity questions: identify when a risk implies an implicit domain object, existing-model impact, missing lifecycle, invariant, event, repository, bounded context, or data-authority decision.
- Design uses cards to surface design questions: identify when a risk implies missing subdomain, bounded context, data authority, context-map, or tactical model decisions. Do not report violations from design-only speculation.
- Implement uses cards to translate accepted model decisions into code placement: identify which deeper reference is needed for adapters, mappings, ports, runtime, persistence, or tests. Do not use a card to invent a new model decision during implementation.
- Review uses cards to demand evidence before findings: start from the default rule, then decide whether evidence shows a violation, harmless fit, return-to-modeling trigger, or evidence gap.

## Responsibility Role Classifier

Classify responsibilities, not concept names. Do not create or apply risk cards because a file or type contains a DDD term such as Event Handler, Message Handler, CQRS, Repository, Scheduler, or Drain. First identify the role the code is playing and the boundary it crosses:

Awkward tactical structures are evidence, not diagnosis. Before routing to a tactical fix, ask what upstream model pressure the structure carries: aggregate boundary, invariant owner, CQRS/read-model split, failure tolerance, application coordination, or local convention.
Business fact timeline: command -> past-tense fact -> invariant owner -> reaction/process -> consistency/failure tolerance -> repository mechanism. For reactions, repositories, and transaction shapes, reconstruct this timeline and the accepted collaboration model before choosing an event/message, process, repository, or port card. Irreversible facts such as succeeded, accepted, completed, authorized, executed, or externally committed facts outrank open workflow states.

Default-first concept discipline: for Aggregate, Repository, Domain Event, Integration Message, Application Port, CQRS read, Bounded Context, and FSM state, state the normal DDD role before local convention or project-specific tolerance. Local convention can explain a conflict; it is not permission. Accepted design is evidence, not waiver. Return to domain-modeling when model exception pressure appears unless an accepted modeling decision already resolves it; accepted-model placement gaps return to design.

Return routing: Return to domain-modeling for aggregate boundary, lifecycle, invariant, fact language, data authority, bounded context, or failure tolerance uncertainty. Return to design for layer ownership, CQRS split, port placement, adapter boundary, repository API shape, task/runtime wiring, or mechanism containment after the model is accepted. Directly report a violation only when evidence proves a rule break and no new model/design decision is needed.
Build/runtime blockers only block executable verification; Independent static model review still runs. Compile blocker is never a positive model signal. Absence of forbidden nouns is not model proof; optimistic satisfied claims must be falsified against missing timeline, classification, recovery, CQRS, and FSM evidence. Counterfactual gateway: before final checked claims, try to prove a checked conclusion wrong across durable facts, ownership, reactions, language, and reads, and emit a mandatory falsification ledger; no-finding rows are provisional until their falsifier question and inspected evidence are named. checked rows require proof artifacts: transaction evidence can fill evidence, never rule satisfied; QueryRepository names and DTOs are not CQRS proof; accepted design requires independent code evidence. compact output is invalid for lifecycle scope; empty required sections are evidence gaps; checked-with-caveat is not checked. Evidence Matrix cannot replace mandatory proof artifacts; use exact mandatory section names. For lifecycle specs, mandatory review sections are not optional after high-severity findings, and a compile/build blocker cannot remove lifecycle output sections. Run Event Timeline Reconciliation per flow: each past-tense fact needs `fact -> event/process/reconciler owner -> recovery/failure behavior`, and split money execution versus aggregate terminal closure must be classified separately. Recovery reachability proof must name a production path after the original command returns: handler registration alone is not recovery reachability proof, a callable command is not recovery reachability proof unless runtime/API/scheduler wiring invokes it, and a swallowed or logged dispatch failure after a durable fact requires retry, reconciliation, or blocking guards. Treat states named failed, cancelled, pending, or similar as state-language semantics risk when they may describe child-process facts instead of aggregate lifecycle facts.
Compact Mandatory review sections blocks are invalid for lifecycle scope. Lifecycle exact-section gate: If any exact lifecycle section is missing, do not mark any related row checked or Rules Satisfied. Output completion gate must list every exact lifecycle section. Missing exact section becomes evidence gap.
Negative decision inventory runs before findings for lifecycle/repository/event/CQRS scope. All mandatory lifecycle rows start as `unresolved`; Row-local proof is the only promotion path from `unresolved` to `checked`. Findings are generated from negative inventory rows after the inventory is complete. Pre-written findings cannot satisfy inventory rows.
Checked promotion requires non-transaction model proof. Transaction shape, accepted design, semantic repository naming, DTO/query naming, or package separation cannot be the strongest checked evidence; if they are the strongest evidence, downgrade to return/evidence gap/finding. command transaction is not a final collaboration mechanism; accepted atomic transaction requires explicit model decision and failure-tolerance proof. State-language inventory must enumerate every discovered or declared parent state word; Missing configured state words force evidence gap. CQRS inventory rows must be one method or port each; Grouped CQRS rows cannot be checked.
Mandatory rows are decision gates, not summaries. A row that cites a caveat or another finding cannot be checked; downgrade it to the strongest referenced decision. Use one row per Repository/API method that saves or coordinates multiple candidates; grouped method summaries cannot be checked. synchronous command path is evidence, not a collaboration decision; classify Domain Event, process manager, reconciler, task processor, Integration Message, accepted atomic transaction, or evidence gap. If a parent aggregate state is named after a child process outcome, prove the parent lifecycle fact and owner before marking it checked. CQRS checked requires semantic proof beyond names, DTOs, packages, and absent imports.
Finding extraction gate: any mandatory row with finding, return, or evidence gap must become a Finding paragraph or cite an existing finding with the same scope. Split or multi-execution outcomes require one row per execution fact with authorization source, amount/result scope, idempotency/replay rule, failure recovery, and exact aggregate closure condition; command sequencing alone cannot check terminal/execution separation. State-language enumeration must inspect every parent state whose vocabulary looks like pending, failed, cancelled, succeeded, authorized, executed, completed, refunded, settled, or closed. CQRS read-shaped method inventory must inspect every read-shaped method on write repositories or shared adapters. checked rows inherit the strongest negative decision unless independence is proven.
Checked row admission control: Checked-row proof tuple: row scope, model fact, owner proof, coordination proof, forbidden evidence scrub, final decision. Category-level checked decisions are invalid; grouped method/flow/state/port categories and prose summaries are commentary, not admission decisions. semantic lifecycle transaction is red-flag evidence only. synchronous command plus transaction cannot be checked collaboration without an accepted atomic-transaction model decision and failure-tolerance proof. caller-location-only CQRS proof is insufficient; command-side caller location must be paired with returned model family, product-read overlap, write-side influence, and adapter/storage overlap. checked with inherited negative is not checked unless row-local independence proof removes the negative.
Lifecycle exact-section preamble: For lifecycle/repository/event/CQRS scope, do not start with Findings. Output completion gate must appear before any checked decision. Checked Flows is forbidden until exact-section gate and admission control are complete. Missing admission-control table invalidates every related checked row.
Mandatory proof sections are table-backed gates. A prose-only mandatory section counts as missing. Every mandatory proof row must have a stable row id. Every checked row must appear in Checked row admission control with the same row id. Grouped row scopes cannot be checked; split rows that cover multiple methods, flows, execution facts, states, ports, commands, or owners. Output completion gate marks a section non-empty only when table rows exist.
Section-coverage summary claims are invalid. Do not write that lifecycle sections are covered; emit the actual tables. Irreversible fact command-admission matrix: Every durable succeeded, authorized, completed, or executed fact must be tested against later cancel, retry, reopen, or refund commands that can act from stale parent state.
CQRS write-side inventory gate: Inventory every read-shaped method on write repositories and shared adapters before CQRS checked. Query DTO or read facade evidence alone cannot satisfy CQRS; each checked row must name the write-side method/adapter, caller semantics, returned model family, write-side influence, storage/adapter overlap, and why no read facade should own it. All-checked contradiction gate: Do not write all rows checked when any mandatory row is finding, return, evidence gap, grouped, compressed, or missing admission-control proof.
Hard downgrade checked-row filter: Forbidden proof tokens in a checked row force downgrade. checked with caveat, design accepts, accepted by design, xorm tx, accepted atomic write, command-side check, or synchronous command path cannot be decisive checked proof. Accepted atomic transaction requires model decision id and failure-tolerance rule in the same row; otherwise downgrade. Terminal/event timing gate: Terminal/execution checked rows must inspect lifecycle event emission timing and durable fact ordering; command/domain guards alone cannot check terminal/execution separation.
Positive-conclusion quarantine: If any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted, omit Checked flows and positive Rules Satisfied entries. Output completion exact-column gate: A section is present only when its table header exactly matches the required template. Residual-risk summary replaces checked-flow summary while negative decisions exist.
Negative-scope lock: When any lifecycle/repository/event/CQRS row is finding, return, evidence gap, grouped, missing exact columns, or not admitted, every same-scope checked decision is invalid. Use not admitted or not claimed instead of checked for same-scope rows while the lock is active. Grouped method, flow, candidate, state, port, or execution rows cannot be admitted. Independent-scope checked exception requires row-local scope boundary proof.
Not-claimed extraction gate: not claimed cannot be a final mandatory-row decision. Every not-claimed lifecycle/repository/event/CQRS row must become evidence gap, return, or finding. Positive-word scrub: covered, reachable, shape matches, appears guarded, or no blocker found are positive conclusions; downgrade them while negative decisions exist. Bare method-name lists are not CQRS inventory; each row needs caller semantics, returned model family, write influence, storage overlap, and read-facade ownership.
Inventory completeness gate: Mandatory sections are incomplete unless all accepted model and code seeds are inventoried. A blocker cannot shrink lifecycle scope; continue independent flow inventory after high-severity findings. One-row mandatory sections are incomplete when multiple commands, methods, states, events, flows, or read-shaped methods exist. Inventory seeds: lifecycle flows, repository/API methods, collaboration trigger facts, terminal execution facts, parent state vocabulary, domain event names, and read-shaped write-side methods/shared adapters. Collaboration policy inventory: Collaboration rows must include every accepted lifecycle reaction, external side effect, reversal/compensation path, closure/settlement fact, exception/dispute path, and cross-owner reaction found in expected model or code seeds. Each collaboration row must classify mechanism as domain event, process manager, reconciler, task processor, integration message, accepted atomic transaction with failure tolerance, or evidence gap. Full FSM parent-state vocabulary inventory: Every parent state word must be classified as parent lifecycle fact or child/process outcome. Stale-command rights matrix must enumerate retry/start, cancel, reopen, refund/open-dispute/escalate, execution, and closure commands after durable facts. No terminal/execution no-finding without one exact Terminal/execution fact table row per execution fact and aggregate closure fact. No CQRS no-finding without one exact CQRS inventory row per read-shaped write-side method or shared adapter method. Collaboration mechanism rows cannot use application coordination, repository semantic transaction, same DB transaction, or command transaction as final mechanism. Parent-state vocabulary must include pending-like configured parent states, including payment_pending, not only failed or cancelled states. Not admitted cannot be a final mandatory-row decision. Every not-admitted lifecycle/repository/event/CQRS/terminal/state/collaboration row must become same-scope finding, evidence gap, or return route. Finding extraction map must be one-to-one: unrelated rows cannot be grouped under a broad gap id. Stale-command rights matrix rows must contain exactly one durable fact and one later command; grouped command cells such as cancel/retry/execute are invalid. A collaboration row using command transaction, application coordination, repository semantic transaction, or same DB transaction becomes evidence gap/finding/return unless the same row names an accepted atomic decision and failure-tolerance proof. Mandatory-axis completion preflight: final findings are prohibited until every triggered lifecycle, repository/API, collaboration, parent-state, and CQRS axis has an emitted ledger. Severe findings cannot abbreviate mandatory axes; continue inventories after Blocker or Critical findings. Residual positive claims are forbidden when any triggered axis ledger is missing, incomplete, grouped, or skipped. One discovered stale command cannot stand in for the remaining later commands after the same durable fact. Naming, package separation, DTO/query names, and caller location are routing clues only, not final positive proof.
Final-output gate: Lifecycle/repository/event/CQRS scope is a final-output gate, not only a checked/Rules Satisfied gate. When any lifecycle/repository/event/CQRS scope is active, no final Finding paragraph, summary, no-finding claim, Rules Satisfied entry, or residual-risk summary may be emitted until every mandatory axis ledger has been emitted and classified. For lifecycle scope, the mandatory axis ledgers are exhaustive and non-optional: Repository/API candidate classification, Collaboration model table, Parent-state language table, CQRS read-shaped method inventory, Terminal/execution fact table, Per-flow Event Timeline Reconciliation, Recovery reachability table, Irreversible fact command-admission matrix, Finding extraction gate, Strongest-decision inheritance, Output completion gate, and Checked row admission control. A mandatory axis may not be omitted. If no candidates, states, collaborations, or read-shaped methods are found, emit a not applicable row naming the inspected evidence. If the evidence was not inspected, emit evidence gap. Absence of a ledger becomes a missing-axis evidence-gap ledger. Missing axis ledgers block same-scope positive claims, not final artifact emission. Finding paragraphs are generated only from completed inventory rows. A broad finding cannot stand in for missing repository/API, collaboration, parent-state, or CQRS inventory rows. Forbidden final decisions: scoped OK, no issue found, product reads separated, accepted by design, names look correct, used by commands. Axis completion summary is not evidence. Wildcard row families such as RC-*, COL-*, or CQ-* cannot support completion or no-finding claims unless the corresponding visible rows appear in findings, gaps, returns, not-applicable rows, or the ledger appendix. Accepted-design match cannot soften Repository/API candidate classification; missing owner or coordination proof still routes to modeling/design. Collaboration mechanism inventory must extract missing delivery/refund/dispute/settlement/split-closure mechanism rows independently; payment recovery or terminal-fact findings cannot stand in for linked behavior mechanisms. CQRS no-finding requires visible method-level rows with caller semantics, returned model family, write-side influence, storage/adapter overlap, and read-facade ownership.
Dangerous shape default-deny: shape sentinels run before proof promotion. Repository/API methods that save or coordinate several aggregate or lifecycle-owner candidates start as return/evidence gap/finding, not checked or not claimed. Candidate classification chooses the return route; it does not promote the row. Promotion requires row-local proof that every additional candidate is an owned child/value object under one lifecycle owner, or that coordination is handled by a named Domain Event, process manager, reconciler, task processor, Integration Message, or accepted atomic-transaction model decision with failure-tolerance proof. Semantic repository names, accepted design, same transaction/session, cross-table writes, or command-side synchronous coordination cannot waive the sentinel.
First-principles shape challenge: after inventory questions and before admitting any tactical shape, ask: Is this shape genuinely necessary for the business invariant, or compensating for a wrong aggregate/lifecycle boundary? If the answer depends on accepted design, transaction shape, semantic names, DTO/package separation, command sequencing, or local convention without explicit model and failure-tolerance proof, keep the default-deny decision.
Terminal-closure default-deny gate: inventory every terminal lifecycle fact and terminal lifecycle event emission from accepted model sources and code, then map each one to all required execution facts before any checked terminal/execution decision. A terminal lifecycle event or aggregate closure can be checked only when durable ordering proves every required execution fact is authorized, completed or explicitly separated, idempotent/replay-safe, and recoverable before the terminal event is emitted. If code emits terminal lifecycle closure/events before, during, or without proof of all required execution facts, default to finding, return, or evidence gap. Command sequencing, domain guards, same transaction, closure method names, or event names alone cannot admit the row.
Parallel risk-axis review: Run shape-sentinel, lifecycle-spec, and evidence-admission axes independently, then aggregate them side by side. One risk axis cannot clear another risk axis. A checked, evidence-gap, return, finding, or not-applicable decision in one axis cannot satisfy, waive, or mask another triggered axis.

| Role | Classifier question | Typical owner | Route when risky |
|---|---|---|---|
| same-BC reaction | Does this react to one domain fact inside the same bounded context after state is saved? | Domain Event Handler / Application reaction | Shared Umbrella Processor, Business State Classification Outside Domain |
| cross-context contract consumer | Does this consume a published fact or command-like contract from another bounded context? | Integration Message Handler / ACL | Cross-Context Direct Imports, Shared Umbrella Processor |
| boundary publisher | Does this translate same-BC facts into a stable cross-context payload? | Boundary Publisher | Generated Protocol Types in Semantic Ports, Shared Umbrella Processor |
| product read model | Does this answer a product/application read use case without changing state? | QueryRepository / read facade | Command-Side Application Port Reflex, Cross-Context Direct Imports |
| scheduled trigger | Does this enqueue or wake up work on a cadence without doing the business work inline? | PeriodicTask / task definition / scheduler registration | Manual Runner Misplacement |
| task processor | Does this execute one durable task contract and own retry/idempotency semantics for that task type? | Application task processor | Shared Umbrella Processor, Business State Classification Outside Domain |
| runtime loop | Does this start a goroutine/process loop, poll, sleep, back off, or manage shutdown/lifecycle? | Runtime module / shared runtime package | Manual Runner Misplacement, Runtime/Entrypoint Provider Pollution |
| application coordination | Does this orchestrate a use case across repositories, policies, ACLs, events/messages, or task enqueueing? | Named Application service | Command-Side Application Port Reflex, Business State Classification Outside Domain |

Use the classifier to choose a small set of risk cards. If a concept name and the observed role disagree, trust the observed role and report the naming or placement mismatch only after evidence ties it to a boundary rule.

## Calibration Before Probes

Risk cards are portable; probe examples are not. Before treating any probe hit as evidence, identify the repository's local shape:

- bounded-context root paths;
- layer names and package conventions;
- generated code locations;
- RPC framework and handler placement;
- runtime/module wiring style;
- project-specific architecture tests or docs.
- active backend language and framework conventions.

Rewrite probe examples to match that local shape. A probe hit is a review signal, not proof of a violation. Do not report a violation until the hit is mapped to a DDD boundary rule.

Choose the active language reference after the risk card is selected: `ddd-golang.md` for Go, `ddd-python.md` for Python, and `ddd-typescript.md` for TypeScript. For concrete Go / go-jimu building-block questions, start with `ddd-golang.md` and follow its Layer Reference Map: Domain shape routes to `ddd-golang-domain.md`, Application orchestration/logging to `ddd-golang-application.md`, CQRS reads to `ddd-golang-cqrs.md`, persistence adapters to `ddd-golang-infrastructure.md`, and layout to `ddd-golang-scaffold.md`. Use `ddd-golang-events-messages.md`, `ddd-golang-taskqueue.md`, and `ddd-golang-runtime.md` only for Go-specific event/message, taskqueue, or runtime work.

Before using or reporting any probe result, write a short calibration block:

```text
Repo calibration:
- Bounded-context roots:
- Layer names:
- Generated-code paths:
- Runtime/module style:
- Architecture tests/docs:
- Probe rewrites:
```

Never paste a probe example unchanged unless the calibrated repository shape matches it exactly. Probe output is evidence only after it is tied to a specific card decision.

## Routing Matrix

When a card is triggered, load the required references before reporting a violation. The card body still owns the detailed smell, decision, and probe examples.

| Risk card | Required references | Required evidence | Default rule / required action |
|---|---|---|---|
| Cross-Context Direct Imports | `ddd-core.md`, active language guide; Go event/message guide when async contracts are involved | Import path crossing calibrated bounded-context roots; caller/callee layer; whether the import is Domain/Application vs published API/protocol | Default rule: use Integration Messages, read facade, ACL, or protocol contract; missing boundary decision returns to domain-modeling |
| Generated Protocol Types in Semantic Ports | `ddd-core.md`, active language guide | Port/interface signature, Domain/Application package path, generated/protocol type import, mapping boundary evidence | Default rule: map protocol DTOs at boundaries; read DTO contracts need explicit read-side proof |
| Fat Generated RPC Adapter | `ddd-core.md`, active language guide | Generated RPC/IDL adapter method with repository, save, dispatch, enqueue, transaction, or multi-port coordination evidence | Default rule: generated adapter maps -> delegates once -> maps response/error |
| Shared Umbrella Processor | `ddd-golang-events-messages.md` and/or `ddd-golang-taskqueue.md` | Shared processor type, inbound kinds/task types, dependency set, role/side-effect mix, transaction/failure policy | Default rule: one concrete handler/processor per inbound fact or task type; mixed roles return to domain-modeling/design |
| Business State Classification Outside Domain | `ddd-agent-contract.md`, `ddd-core.md`, active language guide | Application/handler/processor branch or helper over business state/status; evidence it drives a business decision, not mapping | Default rule: business state classification lives behind Aggregate methods or Domain policies |
| Command-Side Application Port Reflex | `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md` | New command-side interface, caller use case, semantic capability, rejected Domain/Repository/Domain Event/Integration Message/ACL/Infrastructure alternatives | Default rule: prefer Aggregate, Repository, Domain Service, Domain Event, Integration Message, ACL, Infrastructure adapter, or QueryRepository; unclear capability returns to domain-modeling |
| Aggregate Boundary Conflict | `ddd-modeling-gates.md`, `ddd-core.md`, active language Domain/Infrastructure guide | Repository/API saves or coordinates several candidate roots/lifecycle owners; implementation transaction evidence; owned-child evidence; event-driven coordination evidence; candidate classification table; red-flag evidence such as semantic repository transaction, lifecycle transaction, cross-table transaction, same persistence boundary, or ORM session | Default rule: one Repository saves one Aggregate Root; implementation transaction evidence is not model evidence; transaction-shaped evidence cannot satisfy Repository design; return to domain-modeling |
| Lifecycle Fact Precedence | `ddd-core.md`, active language guide, Go event/message guide when events are involved | Durable succeeded/accepted/completed/authorized/executed facts; open workflow state; retry/cancel/reopen command; Event Timeline Reconciliation; Recovery reachability proof; terminal lifecycle facts and execution facts | Default rule: irreversible facts dominate lagging workflow projections; recovery gaps return to design or become violations |
| FSM Contract Drift | active language Domain guide and runtime dependency evidence | Dependency version/API; StateContext contract; transition helper; state-specific behavior methods; tests for state polymorphism | Default rule: lifecycle FSMs must match the adopted library contract and keep state-specific behavior in states |
| CQRS Read/Write Blend | `ddd-core.md`, active language CQRS/read-side guide | Repository/interface mixing aggregate load/save with product list/detail/history/projection reads; caller semantics; read model family | Default rule: write-side aggregate Repository and product QueryRepository/read facade stay separate unless the read is command-side Domain fact lookup |
| Manual Runner Misplacement | `ddd-agent-contract.md`, `ddd-golang-taskqueue.md`, `ddd-golang-runtime.md`; active language guide when non-Go | Manual polling, reconciliation, scheduler, backlog drain, recovery, or outbox-drain loop evidence; lifecycle/start-stop ownership; cadence/backoff/limit policy; business work delegated inline vs through a task/processor | Default rule: scheduled/retry/runtime loops live in taskqueue/runtime; business lifecycle ambiguity returns to domain-modeling/design |
| Runtime/Entrypoint Provider Pollution | active runtime/language guide where available | Process entrypoint provider construction, business-layer imports, generated route registration, lifecycle/config ownership evidence | Default rule: entrypoint loads config, selects modules, and runs the app |
| Technical Bounded Context | `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md` | Product/operator language, lifecycle/state/invariant ownership, adapter-detail exclusion evidence | Default rule: bounded contexts follow product language and stable invariants, not technology nouns |

## Cards

### Cross-Context Direct Imports

- **Smell:** one bounded context imports another context's `domain/` or `application/`.
- **Probe examples:** for Go repos with `internal/<context>/<layer>` layout, start from `rg -n 'internal/.*/(domain|application)' internal` and then narrow by actual bounded-context roots.
- **Decision:** use Integration Messages, published read facades, ACL, or protocol contracts.
- **Return path:** missing bounded-context contract returns to `domain-modeling`; compatibility bridges need a migration target.
- **Reference:** `ddd-core.md`, active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`), and Go event/message guide when applicable.

### Generated Protocol Types in Semantic Ports

- **Smell:** command-side or Domain-facing ports mention `pkg/gen`, `gen/go`, `proto.Message`, or ConnectRPC request/response types.
- **Probe examples:** in Go/protobuf repos, search semantic inward layers for generated-code imports, e.g. `rg -n 'pkg/gen|gen/go|proto\.Message|connect\.Request|connect\.Response' <domain-or-application-paths>`.
- **Decision:** map generated DTOs at Interface/Application/Infrastructure boundaries.
- **Return path:** unclear read-side contract returns to `design`; protocol DTOs are not Domain objects.
- **Reference:** `ddd-core.md` and active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`).

### Fat Generated RPC Adapter

- **Smell:** generated RPC/IDL adapter methods contain repository calls, saves, dispatch, enqueueing, transactions, or multi-port coordination. The smell is a fat generated RPC adapter body, not the calibrated placement itself.
- **Probe examples:** inspect generated adapter implementations for persistence, dispatch, enqueueing, transaction, or multi-port coordination calls; rewrite the search to match the repository's generated framework and handler location.
- **Decision:** keep generated adapter methods as map -> delegate once -> map response/error. Do not move a thin generated adapter solely to satisfy a generic Interface layer example.
- **Default rule:** small actor/auth extraction may prepare a command/query; repository, dispatch, transaction, or multi-port coordination still belongs behind one delegate.
- **Reference:** `ddd-core.md` and the active language guide.

### Shared Umbrella Processor

- **Smell:** many one-kind message handlers delegate to one large `Processor` with unrelated message families or dependencies.
- **Probe examples:** search async handler packages for shared processors or multi-kind dispatchers, e.g. `rg -n 'type Processor|NewProcessor|processor\.|switch .*Kind|Listening\\(\\)' <message-or-task-handler-paths>`.
- **Decision:** prefer one concrete handler/processor per inbound fact or task type.
- **Return path:** mixed roles, source families, side effects, or failure policies return to `domain-modeling` / `design`.
- **Reference:** `ddd-golang-events-messages.md`, `ddd-golang-taskqueue.md`.

### Business State Classification Outside Domain

- **Smell:** Application, message handlers, or task processors define helpers like `isTerminal`, `hasLiveRuntime`, `countsAsActive`, or branch directly on business `State`/`Status`.
- **Probe examples:** search Application/handler/processor layers for state classification helpers or direct business-state branches, e.g. `rg -n 'isTerminal|hasLiveRuntime|countsAsActive|requiresCleanup|\\.State|\\.Status' <application-paths>`.
- **Decision:** put stable state classification behind Aggregate methods or Domain policies.
- **Default rule:** mechanical DTO/read-model/proto mapping is not business state classification.
- **Reference:** `ddd-agent-contract.md`, `ddd-core.md`, and active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`).

### Command-Side Application Port Reflex

- **Smell:** a command handler gets a new interface only because it needs to call an external mechanism.
- **Probe examples:** review new command-side interfaces and names ending in `Client`, `Publisher`, `Router`, `Directory`, `Writer`, `Sender`, or `Fetcher`.
- **Decision:** classify capability first; prefer Aggregate method, Repository, Domain Service, Domain Event, Integration Message, ACL, or Infrastructure adapter.
- **Return path:** if the need cannot be placed in a normal Domain/Application/Infrastructure role, return to `domain-modeling`.
- **Reference:** `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md`.

### Aggregate Boundary Conflict

- **Smell:** a Repository/API method appears to save or coordinate several candidate roots/lifecycle owners and the review cites transaction shape, table writes, or a semantic store method name.
- **Probe examples:** inspect Domain repository interfaces for `Save*` methods with several Domain parameters; classify each parameter in a candidate classification table as aggregate root candidate, owned child/value object, decision record, execution record, domain event reaction, read model, external fact, or persistence record.
- **Decision:** semantic repository methods are evidence, not proof. This is a default-deny shape sentinel, not a neutral proof request. semantic repository method or transaction touching multiple candidate lifecycle owners must produce a candidate classification table. The row starts as return/evidence gap/finding and must also produce an Aggregate Boundary Candidate Ledger with role, owner proof, Repository/API evidence, decision, and return route. Use one row per Repository/API method that saves or coordinates multiple candidates, and classify every parameter/record as aggregate root candidate, owned child/value object, decision record, execution record, domain event reaction, read model, external fact, or persistence record. Unclassified or owner-unproven candidates cannot be checked. Candidate classification alone chooses the return route; it cannot promote the row to checked. Implementation transaction evidence is not model evidence. Red-flag evidence includes semantic repository transaction, lifecycle transaction, cross-table transaction, same persistence boundary, `xorm.Session`, `gorm.Tx`, or multi-record lifecycle writes. transaction-shaped evidence cannot satisfy Repository design and cannot be marked Rules Satisfied. Prefer one aggregate boundary or Domain Event / process manager / reconciler coordination. If the model is unclear, return to `domain-modeling`; if the accepted aggregate is clear but Repository API shape, CQRS split, or adapter mapping is wrong, Return to design.
- **Return path:** reopened modeling decides aggregate boundary, lifecycle owner, event facts, and recoverability before any Repository design.
- **Reference:** `ddd-modeling-gates.md`, `ddd-core.md`, active language Domain/Infrastructure guide.

### Lifecycle Fact Precedence

- **Smell:** a command treats an open workflow state as permission to retry, cancel, reopen, or refund even though a durable succeeded/accepted/completed/authorized/executed fact already exists.
- **Probe examples:** compare lifecycle commands with event/reaction/reconciler gaps; enumerate every command that still admits retry, cancel, reopen, or refund from the workflow aggregate state without checking durable execution or decision records.
- **Decision:** irreversible business facts outrank stale workflow state. Require Event Timeline Reconciliation, Recovery reachability proof, and separation of terminal lifecycle facts and execution facts before marking coverage satisfied. Split or multi-execution outcomes require one row per execution fact with authorization source, amount/result scope, idempotency/replay rule, failure recovery, and exact aggregate closure condition; command sequencing alone cannot check terminal/execution separation. Handler registration alone is not recovery reachability proof; a callable command is not recovery reachability proof without a production entrypoint.
- **Return path:** missing precedence or recovery design returns to `design`; concrete retry/cancel/reopen behavior after an irreversible fact is a violation.
- **Reference:** `ddd-core.md`, active language guide, and event/message guide when a same-BC reaction or reconciler is involved.

### FSM Contract Drift

- **Smell:** lifecycle code uses an adopted FSM library as a transition table only, relies on removed/old API calls, or keeps state-specific behavior in aggregate/application `switch` branches.
- **Probe examples:** inspect dependency version, `StateContext` implementation, transit helper calls, raw state mutation, `HasTransition` pre-checks, and tests for state-specific behavior.
- **Decision:** FSM Contract Drift has API compatibility and state-polymorphism subrows. Match the selected library API and preserve state polymorphism. API mismatch is a build/runtime violation; state-polymorphism bypass is Domain behavior drift.
- **Reference:** active language Domain guide.

### CQRS Read/Write Blend

- **Smell:** one Repository or port both saves mutable aggregates and serves product list/detail/history/projection reads.
- **Probe examples:** compare repository methods and call sites; distinguish command-side fact lookup from UI/API read models.
- **Decision:** command writes use Domain Repositories; product reads use QueryRepository/read facades grouped by read-model family. The presence of QueryRepository names is not proof; shared infrastructure implementation does not prove CQRS separation. CQRS checked requires semantic proof beyond names, DTOs, packages, and absent imports. CQRS read-shaped method inventory must inspect every read-shaped method on write repositories or shared adapters. Classify caller semantics, DTO/read-model family, write-side repository methods, write-side product-read overlap, query-adapter write authority, shared storage/adapter coupling, and whether reads influence write-side decisions.
- **Return path:** accepted-model repository/read-side split gaps return to `design`.
- **Reference:** `ddd-core.md` and active language CQRS/read-side guide.

### Manual Runner Misplacement

- **Smell:** a bounded-context root or composition package owns a manual polling, reconciliation, scheduler, backlog drain, recovery, or outbox-drain loop that starts its own runtime loop, including calling an Application scheduler/service from a root package loop.
- **Probe examples:** search calibrated module roots and runtime packages for `*_drain`, `*scheduler`, `*reconcile`, `fx.Lifecycle`, `OnStart`, `OnStop`, `go func`, `time.NewTimer`, `time.NewTicker`, `Interval`, `Backoff`, `Limit`, `for {`, or equivalent lifecycle/timer constructs. The filename is only a routing clue; require loop/lifecycle/cadence evidence.
- **Decision:** classify the responsibility first. Scheduled triggers and polling/reconciliation work route to taskqueue/polling/periodic guidance; business task semantics live with the owning Application task/processor or coordination service; shared worker/scheduler lifecycle lives in runtime infrastructure such as `internal/pkg/taskqueue`. Bounded-context module roots may contribute providers/tasks/processors but should not hide manual loops, retry/backoff, shutdown, or provider lifecycle policy.
- **Return path:** unclear business lifecycle or coordination ownership returns to `domain-modeling`; runtime-only placement goes to runtime/taskqueue references.
- **Reference:** `ddd-agent-contract.md`, `ddd-golang-taskqueue.md`, `ddd-golang-runtime.md`, and the active language guide when not Go.

### Runtime/Entrypoint Provider Pollution

- **Smell:** the process entrypoint constructs repositories, query repositories, ACL clients, handler wrappers, or generated route handlers.
- **Probe examples:** search calibrated entrypoint/composition roots for business-layer imports, generated route registration, and provider-heavy wiring; in Go/fx repos this often includes `cmd/<service>/main.go` and `fx.Provide`.
- **Decision:** the process entrypoint loads config, selects modules/composition roots, supplies process options, and runs the app.
- **Return path:** business-layer provider construction returns to module/design review; process-owned providers need runtime impact notes.
- **Reference:** active runtime/language guide where available.

### Technical Bounded Context

- **Smell:** a context uses infrastructure-shaped terms such as pod, namespace, mount, supervisor, lease, or worker.
- **Probe examples:** inspect whether those terms appear in product/operator language and own stable lifecycle rules; do not classify by keyword alone.
- **Decision:** technical terms may be Domain language only when the bounded context is itself a runtime substrate.
- **Default rule:** record stable lifecycle/invariant before accepting technical language, and keep deployment adapter details out of Domain.
- **Reference:** `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md`.
