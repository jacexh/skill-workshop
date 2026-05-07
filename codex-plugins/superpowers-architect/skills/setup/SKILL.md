---
name: setup
description: "Compatibility fallback for older Codex builds: register superpowers-architect hooks into ~/.codex/hooks.json when native plugin hooks do not load."
---

# Setup superpowers-architect hooks for Codex

Current Codex versions load this plugin's native lifecycle config from `hooks/hooks.json`. Use this fallback skill only when hooks do not appear after plugin install/upgrade and restart.

Do not run this skill for regular upgrades when native plugin hooks work. If this fallback was used previously and native hooks are now enabled, use `$superpowers-architect:cleanup` once to remove stale fallback entries from `~/.codex/hooks.json`.

This skill registers superpowers-architect's SessionStart and UserPromptSubmit hooks into `~/.codex/hooks.json`. Re-runnable and idempotent via the plugin's installer script.

## Procedure

### 1. Locate the installed plugin root

This skill file lives at:

```text
<plugin-root>/skills/setup/SKILL.md
```

Resolve `<plugin-root>` from the loaded skill path. Do not assume a fixed install directory; Codex marketplace installs commonly live under `~/.codex/plugins/cache/...`.

### 2. Run the installer

Run:

```bash
node "<plugin-root>/scripts/install-codex-hooks.js"
```

### 3. Report the result

Report the installer output, including backup path, entries removed/added, and whether legacy marker comments were removed.

### 4. Tell the user to restart Codex

Hook config is loaded at Codex startup. Suggest the user exit and restart their Codex session.

## Constraints

- Do not manually edit `~/.codex/hooks.json`; run the installer script.
- Do not write `//` comments into `hooks.json`; Codex parses it as strict JSON.
- Do not copy `hooks/hooks.json` or `codex-hooks-snippet.json` directly into `~/.codex/hooks.json`; they contain a `${PLUGIN_ROOT}` placeholder for the installer.
- Do not use setup as a routine upgrade step on current Codex builds; prefer native hooks plus `$superpowers-architect:cleanup` for migration off fallback entries.
