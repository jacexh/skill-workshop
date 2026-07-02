---
name: DDD Risk Router
description: Compact DDD/backend architecture risk cards. Read with the active DDD phase playbook for backend services in Go, Python, or TypeScript, database-backed services, event/message, taskqueue, or runtime-boundary work.
---

# DDD Risk Router

Read this file with the active phase playbook for DDD/backend architecture work. Use it to decide which deeper standards to load.

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

Choose the active language reference after the risk card is selected: `ddd-golang.md` for Go, `ddd-python.md` for Python, and `ddd-typescript.md` for TypeScript. Use `ddd-golang-events-messages.md`, `ddd-golang-taskqueue.md`, and `ddd-golang-runtime.md` only for Go-specific event/message, taskqueue, or runtime work.

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
| Fat Go RPC Shortcut | `ddd-golang.md` | `application.go` or RPC adapter method with repository, save, dispatch, enqueue, transaction, or multi-port coordination evidence | Small actor/auth extraction used only to build a command/query before one delegate call |
| Shared Umbrella Processor | `ddd-golang-events-messages.md` and/or `ddd-golang-taskqueue.md` | Shared processor type, inbound kinds/task types, dependency set, role/side-effect mix, transaction/failure policy | Same role, source family, side effect, transaction boundary, failure policy, and dependency set |
| Business State Classification Outside Domain | `ddd-agent-contract.md`, `ddd-core.md`, active language guide | Application/handler/processor branch or helper over business state/status; evidence it drives a business decision, not mapping | Mechanical DTO/read-model/proto mapping without business decision semantics |
| Command-Side Application Port Reflex | `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md` | New command-side interface, caller use case, semantic capability, rejected Domain/Repository/Domain Event/Integration Message/ACL/Infrastructure alternatives | Architecture Gate proves a stable use-case semantic lifecycle that is not mechanism plumbing |
| Runtime/Cmd Provider Pollution | `ddd-golang-runtime.md` | `cmd/**` provider construction, business-layer imports, generated route registration, lifecycle/config ownership evidence | Process-owned provider with explicit runtime impact note |
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

### Fat Go RPC Shortcut

- **Smell:** `application.go` generated RPC methods contain repository calls, saves, dispatch, enqueueing, transactions, or multi-port coordination.
- **Probe examples:** in Go repos that use generated RPC stubs on `application.go`, search those methods for persistence, dispatch, enqueueing, or transaction calls, e.g. `rg -n 'Save\(|Dispatch|Enqueue|Transaction|Session|repo\.|repository|Publisher|Handler' <application-entrypoint-files>`.
- **Decision:** keep RPC methods as map -> delegate once -> map response/error.
- **Allowed exception:** small actor/auth extraction needed to build the command/query.
- **Reference:** `ddd-golang.md`.

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

### Runtime/Cmd Provider Pollution

- **Smell:** `cmd/<service>/main.go` constructs repositories, query repositories, ACL clients, handler wrappers, or generated route handlers.
- **Probe examples:** in Go/fx repos, search entrypoints for business-layer imports, generated route registration, and provider-heavy wiring, e.g. `rg -n 'internal/.*/(infrastructure|application/(command|query|eventhandler|messagehandler|messagepublisher))|fx\\.Provide\\(|pkg/gen/.*(connect|grpc)' <cmd-paths>`.
- **Decision:** `cmd` loads config, selects modules, supplies aggregate options, and runs the app.
- **Allowed exception:** process-owned provider with runtime impact note.
- **Reference:** `ddd-golang-runtime.md`.

### Technical Bounded Context

- **Smell:** a context uses infrastructure-shaped terms such as pod, namespace, mount, supervisor, lease, or worker.
- **Probe examples:** inspect whether those terms appear in product/operator language and own stable lifecycle rules; do not classify by keyword alone.
- **Decision:** technical terms may be Domain language only when the bounded context is itself a runtime substrate.
- **Allowed exception:** record the stable lifecycle/invariant and keep deployment adapter details out of Domain.
- **Reference:** `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md`.
