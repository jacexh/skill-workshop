---
last_updated: 2026-05-06
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# ADR-014: Native Codex Plugin Lifecycle Hooks With Setup Fallback

**Status:** Accepted

**Decision:** Codex plugins declare native lifecycle hooks through `.codex-plugin/plugin.json` with `"hooks": "./hooks/hooks.json"`. The native hook file is the primary lifecycle config for installs and upgrades. Existing `$<plugin>:setup` skills and `scripts/install-codex-hooks.js` remain as a compatibility fallback for older Codex builds or environments where native hooks do not load after restart.

**Context:** The first Codex plugin port relied on setup skills that wrote absolute paths into `~/.codex/hooks.json`. That worked but made every marketplace upgrade require a manual setup rerun, because cached plugin paths could change. Current Codex plugin manifests can point at a hook config inside the installed plugin, so the host can resolve `${PLUGIN_ROOT}` from the active plugin version.

**Implications:** Each Codex plugin now ships `hooks/hooks.json` and a manifest `hooks` field. The fallback `codex-hooks-snippet.json` stays temporarily and must mirror the native file. Setup installers prefer `hooks/hooks.json`, fall back to `codex-hooks-snippet.json`, and still preserve unrelated user hooks when writing `~/.codex/hooks.json`.

**Trade-off:** Maintaining native and fallback hook files creates drift risk. Release tests must check manifest hook paths, native hook schema, fallback snippet schema, and version alignment until setup fallback can be removed. Users also need `[features] codex_hooks = true` and a Codex restart for native hooks to take effect.
