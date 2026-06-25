---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions — Foundation

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
