---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions — Memory

## ADR-024: Retire legacy memory migration
**Decision:** Remove the pre-canonical memory-directory migration path from public memory skills, runtime write protection, README guidance, and release fixtures. `docs/superpowers/memory/` is the only managed Project Knowledge Base directory.
**Trade-off:** Old installations must be moved manually or bootstrapped into the canonical directory before using memory skills. Accepted because the migration grace period is over and keeping hidden compatibility paths increases prompt, runtime, and testing surface area.
**Affects:** `plugins/superpowers-memory/`, `codex-plugins/superpowers-memory/`, memory skill docs, runtime path resolution, KB write-lock behavior, release fixtures.
→ [adr/ADR-024-retire-legacy-memory-migration.md](adr/ADR-024-retire-legacy-memory-migration.md)

## ADR-020: SessionStart no longer injects index content
**Decision:** Memory SessionStart no longer inlines `docs/superpowers/memory/index.md`. It emits only KB availability, the index path, freshness status, and short query/ingest guidance; `superpowers-memory:query` reads `index.md` on demand and routes to owner files/shards.
**Trade-off:** Agents lose passive project-map text on turns that never invoke `query`, but SessionStart becomes smaller and avoids duplicating the `query` workflow's first read. Accepted because `query` is now the preferred project-knowledge entry point and skill descriptions plus the primer carry adoption pressure.
**Affects:** `plugins/superpowers-memory/hooks/hook-runtime.js`, `codex-plugins/superpowers-memory/hooks/codex-runtime.js`, `plugins/superpowers-memory/content-rules.md`, `codex-plugins/superpowers-memory/content-rules.md`, SessionStart tests.
→ [adr/ADR-020-sessionstart-query-router.md](adr/ADR-020-sessionstart-query-router.md)

## ADR-019: Canonical memory directory under docs/superpowers
**Decision:** Move the Project Knowledge Base under `docs/superpowers/memory/` and treat that directory as the canonical storage path. Superseded in part by ADR-024, which removes the temporary migration and retired-path write-protection behavior.
**Trade-off:** A single canonical path keeps the mental model simple and places memory beside superpowers specs/plans. ADR-024 later removes the upgrade side effect after the migration window closed.
**Affects:** `plugins/superpowers-memory/`, `codex-plugins/superpowers-memory/`, memory skill docs, runtime path resolution, KB write-lock behavior, release fixtures.
→ [adr/ADR-019-canonical-memory-directory.md](adr/ADR-019-canonical-memory-directory.md)

## ADR-016: Progressive KB layout and playbook removal
**Decision:** Remove the `playbooks.md` lazy slot from superpowers-memory and replace non-index line/token constraints with advisory `retrievalCost` plus vertical `<slot>-<domain>.md` shard support. `index.md` remains the only strict query-router size constraint because `query` reads it first on demand.
**Trade-off:** Large projects may produce more KB files and require better index routing. Accepted because preserving valid knowledge is more important than satisfying global caps, and playbooks had no observed practical value.
**Affects:** `plugins/superpowers-memory/`, `codex-plugins/superpowers-memory/`, `docs/superpowers/memory/index.md`, KB shard routing rules.
→ [adr/ADR-016-progressive-kb-layout.md](adr/ADR-016-progressive-kb-layout.md)

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

## ADR-005: MEMORY.md as KB index with two-layer injection
**Decision:** `docs/superpowers/memory/index.md` (or legacy `MEMORY.md`) serves as a structured index (≤50 lines). Superseded in part by ADR-020: SessionStart no longer inlines index content; `query` reads it on demand before owner-file routing.
**Trade-off:** The index is an extra artifact to regenerate, but it keeps SessionStart context small while still making detailed files discoverable.
**Affects:** `docs/superpowers/memory/index.md`, memory session-start behavior, query/load routing.
→ [adr/ADR-005-kb-index-two-layer-injection.md](adr/ADR-005-kb-index-two-layer-injection.md)

## ADR-004: PreToolUse hook over SessionStart for KB context injection
**Decision:** Inject KB context at the exact moment a relevant skill is called (PreToolUse) rather than at session start. Superseded in part by ADR-020: SessionStart now retains only KB availability/status and query guidance.
**Trade-off:** Coverage depends on hookable tool invocations; the benefit is lower background context and more task-specific instructions.
**Affects:** `plugins/superpowers-memory/hooks/`, memory skill trigger behavior.
→ [adr/ADR-004-pretooluse-kb-context.md](adr/ADR-004-pretooluse-kb-context.md)

## ADR-003: Split knowledge base into separate files
**Decision:** Store knowledge in independent files (architecture, tech-stack, features, conventions, decisions, glossary), each covering one domain. Incremental updates only modify changed files.
**Trade-off:** The KB has more files and needs routing rules, but incremental updates stay small and ownership is clearer.
**Affects:** `docs/superpowers/memory/`, memory templates, ingest/update routing rules.
→ [adr/ADR-003-split-project-knowledge.md](adr/ADR-003-split-project-knowledge.md)
