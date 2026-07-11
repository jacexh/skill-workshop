# ddd-expert (Codex)

Standalone DDD/backend architecture expert skills for Codex.

Use the phase skills directly for DDD/backend work. This plugin is hookless; automatic intervention relies on each skill's own frontmatter description, written in common development workflow language.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add ddd-expert@skill-workshop-codex
```

Restart Codex after installation so the skills are loaded.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after upgrade.

## Capabilities

- **`$ddd-expert:explore` skill** — User-story discovery projected through the Context Map into per-context and relationship trees, lifecycle closure, and accepted Model checkpoints
- **`$ddd-expert:shape` skill** — Tactical Design for Aggregate boundaries, consistency, collaboration, ports, persistence boundaries, runtime containment, and verification seams
- **`$ddd-expert:codify` skill** — House-Style Realization of accepted model and design decisions in working backend code
- **`$ddd-expert:guard` skill** — Parallel Design Realization and House-Style Conformance review of concrete implementation evidence
- **References** — canonical files live under `references/`

The plugin does not auto-inject context. User work is driven by the four phase-skill descriptions. The plugin also ships `maintain-artifacts` as an internal protocol, not a user entry point.

Phase skills own semantic decisions and load the `maintain-artifacts` protocol before artifact inspection or accepted writes. The same active agent executes it and loads only the templates required by that operation.

## Activation Guidance

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. The phase skills are described to match common development actions, and you may also mention a phase skill explicitly when the task touches bounded contexts, Domain/Application/Transport/Infrastructure placement, generated RPC/protocol types, Go/Python/TypeScript runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

Choose the phase by timing:

- `$ddd-expert:explore` when a backend user story, equivalent business scenario, or strategic-model question needs business-language, lifecycle, authority, invariant, policy, failure-semantics, or bounded-context clarification.
- `$ddd-expert:shape` when accepted domain facts need Tactical Design before coding, or that design must be reviewed or changed.
- `$ddd-expert:codify` when accepted facts and tactical decisions must be realized as house-style backend code.
- `$ddd-expert:guard` when a concrete backend diff or claimed implementation scope must be checked for both missing realization and incorrect implementation before merge or release.

## Scope

Use this plugin for:

- bounded contexts and context boundaries
- high-fidelity Strategic Modeling interviews
- product-semantic Tactical Modeling before codification
- model-to-code realization and placement
- evidence-based Design Realization and House-Style Conformance review
- Domain/Application/Transport/Infrastructure ownership
- Domain and Application port eligibility
- generated protocol DTO boundaries
- Go, Python, and TypeScript backend House Style, HTTP/RPC adapter boundaries, module placement, and Runtime wiring
- Domain Events, published-fact/intent contracts, Integration Messages, and async handlers
- taskqueue/runtime boundaries in DDD services
- database-backed backend persistence design when schema, query, migration, transaction, or storage concerns are explicit

Explore walks the affected Context Map one context and relationship at a time. It checkpoints accepted local or boundary closures into each context's terminal-state Domain Model while keeping unresolved discovery active; only a complete story replay routes the current Model revisions to Shape. Shape maintains each context's Tactical Design beside it. Artifact locations and ownership follow [templates/artifact-layout.md](templates/artifact-layout.md).

These artifacts contain only current DDD facts and tactical decisions. They do not copy feature descriptions, ADRs, tickets, project architecture, implementation progress, or review reports. Purely mechanical work with unambiguous ownership does not force document creation.

## Artifact Templates

- `templates/artifact-layout.md` defines the canonical project directory and artifact ownership.
- `templates/README.md` defines the project artifact entry point and context index.
- `templates/context-map.md` defines strategic context responsibilities and relationships.
- `templates/model.md` defines one context's terminal-state Domain Model structure.
- `templates/design.md` defines one context's terminal-state Tactical Design structure.

The templates fix document and section names while allowing inapplicable sections to be omitted. Written artifacts contain accepted content only, with no template comments or placeholders.

Explore exclusively authorizes root README, Context Map, and Domain Model transactions. Shape exclusively authorizes Tactical Design transactions. The internal `maintain-artifacts` skill validates and executes those writes; Codify and Guard may inspect only. Each design records the exact model revision it has shaped so stale designs cannot enter implementation as accepted authority.

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
