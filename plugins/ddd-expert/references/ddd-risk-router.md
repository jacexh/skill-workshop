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
- Review uses cards to demand evidence before findings: use Required evidence and Allowed exception before calling a probe hit a violation. Evidence gaps stay evidence gaps.

## Responsibility Role Classifier

Classify responsibilities, not concept names. Do not create or apply risk cards because a file or type contains a DDD term such as Event Handler, Message Handler, CQRS, Repository, Scheduler, or Drain. First identify the role the code is playing and the boundary it crosses:

Awkward tactical structures are evidence, not diagnosis. Before routing to a tactical fix, ask what upstream model pressure the structure carries: aggregate boundary, invariant owner, CQRS/read-model split, failure tolerance, application coordination, or local convention.
For reactions, repositories, and transaction shapes, reconstruct the business fact timeline and accepted collaboration model before choosing an event/message, process, repository, or port card.

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

| Risk card | Required references | Required evidence | Allowed exception |
|---|---|---|---|
| Cross-Context Direct Imports | `ddd-core.md`, active language guide; Go event/message guide when async contracts are involved | Import path crossing calibrated bounded-context roots; caller/callee layer; whether the import is Domain/Application vs published API/protocol | Written compatibility bridge or migration target using Integration Messages, read facade, ACL, or protocol contract |
| Generated Protocol Types in Semantic Ports | `ddd-core.md`, active language guide | Port/interface signature, Domain/Application package path, generated/protocol type import, mapping boundary evidence | Project explicitly treats generated type as a read contract for query/read DTOs |
| Fat Generated RPC Adapter | `ddd-core.md`, active language guide | Generated RPC/IDL adapter method with repository, save, dispatch, enqueue, transaction, or multi-port coordination evidence | Small actor/auth extraction used only to build a command/query before one delegate call |
| Shared Umbrella Processor | `ddd-golang-events-messages.md` and/or `ddd-golang-taskqueue.md` | Shared processor type, inbound kinds/task types, dependency set, role/side-effect mix, transaction/failure policy | Same role, source family, side effect, transaction boundary, failure policy, and dependency set |
| Business State Classification Outside Domain | `ddd-agent-contract.md`, `ddd-core.md`, active language guide | Application/handler/processor branch or helper over business state/status; evidence it drives a business decision, not mapping | Mechanical DTO/read-model/proto mapping without business decision semantics |
| Command-Side Application Port Reflex | `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md` | New command-side interface, caller use case, semantic capability, rejected Domain/Repository/Domain Event/Integration Message/ACL/Infrastructure alternatives | Architecture Gate proves a stable use-case semantic lifecycle that is not mechanism plumbing |
| Manual Runner Misplacement | `ddd-agent-contract.md`, `ddd-golang-taskqueue.md`, `ddd-golang-runtime.md`; active language guide when non-Go | Manual polling, reconciliation, scheduler, backlog drain, recovery, or outbox-drain loop evidence; lifecycle/start-stop ownership; cadence/backoff/limit policy; business work delegated inline vs through a task/processor | Written runtime exception proving a process-owned runner with lifecycle/shutdown/config impact and no hidden taskqueue, scheduling, or business policy |
| Runtime/Entrypoint Provider Pollution | active runtime/language guide where available | Process entrypoint provider construction, business-layer imports, generated route registration, lifecycle/config ownership evidence | Process-owned provider with explicit runtime impact note |
| Technical Bounded Context | `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md` | Product/operator language, lifecycle/state/invariant ownership, adapter-detail exclusion evidence | Stable lifecycle/invariant is recorded and deployment adapter mechanics stay outside Domain |

## Cards

### Cross-Context Direct Imports

- **Smell:** one bounded context imports another context's `domain/` or `application/`.
- **Probe examples:** for Go repos with `internal/<context>/<layer>` layout, start from `rg -n 'internal/.*/(domain|application)' internal` and then narrow by actual bounded-context roots.
- **Decision:** use Integration Messages, published read facades, ACL, or protocol contracts.
- **Allowed exception:** only with a written compatibility bridge and migration target.
- **Reference:** `ddd-core.md`, active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`), and Go event/message guide when applicable.

### Generated Protocol Types in Semantic Ports

- **Smell:** command-side or Domain-facing ports mention `pkg/gen`, `gen/go`, `proto.Message`, or ConnectRPC request/response types.
- **Probe examples:** in Go/protobuf repos, search semantic inward layers for generated-code imports, e.g. `rg -n 'pkg/gen|gen/go|proto\.Message|connect\.Request|connect\.Response' <domain-or-application-paths>`.
- **Decision:** map generated DTOs at Interface/Application/Infrastructure boundaries.
- **Allowed exception:** query/read DTOs may use generated types only when the project explicitly treats them as read contracts.
- **Reference:** `ddd-core.md` and active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`).

### Fat Generated RPC Adapter

- **Smell:** generated RPC/IDL adapter methods contain repository calls, saves, dispatch, enqueueing, transactions, or multi-port coordination. The smell is a fat generated RPC adapter body, not the calibrated placement itself.
- **Probe examples:** inspect generated adapter implementations for persistence, dispatch, enqueueing, transaction, or multi-port coordination calls; rewrite the search to match the repository's generated framework and handler location.
- **Decision:** keep generated adapter methods as map -> delegate once -> map response/error. Do not move a thin generated adapter solely to satisfy a generic Interface layer example.
- **Allowed exception:** small actor/auth extraction needed to build the command/query.
- **Reference:** `ddd-core.md` and the active language guide.

### Shared Umbrella Processor

- **Smell:** many one-kind message handlers delegate to one large `Processor` with unrelated message families or dependencies.
- **Probe examples:** search async handler packages for shared processors or multi-kind dispatchers, e.g. `rg -n 'type Processor|NewProcessor|processor\.|switch .*Kind|Listening\\(\\)' <message-or-task-handler-paths>`.
- **Decision:** prefer one concrete handler/processor per inbound fact or task type.
- **Allowed exception:** same role, source family, side effect, transaction boundary, failure policy, and dependency set.
- **Reference:** `ddd-golang-events-messages.md`, `ddd-golang-taskqueue.md`.

### Business State Classification Outside Domain

- **Smell:** Application, message handlers, or task processors define helpers like `isTerminal`, `hasLiveRuntime`, `countsAsActive`, or branch directly on business `State`/`Status`.
- **Probe examples:** search Application/handler/processor layers for state classification helpers or direct business-state branches, e.g. `rg -n 'isTerminal|hasLiveRuntime|countsAsActive|requiresCleanup|\\.State|\\.Status' <application-paths>`.
- **Decision:** put stable state classification behind Aggregate methods or Domain policies.
- **Allowed exception:** mechanical DTO/read-model/proto mapping without business decision semantics.
- **Reference:** `ddd-agent-contract.md`, `ddd-core.md`, and active language guide (`ddd-golang.md`, `ddd-python.md`, or `ddd-typescript.md`).

### Command-Side Application Port Reflex

- **Smell:** a command handler gets a new interface only because it needs to call an external mechanism.
- **Probe examples:** review new command-side interfaces and names ending in `Client`, `Publisher`, `Router`, `Directory`, `Writer`, `Sender`, or `Fetcher`.
- **Decision:** classify capability first; prefer Aggregate method, Repository, Domain Service, Domain Event, Integration Message, ACL, or Infrastructure adapter.
- **Allowed exception:** written gate proves a stable use-case semantic lifecycle that is not mechanism plumbing.
- **Reference:** `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md`.

### Manual Runner Misplacement

- **Smell:** a bounded-context root or composition package owns a manual polling, reconciliation, scheduler, backlog drain, recovery, or outbox-drain loop that starts its own runtime loop, including calling an Application scheduler/service from a root package loop.
- **Probe examples:** search calibrated module roots and runtime packages for `*_drain`, `*scheduler`, `*reconcile`, `fx.Lifecycle`, `OnStart`, `OnStop`, `go func`, `time.NewTimer`, `time.NewTicker`, `Interval`, `Backoff`, `Limit`, `for {`, or equivalent lifecycle/timer constructs. The filename is only a routing clue; require loop/lifecycle/cadence evidence.
- **Decision:** classify the responsibility first. Scheduled triggers and polling/reconciliation work route to taskqueue/polling/periodic guidance; business task semantics live with the owning Application task/processor or coordination service; shared worker/scheduler lifecycle lives in runtime infrastructure such as `internal/pkg/taskqueue`. Bounded-context module roots may contribute providers/tasks/processors but should not hide manual loops, retry/backoff, shutdown, or provider lifecycle policy.
- **Allowed exception:** a documented process-owned runner may stay outside taskqueue only when it records runtime ownership, lifecycle/shutdown behavior, config/cadence policy, idempotency/failure semantics, and why a task contract or shared runtime scheduler is not the right mechanism.
- **Reference:** `ddd-agent-contract.md`, `ddd-golang-taskqueue.md`, `ddd-golang-runtime.md`, and the active language guide when not Go.

### Runtime/Entrypoint Provider Pollution

- **Smell:** the process entrypoint constructs repositories, query repositories, ACL clients, handler wrappers, or generated route handlers.
- **Probe examples:** search calibrated entrypoint/composition roots for business-layer imports, generated route registration, and provider-heavy wiring; in Go/fx repos this often includes `cmd/<service>/main.go` and `fx.Provide`.
- **Decision:** the process entrypoint loads config, selects modules/composition roots, supplies process options, and runs the app.
- **Allowed exception:** process-owned provider with runtime impact note.
- **Reference:** active runtime/language guide where available.

### Technical Bounded Context

- **Smell:** a context uses infrastructure-shaped terms such as pod, namespace, mount, supervisor, lease, or worker.
- **Probe examples:** inspect whether those terms appear in product/operator language and own stable lifecycle rules; do not classify by keyword alone.
- **Decision:** technical terms may be Domain language only when the bounded context is itself a runtime substrate.
- **Allowed exception:** record the stable lifecycle/invariant and keep deployment adapter details out of Domain.
- **Reference:** `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md`.
