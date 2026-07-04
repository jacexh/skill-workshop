# ddd-expert (Codex)

Standalone DDD/backend architecture expert skills for Codex.

This plugin is explicit-only. It does not register lifecycle hooks, intercept prompts, or depend on any workflow plugin.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add ddd-expert@skill-workshop-codex
```

Restart Codex after installation so the explicit skills are loaded.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after upgrade.

## Capabilities

- **`$ddd-expert:design` skill** — explicit product-semantics-to-DDD boundary design workflow
- **`$ddd-expert:implement` skill** — explicit model-to-code placement workflow
- **`$ddd-expert:review` skill** — explicit evidence-to-judgment boundary review workflow
- **References** — canonical files live under `references/`

The plugin does not auto-inject context for natural-language architecture prompts. Invoke a skill when DDD/backend guidance is needed.

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
