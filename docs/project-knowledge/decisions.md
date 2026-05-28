---
last_updated: 2026-05-28
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions

## ADR-016: Progressive KB layout and playbook removal
**Decision:** Remove the `playbooks.md` lazy slot from superpowers-memory and replace non-index line/token constraints with advisory `retrievalCost` plus vertical `<slot>-<domain>.md` shard support. `index.md` remains the only strict hot-path size constraint because it is injected at SessionStart.
**Trade-off:** Large projects may produce more KB files and require better index routing. Accepted because preserving valid knowledge is more important than satisfying global caps, and playbooks had no observed practical value.
→ [adr/ADR-016-progressive-kb-layout.md](adr/ADR-016-progressive-kb-layout.md)

## ADR-015: DDD agent contract and Go runtime split as standalone pattern files
**Decision:** Add `ddd-agent-contract.md` (agent execution behavior: trigger conditions, task classification, stop protocol, 23 must-not rules including dependency-inversion-only Application-port rejection, routing/topology Application-port rejection, umbrella async handler rejection, mixed event/message handler rejection, adopted Go component-stack usage, dual-track self-check, compact output template) and `ddd-golang-runtime.md` (Go config + fx.Lifecycle + graceful shutdown + Kubernetes) as siblings under `design-patterns/` on both Claude and Codex tracks. `ddd-golang.md` shrinks to layer/aggregate/event content with a stub linking into the runtime guide. Promotion of the contract to a standalone skill is deferred with explicit re-evaluation criteria.
**Trade-off:** Pattern-file count grows from 8 to 10 and the contract introduces a drift risk against the underlying spec rules. Accepted because agent-selective-absorption of a 1723-line `ddd-golang.md` and recurring must-not violations had higher cost than pattern-count growth.
→ [adr/ADR-015-ddd-agent-contract-and-runtime-split.md](adr/ADR-015-ddd-agent-contract-and-runtime-split.md)

## ADR-014: Native Codex plugin lifecycle hooks with cleanup migration
**Decision:** Codex plugins declare native `"hooks": "./hooks/hooks.json"` in `.codex-plugin/plugin.json`; public setup skills are removed, and cleanup skills remove stale fallback entries from `~/.codex/hooks.json`.
**Trade-off:** Older Codex builds without native plugin hooks lose the setup-skill fallback. This is accepted to avoid stale cache-path hook failures and repeated setup confusion.
→ [adr/ADR-014-native-codex-plugin-hooks.md](adr/ADR-014-native-codex-plugin-hooks.md)

## ADR-013: Strategy A — parallel codex-plugins/ tree for Codex marketplace compatibility
**Decision:** Ship Codex-compatible variants under `codex-plugins/` plus `.agents/plugins/marketplace.json`. Current Codex plugins rely on native manifest hooks; cleanup skills remove old fallback entries from `~/.codex/hooks.json`. Coverage maps to Codex primitives: SessionStart primer, UserPromptSubmit regex for manually typed skills, and PreToolUse `apply_patch|mcp__filesystem__.*` for KB write-lock.
**Trade-off:** ~2,000 lines of asset content + ~700 lines of runtime logic exist twice — drift risk accepted because Codex track is experimental. Three Codex protocol gaps documented and accepted: auto-triggered planning skills get only standing primer (no JIT); agent-self-decided finishing invocation gets no diff evidence; architect plan/review wording collapses to fused meta-rule.
→ [adr/ADR-013-codex-marketplace-compat.md](adr/ADR-013-codex-marketplace-compat.md)

## ADR-012: UserPromptExpansion hook for slash-command coverage of finishing-a-development-branch
**Decision:** Add a `UserPromptExpansion` hook (matcher: `finishing-a-development-branch`) that runs the same `classifyFinishingState()` classifier the existing `PreToolUse:Skill` hook uses. Slash-command invocations (`/superpowers:finishing-a-development-branch` typed by the user) bypass `PreToolUse:Skill`; without this hook, the rich-injection from ADR-011 would never fire on the manual path. KB-ready precheck lives at each caller boundary, not inside the shared classifier.
**Trade-off:** Two hook entries to maintain instead of one. Mitigated by the shared classifier — only the precheck and the event-name parameter differ between paths. Matcher format for plugin-namespaced skills is documented but not exhaustively specified; the script defensively double-checks `command_name.endsWith("finishing-a-development-branch")`.
→ [adr/ADR-012-user-prompt-expansion-hook.md](adr/ADR-012-user-prompt-expansion-hook.md)

## ADR-011: Rich-context injection for finishing-a-development-branch staleness
**Decision:** When `superpowers:finishing-a-development-branch` is invoked on a feature branch and the KB does not cover HEAD, the PreToolUse hook returns an architect-style rich-context block (header + commits/files since `covers_branch@SHA` + imperative "must invoke `superpowers-memory:update` next" + escape hatch) instead of `decision: "block"`. Hard block retained only for KB-missing (catastrophic).
**Trade-off:** The model can ignore a rich context (no enforcement), unlike a hard block. Mitigated by concrete diff scope + explicit MUST language. Aligns staleness handling with the documented "hard block only catastrophic; semantic freshness via rich injection" preference.
→ [adr/ADR-011-finishing-rich-injection.md](adr/ADR-011-finishing-rich-injection.md)

## ADR-010: KB write-lock enforced by PreToolUse hook
**Decision:** Extend the superpowers-memory PreToolUse hook to block `Write|Edit|MultiEdit|NotebookEdit` on any path under `docs/project-knowledge/` unless a write-lock (`.git/superpowers-memory.lock`, 60-min TTL) is held; only `superpowers-memory:update` and `superpowers-memory:rebuild` acquire/release the lock via new `hook-runtime.js` `lock`/`unlock`/`lock-status` modes.
**Trade-off:** Breaking change for users on prior versions — manual KB edits (including typo fixes) and ad-hoc ADR commits become impossible without invoking `superpowers-memory:update`. No env-var escape hatch by design.
→ [adr/ADR-010-kb-write-lock.md](adr/ADR-010-kb-write-lock.md)

## ADR-009: Plugin-level enforcement of KB content discipline
**Decision:** Add explicit Ownership Matrix, single-question ADR gate, capability-view `features.md`, ≤2-line `glossary.md` rule, Exclusion Gate step in update/rebuild skills, and three new warn-only `verify` checks (`ssotCheck`, `contentShapeLint`, `totalTokenBudget` 20K default). `decisions.md` size cap raised from 150 → 300.
**Trade-off:** No hard enforcement — `verify` stays warn-only, `committable` remains git-state-only. Users retain control over whether to compress or accept warnings. Machine-checkable format rules (especially ≤2-line glossary) will surface legacy patterns as violations; re-shaping legacy KBs happens progressively on subsequent updates, not forced in one shot.
→ [adr/ADR-009-kb-content-discipline.md](adr/ADR-009-kb-content-discipline.md)

## ADR-008: Evidence-based staleness detection in stop hook
**Decision:** The stop hook detects KB staleness by checking for file-level changes outside `docs/project-knowledge/` using four git queries: committed changes since last KB update (`git diff --name-only <kb-sha>..HEAD`), staged changes, unstaged changes, and untracked files. It emits a reminder only when relevant changes exist.
**Trade-off:** More git probes than commit-message matching, but materially fewer false negatives. Later ADR-011 replaces stop-hook enforcement with finishing-time rich injection because stop hooks were too noisy.
→ [adr/ADR-008-evidence-based-staleness.md](adr/ADR-008-evidence-based-staleness.md)

## ADR-007: Node.js hook runtime for superpowers-memory
**Decision:** Consolidate all superpowers-memory hook logic into a single `hook-runtime.js` (Node.js) file. The three bash hook scripts become thin wrappers that `exec node hook-runtime.js <mode>`. The runtime handles `session-start`, `pre-tool-use`, `stop`, `verify`, and `analyze` modes.
**Trade-off:** Hook logic becomes a larger JS runtime file, but avoids coordinated shell/Python quoting behavior and reduces host dependencies.
→ [adr/ADR-007-node-hook-runtime.md](adr/ADR-007-node-hook-runtime.md)

## ADR-006: Progressive design pattern loading via PreToolUse hook
**Decision:** `superpowers-architect` intercepts 5 target skills via PreToolUse hook, scans two-layer pattern directories (global + project), and injects only a compact index (name + description + path). Claude loads full content on demand via `Read`.
**Trade-off:** Agents must load full pattern content on demand; this preserves context budget and lets project-local patterns override team defaults.
→ [adr/ADR-006-progressive-design-pattern-loading.md](adr/ADR-006-progressive-design-pattern-loading.md)

## ADR-005: MEMORY.md as KB index with two-layer injection
**Decision:** `docs/project-knowledge/index.md` (or legacy `MEMORY.md`) serves as a structured index (≤50 lines). Injected at session-start for passive awareness and referenced by pre-tool-use for enforced reading before brainstorming/writing-plans.
**Trade-off:** The index is an extra artifact to regenerate, but it keeps SessionStart context small while still making detailed files discoverable.
→ [adr/ADR-005-kb-index-two-layer-injection.md](adr/ADR-005-kb-index-two-layer-injection.md)

## ADR-004: PreToolUse hook over SessionStart for KB context injection
**Decision:** Inject KB context at the exact moment a relevant skill is called (PreToolUse) rather than at session start. SessionStart retains only the index injection.
**Trade-off:** Coverage depends on hookable tool invocations; the benefit is lower background context and more task-specific instructions.
→ [adr/ADR-004-pretooluse-kb-context.md](adr/ADR-004-pretooluse-kb-context.md)

## ADR-003: Split knowledge base into separate files
**Decision:** Store knowledge in independent files (architecture, tech-stack, features, conventions, decisions, glossary), each covering one domain. Incremental updates only modify changed files.
**Trade-off:** The KB has more files and needs routing rules, but incremental updates stay small and ownership is clearer.
→ [adr/ADR-003-split-project-knowledge.md](adr/ADR-003-split-project-knowledge.md)

## ADR-002: Zero-modification principle for superpowers integration
**Decision:** The plugin only uses Claude Code's hook system to inject context; it does not patch or override any superpowers files.
**Trade-off:** Hooks can influence but not fully control model behavior; the plugin remains independently upgradeable and avoids upstream coupling.
→ [adr/ADR-002-zero-modification-principle.md](adr/ADR-002-zero-modification-principle.md)

## ADR-001: Cross-platform polyglot hook dispatcher
**Decision:** `run-hook.cmd` is a polyglot script — valid as both a Windows batch file and a bash script.
**Trade-off:** The wrapper is less obvious than separate platform scripts, but keeps hook declarations single-path and dependency-free.
→ [adr/ADR-001-cross-platform-hook-dispatcher.md](adr/ADR-001-cross-platform-hook-dispatcher.md)
