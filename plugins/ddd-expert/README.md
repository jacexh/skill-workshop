# ddd-expert

Standalone DDD/backend architecture expert skills for Claude Code.

Invoke the phase skill that matches the project stage:

```text
$ddd-expert:explore
$ddd-expert:shape
$ddd-expert:codify
$ddd-expert:guard
```

This plugin is hookless. Automatic intervention relies on each skill's own frontmatter description, written in common development workflow language, so the skills can be selected during discovery, planning, implementation, and review without binding to another workflow plugin.

## How It Works

The plugin exposes four compact phase skills plus shared references:

- `explore` — Domain clarification for accepted language, business facts, lifecycle, authority, policies, and context relationships
- `shape` — Tactical Design for Aggregate boundaries, consistency, collaboration, ports, persistence boundaries, runtime containment, and verification seams
- `codify` — House-Style Realization of accepted model and design decisions in working backend code
- `guard` — Hypothesis-driven Model Integrity review of concrete implementation evidence

Each skill runs its compact phase workflow and then loads only the reference sections required by the touched responsibility.

## Activation Guidance

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. The phase skills are described to match common development actions, and you may also mention a phase skill explicitly when the task touches bounded contexts, Domain/Application/Transport/Infrastructure placement, generated RPC/protocol types, Go/Python/TypeScript runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

Choose the phase by timing:

- `$ddd-expert:explore` when a backend product request needs business-language, lifecycle, authority, invariant, policy, failure-semantics, or bounded-context clarification.
- `$ddd-expert:shape` when accepted domain facts need Tactical Design before coding, or that design must be reviewed or changed.
- `$ddd-expert:codify` when accepted facts and tactical decisions must be realized as house-style backend code.
- `$ddd-expert:guard` when a concrete backend diff or implementation must be reviewed before merge or release.

## Scope

Use this plugin for:

- bounded contexts and context boundaries
- high-fidelity Strategic Modeling interviews
- product-semantic Tactical Modeling before codification
- model-to-code realization and placement
- evidence-based Model Integrity review
- Domain/Application/Transport/Infrastructure ownership
- Domain and Application port eligibility
- generated protocol DTO boundaries
- Go, Python, and TypeScript backend House Style, HTTP/RPC adapter boundaries, module placement, and Runtime wiring
- Domain Events, published-fact/intent contracts, Integration Messages, and async handlers
- taskqueue/runtime boundaries in DDD services
- database-backed backend persistence design when schema, query, migration, transaction, or storage concerns are explicit

Explore lazily maintains the terminal-state domain model in `docs/ddd/model.md`; Shape maintains the terminal-state Tactical Design in `docs/ddd/design.md`. Multiple bounded contexts use explicit sections in these same artifacts.

These artifacts contain only current DDD facts and tactical decisions. They do not copy feature descriptions, ADRs, tickets, project architecture, implementation progress, or review reports. Purely mechanical work with unambiguous ownership does not force document creation.

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup.

## References

Canonical references live under `references/`:

- `ddd-modeling.md` — strategic language, subdomain, bounded-context, authority, lifecycle, and aggregate guidance
- `ddd-core.md` — language-neutral DDD and Clean Architecture layers, tactical building blocks, Repository, and conditional CQRS guidance
- `ddd-collaboration.md` — published APIs, Domain Events, Integration Messages, process managers, and reliable delivery
- `ddd-golang.md` — Go/go-jimu house-style router and adopted stack
- `ddd-golang-scaffold.md` — multi-bounded-context Go layout, generated code, module composition, and test placement
- `ddd-golang-domain.md` — Aggregate Root, Entity, Value Object, Domain Service, Repository, validation, events, and FSM guidance
- `ddd-golang-application.md` — transport-neutral commands, queries, Application registry, assemblers, transactions, and outbound ports
- `ddd-golang-transport.md` — inbound ConnectRPC/HTTP, message-subscriber, and task-processor adapters
- `ddd-golang-cqrs.md` — conditional QueryRepository, read DTO, query-handler, and projection guidance
- `ddd-golang-infrastructure.md` — xorm persistence, DO conversion, QueryRepository, ACL, and outbound adapter guidance
- `ddd-golang-events-messages.md` — Domain Event timing, published facts, asynchronous intents, Kafka runtime, and conditional outbox guidance
- `ddd-golang-taskqueue.md` — Application task contracts, task processors, scheduling, follow-up work, and Asynq runtime guidance
- `ddd-golang-runtime.md` — configuration, Fx composition, ConnectRPC/Chi lifecycle, logging, shutdown, and conditional telemetry guidance
- `database.md` — MySQL persistence, table roles, types, indexes, SQL, transactions, concurrency, migrations, and sharding rules
- `ddd-python.md` — compact Python DDD House Style for stack, layers, flows, scaffold, and Runtime
- `ddd-typescript.md` — compact TypeScript DDD House Style for stack, layers, flows, scaffold, and Runtime

This plugin intentionally does not scan generic `design-patterns/` directories. Project-specific architecture facts should be read from explicit project docs or project knowledge sources.
