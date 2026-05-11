---
last_updated: 2026-05-11
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions

## ADR-015: DDD agent contract and Go runtime split as standalone pattern files
**Decision:** Add `ddd-agent-contract.md` (agent execution behavior: trigger conditions, task classification, stop protocol, 12 must-not rules, dual-track self-check, compact output template) and `ddd-golang-runtime.md` (Go config + fx.Lifecycle + graceful shutdown + Kubernetes) as siblings under `design-patterns/` on both Claude and Codex tracks. `ddd-golang.md` shrinks to layer/aggregate/event content with a stub linking into the runtime guide. Promotion of the contract to a standalone skill is deferred with explicit re-evaluation criteria.
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
**Why:** User case study (talgent KB) showed pre-existing rules (implied ownership in template comments, Exclusion List never invoked as a skill step, only coarse size warnings) allowed progressive drift across three categories — size overflow via granularity creep, SSOT breakdown, Exclusion List violations. Explicit matrix + gates + richer `verify` warnings give users specific, actionable feedback at update time.
**Trade-off:** No hard enforcement — `verify` stays warn-only, `committable` remains git-state-only. Users retain control over whether to compress or accept warnings. Machine-checkable format rules (especially ≤2-line glossary) will surface legacy patterns as violations; re-shaping legacy KBs happens progressively on subsequent updates, not forced in one shot.

---

## ADR-008: Evidence-based staleness detection in stop hook

**Date:** 2026-04-09
**Status:** Accepted

**Decision:** The stop hook detects KB staleness by checking for file-level changes outside `docs/project-knowledge/` using four git queries: committed changes since last KB update (`git diff --name-only <kb-sha>..HEAD`), staged changes, unstaged changes, and untracked files. It emits a reminder only when relevant changes exist.

**Alternatives:** Previous approach matched commit message patterns (`grep -qE "^(feat|refactor):"`) which missed changes without conventional prefixes.

**Reason:** File-level detection is more reliable — it catches all meaningful changes regardless of commit message format.

---

## ADR-007: Node.js hook runtime for superpowers-memory

**Date:** 2026-04-09
**Status:** Accepted

**Decision:** Consolidate all superpowers-memory hook logic into a single `hook-runtime.js` (Node.js) file. The three bash hook scripts become thin wrappers that `exec node hook-runtime.js <mode>`. The runtime handles `session-start`, `pre-tool-use`, `stop`, `verify`, and `analyze` modes.

**Alternatives:** Keep bash+python3 approach. Python3 was used only for `json.dumps` escaping and stdin JSON parsing.

**Reason:** Node.js is available in any Claude Code environment. A single JS file is easier to maintain than coordinated bash+python3 scripts, and eliminates the python3 dependency.

---

## ADR-006: Progressive design pattern loading via PreToolUse hook

**Date:** 2026-04-02
**Status:** Accepted

**Decision:** `superpowers-architect` intercepts 5 target skills via PreToolUse hook, scans two-layer pattern directories (global + project), and injects only a compact index (name + description + path). Claude loads full content on demand via `Read`.

**Alternatives:** Full-content injection (token bloat), tag-based activation (user friction).

**Reason:** Progressive loading keeps context small while enforcing standards. Two-layer directories allow team defaults with per-project overrides.

---

## ADR-005: MEMORY.md as KB index with two-layer injection

**Date:** 2026-04-01
**Status:** Accepted

**Decision:** `docs/project-knowledge/index.md` (or legacy `MEMORY.md`) serves as a structured index (≤50 lines). Injected at session-start for passive awareness and referenced by pre-tool-use for enforced reading before brainstorming/writing-plans.

**Reason:** Two complementary layers cover both passive session context and enforced skill-time reading. Index stays lightweight by design.

---

## ADR-004: PreToolUse hook over SessionStart for KB context injection

**Date:** 2026-04-01
**Status:** Accepted

**Decision:** Inject KB context at the exact moment a relevant skill is called (PreToolUse) rather than at session start. SessionStart retains only the index injection.

**Reason:** Precise injection at skill invocation time maximizes compliance. State-awareness allows calibrated instructions.

---

## ADR-003: Split knowledge base into separate files

**Date:** 2026-03-31
**Status:** Accepted

**Decision:** Store knowledge in independent files (architecture, tech-stack, features, conventions, decisions, glossary), each covering one domain. Incremental updates only modify changed files.

**Reason:** Surgical updates with minimal diff noise; maps cleanly to distinct knowledge domains.

---

## ADR-002: Zero-modification principle for superpowers integration

**Date:** 2026-03-31
**Status:** Accepted

**Decision:** The plugin only uses Claude Code's hook system to inject context; it does not patch or override any superpowers files.

**Reason:** Hook-based injection achieves behavioral outcomes without coupling to superpowers internals. Plugin remains independently upgradeable.

---

## ADR-001: Cross-platform polyglot hook dispatcher

**Date:** 2026-03-31
**Status:** Accepted

**Decision:** `run-hook.cmd` is a polyglot script — valid as both a Windows batch file and a bash script.

**Reason:** Single file, no extra dependencies, handles Windows (Git for Windows) transparently.
