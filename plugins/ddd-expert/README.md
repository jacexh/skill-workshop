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

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. The phase skills are described to match common development actions, and you may also mention a phase skill explicitly when the task touches bounded contexts, Domain/Application/Infrastructure placement, generated RPC/protocol types, Go runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

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
- Domain/Application/Infrastructure ownership
- Domain and Application port eligibility
- generated protocol DTO boundaries
- Go ConnectRPC/gRPC shortcut pressure
- Python and TypeScript backend DDD module/layer placement
- Domain Events, Boundary Publishers, Integration Messages, and async handlers
- taskqueue/runtime boundaries in DDD services
- database-backed backend persistence design when schema, query, migration, transaction, or storage concerns are explicit

Explore lazily maintains the terminal-state domain model in `docs/ddd/model.md`; Shape maintains the terminal-state Tactical Design in `docs/ddd/design.md`. Multiple bounded contexts use explicit sections in these same artifacts.

These artifacts contain only current DDD facts and tactical decisions. They do not copy feature descriptions, ADRs, tickets, project architecture, implementation progress, or review reports. Purely mechanical work with unambiguous ownership does not force document creation.

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup.

## References

Canonical references live under `references/`:

- `ddd-modeling-gates.md` — compact modeling thought gates for story, authority, lifecycle, invariants, failure tolerance, integration language, and coordination choices
- `ddd-agent-contract.md` — on-demand agent prohibited actions, classification, and self-checks
- `ddd-modeling.md` — on-demand strategic bounded-context, aggregate, and architecture gate guidance
- `ddd-core.md` — on-demand dependency direction, bounded contexts, and service layer boundaries
- `ddd-golang.md` — Go/go-jimu reference router
- `ddd-golang-scaffold.md` — Go project layout, bounded-context package shape, generated code, and test placement
- `ddd-golang-domain.md` — Aggregate Root, Entity, Value Object, Domain Service, Repository interface, and Domain Event recording shape
- `ddd-golang-application.md` — command handlers, Application services, generated RPC shortcut, handler placement, and execution-boundary logging
- `ddd-golang-cqrs.md` — QueryRepository, read DTOs, query handlers, read facades, and projections
- `ddd-golang-infrastructure.md` — Repository implementations, DO/converters, persistence adapters, ACLs, and generated protocol adapters
- `ddd-python.md` — Python-specific DDD implementation guidance
- `ddd-typescript.md` — TypeScript-specific DDD implementation guidance
- `ddd-golang-events-messages.md` — Domain Events, Boundary Publishers, Integration Messages, and Kafka adapter wiring
- `ddd-golang-runtime.md` — Go runtime guidance for config, fx lifecycle, graceful shutdown, and Kubernetes
- `ddd-golang-taskqueue.md` — polling jobs, TaskType/schema registry, processors, asynq wiring, and middleware
- `database.md` — on-demand schema conventions, index strategy, migrations, and persistence rules

This plugin intentionally does not scan generic `design-patterns/` directories. Project-specific architecture facts should be read from explicit project docs or project knowledge sources.
