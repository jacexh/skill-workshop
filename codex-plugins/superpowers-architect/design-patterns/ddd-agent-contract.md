---
name: ddd-agent-contract
description: Mandatory agent execution contract for DDD, Go runtime, Go events/messages, and Go taskqueue work. Use BEFORE reading ddd-modeling / ddd-core / ddd-golang / ddd-golang-events-messages / ddd-golang-runtime / ddd-golang-taskqueue or editing any file under internal/business/**, domain/, application/, infrastructure/, cmd/**/main.go, internal/pkg/**, configs/**, event/message handlers, taskqueue/asynq wiring, periodic task schedulers, or fx lifecycle / shutdown wiring. Defines trigger conditions, execution order, stop protocol, prohibited actions, and completion self-check for code agents.
---

# DDD Code Agent Usage Contract

**Version**: v1.5
**Date**: 2026-05-29
**Audience**: Claude Code, Codex, and any other code agent expected to follow this repository's DDD standards.
**Scope**: This is a behavior contract, not an architecture spec. It tells an agent **when** to read which DDD pattern, in **what order**, when to **stop and ask**, what **never** to do, and what to **self-check** before reporting work as complete.

> If you are a human reading this, you may skim and go directly to [`ddd-modeling.md`](ddd-modeling.md) / [`ddd-core.md`](ddd-core.md) / [`ddd-golang.md`](ddd-golang.md). The rules below exist because LLM agents tend to skip preconditions and copy snippets out of context — this page defends against that.

---

## 0. Hot Path: Before Adding an Application Command-Side Port

Application command-side ports are exceptions. Before creating one, answer this decision card in order:

1. Rule on one aggregate? -> Aggregate method.
2. Write-side aggregate collection? -> Domain Repository.
3. Rule spanning aggregates? -> Domain Service. Multi-step orchestration without a domain rule? -> named Application coordination service.
4. Repeated reaction to one same-BC domain fact? -> Domain Event + one same-BC handler.
5. Cross-context fact propagation? -> Integration Message.
6. Read-only product view? -> Application QueryRepository/read facade returning DTOs.
7. External protocol, storage, routing, retry, topology, or vendor translation? -> Infrastructure adapter or ACL.
8. Only after all above are rejected -> exceptional Application command-side port with the rejection reason in the Architecture Gate.

Semantic fake rule: if the only meaningful fake is "pretend the external side effect succeeded", do not create an inward port; keep the mechanism behind Repository, QueryRepository, ACL, event/message publisher, named Application coordination service, or Infrastructure.

---

## 1. Trigger Conditions (when this contract applies)

Apply this contract whenever **any** of the following is true:

- The task touches files under `internal/business/<context>/**` or paths named `domain/`, `application/`, `interfaces/`, `infrastructure/`.
- The task mentions any of: bounded context, aggregate, value object, repository, domain event, integration message, CQRS, anti-corruption layer, clean architecture, domain-driven design, DDD.
- The task is a backend implementation plan, refactor, code review, or architecture decision affecting one of the above.
- The task involves a new use case (command / query / event handler) inside an existing bounded context.
- The task is a cross-context change (publishing a new integration message, exposing a new read port, adding an ACL).
- The task mentions or edits Domain Events, `event.Collection`, Domain Event Handlers, Boundary Publishers, Integration Messages, `message.Publisher`, `message.Handler`, `message.Subscriber`, `message.Runner`, Kafka message adapters, Kafka `FailurePolicy`, `application/eventhandler`, `application/messagepublisher`, or `application/messagehandler`.
- The task touches Go runtime wiring: `cmd/**/main.go`, `internal/pkg/**`, `configs/**`, `fx.Module`, `fx.Lifecycle`, `OnStart` / `OnStop`, config loading, middleware client ownership, graceful shutdown, or Kubernetes `preStop`.
- The task mentions or edits task queues, polling tasks, reconciliation jobs, scheduled/background jobs, periodic task producers, asynq schedulers, `TaskType`, `PeriodicTask`, `PeriodicTaskScheduler`, task payload schemas, task processors, `internal/pkg/taskqueue`, worker lifecycle, task middleware, delayed enqueueing, or schema registry wiring.

If unsure whether the contract applies: **assume it does** and read the contract once. The cost is small; the cost of skipping the gate is large.

---

## 2. Mandatory Execution Order

Agents must follow this sequence. Do not jump to planning, editing, or reviewing before classifying the task and reading the required specs.

```
1. Read this contract               (§0–§6 of this file)
2. Classify the task path           (DDD/business, Go events/messages, Go taskqueue/polling/periodic, Go runtime-only, or mixed)
3. Read the required specs          (see the matrix below)
4. Plan / edit / review code        (cite sections for non-trivial architecture decisions in plans, reviews, PR descriptions, or architecture notes; ordinary final summaries do not need section-by-section citations)
5. Run the matching self-check      (§5 below) before claiming the work is done
```

Required spec matrix:

- For **new bounded context or new aggregate** → read `ddd-modeling.md`, `ddd-core.md`, and the active language guide; emit the Architecture Gate core block and placement extension from modeling §0.
- For **new use case inside an existing context** → read modeling §7.2, all of core, and the relevant language sections (file org, event/message wiring, error/logging); emit the Architecture Gate core block and placement extension from modeling §0.
- For **local change inside an existing business layer** → read modeling §7.1, the affected core section, and the affected language sections; emit the Architecture Gate core block from modeling §0, adding the placement extension only when the change touches one of its fields.
- For **cross-context change** → read modeling §7.4 and core §5 in addition to the language guide; emit one Architecture Gate core block and placement extension per affected side when the change spans producer and consumer contexts.
- For **Go event/message work** (Domain Events, event handlers, Boundary Publishers, Integration Messages, message handlers, `message.Runner`, Kafka message adapters, Kafka `FailurePolicy`) → read `ddd-golang-events-messages.md` in addition to the matching DDD/business row above. If the work only changes shared eventbus/message adapter runtime wiring, also read `ddd-golang-runtime.md` and state lifecycle/config/shutdown impact.
- For **Go runtime-only work** (`cmd/**/main.go`, `internal/pkg/**`, `configs/**`, `fx.Lifecycle`, shutdown, Kubernetes) that does not change a bounded context, aggregate, repository, command/query handler, event/message contract, or domain rule → read `ddd-golang-runtime.md` and the relevant Go layout section in `ddd-golang.md`; do **not** emit the DDD Architecture Gate. Instead, state the runtime component, module-assembly boundary, ownership, lifecycle hook, config, and shutdown impact.
- For **Go taskqueue / polling / periodic / asynq work** → read `ddd-golang-taskqueue.md` and `ddd-golang-runtime.md`. If the change adds or modifies task processors, task payloads, enqueueing decisions, polling policy, periodic task definitions, or scheduler registration inside a bounded context, also follow the matching DDD/business row above and emit the Architecture Gate for the business side. If it only changes `internal/pkg/taskqueue` runtime wiring, do not emit the DDD Architecture Gate; state the taskqueue component, ownership, lifecycle hook, config, schema/processor/periodic registration impact, and shutdown impact.
- For **mixed business + runtime work** → read both the DDD path above and `ddd-golang-runtime.md`; emit the DDD Architecture Gate for the business change and include runtime impact in the plan.

If `ddd-modeling.md` defines a richer Architecture Gate format, emit that format, not the generic `standards` skill block. Never emit both.

---

## 3. Stop Protocol (when the agent must ask, not guess)

Before stopping, inspect the existing repository context first: current package paths, neighboring code, tests, docs, project knowledge, and existing module names. If the answer is still unknown or ambiguous after that inspection, the agent must **stop and ask the user** — not invent answers, not fill `n/a` to bypass — when any of the following is unknown or ambiguous:

| Unknown | Why stopping matters | What to ask |
|---|---|---|
| Bounded context the change belongs to | Wrong context → wrong package path, wrong language, wrong owner | "Which bounded context owns this change? <list candidates from current modules>" |
| Aggregate root affected | Wrong aggregate → wrong invariant scope, wrong transaction boundary | "Which aggregate's invariants does this touch?" |
| Business invariant being protected | No named invariant → cannot justify aggregate grouping or transaction boundary | "What rule must always be true after this change?" |
| Layer ownership (Domain / Application / Infra) | Wrong layer → import-boundary violations, leaked rules | "Is this a domain rule, an orchestration concern, or an external-system adapter?" |
| Technical-capability classification (registry / dispatcher / scheduler / connector) | Misclassified → ends up in Infrastructure with hidden rules | "Does this capability own stable language / states / policies, or only adapt an external system?" |
| Multi-aggregate write justification | Skipping the exception gate produces broken consistency boundaries | "Why does this need to write multiple aggregates in one transaction? Can it be split via Domain Events / Integration Messages / a named Application coordination service?" |
| Integration Message contract & payload | Guessing breaks downstream consumers | "Is this a new Integration Message? Which consumers depend on it? What is the minimum required payload?" |
| Port semantic name (when tempted to use `Cacher`, `RedisStore`, `Peer`, `Directory`, etc.) | Technology-shaped or routing-shaped port leaks Infrastructure inward | "What is the use-case semantic this port serves? (rate-limit / lease lifecycle / product read model / repository / ...), and which parts are only routing, transport, or topology mechanics?" |

**Hard rule**: if any required field in the Architecture Gate core block or required placement extension would have to be `n/a — <reason>` only because the agent does not know the answer, that is a Stop condition. `n/a` is reserved for cases where the change genuinely does not touch that field (per modeling §0).

---

## 4. Agent Must Not Do (prohibited actions)

These are the most common DDD failure patterns an LLM produces when it shortcuts the spec. Each one is rejected on review; do not commit any of them.

1. **Create technology-shaped ports.** Do not add `Cacher`, `RedisStore`, `RedisClient`, `MysqlReader`, `LockClient`, `TxManager`, `UnitOfWork`, `TransactionalEventPublisher`, or `BrokerPublisher` as Domain / Application interfaces. Compose those clients and transaction mechanics inside Infrastructure behind an existing `Repository` / `QueryRepository` / semantic port. (core §3.4, modeling §0.2; golang §3.4)
2. **Create omnibus read/write store ports.** Do not expose one `MessageStore`, `EventStore`, `AuditStore`, `DataStore`, or similar interface to multiple use cases when it mixes producer writes, UI/API history, audit/correlation lookup, projection bootstrap, high-watermark reads, or other unrelated consumer views. Split by Command vs Query side and by consumer-specific semantics; one Infrastructure adapter may implement several semantic capability-lifecycle ports. (core §3.2, modeling §0.2)
3. **Put generated proto / `pb.Message` into Domain.** Domain methods, value objects, repository interfaces, and domain events must use Domain-owned types. Convert `Proto ↔ Domain` at the Application or Infrastructure boundary. (core §5.7, golang §2.3)
4. **Implement business validation in Application / Handler.** Application constructs Domain inputs and calls Domain `Validate()` / domain methods. It must not run `validator.Struct(req)` against Domain fields or reproduce field rules in handlers. (core §3.1, §3.2)
5. **Load a full Aggregate to serve a UI read.** Use the read path — Application-owned `QueryRepository` returning DTOs. Aggregates are write-side. (core §3.2, §3.4)
6. **Import another context's `domain/` package.** Cross-context interaction uses one of: Integration Messages, cross-context query ports (`<ctx>/api/queries.go`), ACL, protocol contracts. Direct `import` of a neighbor's Domain is prohibited. (core §5, golang §5.1)
7. **Write multiple aggregates in one transaction "because the ORM makes it easy".** The default is one aggregate per transaction. Multi-aggregate transactions require the exception gate in core §3.2. `xorm.Session` / `gorm.Tx` convenience is not a justification.
8. **Drain Domain Events inside the Repository.** Only the Application layer calls `aggregate.Events.Drain()`, `aggregate.DrainEvents()`, or the repository's established narrow drain accessor, and only once, after a successful `Save()`. (core §3.1, golang §3.1)
9. **Treat Domain Events and Integration Messages as the same thing.** Domain Events are bounded-context-internal facts (publisher's ubiquitous language, refactorable freely). Integration Messages are the cross-context contract (additive evolution, consumer-visible). Same struct ≠ same concept. (core §5.3)
10. **Use Aggregate fields as the business decision API.** Mechanical DTO/DO mapping may read or assign exported fields, but business decisions and state changes go through Aggregate Root methods that enforce invariants. Do not branch in Application/handlers/processors on fields such as `Status`, `Version`, or deadline flags when the decision belongs behind an entity method, and do not assign fields to perform a state transition. Anemic aggregates (fields plus getters/setters with rules in handlers) are rejected. (core §3.1, golang §3.1)
11. **Generate aggregate IDs from database auto-increment.** Domain generates IDs (UUID / ULID / Snowflake) inside the factory method. Database auto-increment couples Domain to Infrastructure. (core §3.1, §1.3)
12. **Dispatch events before the persist succeeds.** Order is: call domain method → persist → drain → dispatch. Dispatching before persist creates events for state the system may later disown. (core §6.1)
13. **Define a Domain-facing port in Infrastructure and import it inward.** Inward layers define their ports; outer layers implement them. Never the reverse, even when the port "looks technical". (core §1.3, §3.1)
14. **Use dependency inversion as the sole justification for an Application port.** Do not add a Domain/Application interface only because an inward layer triggers an outward implementation. Classify the capability first; if the interface exposes only routing, transport, storage, deployment, retry, or adapter-selection mechanics, keep it in Infrastructure. (modeling §0.1-§0.2, core §3.2-§3.4)
15. **Promote routing/topology mechanics into Application ports.** Do not define `Peer`, `Directory`, `Router`, `Forwarder`, or `OwnershipLookup` as Domain/Application interfaces when they expose peer addresses, instance IDs used only for routing, cache/coordination ownership read models, RPC request/response forwarding, hop headers, retry/backoff knobs, queue subjects, storage tables/keys, replica selection, or deployment topology. Keep those in Infrastructure. A lease/ownership lifecycle port is allowed only when the Application use case observes stable lifecycle semantics; it must not also answer address lookup or forwarding questions. (modeling §0.1-§0.2, core §3.2-§3.4)
16. **Invent local substitutes for the adopted Go component libraries.** In Go DDD code using this guide's project-default stack, do not define project-local `DomainEvent`, `EventBus`, `EventDispatcher`, `MessagePublisher`, `MessageSubscriber`, `MessageRunner`, `FailurePolicy`, `TaskType`, `TaskQueue`, `TaskWorker`, `TaskSchemaRegistry`, `PeriodicTask`, `PeriodicTaskScheduler`, `StateMachine`, `LoggerHelper`, `ConfigLoader`, or similar equivalents for concerns already covered by `ddd-golang.md`'s default library table. Use the adopted library interfaces directly (`github.com/go-jimu/components/ddd/event`, `github.com/go-jimu/components/ddd/message`, `github.com/go-jimu/contrib/message/kafka`, `github.com/go-jimu/components/taskqueue`, `github.com/go-jimu/contrib/taskqueue/asynq`, `github.com/go-jimu/components/fsm`, `github.com/go-jimu/components/sloghelper`, `github.com/go-jimu/components/config`, etc.) unless existing repository code or explicit user direction establishes an exception. (golang §3.1, §7; taskqueue §2)
17. **Mechanism-operation-granular Application/Domain port.** Do not slice the lifecycle of one capability -- observe / mutate / publish / transfer / retire / recover / release -- into multiple `*Reader`, `*Writer`, `*Stream`, `*Opener`, `*Sender`, `*Fetcher`, or similarly verb-suffixed ports. If a single Application use case is about to inject two or more ports that look like different verbs on the same noun, review whether they are one lifecycle; at three or more, stop and re-group unless the semantic split is justified in writing. They usually belong on one capability-lifecycle port. Default naming starts from a domain noun plus lifecycle role; verb-suffix names require an explicit justification of why the capability is one-directional. (modeling §0.2.1)
18. **Capability-fragmented port — a new use case is not automatically a new port.** When a new use case touches a semantic capability whose port already exists (same aggregate, same consistency boundary, same failure/authorization semantics), the default action is to add a method to that port, not to create a new one. Fork only when the new caller observes different freshness, ordering, authorization, pagination, failure, consistency-window semantics, published API surface, dependency direction, test substitute, or aggregate. This preserves Go-style small interfaces when caller semantics truly differ, while rejecting one-method ports created only to mirror adapter operations. (modeling §0.2.2, core §3.2)
19. **Application command-side port as default abstraction.** Do not create an Application command-side port merely because a Command Handler needs to call, mock, listen to, publish, route, or finalize something. First place the need as Domain Repository, Aggregate method, Domain Service, Domain Event handler, Integration Message, ACL, Application QueryRepository/read facade, or Infrastructure adapter. A command-side Application port that survives must have an Architecture Gate exception explaining why none of those mechanisms owns the semantic need. (modeling §0, §0.2.3; core §3.1 Domain Mechanism Placement)
20. **Repeated side-effect handling without a Domain Event.** Do not duplicate the same post-state-change side effect across multiple Command Handlers, subscribers, adapters, or local listeners. If the reaction is triggered by the same same-BC domain fact, emit one Domain Event from the aggregate and handle it with one Domain Event Handler after `Save()`. If the reaction crosses bounded contexts, translate the Domain Event or explicit published fact into an Integration Message. Direct per-use-case side-effect calls are allowed only when the side effect is an explicit output of that command and the Architecture Gate says why it is not event/message-driven. (core §3.1 Domain Event Collection, §5.3, §6)
21. **Suspicious naming without placement justification.** Do not name an Application/Domain interface `*Policy`, `*Specification`, `*Allocator`, `*Generator`, `*Resolver`, `*Finalizer`, `*Terminator`, `*Closer`, `*Calculator`, `*Scorer`, `*Pricer`, `*Decider`, `*Authorizer`, `*Validator` (outside Domain `Validate()`), `*Sink`, `*Hook`, `*Observer`, `*Client`, `*Directory`, `*Router`, or `*Forwarder` without an Architecture Gate entry under "Domain mechanism placement before Application ports". The entry must answer which DDD mechanism owns the need, not merely rename the interface. Application interfaces that survive must record the exception reason. (modeling §0.2.3)
22. **Umbrella asynchronous handlers.** Do not create or grow a generic `EventHandler`, `MessageHandler`, `TaskHandler`, or `Handler` concrete type that listens to unrelated Domain Events / Integration Messages / task types and dispatches internally with a large `switch`, many `On*` methods, `Listening() []string` for task types, or chains of type assertions. Default to one inbound event/message kind per concrete handler and one `taskqueue.Processor` per `TaskType`. Multi-kind handlers require the same role, source context or contract family, target side effect, transaction boundary, failure policy, and dependency set to be stated in the Architecture Gate. Multi-task processors are rejected unless the taskqueue guide's one-processor-per-TaskType rule has an explicit documented exception. (core §5.3 Async Reaction Roles; golang §3.2; taskqueue §3-§4)
23. **Mixed asynchronous handler roles.** Do not implement same-BC Domain Event consumption and Integration Message consumption on the same concrete type. Classify each asynchronous reaction as Domain Event Handler, Boundary Publisher, or Integration Message Handler. A Boundary Publisher may consume a same-BC Domain Event and publish an Integration Message, but it must not consume Integration Messages, mutate aggregates, or advance workflow state. (core §5.3 Async Reaction Roles; golang §3.2)
24. **Periodic scheduler callbacks and unstable periodic policy.** Do not add scheduler `HandleFunc`, callback registration, or business-service calls for periodic taskqueue work. Periodic producers enqueue concrete `taskqueue.PeriodicTask` values; the normal one-`TaskType`, one-`Processor` task contract handles execution. Do not model config toggles as `PeriodicTask.Enabled`, combine `IntervalSchedule` with `WithLocation`, put `WithProcessAt` / static `WithDeadline` into a periodic enqueue policy, or hide business-visible scheduling/deadline/eligibility rules inside processor-local conditionals. (taskqueue §1, §5)
25. **Bloated Go RPC shortcut.** Do not use `application/application.go` as a place for business branches, transaction control, repository calls, event/message dispatch, task enqueueing, or cross-port coordination just because it implements a generated gRPC/ConnectRPC stub. The shortcut is only protocol mapping, one delegate call, response/error mapping, and small actor extraction. Larger workflows move to `application/command`, `application/query`, or a named Application coordination service. (golang §3.3)
26. **Bloated Go fx entry point.** Do not use `cmd/<service>/main.go` as the place to construct shared middleware clients, repositories, query repositories, ACL clients, routing directories, publishers, handler wrappers, or cross-context HTTP/client adapters. `cmd` loads config, supplies the aggregate `Option`, selects modules, sets process-level fx options, and runs the app. Shared runtime wiring belongs in `internal/pkg/module.go`; multi-service differences are named module variables there (`FooModule`, `BarModule`, etc.) that each entry point loads. Bounded-context providers and handler registration belong in the bounded-context module. Adapter details belong in Infrastructure/ACL packages, not inline `fx.Provide` closures in `cmd`. (golang-runtime §2.2)

> When uncertain whether a pattern is on this list, search this file for the keyword (`Cacher`, `proto`, `validation`, `drain`, `Policy`, `Allocator`, `Domain Event`, `Integration Message`, …) before committing.

---

## 5. Completion Self-Check

Before claiming a task is done, run the matching checklist. Treat any applicable "no" as work remaining.

### 5.1 DDD / Business-Code Self-Check

- [ ] **Gate emitted**: the Architecture Gate core block from modeling §0 (plus the placement extension when required) appears in the plan / PR description with concrete values, not `n/a` substituted for unknowns.
- [ ] **Layer imports clean**: `domain/` has no imports of frameworks, generated proto, storage drivers, queue clients, HTTP/gRPC packages, `internal/pkg/*` adapters, `internal/.../infrastructure`, or another context's `domain/`. (Grep before claiming done.)
- [ ] **Capability before port ownership**: every new interface was classified first as Domain-facing, Application orchestration, or Infrastructure; dependency inversion alone was not used as the reason for an Application port.
- [ ] **CQRS port granularity**: every new interface is named for a use-case semantic capability, command/query side, and consumer-specific product view. No item from §4(1), §4(2), the dependency-inversion-only prohibition, or the routing/topology prohibition was introduced.
- [ ] **Capability lifecycle coherence**: every new port corresponds to the full lifecycle of one stable semantic capability; no capability has been sliced into per-mechanism-operation or per-verb ports. If two or more ports in this change look like different verbs on the same noun, they were reviewed as one lifecycle; if three or more appear, they were re-grouped or the split was explicitly justified.
- [ ] **Port evolution path**: when touching an existing capability, the default was to add a method to the existing port. If a new port was introduced, the caller's freshness / ordering / authorization / pagination / failure / consistency-window / published API / dependency direction / test substitute difference from the existing port is named in writing.
- [ ] **Transaction boundary**: each Command Handler writes one aggregate per transaction, or the multi-aggregate exception in core §3.2 is satisfied in writing; raw transaction/session plumbing is not exposed as an Application/Domain port.
- [ ] **Event lifecycle**: events are collected inside domain methods, persisted before dispatch, drained once by Application after `Save()`, never by Repository.
- [ ] **Cross-context paths**: any cross-context communication uses one of Integration Messages / cross-context query port / ACL / protocol contracts; no new direct import of a neighbor's `domain/`.
- [ ] **Validation contract**: Domain types expose `Validate()` (or the language's equivalent); external layers call it rather than re-validating Domain fields.
- [ ] **If code changed, tests on the changed layer**: Domain rules covered by pure unit tests; Application orchestration covered with Repository/QueryRepository mocks; Infrastructure covered by integration tests against real dependencies (test containers or equivalent).
- [ ] **If docs / plans only changed**: references, section links, duplicated plugin copies (`plugins/` and `codex-plugins/`), and examples were checked for consistency.
- [ ] **Naming**: aggregate / event / command / handler / repository naming matches the language guide's convention table.
- [ ] **P1 Port eligibility**: every new inward interface appears in the Architecture Gate with its semantic need and owner; suspicious names from modeling §0.2.3 have a written placement answer; command-side Application ports have an explicit exception; the semantic fake is meaningful beyond "pretend the external side effect succeeded".
- [ ] **P2 Handler pressure**: no Command Handler injects four or more semantic outbound dependencies without satisfying the port-pressure review (`ddd-core.md §3.2`), including event/message extraction.
- [ ] **P3 Read-side DTO**: no Application reader/query interface returns `*Aggregate` or `[]*Aggregate`; product reads return DTOs.
- [ ] **P4 Event/message extraction**: repeated same-BC side effects route through one Domain Event + same-BC handler; cross-context facts route through Integration Messages; direct side effects remain only when the Architecture Gate says they are explicit command outputs.
- [ ] **P5 Async role isolation**: every event/message handler is classified as Domain Event Handler, Boundary Publisher, or Integration Message Handler; no concrete type mixes same-BC Domain Event consumption with Integration Message consumption.
- [ ] **P6 Handler kind granularity**: each new or modified handler defaults to one inbound kind; any multi-kind handler has the same role, source context or contract family, target side effect, transaction boundary, failure policy, and dependency set documented.
- [ ] **P7 Lightweight failure semantics**: each handler states best-effort, log-and-continue, return subscriber/adapter error, or `n/a`; stronger delivery machinery is not introduced unless the use case explicitly requires it.
- [ ] **Audit-only R3 when scope warrants it**: for Level 3, new BC, or architecture-audit work, command-side Application ports were compared with Domain Repositories, Domain Services, Domain Events, Integration Messages, named Application coordination services, ACLs, and Infrastructure adapters. Missing mechanisms were added only when the domain need exists.
- [ ] **No `Must Not` violations**: each item in §4 above was reviewed against the diff — in particular §4.19 (Application command-side port default), §4.20 (repeated side-effect without Domain Event), §4.22 (umbrella asynchronous handlers), and §4.23 (mixed asynchronous handler roles).

### 5.2 Go Runtime Self-Check

Use this checklist when editing `cmd/**/main.go`, `internal/pkg/**`, `configs/**`, fx wiring, lifecycle hooks, or shutdown behavior:

- [ ] **Runtime guide read**: `ddd-golang-runtime.md` was read for config, fx, lifecycle, shutdown, and Kubernetes concerns.
- [ ] **Taskqueue guide read when applicable**: `ddd-golang-taskqueue.md` was read for polling jobs, periodic task producers, task processors, schema registry, asynq worker/scheduler wiring, task middleware, and `internal/pkg/taskqueue`.
- [ ] **Component owns its `Option`**: each runtime component declares its own `Option` in its own package; `cmd/server/main.go` only aggregates and supplies options.
- [ ] **Middleware ownership clean**: shared middleware clients are initialized in `internal/pkg/<middleware>`; bounded-context Infrastructure receives initialized clients and does not read config or open shared connections.
- [ ] **Module assembly boundary clean**: `cmd/**/main.go` only loads config, supplies the aggregate `Option`, selects modules, sets process-level fx options, and runs the app; provider details live in `internal/pkg/module.go`, bounded-context modules, or Infrastructure/ACL packages.
- [ ] **Multi-service runtime differences centralized**: services use named module variables in `internal/pkg/module.go` such as `FooModule` / `BarModule`; repeated provider lists are not copied across `cmd/<service>/main.go`.
- [ ] **cmd smoke scans reviewed**: `cmd/**/main.go` has no unexplained imports of bounded-context `infrastructure` or inner `application/*` packages, no generated handler registration imports, no per-field `fx.Supply(opt.X)` drift, and no provider-heavy `fx.Provide` blocks without a written runtime exception.
- [ ] **No technology-shaped business ports**: runtime clients such as Redis, MySQL, Kafka, or HTTP clients are not exposed inward as Domain/Application interfaces unless they represent a named semantic capability.
- [ ] **Lifecycle hooks fit in-flight work**: servers, dispatchers, consumers, and workers with in-flight work have `OnStop` drain behavior; pure clients only close resources when the library exposes cleanup.
- [ ] **Startup failure is observable**: listeners bind synchronously in `OnStart` before serving in a goroutine, so port conflicts fail startup instead of disappearing into background logs.
- [ ] **Shutdown ordering considered**: fx dependency order leaves dependencies available while servers, consumers, workers, and event dispatchers drain.
- [ ] **Config resolution documented**: new config keys are added to `configs/defaults.yml` (or documented prefix+profile files such as `app_prod.yml`), loader directory/default/prefix/profile/env-prefix choices are explicit, and placeholder convention is used when env overrides are required.
- [ ] **Kubernetes impact checked**: high-traffic services that may receive traffic during termination have `preStop` / termination-grace-period considerations documented.
- [ ] **Runtime verification run**: build/tests or the relevant runtime test script were run; for docs-only changes, links and duplicated plugin copies were checked.

### 5.3 Go Taskqueue Self-Check

Use this checklist when editing task queues, polling/reconciliation jobs, periodic task producers, asynq worker/scheduler wiring, `TaskType`, `PeriodicTask`, task payload schemas, task processors, enqueueing, or `internal/pkg/taskqueue`:

- [ ] **Taskqueue guide read**: `ddd-golang-taskqueue.md` was read and applied.
- [ ] **Layer placement clean**: task processors and payload schemas live under the owning bounded context's `application` subtree; Domain imports no taskqueue/asynq/runtime packages.
- [ ] **One task contract**: each task has one `TaskType`, one payload schema, and one `taskqueue.Processor`; no `Listening() []string` task handler or multi-task switch was introduced.
- [ ] **Schema registry ownership**: one service-owned registry is provided through normal DI and populated during startup/module wiring; no hidden global mutable registry was added.
- [ ] **Runtime ownership**: `internal/pkg/taskqueue` owns asynq client/worker/scheduler creation, common middleware, processor registration, periodic task registration, lifecycle hooks, and graceful shutdown; `cmd/**/main.go` remains a thin entry point.
- [ ] **Polling policy explicit**: normal "not ready yet" states re-enqueue with delay and a bound; transient failures return errors for provider retry; permanent failures wrap `taskqueue.ErrSkipRetry`.
- [ ] **Periodic producer explicit**: recurring work uses `taskqueue.PeriodicTask`, `CronSchedule` / `IntervalSchedule`, and `PeriodicTaskScheduler`; the scheduler enqueues static task envelopes and does not expose `HandleFunc` or business callbacks. Disabled periodic tasks are omitted from registration, `WithLocation` is cron-only, periodic policies avoid `WithProcessAt` / `WithDeadline`, duplicate-name guarantees are scoped to one scheduler/registrar instance unless runtime coordination is documented, and business-visible scheduling/deadline/eligibility rules are modeled outside provider mechanics.
- [ ] **Adopted stack used**: code uses `github.com/go-jimu/components/taskqueue` and `github.com/go-jimu/contrib/taskqueue/asynq` instead of local substitutes.

---

## 6. Notes on Example Code

Code blocks in the language-specific guides (e.g., `ddd-golang.md`) are **illustrative**, not copy-paste templates:

- Imports may be elided for readability.
- Identifiers may reference types not defined in the snippet.
- They show *shape and idiom*, not a compilable file.

When implementing, the agent must:

1. Open the actual surrounding package and follow its conventions.
2. Add the imports its target package needs (not necessarily the ones shown).
3. Run `go build ./...` / equivalent before claiming the change compiles.
4. Run the package's tests, or add new ones, before claiming behavior works.

If a snippet contradicts what compiles in the real repository, **the real repository wins** and the contradiction is a bug in the docs — flag it, do not silently rewrite the docs to match a stale snippet.

---

## 7. Minimal Output Format

Use this compact shape when reporting a DDD / runtime plan, review, or implementation result. Omit fields that genuinely do not apply; do not omit unknowns to avoid asking.

```text
Standards read:
- <ddd-agent-contract + modeling/core/language/runtime files actually read>

Task classification:
- <DDD/business | Go events/messages | Go taskqueue/polling/periodic | Go runtime-only | mixed>

Architecture Gate:
- <modeling §0 core block for DDD/business changes, plus the placement extension when required; or "n/a — runtime-only; runtime component is ...">

Stop questions:
- <none, or the exact unresolved questions>

Planned / changed files:
- <paths>

Self-check result:
- <DDD checklist / runtime checklist / docs-only checks completed>
```

For final summaries after straightforward implementation, keep this brief: mention the files changed, verification run, and any remaining risk. Section-by-section citations are required for plans, reviews, PR descriptions, and architecture-affecting decisions, not for every final response.

---

## 8. Quick Index

| Need | Read |
|---|---|
| Identify bounded context / aggregate boundary | [`ddd-modeling.md`](ddd-modeling.md) §2, §3 |
| Architecture Gate core / placement extension format | [`ddd-modeling.md`](ddd-modeling.md) §0 |
| Planning gates by change size | [`ddd-modeling.md`](ddd-modeling.md) §7 |
| Layer responsibilities & dependency rule | [`ddd-core.md`](ddd-core.md) §1, §3 |
| Repository / `Save()` collection semantics | [`ddd-core.md`](ddd-core.md) §3.4 |
| Multi-aggregate transaction exception gate | [`ddd-core.md`](ddd-core.md) §3.2 |
| Cross-context mechanisms (4 legitimate ways) | [`ddd-core.md`](ddd-core.md) §5 |
| Integration Message payload rules | [`ddd-core.md`](ddd-core.md) §5.4 |
| Architecture review checklist | [`ddd-core.md`](ddd-core.md) §10 |
| Go file layout / module assembly | [`ddd-golang.md`](ddd-golang.md) §2, §10 |
| Go Domain Events, Boundary Publishers, Integration Messages, Kafka adapter wiring | [`ddd-golang-events-messages.md`](ddd-golang-events-messages.md) |
| Go boundary checklist | [`ddd-golang.md`](ddd-golang.md) §2.4 |
| Go logging & error handling | [`ddd-golang.md`](ddd-golang.md) §8 |
| Go configuration, fx module assembly, fx.Lifecycle, graceful shutdown, k8s preStop | [`ddd-golang-runtime.md`](ddd-golang-runtime.md) §1, §2 |
| Go taskqueue, polling jobs, periodic producers, asynq workers/schedulers, task schemas | [`ddd-golang-taskqueue.md`](ddd-golang-taskqueue.md) |
