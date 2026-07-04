# ddd-expert

Standalone DDD/backend architecture expert skills for Claude Code.

This plugin is explicit-only. It does not register lifecycle hooks, intercept other skills, or depend on any workflow plugin. Invoke the phase skill that matches the task:

```text
$ddd-expert:design
$ddd-expert:implement
$ddd-expert:review
```

## How It Works

The plugin exposes three compact phase skills plus shared references:

- `design` — product-semantics-to-DDD boundary design before implementation
- `implement` — accepted-model-to-code placement and refactoring guidance
- `review` — evidence-based DDD boundary review for concrete plans, diffs, or files

Each skill reads `references/ddd-risk-router.md` first, then loads only the deeper references required by the task or triggered risk cards. The plugin intentionally avoids automatic prompt injection so teams can use it independently in any workflow.

## Scope

Use this plugin for:

- bounded contexts and context boundaries
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

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup.

## References

Canonical references live under `references/`:

- `../skills/design/SKILL.md` — design-phase product-semantics-to-model method
- `../skills/implement/SKILL.md` — implementation-phase model-to-code placement method
- `../skills/review/SKILL.md` — review-phase evidence-to-judgment method
- `ddd-risk-router.md` — default DDD/backend risk cards read with the active phase skill
- `ddd-agent-contract.md` — on-demand agent prohibited actions, classification, and self-checks
- `ddd-modeling.md` — on-demand strategic bounded-context, aggregate, and architecture gate guidance
- `ddd-core.md` — on-demand dependency direction, bounded contexts, and service layer boundaries
- `ddd-golang.md` — Go-specific implementation guidance
- `ddd-python.md` — Python-specific DDD implementation guidance
- `ddd-typescript.md` — TypeScript-specific DDD implementation guidance
- `ddd-golang-events-messages.md` — Domain Events, Boundary Publishers, Integration Messages, and Kafka adapter wiring
- `ddd-golang-runtime.md` — Go runtime guidance for config, fx lifecycle, graceful shutdown, and Kubernetes
- `ddd-golang-taskqueue.md` — polling jobs, TaskType/schema registry, processors, asynq wiring, and middleware
- `database.md` — on-demand schema conventions, index strategy, migrations, and persistence rules

This plugin intentionally does not scan generic `design-patterns/` directories. Project-specific architecture facts should be read from explicit project docs or project knowledge sources.
