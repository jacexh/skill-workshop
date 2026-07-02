# superpowers-ddd-architect

DDD-first backend architecture guardrails for Claude Code.

This plugin is an active DDD/backend architecture guardrail. It uses a compact DDD Risk Router first, then points Claude to deeper references only when a risk card, task, or Architecture Gate requires them.

## How It Works

When a superpowers planning, execution, subagent, or code-review workflow runs, the plugin injects a compact DDD/backend reference index tuned to that moment:

- planning and design workflows load DDD design guidance
- implementation workflows load DDD implementation guardrails
- code-review workflows load DDD boundary review guidance

Claude must read `references/ddd-risk-router.md` first, then load only the deeper references needed for the triggered risks.

You can also invoke the skills explicitly:

```text
$superpowers-ddd-architect:design
$superpowers-ddd-architect:implement
$superpowers-ddd-architect:review
```

## Scope

Use this plugin for:

- bounded contexts and context boundaries
- Domain/Application/Infrastructure ownership
- Domain and Application port eligibility
- generated protocol DTO boundaries
- Go ConnectRPC/gRPC shortcut pressure
- Python and TypeScript backend DDD module/layer placement
- Domain Events, Boundary Publishers, Integration Messages, and async handlers
- taskqueue/runtime boundaries in DDD services
- database-backed backend persistence design

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup. Use `superpowers-architect` explicitly for general standards.

## References

Canonical references live under `references/`:

- `ddd-risk-router.md` — first-read DDD/backend risk cards
- `ddd-agent-contract.md` — agent execution contract for DDD, Go runtime, and taskqueue work
- `ddd-modeling.md` — strategic bounded-context, aggregate, and architecture gate guidance
- `ddd-core.md` — dependency direction, bounded contexts, and service layer boundaries
- `ddd-golang.md` — Go-specific implementation guidance
- `ddd-python.md` — Python-specific DDD implementation guidance
- `ddd-typescript.md` — TypeScript-specific DDD implementation guidance
- `ddd-golang-events-messages.md` — Domain Events, Boundary Publishers, Integration Messages, and Kafka adapter wiring
- `ddd-golang-runtime.md` — Go runtime guidance for config, fx lifecycle, graceful shutdown, and Kubernetes
- `ddd-golang-taskqueue.md` — polling jobs, TaskType/schema registry, processors, asynq wiring, and middleware
- `database.md` — schema conventions, index strategy, migrations, and persistence rules

This plugin intentionally does not scan generic `design-patterns/` directories. Project-specific architecture facts should be read from explicit project docs or Project Knowledge; generic team standards remain the responsibility of `superpowers-architect`.
