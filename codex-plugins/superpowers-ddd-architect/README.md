# superpowers-ddd-architect (Codex)

DDD-first backend architecture guardrails for Codex.

This plugin is an active DDD/backend architecture guardrail. Its default prompt-time budget is the active phase skill plus the compact DDD Risk Router; deeper references load only when a risk card, task, or Architecture Gate requires them.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add superpowers-ddd-architect@skill-workshop-codex
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after upgrade.

## Capabilities

- **SessionStart hook** — injects only a lightweight reminder that DDD/backend guardrails are available on demand through `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, and `$superpowers-ddd-architect:review`
- **UserPromptSubmit hook** — detects explicit upstream `superpowers` workflow skill mentions and injects the matching DDD phase skill plus the compact DDD Risk Router, without duplicating the phase method in the hook
- **`$superpowers-ddd-architect:design` skill** — explicit product-semantics-to-DDD boundary design workflow
- **`$superpowers-ddd-architect:implement` skill** — explicit model-to-code placement workflow
- **`$superpowers-ddd-architect:review` skill** — explicit evidence-to-judgment boundary review workflow
- **References** — canonical files live under `references/`

Natural-language architecture prompts stay quiet unless they explicitly mention an upstream `$superpowers:*` workflow skill.

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

Do not use this plugin for frontend architecture, browser QA, product UI design, or general dynamic standards lookup. Use `superpowers-architect` explicitly for general standards.

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

This plugin intentionally does not scan generic `design-patterns/` directories. Project-specific architecture facts should be read from explicit project docs or Project Knowledge; generic team standards remain the responsibility of `superpowers-architect`.

## Known Codex Protocol Gap

Codex does not expose native skill invocation as a hookable tool/event, so the Codex port uses weaker signals: a lightweight SessionStart reminder, UserPromptSubmit matching for explicit upstream `$superpowers:*` workflow skill mentions, and explicit `design` / `implement` / `review` skills. It does not register a Stop hook because Stop fires after each assistant turn.
