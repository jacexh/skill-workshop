# ddd-expert

EventStorming-led DDD/backend workflow skills for Claude Code.

Use EventStorming as the single modeling path from backend evidence to a codify-ready design:

```text
/ddd-expert:event-storming
/ddd-expert:codify
/ddd-expert:guard
```

This plugin is hookless. Automatic intervention relies on each skill's own frontmatter description, written in common development workflow language, so the skills can be selected during discovery, planning, implementation, and review without binding to another workflow plugin.

## How It Works

The plugin exposes one modeling workflow, two focused expert skills, one internal artifact executor, and shared references:

- `event-storming` — Continuous workflow from backend stories or specifications through proportionate Big Picture and Process Modelling, accepted Models and Context Map, Software Design EventStorming, Tactical Design, visible readiness, and a codify-ready handoff
- `codify` — House-Style Realization of accepted model and design decisions in working backend code; every material changed implementation completes through a clear independent Guard in the same task
- `guard` — Parallel Design Realization and House-Style Conformance review of concrete implementation evidence
- `maintain-artifacts` — Internal validation and execution of authorized DDD artifact transactions; not a user entry point

Workflow skills own accepted decisions and load the `maintain-artifacts` protocol before artifact inspection or accepted writes. The same active agent executes it and loads only the templates required by that operation.

## Activation Guidance

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. The skills are described to match common development actions, and you may also mention a skill explicitly when the task touches bounded contexts, Domain/Application/Transport/Infrastructure placement, generated RPC/protocol types, Go/Python/TypeScript runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

Choose by requested outcome:

- `/ddd-expert:event-storming` for the complete modeling path from a backend story, specification, or existing model to accepted Strategic Modeling and a codify-ready Tactical Design. The same skill loops between business discovery and software design as evidence requires.
- `/ddd-expert:codify` when accepted facts and tactical decisions must be realized as house-style backend code.
- `/ddd-expert:guard` when a concrete backend diff or claimed implementation scope must be checked for both missing realization and incorrect implementation before merge or release.

Codify sends every material final code snapshot to a fresh read-only Guard coordinator before reporting completion. Only a clear review over that complete, unchanged snapshot permits `changed`; a future route to Guard does not satisfy the gate.

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

EventStorming keeps one continuous conversation and modeling loop from evidence to implementation handoff. It derives the scope from backend stories or equivalent business scenarios, then uses proportionate Big Picture and Process Modelling over the affected Scenario Threads to establish events, commands, actors, policies, business language, authority, candidate Bounded Contexts, and the Context Map; a simple change inside an accepted context does not force a new repository-wide Big Picture. Each material Scenario Thread is replayed from triggering facts and decision-time information through actor, intent, decision, established fact, affected rights, obligations, or value, subsequent reactions, and a stable outcome. Modeling probes seek a missing fact, example, or counterexample; only user-owned alternatives that change a business-visible guarantee become decision proposals. Inside accepted context boundaries, Software Design EventStorming assigns Aggregate decisions, invariants, lifecycles, Domain Events, policies, and collaboration. Tactical replay that exposes a semantic gap returns to business discovery inside the same skill and then resumes the same design scope. EventStorming challenges source nouns before promoting them to independent concepts or objects. Authoritative Model facts and resolved, justified Design decisions are written incrementally as the smallest consistency closure; an evidence-supported DDD representation does not wait for a separate user-approval ceremony, and unrelated open decisions no longer delay it. Models and Designs remain `evolving` until scoped replay proves `shape_ready` and `codify_ready`. The Context Map remains an acyclic graph of one-way model dependencies whose Global View projects each context's one-hop named contracts, never runtime calls. Artifact locations and ownership follow [templates/artifact-layout.md](templates/artifact-layout.md).

These artifacts contain only current DDD facts and tactical decisions. They do not copy feature descriptions, ADRs, tickets, project architecture, implementation progress, or review reports. Purely mechanical work with unambiguous ownership does not force document creation.

## Artifact Templates

- `templates/artifact-layout.md` defines the canonical project directory and artifact ownership.
- `templates/README.md` defines the project artifact entry point and context index.
- `templates/context-map.md` defines the global dependency DAG and each context's one-hop dependency and named-contract projection.
- `templates/model.md` defines one context's accepted Domain Model structure and readiness status.
- `templates/design.md` defines one context's accepted Tactical Design structure and readiness status.

The templates fix document and section names while allowing inapplicable sections to be omitted. Written artifacts contain accepted content only, with no template comments or placeholders.

EventStorming exclusively authorizes root README, Context Map, Domain Model, and Tactical Design transactions. The internal `maintain-artifacts` skill validates the minimum consistency closure and executes accepted slices; Codify and Guard may inspect only. Codify requires a `shape_ready` Model and exact-revision `codify_ready` Design.

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
