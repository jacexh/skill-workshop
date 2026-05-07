---
name: cleanup
description: "Remove designing-tests fallback hooks from ~/.codex/hooks.json after native Codex hooks are enabled."
---

# Cleanup designing-tests fallback hooks for Codex

Current Codex versions load this plugin's native lifecycle config from `hooks/hooks.json`. Use this cleanup skill after enabling native hooks, or when old fallback entries in `~/.codex/hooks.json` point at deleted plugin cache versions.

This skill removes only designing-tests entries from `~/.codex/hooks.json`; unrelated hooks are preserved. Re-runnable and idempotent via the plugin's installer script.

## Procedure

### 1. Locate the installed plugin root

This skill file lives at:

```text
<plugin-root>/skills/cleanup/SKILL.md
```

Resolve `<plugin-root>` from the loaded skill path. Do not assume a fixed install directory; Codex marketplace installs commonly live under `~/.codex/plugins/cache/...`.

### 2. Run the cleanup mode

Run:

```bash
node "<plugin-root>/scripts/install-codex-hooks.js" remove
```

### 3. Report the result

Report the installer output, including backup path and entries removed.

### 4. Tell the user to restart Codex

Hook config is loaded at Codex startup. Suggest the user exit and restart their Codex session.

## Constraints

- Do not manually edit `~/.codex/hooks.json`; run the installer script.
- Do not remove unrelated user hooks.
