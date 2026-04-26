---
name: setup
description: Use after installing or upgrading superpowers-memory in Codex to register the plugin's hooks into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Detects existing version markers and skips if up-to-date, replaces if outdated, or adds fresh if missing.
---

# Setup superpowers-memory hooks for Codex

Use this skill to register superpowers-memory's SessionStart, UserPromptSubmit, and PreToolUse hooks into the user's `~/.codex/hooks.json`. Re-runnable; idempotent via version markers.

## Procedure

### 1. Read the current hook config

Read `~/.codex/hooks.json`. If the file does not exist, treat the current config as `{}` (no hooks installed yet).

### 2. Read the plugin's snippet

Read `codex-plugins/superpowers-memory/codex-hooks-snippet.json` from the installed plugin root (typically under `~/.codex/plugins/skill-workshop-codex/codex-plugins/superpowers-memory/`). Note the `version` field — call it `SNIPPET_VERSION`.

### 3. Locate the existing block (if any)

Within `~/.codex/hooks.json`, search for a JSON-comment-style marker pair:

```
// BEGIN superpowers-memory:hooks-v<X.Y.Z>
... block ...
// END superpowers-memory:hooks
```

(Codex's hook config supports JSON5-style comments — confirm at runtime; if comments are stripped, fall back to a sentinel key like `"_marker_superpowers_memory_version": "<X.Y.Z>"` placed inside the merged block.)

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | **Fresh install** — merge snippet's `hooks.*` arrays into `~/.codex/hooks.json` `hooks.*`; insert BEGIN/END markers around the appended entries |
| Found, version equals `SNIPPET_VERSION` | **Up-to-date** — report and stop |
| Found, version differs | **Update** — remove the old block (between BEGIN and END), then perform fresh install with new version |

### 5. Backup

Before writing, copy `~/.codex/hooks.json` to `~/.codex/hooks.json.bak.<timestamp>` (timestamp = `YYYYMMDD-HHMMSS`).

### 6. Write and report

Write the merged config back. Report exactly what changed:

- Backup file path created
- Old version → new version (or "fresh install" / "no change")
- Number of hook entries added/replaced

### 7. Tell the user to restart Codex

Hook config is loaded at Codex startup. Suggest the user exit and restart their Codex session.

## Constraints

- Never modify hook entries that are NOT inside the BEGIN/END markers (these belong to the user or other plugins).
- Never overwrite without backup.
- If JSON parsing fails, abort and report; do NOT attempt to repair user's hook config.
