---
name: setup
description: Use after installing or upgrading superpowers-architect in Codex to register the plugin's SessionStart hook into ~/.codex/hooks.json. Re-run after every codex plugin marketplace upgrade. Idempotent via version markers.
---

# Setup superpowers-architect hooks for Codex

Use this skill to register superpowers-architect's SessionStart hook into `~/.codex/hooks.json`. Re-runnable; idempotent via version markers.

## Procedure

### 1. Read the current hook config

Read `~/.codex/hooks.json`. If the file does not exist, treat as `{}`.

### 2. Read the plugin's snippet

Read `codex-plugins/superpowers-architect/codex-hooks-snippet.json` (typically under `~/.codex/plugins/skill-workshop-codex/...`). Note the `version` field — call it `SNIPPET_VERSION`.

### 3. Locate the existing block

Search for marker:

```
// BEGIN superpowers-architect:hooks-v<X.Y.Z>
... block ...
// END superpowers-architect:hooks
```

### 4. Decision

| Existing marker | Action |
|---|---|
| Not found | Fresh install: append snippet's `hooks.SessionStart` entries; insert markers |
| Version matches | Up-to-date; report and stop |
| Version differs | Replace block with new version |

### 5. Backup, write, report

Same as superpowers-memory's setup skill. Backup `~/.codex/hooks.json.bak.<timestamp>` first; write merged config; report changes; suggest Codex restart.

## Constraints

Same as superpowers-memory: never touch entries outside markers, never write without backup, never repair user's malformed JSON — abort and report instead.
