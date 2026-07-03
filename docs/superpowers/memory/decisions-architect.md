---
last_updated: 2026-07-03
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
---

# Decisions — Architect

## ADR-023: DDD references leave old architect plugin
**Decision:** Remove bundled `ddd-*.md` and migrated `database.md` from `superpowers-architect` on both tracks. Move `ddd-python.md` and `ddd-typescript.md` into `plugins/superpowers-ddd-architect/references/` and `codex-plugins/superpowers-ddd-architect/references/` so the DDD plugin owns all bundled DDD language guides.
**Trade-off:** The old explicit standards plugin no longer offers bundled database or DDD fallback files. Accepted because keeping copies created drift and made Python/TypeScript DDD guides depend on removed core/modeling references.
**Affects:** `plugins/superpowers-architect/design-patterns/`, `codex-plugins/superpowers-architect/design-patterns/`, `plugins/superpowers-ddd-architect/references/`, `codex-plugins/superpowers-ddd-architect/references/`, architect runtime tests.
→ [adr/ADR-023-ddd-references-leave-old-architect.md](adr/ADR-023-ddd-references-leave-old-architect.md)

## ADR-022: DDD architect uses phase-specific skills
**Decision:** Replace the DDD plugin's single `standards` skill with `design`, `implement`, and `review`. All three skills share plugin-root `references/`; default prompt-time budgets list the active phase skill plus `ddd-risk-router.md`, while hooks map planning to design guidance, execution to implementation guardrails, and code-review to boundary review. The phase skills own detailed thinking frameworks and minimum output contracts: design owns Product semantics intake, Existing model inventory, Strategic/Tactical Model Gates, and Spec trace; implement owns Design input check, Accepted model source, Placement Translation Gates, Model-to-code placement, and Implementation trace; review owns Evidence Preconditions, Evidence map, Expected model vs observed code, Finding triage, and severity calibration. Hooks are route-only and must not duplicate those phase methods. The Risk Router owns the routing matrix for required references/evidence/exceptions. Deep references such as modeling/core/agent-contract/language/runtime/database are on-demand rule sources.
**Trade-off:** The plugin exposes more skills and gives each phase a stronger output contract, but each entry point is simpler and more focused. Accepted because one broad standards entry left agents to infer whether they were designing, placing code, or auditing a diff, and earlier workflows risked becoming passive reference-reading checklists.
**Affects:** `plugins/superpowers-ddd-architect/skills/`, `codex-plugins/superpowers-ddd-architect/skills/`, `plugins/superpowers-ddd-architect/references/`, `codex-plugins/superpowers-ddd-architect/references/`, DDD architect hooks and tests.
→ [adr/ADR-022-ddd-phase-specific-skills.md](adr/ADR-022-ddd-phase-specific-skills.md)

## ADR-021: Dedicated DDD architect plugin replaces automatic architect injection
**Decision:** Add `superpowers-ddd-architect` on both Claude and Codex tracks as the active DDD/backend architecture guardrail plugin. It owns automatic DDD/backend workflow routing, uses the active phase skill plus `ddd-risk-router.md` as the default prompt-time budget, stores references under plugin-root `references/`, treats probe commands as repo-calibrated examples, and intentionally has no root `design-patterns/` directory. `superpowers-architect` becomes explicit-only general standards lookup with empty automatic hook configs.
**Trade-off:** The plugin count grows and DDD references are duplicated into a new plugin track. Accepted because the old broad dynamic-loader identity was causing hot-path growth and made DDD/backend guidance compete with unrelated standards.
**Affects:** `plugins/superpowers-ddd-architect/`, `codex-plugins/superpowers-ddd-architect/`, `plugins/superpowers-architect/`, `codex-plugins/superpowers-architect/`, marketplace entries, architecture guidance tests.
→ [adr/ADR-021-ddd-architect-plugin-split.md](adr/ADR-021-ddd-architect-plugin-split.md)

## ADR-018: DDD Go events/messages split as standalone pattern file
**Decision:** Add `ddd-golang-events-messages.md` as a sibling design-pattern file on both Claude and Codex tracks. It owns Go event/message guidance: Domain Event collection, same-BC Domain Event Handlers, Boundary Publishers, Integration Messages, message handler contracts, Kafka adapter wiring, module registration, idempotency, and event/message failure semantics. `ddd-golang.md`, `ddd-agent-contract.md`, runtime references, and plugin READMEs now route event/message work to this guide.
**Trade-off:** Pattern-file count grows from 11 to 12 and the Go guidance has another sibling to keep synchronized. Accepted because event/message rules were the largest remaining cross-cutting chunk in `ddd-golang.md`, have clear trigger terms, and are a common LLM failure area distinct from the Go layer/layout skeleton.
**Affects:** `plugins/superpowers-architect/design-patterns/`, `codex-plugins/superpowers-architect/design-patterns/`, architecture/conventions entries for DDD Go guidance.
→ [adr/ADR-018-ddd-golang-events-messages-split.md](adr/ADR-018-ddd-golang-events-messages-split.md)

## ADR-017: DDD Go taskqueue and polling split as standalone pattern file
**Decision:** Add `ddd-golang-taskqueue.md` as a sibling design-pattern file on both Claude and Codex tracks. It owns Go taskqueue/polling guidance: `TaskType`, schema registry, one processor per task type, Application-layer processor placement, `internal/pkg/taskqueue` asynq runtime ownership, middleware, graceful shutdown, and polling-vs-retry policy. `ddd-agent-contract.md`, `ddd-golang.md`, `ddd-golang-runtime.md`, and plugin READMEs now route taskqueue/asynq work to this guide.
**Trade-off:** Pattern-file count grows from 10 to 11 and the Go guidance has another sibling to keep in sync across tracks. Accepted because putting polling/asynq rules into the already-long `ddd-golang.md` would recreate the selective-reading problem ADR-015 solved, while relying only on component/contrib package docs would not teach agents the DDD layer-placement rules.
**Affects:** `plugins/superpowers-architect/design-patterns/`, `codex-plugins/superpowers-architect/design-patterns/`, architecture/conventions entries for DDD Go taskqueue guidance.
→ [adr/ADR-017-ddd-golang-taskqueue-split.md](adr/ADR-017-ddd-golang-taskqueue-split.md)

## ADR-015: DDD agent contract and Go runtime split as standalone pattern files
**Decision:** Add `ddd-agent-contract.md` (agent execution behavior: trigger conditions, task classification, stop protocol, initially 23 and now 26 must-not rules including dependency-inversion-only Application-port rejection, routing/topology Application-port rejection, bloated Go fx entrypoint rejection, umbrella async handler rejection, mixed event/message handler rejection, adopted Go component-stack usage, completion self-checks, compact output template) and `ddd-golang-runtime.md` (Go config + fx module assembly guardrails + fx.Lifecycle + graceful shutdown + Kubernetes) as siblings under `design-patterns/` on both Claude and Codex tracks. `ddd-golang.md` shrinks to layer/aggregate/event content with a stub linking into the runtime guide; ADR-017 and ADR-018 later move taskqueue and events/messages into siblings. Promotion of the contract to a standalone skill is deferred with explicit re-evaluation criteria.
**Trade-off:** Pattern-file count grows from 8 to 10 and the contract introduces a drift risk against the underlying spec rules. Accepted because agent-selective-absorption of a 1723-line `ddd-golang.md` and recurring must-not violations had higher cost than pattern-count growth.
**Affects:** `plugins/superpowers-architect/design-patterns/`, `codex-plugins/superpowers-architect/design-patterns/`, architect standards routing.
→ [adr/ADR-015-ddd-agent-contract-and-runtime-split.md](adr/ADR-015-ddd-agent-contract-and-runtime-split.md)

## ADR-006: Progressive design pattern loading via PreToolUse hook
**Decision:** `superpowers-architect` intercepts 5 target skills via PreToolUse hook, scans two-layer pattern directories (global + project), and injects only a compact index (name + description + path). Claude loads full content on demand via `Read`.
**Trade-off:** Agents must load full pattern content on demand; this preserves context budget and lets project-local patterns override team defaults.
**Affects:** `plugins/superpowers-architect/hooks/`, `plugins/superpowers-architect/design-patterns/`, architect standards skill.
→ [adr/ADR-006-progressive-design-pattern-loading.md](adr/ADR-006-progressive-design-pattern-loading.md)
