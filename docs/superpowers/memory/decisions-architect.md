---
last_updated: 2026-07-06
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-06-ddd-expert-modeling-guidance.md"
---

# Decisions — Architect

## ADR-026: Restore superpowers-architect v1.13.10 content
**Decision:** Restore `plugins/superpowers-architect/` and `codex-plugins/superpowers-architect/` to the v1.13.10 dynamic design-pattern loader content, including bundled database and DDD/backend pattern files. Keep `superpowers-ddd-architect` retired and keep standalone `ddd-expert` as the hookless phase-skill path.
**Trade-off:** Reintroduces duplicated DDD/database reference material in `superpowers-architect`, but preserves the older dynamic Superpowers workflow behavior while `ddd-expert` supports hookless and non-Superpowers skill systems.
**Affects:** `plugins/superpowers-architect/`, `codex-plugins/superpowers-architect/`, architect runtime tests, hook setup tests, root README, and current architecture/convention entries. Supersedes ADR-021/ADR-023 consequences for old-architect hook and bundled-pattern removal, but not the retirement of `superpowers-ddd-architect` from ADR-025.
→ [adr/ADR-026-restore-superpowers-architect-v11310.md](adr/ADR-026-restore-superpowers-architect-v11310.md)

## ADR-025: ddd-expert replaces Superpowers DDD architect plugin
**Decision:** Retire `superpowers-ddd-architect` on both Claude and Codex tracks and make standalone `ddd-expert` the canonical DDD/backend guidance plugin. `ddd-expert` keeps explicit `design`, `implement`, and `review` skills plus the shared DDD/backend references, but does not register hooks or depend on Superpowers workflow routing. Its implement/review phases now use evidence-driven surface routers: high-risk tables are examples for routing required references, not exhaustive checklists.
**Trade-off:** Agents lose the dedicated `superpowers-ddd-architect` hook reminders for DDD work, but the DDD guidance becomes usable by non-Superpowers skill systems. ADR-026 later restores the older `superpowers-architect` dynamic design-pattern hook path as a separate legacy standards surface.
**Affects:** `plugins/ddd-expert/`, `codex-plugins/ddd-expert/`, marketplace entries, root README, release tests, and the retired `superpowers-ddd-architect` plugin paths.
→ [adr/ADR-025-ddd-expert-replaces-superpowers-ddd-architect.md](adr/ADR-025-ddd-expert-replaces-superpowers-ddd-architect.md)

## ADR-023: DDD references leave old architect plugin
**Decision:** Remove bundled `ddd-*.md` and migrated `database.md` from `superpowers-architect` on both tracks. Superseded by ADR-026, which restores v1.13.10 architect content including those bundled defaults.
**Trade-off:** The old explicit standards plugin no longer offered bundled database or DDD fallback files at the time. ADR-026 accepts the later drift risk to regain the older dynamic workflow behavior.
**Affects:** Historical DDD reference movement; current `plugins/superpowers-architect/design-patterns/` and `codex-plugins/superpowers-architect/design-patterns/` state is governed by ADR-026.
→ [adr/ADR-023-ddd-references-leave-old-architect.md](adr/ADR-023-ddd-references-leave-old-architect.md)

## ADR-022: DDD architect uses phase-specific skills
**Decision:** Replace the DDD plugin's single `standards` skill with phase skills. The current `ddd-expert` chain is `domain-modeling`, `design`, `implement`, and `review`; all share plugin-root `references/`. Prompt-time guidance stays compact, while phase skills own slim output contracts: domain-modeling owns evidence-first strategic interview and PRD-shaped brief; design owns strategic-first implementable design and Implementation handoff; implement owns handoff-to-code translation, object/surface routing, rule status, and verification; review owns expected-model reconstruction, evidence-gated findings, and evidence-gap reporting. The Risk Router owns detailed required references/evidence/exceptions. Deep references such as modeling/core/agent-contract/language/runtime/database remain on-demand rule sources.
**Trade-off:** The plugin exposes more skills and gives each phase a stronger output contract, but each entry point is simpler and more focused. Accepted because one broad standards entry left agents to infer whether they were designing, placing code, or auditing a diff, and earlier workflows risked becoming passive reference-reading checklists.
**Affects:** Current DDD phase skills and references from ADR-025; historical DDD architect hooks and tests.
→ [adr/ADR-022-ddd-phase-specific-skills.md](adr/ADR-022-ddd-phase-specific-skills.md)

## ADR-021: Dedicated DDD architect plugin replaces automatic architect injection
**Decision:** Add `superpowers-ddd-architect` on both Claude and Codex tracks as the active DDD/backend architecture guardrail plugin and make `superpowers-architect` explicit-only. The dedicated DDD plugin path was later retired by ADR-025, and the old architect content was restored by ADR-026.
**Trade-off:** The plugin count grew and DDD references were duplicated into a new plugin track at the time. ADR-026 later chooses a different coexistence model: restored `superpowers-architect` pattern injection plus standalone hookless `ddd-expert`.
**Affects:** Historical DDD architect plugin; current canonical paths are governed by ADR-025 and ADR-026.
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
