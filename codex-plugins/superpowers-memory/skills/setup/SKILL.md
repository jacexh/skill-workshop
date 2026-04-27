---
name: setup
description: Use after installing or upgrading superpowers-memory in Codex to register the plugin's hooks into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade.
---

# Setup superpowers-memory hooks for Codex

Use this skill to register superpowers-memory's SessionStart, UserPromptSubmit, and PreToolUse hooks into the user's `~/.codex/hooks.json`. Re-runnable and idempotent via the plugin's installer script.

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

- Reads this plugin's `codex-hooks-snippet.json`
- Replaces `${PLUGIN_ROOT}` with the actual installed plugin root
- Writes strict JSON only; it never writes `//` comments into `hooks.json`
- Migrates legacy `// BEGIN ...` / `// END ...` marker comments created by older setup instructions for the three skill-workshop Codex plugins
- Preserves unrelated user or plugin hook entries
- Creates `~/.codex/hooks.json.bak.<timestamp>` before changing an existing file
- Aborts on malformed JSON that is not caused by those managed legacy marker comments

## Constraints

- Do not manually edit `~/.codex/hooks.json`; run the installer script.
- Do not copy `codex-hooks-snippet.json` directly into `hooks.json`; it contains a `${PLUGIN_ROOT}` placeholder for the installer.
