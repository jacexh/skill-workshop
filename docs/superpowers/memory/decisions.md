---
last_updated: 2026-06-24
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions

## ADR-019: Canonical memory directory under docs/superpowers
**Decision:** Move the Project Knowledge Base from `docs/project-knowledge/` to `docs/superpowers/memory/` and treat the new directory as the only canonical storage path. Each memory skill performs a one-time hard migration with `git mv docs/project-knowledge docs/superpowers/memory` when the legacy directory exists and the canonical directory does not. Runtime reading, verification, owner suggestions, and status checks use the canonical path; write protection still blocks both canonical and legacy paths so the old directory cannot be maintained by hand.
**Trade-off:** Query/lint gain one allowed write side effect during upgrade, and users with both directories must resolve the conflict manually. Accepted because a hard cut keeps the mental model simple, places memory beside superpowers specs/plans, and avoids long-term dual-path drift.
**Affects:** `plugins/superpowers-memory/`, `codex-plugins/superpowers-memory/`, memory skill docs, runtime path resolution, KB write-lock behavior, release tests.
→ [adr/ADR-019-canonical-memory-directory.md](adr/ADR-019-canonical-memory-directory.md)

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

## ADR-016: Progressive KB layout and playbook removal
**Decision:** Remove the `playbooks.md` lazy slot from superpowers-memory and replace non-index line/token constraints with advisory `retrievalCost` plus vertical `<slot>-<domain>.md` shard support. `index.md` remains the only strict hot-path size constraint because it is injected at SessionStart.
**Trade-off:** Large projects may produce more KB files and require better index routing. Accepted because preserving valid knowledge is more important than satisfying global caps, and playbooks had no observed practical value.
**Affects:** `plugins/superpowers-memory/`, `codex-plugins/superpowers-memory/`, `docs/superpowers/memory/index.md`, KB shard routing rules.
→ [adr/ADR-016-progressive-kb-layout.md](adr/ADR-016-progressive-kb-layout.md)

## ADR-015: DDD agent contract and Go runtime split as standalone pattern files
**Decision:** Add `ddd-agent-contract.md` (agent execution behavior: trigger conditions, task classification, stop protocol, initially 23 and now 26 must-not rules including dependency-inversion-only Application-port rejection, routing/topology Application-port rejection, bloated Go fx entrypoint rejection, umbrella async handler rejection, mixed event/message handler rejection, adopted Go component-stack usage, completion self-checks, compact output template) and `ddd-golang-runtime.md` (Go config + fx module assembly guardrails + fx.Lifecycle + graceful shutdown + Kubernetes) as siblings under `design-patterns/` on both Claude and Codex tracks. `ddd-golang.md` shrinks to layer/aggregate/event content with a stub linking into the runtime guide; ADR-017 and ADR-018 later move taskqueue and events/messages into siblings. Promotion of the contract to a standalone skill is deferred with explicit re-evaluation criteria.
**Trade-off:** Pattern-file count grows from 8 to 10 and the contract introduces a drift risk against the underlying spec rules. Accepted because agent-selective-absorption of a 1723-line `ddd-golang.md` and recurring must-not violations had higher cost than pattern-count growth.
**Affects:** `plugins/superpowers-architect/design-patterns/`, `codex-plugins/superpowers-architect/design-patterns/`, architect standards routing.
→ [adr/ADR-015-ddd-agent-contract-and-runtime-split.md](adr/ADR-015-ddd-agent-contract-and-runtime-split.md)

## ADR-014: Native Codex plugin lifecycle hooks with cleanup migration
**Decision:** Codex plugins declare native `"hooks": "./hooks/hooks.json"` in `.codex-plugin/plugin.json`; public setup and cleanup skills are removed, while script-only `install-codex-hooks.js remove` helpers remain for stale fallback entries in `~/.codex/hooks.json`.
**Trade-off:** Older Codex builds without native plugin hooks lose setup/cleanup skill fallbacks. This is accepted to keep the public skill surface small and avoid stale cache-path hook failures.
**Affects:** `codex-plugins/*/.codex-plugin/plugin.json`, `codex-plugins/*/hooks/hooks.json`, Codex install/upgrade docs.
→ [adr/ADR-014-native-codex-plugin-hooks.md](adr/ADR-014-native-codex-plugin-hooks.md)

## ADR-013: Strategy A — parallel codex-plugins/ tree for Codex marketplace compatibility
**Decision:** Ship Codex-compatible variants under `codex-plugins/` plus `.agents/plugins/marketplace.json`. Current Codex plugins rely on native manifest hooks; script-only remove helpers clean old fallback entries from `~/.codex/hooks.json` when needed. Coverage maps to Codex primitives: SessionStart primer, UserPromptSubmit regex for manually typed skills, and PreToolUse `apply_patch|mcp__filesystem__.*` for KB write-lock.
**Trade-off:** ~2,000 lines of asset content + ~700 lines of runtime logic exist twice — drift risk accepted because Codex track is experimental. Three Codex protocol gaps documented and accepted: auto-triggered planning skills get only standing primer (no JIT); agent-self-decided finishing invocation gets no diff evidence; architect plan/review wording collapses to fused meta-rule.
**Affects:** `codex-plugins/`, `.agents/plugins/marketplace.json`, release scripts, Codex plugin documentation.
→ [adr/ADR-013-codex-marketplace-compat.md](adr/ADR-013-codex-marketplace-compat.md)

## ADR-012: UserPromptExpansion hook for slash-command coverage of finishing-a-development-branch
**Decision:** Add a `UserPromptExpansion` hook (matcher: `finishing-a-development-branch`) that runs the same `classifyFinishingState()` classifier the existing `PreToolUse:Skill` hook uses. Slash-command invocations (`/superpowers:finishing-a-development-branch` typed by the user) bypass `PreToolUse:Skill`; without this hook, the rich-injection from ADR-011 would never fire on the manual path. KB-ready precheck lives at each caller boundary, not inside the shared classifier.
**Trade-off:** Two hook entries to maintain instead of one. Mitigated by the shared classifier — only the precheck and the event-name parameter differ between paths. Matcher format for plugin-namespaced skills is documented but not exhaustively specified; the script defensively double-checks `command_name.endsWith("finishing-a-development-branch")`.
**Affects:** `plugins/superpowers-memory/hooks/`, `plugins/superpowers-memory/hooks/hooks.json`, finishing workflow readiness checks.
→ [adr/ADR-012-user-prompt-expansion-hook.md](adr/ADR-012-user-prompt-expansion-hook.md)

## ADR-011: Rich-context injection for finishing-a-development-branch staleness
**Decision:** When `superpowers:finishing-a-development-branch` is invoked on a feature branch and the KB does not cover HEAD, the PreToolUse hook returns an architect-style rich-context block (header + commits/files since `covers_branch@SHA` + imperative "must invoke `superpowers-memory:update` next" + escape hatch) instead of `decision: "block"`. Hard block retained only for KB-missing (catastrophic).
**Trade-off:** The model can ignore a rich context (no enforcement), unlike a hard block. Mitigated by concrete diff scope + explicit MUST language. Aligns staleness handling with the documented "hard block only catastrophic; semantic freshness via rich injection" preference.
**Affects:** `plugins/superpowers-memory/hooks/hook-runtime.js`, finishing workflow staleness behavior, KB status prompts.
→ [adr/ADR-011-finishing-rich-injection.md](adr/ADR-011-finishing-rich-injection.md)

## ADR-010: KB write-lock enforced by PreToolUse hook
**Decision:** Extend the superpowers-memory PreToolUse hook to block `Write|Edit|MultiEdit|NotebookEdit` on any path under `docs/superpowers/memory/` unless a write-lock (`.git/superpowers-memory.lock`, 60-min TTL) is held; only `superpowers-memory:update` and `superpowers-memory:rebuild` acquire/release the lock via new `hook-runtime.js` `lock`/`unlock`/`lock-status` modes.
**Trade-off:** Breaking change for users on prior versions — manual KB edits (including typo fixes) and ad-hoc ADR commits become impossible without invoking `superpowers-memory:update`. No env-var escape hatch by design.
**Affects:** `plugins/superpowers-memory/hooks/hook-runtime.js`, `codex-plugins/superpowers-memory/hooks/codex-runtime.js`, KB write workflow.
→ [adr/ADR-010-kb-write-lock.md](adr/ADR-010-kb-write-lock.md)

## ADR-009: Plugin-level enforcement of KB content discipline
**Decision:** Add explicit Ownership Matrix, single-question ADR gate, capability-view `features.md`, ≤2-line `glossary.md` rule, Exclusion Gate step in update/rebuild skills, and three new warn-only `verify` checks (`ssotCheck`, `contentShapeLint`, `totalTokenBudget` 20K default). `decisions.md` size cap raised from 150 → 300.
**Trade-off:** No hard enforcement — `verify` stays warn-only, `committable` remains git-state-only. Users retain control over whether to compress or accept warnings. Machine-checkable format rules (especially ≤2-line glossary) will surface legacy patterns as violations; re-shaping legacy KBs happens progressively on subsequent updates, not forced in one shot.
**Affects:** `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/`, memory verify runtime, KB owner files.
→ [adr/ADR-009-kb-content-discipline.md](adr/ADR-009-kb-content-discipline.md)

## ADR-008: Evidence-based staleness detection in stop hook
**Decision:** The stop hook detects KB staleness by checking for file-level changes outside `docs/superpowers/memory/` using four git queries: committed changes since last KB update (`git diff --name-only <kb-sha>..HEAD`), staged changes, unstaged changes, and untracked files. It emits a reminder only when relevant changes exist.
**Trade-off:** More git probes than commit-message matching, but materially fewer false negatives. Later ADR-011 replaces stop-hook enforcement with finishing-time rich injection because stop hooks were too noisy.
**Affects:** `plugins/superpowers-memory/hooks/hook-runtime.js`, KB freshness/status detection.
→ [adr/ADR-008-evidence-based-staleness.md](adr/ADR-008-evidence-based-staleness.md)

## ADR-007: Node.js hook runtime for superpowers-memory
**Decision:** Consolidate all superpowers-memory hook logic into a single `hook-runtime.js` (Node.js) file. The three bash hook scripts become thin wrappers that `exec node hook-runtime.js <mode>`. The runtime handles `session-start`, `pre-tool-use`, `stop`, `verify`, and `analyze` modes.
**Trade-off:** Hook logic becomes a larger JS runtime file, but avoids coordinated shell/Python quoting behavior and reduces host dependencies.
**Affects:** `plugins/superpowers-memory/hooks/`, hook runtime tests, cross-platform hook wrappers.
→ [adr/ADR-007-node-hook-runtime.md](adr/ADR-007-node-hook-runtime.md)

## ADR-006: Progressive design pattern loading via PreToolUse hook
**Decision:** `superpowers-architect` intercepts 5 target skills via PreToolUse hook, scans two-layer pattern directories (global + project), and injects only a compact index (name + description + path). Claude loads full content on demand via `Read`.
**Trade-off:** Agents must load full pattern content on demand; this preserves context budget and lets project-local patterns override team defaults.
**Affects:** `plugins/superpowers-architect/hooks/`, `plugins/superpowers-architect/design-patterns/`, architect standards skill.
→ [adr/ADR-006-progressive-design-pattern-loading.md](adr/ADR-006-progressive-design-pattern-loading.md)

## ADR-005: MEMORY.md as KB index with two-layer injection
**Decision:** `docs/superpowers/memory/index.md` (or legacy `MEMORY.md`) serves as a structured index (≤50 lines). Injected at session-start for passive awareness and referenced by pre-tool-use for enforced reading before brainstorming/writing-plans.
**Trade-off:** The index is an extra artifact to regenerate, but it keeps SessionStart context small while still making detailed files discoverable.
**Affects:** `docs/superpowers/memory/index.md`, memory session-start behavior, query/load routing.
→ [adr/ADR-005-kb-index-two-layer-injection.md](adr/ADR-005-kb-index-two-layer-injection.md)

## ADR-004: PreToolUse hook over SessionStart for KB context injection
**Decision:** Inject KB context at the exact moment a relevant skill is called (PreToolUse) rather than at session start. SessionStart retains only the index injection.
**Trade-off:** Coverage depends on hookable tool invocations; the benefit is lower background context and more task-specific instructions.
**Affects:** `plugins/superpowers-memory/hooks/`, memory skill trigger behavior.
→ [adr/ADR-004-pretooluse-kb-context.md](adr/ADR-004-pretooluse-kb-context.md)

## ADR-003: Split knowledge base into separate files
**Decision:** Store knowledge in independent files (architecture, tech-stack, features, conventions, decisions, glossary), each covering one domain. Incremental updates only modify changed files.
**Trade-off:** The KB has more files and needs routing rules, but incremental updates stay small and ownership is clearer.
**Affects:** `docs/superpowers/memory/`, memory templates, ingest/update routing rules.
→ [adr/ADR-003-split-project-knowledge.md](adr/ADR-003-split-project-knowledge.md)

## ADR-002: Zero-modification principle for superpowers integration
**Decision:** The plugin only uses Claude Code's hook system to inject context; it does not patch or override any superpowers files.
**Trade-off:** Hooks can influence but not fully control model behavior; the plugin remains independently upgradeable and avoids upstream coupling.
**Affects:** plugin integration boundaries, hook-based context injection, upstream superpowers compatibility.
→ [adr/ADR-002-zero-modification-principle.md](adr/ADR-002-zero-modification-principle.md)

## ADR-001: Cross-platform polyglot hook dispatcher
**Decision:** `run-hook.cmd` is a polyglot script — valid as both a Windows batch file and a bash script.
**Trade-off:** The wrapper is less obvious than separate platform scripts, but keeps hook declarations single-path and dependency-free.
**Affects:** `plugins/superpowers-memory/hooks/run-hook.cmd`, cross-platform hook dispatch.
→ [adr/ADR-001-cross-platform-hook-dispatcher.md](adr/ADR-001-cross-platform-hook-dispatcher.md)
