---
name: setup
description: "Compatibility fallback for older Codex builds: register superpowers-memory hooks into ~/.codex/hooks.json when native plugin hooks do not load."
---

# Setup superpowers-memory hooks for Codex

Current Codex versions load this plugin's native lifecycle config from `hooks/hooks.json`. Use this fallback skill only when hooks do not appear after plugin install/upgrade and restart.

Do not run this skill for regular upgrades when native plugin hooks work. If this fallback was used previously and native hooks are now enabled, use `$superpowers-memory:cleanup` once to remove stale fallback entries from `~/.codex/hooks.json`.

This skill registers superpowers-memory's SessionStart, UserPromptSubmit, and PreToolUse hooks into the user's `~/.codex/hooks.json`. Re-runnable and idempotent via the plugin's installer script.

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

Report the installer output, including:

- Backup file path, if one was created
- Entries removed/added
- Whether legacy JSON comment markers were removed

### 4. Tell the user to restart Codex

Hook config is loaded at Codex startup. Suggest the user exit and restart their Codex session.

## Installer Behavior

- Reads this plugin's native `hooks/hooks.json`, falling back to `codex-hooks-snippet.json` for older plugin copies
- Replaces `${PLUGIN_ROOT}` with the actual installed plugin root
- Writes strict JSON only; it never writes `//` comments into `hooks.json`
- Migrates legacy `// BEGIN ...` / `// END ...` marker comments created by older setup instructions for the three skill-workshop Codex plugins
- Preserves unrelated user or plugin hook entries
- Creates `~/.codex/hooks.json.bak.<timestamp>` before changing an existing file
- Aborts on malformed JSON that is not caused by those managed legacy marker comments

## Constraints

- Do not manually edit `~/.codex/hooks.json`; run the installer script.
- Do not copy `hooks/hooks.json` or `codex-hooks-snippet.json` directly into `~/.codex/hooks.json`; they contain a `${PLUGIN_ROOT}` placeholder for the installer.
- Do not use setup as a routine upgrade step on current Codex builds; prefer native hooks plus `$superpowers-memory:cleanup` for migration off fallback entries.
