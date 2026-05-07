---
last_updated: 2026-05-07
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# ADR-014: Native Codex Plugin Lifecycle Hooks With Cleanup Migration

**Status:** Accepted

**Decision:** Codex plugins declare native lifecycle hooks through `.codex-plugin/plugin.json` with `"hooks": "./hooks/hooks.json"`. The native hook file is the only public lifecycle config for installs and upgrades. Public `$<plugin>:setup` skills are removed; `$<plugin>:cleanup` remains to delete stale fallback hook entries from `~/.codex/hooks.json`.

**Context:** The first Codex plugin port relied on setup skills that wrote absolute paths into `~/.codex/hooks.json`. That worked but made every marketplace upgrade require a manual setup rerun, because cached plugin paths could change. Current Codex plugin manifests can point at a hook config inside the installed plugin, so the host can resolve `${PLUGIN_ROOT}` from the active plugin version.

**Implications:** Each Codex plugin ships `hooks/hooks.json` and a manifest `hooks` field. The legacy `codex-hooks-snippet.json` stays temporarily and must mirror the native file while installer migration tests remain. Cleanup runs the installer in `remove` mode and preserves unrelated user hooks when rewriting `~/.codex/hooks.json`.

**Trade-off:** Older Codex builds without native plugin hooks lose the setup-skill fallback. This is accepted to avoid stale cache-path hook failures and repeated setup confusion. Users need `[features] codex_hooks = true`, a current Codex build, and a Codex restart for native hooks to take effect.
