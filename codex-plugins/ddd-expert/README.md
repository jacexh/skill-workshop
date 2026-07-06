# ddd-expert (Codex)

Standalone DDD/backend architecture expert skills for Codex.

Use the phase skills directly for DDD/backend work. The plugin also registers a restrained prompt hook for explicit Superpowers workflow skill mentions; the hook only reminds the agent which `ddd-expert` skill to invoke.

## Installation

Codex hooks require these feature flags in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add ddd-expert@skill-workshop-codex
```

Restart Codex after installation so the skills and hook are loaded.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after upgrade.

## Capabilities

- **`$ddd-expert:domain-modeling` skill** — spec-to-domain-decision interview workflow for implicit domain objects and existing-model impact
- **`$ddd-expert:design` skill** — explicit domain-brief-to-DDD boundary design workflow
- **`$ddd-expert:implement` skill** — explicit model-to-code placement workflow
- **`$ddd-expert:review` skill** — explicit evidence-to-judgment boundary review workflow
- **UserPromptSubmit hook** — when the user explicitly mentions `$superpowers:writing-plans`, `$superpowers:executing-plans`, `$superpowers:subagent-driven-development`, `$superpowers:requesting-code-review`, or `$superpowers:receiving-code-review`, injects only a short reminder to use the matching `ddd-expert` phase skill
- **References** — canonical files live under `references/`

The plugin does not auto-inject context for natural-language architecture prompts. The Codex hook also cannot intercept agent-self-decided skill invocations; invoke a `ddd-expert` skill explicitly when DDD/backend guidance is needed.

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
- `ddd-risk-router.md` — default DDD/backend risk cards read with the active phase skill
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
