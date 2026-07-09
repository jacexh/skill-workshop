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

- `explore` — Strategic Modeling for Core Domain focus, ubiquitous language, Bounded Contexts, Context Map relationships, and business facts
- `shape` — Tactical Modeling for implementation-ready model decisions, consistency boundaries, collaboration style, and verification seams
- `codify` — Model Realization that encodes accepted model decisions into code boundaries, layers, ports, adapters, persistence, messages, runtime, and tests
- `guard` — Model Integrity review for specs, plans, diffs, files, persistence, messages, runtime wiring, and boundary evidence

Each skill reads the smallest phase-specific baseline and then loads only the strategic or tactical references required by the task.

## Activation Guidance

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. The phase skills are described to match common development actions, and you may also mention a phase skill explicitly when the task touches bounded contexts, Domain/Application/Infrastructure placement, generated RPC/protocol types, Go runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

Choose the phase by timing:

- `$ddd-expert:explore` during product discovery, PRD/spec writing, feature scoping, backlog refinement, story mapping, or change-request intake.
- `$ddd-expert:shape` during backend architecture planning, technical design, solution design, ticket breakdown, implementation planning, or design review before coding.
- `$ddd-expert:codify` during ticket implementation, refactoring, bug fixes, API/RPC handler work, persistence/migration work, message/job changes, runtime wiring, logging, or tests.
- `$ddd-expert:guard` during code review, PR review, pull request review, diff review, design/spec review, architecture review, pre-merge checks, release readiness, or regression investigation.

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

Explore writes confirmed model changes back to existing project documentation: glossary/terminology carriers for language, context-map or domain-boundary docs for ownership and boundaries, and the current PRD/spec for domain concepts, lifecycle, rules, policies, or any model content without a dedicated carrier.
Shape writes accepted tactical design back to existing project documentation: design docs, architecture/domain docs, ADRs, or the current PRD/spec `Tactical Design` section when no dedicated carrier exists.

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
