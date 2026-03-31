---
last_updated: 2026-04-01
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Decisions

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
