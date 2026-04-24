---
last_updated: 2026-04-24
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-24-memory-rules-refinement.md"
---

# Decisions

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
