# superpowers-memory (Codex)

Project knowledge persistence + KB write-lock for Codex superpowers workflows.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-memory
```

Then in Codex, register the hooks:

```
$superpowers-memory:setup
```

Restart Codex. Hooks become active.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex, re-run `$superpowers-memory:setup`. The setup skill detects the new version marker and replaces the old block. Restart Codex.

Manual hook config (alternative to setup skill): copy the contents of `codex-hooks-snippet.json` into `~/.codex/hooks.json` under `hooks.*` arrays.

## Capabilities

- **SessionStart hook** — injects KB index from `docs/project-knowledge/index.md` plus standing primer for KB workflow
- **UserPromptSubmit hook** — when user types `$superpowers:brainstorming` or `$superpowers:finishing-a-development-branch`, JIT-injects relevant context (load advisory or finishing-readiness rich injection)
- **PreToolUse hook** — blocks `apply_patch` and `mcp__filesystem__.*` writes to `docs/project-knowledge/` unless write-lock is held by `$superpowers-memory:update` or `$superpowers-memory:rebuild`
- **Skills:** `load`, `update`, `rebuild`, `setup`

## Known Codex protocol gaps

The following coverage exists on Claude Code but **cannot be implemented on Codex** due to protocol limitations:

1. **Agent-self-decided invocation of `$superpowers:finishing-a-development-branch`** does not fire any hook in Codex. The agent only receives the standing primer from SessionStart, not the JIT diff evidence (commits since `covers_branch`, files changed). User-typed slash invocation IS covered via UserPromptSubmit.

2. **Auto-triggered planning skills** (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`) cannot receive a per-skill JIT advisory in Codex (matcher does not support skill names). Coverage falls back to SessionStart standing primer.
