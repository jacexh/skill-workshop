# ddd-expert

Standalone DDD/backend architecture expert skills for Claude Code.

Invoke the phase skill that matches the task:

```text
$ddd-expert:domain-modeling
$ddd-expert:design
$ddd-expert:implement
$ddd-expert:review
```

The plugin also registers a restrained `PreToolUse:Skill` hook for Superpowers workflow skills. The hook only emits a short routing reminder:

- `superpowers:writing-plans` — ensure `$ddd-expert:domain-modeling` has produced an accepted domain model; if it has, use `$ddd-expert:design` before planning.
- `superpowers:executing-plans` and `superpowers:subagent-driven-development` — use `$ddd-expert:implement` before code edits.
- `superpowers:requesting-code-review` and `superpowers:receiving-code-review` — use `$ddd-expert:review` before findings.

The hook does not inject DDD reference content, pattern indexes, file paths, or gate details.

## How It Works

The plugin exposes four compact phase skills plus shared references:

- `domain-modeling` — one-question-at-a-time spec-to-domain-decision interview
- `design` — accepted domain brief to concrete DDD boundary design
- `implement` — accepted-model-to-code placement and refactoring guidance
- `review` — evidence-based DDD boundary review for concrete plans, diffs, or files

Each skill reads `references/ddd-risk-router.md` first, then loads only the deeper references required by the task or triggered risk cards. Hook output is limited to phase-skill routing; detailed context still loads only through the selected `ddd-expert` skill.

## Activation Guidance

Use `ddd-expert` whenever backend work may affect DDD boundaries or supporting backend infrastructure. Mention the phase skill explicitly in the prompt when the task touches bounded contexts, Domain/Application/Infrastructure placement, generated RPC/protocol types, Go runtime/config/lifecycle, taskqueue/message behavior, database persistence, or backend logging.

Choose the phase by timing:

- `$ddd-expert:domain-modeling` after a spec exists and before design when implicit domain objects, lifecycles, invariants, events, repositories, bounded contexts, or existing-model impact need to be made explicit.
- `$ddd-expert:design` after domain-modeling or an explicit existing model, before concrete backend design is accepted.
- `$ddd-expert:implement` before editing or placing backend code after a design direction exists.
- `$ddd-expert:review` when domain abstractions, specs, concrete files, diffs, plans, or evidence already exist.

## Scope

Use this plugin for:

- bounded contexts and context boundaries
- high-fidelity spec-to-domain-modeling interviews
- product-semantic backend modeling before implementation
- model-to-code implementation placement
- evidence-based DDD boundary review
- Domain/Application/Infrastructure ownership
- Domain and Application port eligibility
- generated protocol DTO boundaries
- Go ConnectRPC/gRPC shortcut pressure
- Python and TypeScript backend DDD module/layer placement
- Domain Events, Boundary Publishers, Integration Messages, and async handlers
- taskqueue/runtime boundaries in DDD services
- database-backed backend persistence design when schema, query, migration, transaction, or storage concerns are explicit

Domain-modeling conclusions should normally land in the current spec's `Domain Modeling` section or a sibling domain brief. Emit memory candidates for later `superpowers-memory:ingest`; do not write project memory as part of the modeling interview.

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup.

## References

Canonical references live under `references/`:

- `../skills/domain-modeling/SKILL.md` — one-question-at-a-time spec-to-domain-decision interview
- `../skills/design/SKILL.md` — design-phase domain-brief-to-model method
- `../skills/implement/SKILL.md` — implementation-phase model-to-code placement method
- `../skills/review/SKILL.md` — review-phase evidence-to-judgment method
- `ddd-risk-router.md` — implementation/review risk cards read with the active phase skill
- `ddd-review-smell-protocol.md` — smell-queue review orchestration for broad detection plus one-smell investigation
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
