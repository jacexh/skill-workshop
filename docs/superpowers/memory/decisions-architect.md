---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions — Architect

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
