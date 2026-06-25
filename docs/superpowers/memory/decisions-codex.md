---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Decisions — Codex

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
