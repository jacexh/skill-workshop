---
last_updated: 2026-04-02
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-02-superpowers-architect.md
---

# Decisions

## ADR-006: Progressive design pattern loading via PreToolUse hook

**Date:** 2026-04-02

**Status:** Accepted

**Context:** The `writing-plans`, `executing-plans`, and code review skills produce implementation guidance without awareness of team or project design standards. Manually pasting standards into every prompt is error-prone and inconsistent.

**Decision:** Build `superpowers-architect` as a `pre-tool-use` hook plugin that intercepts five target skills (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`). It scans a two-layer pattern directory (global `$SP_ARCHITECT_DIR` + project `docs/design-patterns/`) and injects only a compact index (`name + description + path`). Claude then decides which patterns are relevant and loads full content on demand via the `Read` tool. Project-level files override global files by filename.

**Alternatives Considered:**
- Full-content injection: would dump all patterns into every prompt, causing token bloat and noise when only one or two patterns are relevant.
- Tag-based activation: would require users to manually tag tasks or maintain a config file — adds friction.

**Reason:** Progressive loading keeps context small (only the index is injected regardless of pattern count) while still enforcing standards. The two-layer directory model lets teams share global defaults and override per-project without forking the plugin.


## ADR-005: MEMORY.md as KB index with two-layer injection

**Date:** 2026-04-01

**Status:** Accepted

**Context:** Reading all 5 KB files on every `load` invocation is verbose. The `session-start` hook returns `{}` when KB is initialized, missing an opportunity to give the agent passive KB awareness. The `pre-tool-use` hook points agents at the raw `docs/project-knowledge/` directory without a lightweight entry point.

**Decision:** Introduce `docs/project-knowledge/MEMORY.md` as a structured index (filename + one-line description + 2-3 key points per file, ≤30 lines). Written by `rebuild` and `update`. Two injection layers: (1) `session-start` injects MEMORY.md content for passive awareness; (2) `pre-tool-use` explicitly requires agents to read MEMORY.md before brainstorming/writing-plans, then load relevant detail files on demand.

**Alternatives Considered:**
- MEMORY.md as cached view (pre-compiled full summary): heavier, load could skip reading files entirely but risks stale summaries.
- MEMORY.md only in pre-tool-use injection: misses passive session-start awareness.

**Reason:** Two complementary layers — session-start for passive context, pre-tool-use for enforced read — cover both the case where the agent absorbed session context and the case where it didn't. Index stays lightweight by design (≤30 lines), keeping token cost low.

---

## ADR-004: PreToolUse hook over SessionStart for KB context injection

**Date:** 2026-04-01

**Status:** Accepted

**Context:** The original SessionStart hook injected 5 broad behavior guidelines into every session. This caused KB instructions to appear even for sessions where no superpowers skills were used, and the guidelines were often ignored or diluted by the time the relevant skill was called.

**Decision:** Replace broad SessionStart guidelines with a PreToolUse hook that intercepts exactly the three skills where KB context matters (`superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:finishing-a-development-branch`). Inject targeted, state-aware context (not_initialized / stale / fresh) at the moment the skill is invoked. SessionStart retains only the "not initialized" prompt.

**Alternatives Considered:**
- Keep SessionStart guidelines: simple but context is stale and often ignored.
- Modify superpowers skills directly: would require forking superpowers, violating ADR-002.

**Reason:** Precise injection at skill invocation time means the agent sees the KB instruction immediately before acting, maximizing compliance. State-awareness (not_initialized / stale / fresh) allows the instruction to be appropriately calibrated rather than one-size-fits-all.

---

## ADR-003: Split knowledge base into 5 separate files

**Date:** 2026-03-31

**Status:** Accepted

**Context:** The project knowledge base needs to cover architecture, tech stack, features, conventions, and decisions. A single large file would require full rewrites on incremental updates, risking data loss and creating unnecessary diff noise.

**Decision:** Store knowledge in 5 independent files, each covering one domain. Incremental updates (`superpowers-memory:update`) only modify the files that actually changed.

**Alternatives Considered:**
- Single `knowledge.md` file: simpler structure but requires rewriting the whole file on every update.
- Database or structured JSON: more queryable but much heavier; doesn't fit a zero-dependency bash + markdown approach.

**Reason:** 5 files enables surgical updates with minimal diff noise, maps cleanly to distinct knowledge domains, and is consistent with the bash + markdown tech stack.

---

## ADR-002: Zero-modification principle for superpowers integration

**Date:** 2026-03-31

**Status:** Accepted

**Context:** The plugin needs to influence agent behavior within the superpowers workflow (brainstorming → writing-plans → executing-plans → finishing) without requiring changes to superpowers itself, which would create a maintenance dependency.

**Decision:** The plugin only uses Claude Code's hook system (SessionStart, TaskCompleted, Stop) to inject context into the agent's existing session, and provides independent skills. It does not patch or override any superpowers files.

**Alternatives Considered:**
- Fork superpowers: would allow deeper integration but creates a maintenance burden and divergence from upstream.
- Modify superpowers skills directly: simpler, but breaks on superpowers updates and violates the principle that users shouldn't need to manage conflicts.

**Reason:** Hook-based context injection achieves the same behavioral outcome without coupling to superpowers internals. The plugin remains independently upgradeable.

---

## ADR-001: Cross-platform polyglot hook dispatcher

**Date:** 2026-03-31

**Status:** Accepted

**Context:** Claude Code runs on macOS, Linux, and Windows. Hook scripts are bash, which isn't natively available on Windows without Git for Windows or WSL.

**Decision:** `run-hook.cmd` is a polyglot script — valid both as a Windows batch file (`.cmd`) and a bash script. On Windows it tries `bash` (PATH), then common Git for Windows install locations, then fails with a clear error. On Unix, bash ignores the Windows section.

**Alternatives Considered:**
- Separate `.sh` and `.cmd` files: would require `hooks.json` to reference different files per OS, which Claude Code's hook system may not support cleanly.
- Node.js dispatcher: cross-platform without bash, but adds a Node.js dependency that may not be present.

**Reason:** The polyglot approach is a single file, requires no extra dependencies, and handles the common Windows case (Git for Windows) transparently.
