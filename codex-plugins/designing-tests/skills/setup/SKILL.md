---
name: setup
description: Use after installing or upgrading designing-tests in Codex to register the plugin's SessionStart hook into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Idempotent via version markers.
---

# Setup designing-tests hooks for Codex

Use this skill to register designing-tests' SessionStart hook into `~/.codex/hooks.json`.

## Procedure

### 1. Read current `~/.codex/hooks.json`

Treat absent file as `{}`.

### 2. Read plugin snippet

Read `codex-plugins/designing-tests/codex-hooks-snippet.json`. Note `version` as `SNIPPET_VERSION`.

### 3. Locate existing marker

Search for:

```
// BEGIN designing-tests:hooks-v<X.Y.Z>
... block ...
// END designing-tests:hooks
```

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | Fresh install: merge `hooks.SessionStart` entries; insert markers |
| Version matches | Up-to-date; report and stop |
| Version differs | Replace block with new version |

### 5. Backup, write, report

Backup → write → report changes → suggest Codex restart.

## Constraints

Same as superpowers-memory and superpowers-architect setup skills.
