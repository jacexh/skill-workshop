# Auto KB Update Design

**Date:** 2026-04-01

**Scope:** Modify existing hooks in `plugins/superpowers-memory/hooks/` so that the project knowledge base is automatically loaded and updated at the right moments, without requiring the user to manually remember to call `superpowers-memory:update` or `superpowers-memory:rebuild`.

---

## Problem

The original plugin has three defects:

1. **Checkbox tracking interference:** The `task-completed` hook injects checkbox update reminders, duplicating logic that `superpowers` already handles internally.
2. **Broken detection in stop hook:** The stop hook checks `git diff --name-only HEAD -- docs/superpowers/plans/` which only catches *unstaged* plan file changes. Any committed work is invisible to it.
3. **Imprecise injection in session-start:** Behavior guidelines are injected at every session start, regardless of what the user is about to do. This is noisy and misses the moments when KB context is actually needed.

---

## Solution

Replace broad session-start injection and checkbox tracking with **precise PreToolUse interception** of the three superpowers skills where KB context matters most.

| Hook | New Role |
|------|----------|
| `pre-tool-use` (new) | Intercept 3 superpowers skills; inject KB context or update reminders at the right moment |
| `session-start` | Narrowed to: KB not initialized → prompt rebuild only |
| `stop` | Unchanged — KB staleness safety net at session end |
| `task-completed` | **Deleted** — superpowers handles checkbox tracking |

---

## Shared Staleness Detection

All hooks that check KB state use the same mechanism:

```bash
kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
if [ -n "$kb_last_commit" ] && [ "$kb_last_commit" != "$current_commit" ]; then
    kb_is_stale="yes"
fi
```

- `kb_last_commit` = SHA of the last commit that touched `docs/project-knowledge/`
- If they differ → new commits exist not yet reflected in KB → stale
- If `kb_last_commit` is empty → KB has never been committed → treat as not initialized
- If no git repo → skip detection

---

## Hook 1: pre-tool-use (new)

**File:** `plugins/superpowers-memory/hooks/pre-tool-use`

**Trigger:** Before any `Skill` tool call; filtered internally to three skill names.

**Matcher in hooks.json:** `Skill`

The hook reads `tool_input.skill` from stdin JSON to determine which skill is being invoked.

### `superpowers:brainstorming`

```
KB not initialized → inject:
  "Project knowledge base not initialized. You MUST run superpowers-memory:rebuild
   before starting brainstorming."

KB stale → inject warning (non-blocking):
  "WARNING: The project knowledge base is behind the current codebase. Consider
   running superpowers-memory:update first. If this brainstorming session itself
   introduces breaking architectural changes, the KB will need rebuilding afterward."
  + inject load instruction:
  "Read docs/project-knowledge/ before proceeding to understand current architecture
   and constraints."

KB fresh → inject load instruction:
  "Before brainstorming, you MUST read docs/project-knowledge/ to understand the
   current architecture, tech stack, conventions, and decisions."
```

### `superpowers:writing-plans`

```
KB not initialized → no injection (plans can be written without KB)

KB stale → inject light warning:
  "WARNING: The project knowledge base may not reflect recent changes. The plan
   should be based on actual code state, not KB alone."

KB fresh → inject load instruction:
  "Before writing plans, you MUST read docs/project-knowledge/ to ensure alignment
   with existing architecture, conventions, and decisions."
```

### `superpowers:finishing-a-development-branch`

```
KB not initialized → inject mandatory:
  "Project knowledge base does not exist. You MUST run superpowers-memory:rebuild
   as part of finishing this branch to create the initial KB."

KB stale → inject mandatory:
  "The project knowledge base is behind the current codebase. You MUST run
   superpowers-memory:update before finishing this branch."

KB fresh → inject mandatory:
  "After completing this development branch, you MUST run superpowers-memory:update
   to keep the project knowledge base current."
```

---

## Hook 2: session-start (simplified)

**File:** `plugins/superpowers-memory/hooks/session-start`

Single branch — only fires when KB is not initialized:

```
KB not initialized → inject:
  "Project knowledge base not initialized. Run superpowers-memory:rebuild to
   generate the full knowledge base from the codebase."

KB exists (fresh or stale) → output {} (no injection)
```

All behavior guidelines and staleness checking removed from this hook. PreToolUse handles context injection at the right moments.

---

## Hook 3: stop (bug fix only)

**File:** `plugins/superpowers-memory/hooks/stop`

**Role unchanged** — session-end KB staleness safety net.

**Implementation fix required:** The current hook uses `git diff --name-only HEAD -- docs/superpowers/plans/` which only detects unstaged plan file changes, missing all committed work. Replace with SHA-based KB staleness detection (same as the other hooks).

```
Not in git repo → output {}

KB stale (SHA mismatch) → inject mandatory:
  "This session has commits not yet reflected in the project knowledge base.
   You MUST run superpowers-memory:update before this session ends."

KB fresh → output {}
```

---

## Hook 4: task-completed (deleted)

File removed. Entry removed from `hooks.json`.

Checkbox tracking is handled by `superpowers` internally. KB update reminders are covered by `finishing-a-development-branch` PreToolUse intercept.

---

## hooks.json Changes

Remove `TaskCompleted` entry. Add `PreToolUse` entry:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "async": false
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" stop",
            "async": false
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" pre-tool-use",
            "async": false
          }
        ]
      }
    ]
  }
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `hooks/hooks.json` | Remove `TaskCompleted`; add `PreToolUse` matcher for `Skill` |
| `hooks/pre-tool-use` | **New file** — intercepts brainstorming, writing-plans, finishing-a-development-branch |
| `hooks/session-start` | Simplified — only "KB not initialized" branch |
| `hooks/stop` | Bug fix — replace broken `git diff` detection with SHA-based KB staleness check |
| `hooks/task-completed` | **Deleted** |

---

## Behavior Walkthrough

**Starting a brainstorming session:**
1. User invokes `superpowers:brainstorming`
2. PreToolUse fires, detects KB is fresh
3. Agent receives: "Read docs/project-knowledge/ before proceeding"
4. Agent reads KB files, brainstorms with full project context

**Writing a plan after brainstorming:**
1. User invokes `superpowers:writing-plans`
2. PreToolUse fires, KB is fresh
3. Agent receives load instruction, writes plan aligned with KB

**Finishing a development branch (first time, no KB):**
1. User invokes `superpowers:finishing-a-development-branch`
2. PreToolUse fires, KB not initialized
3. Agent receives: "MUST run superpowers-memory:rebuild"
4. Agent runs rebuild, KB created and committed
5. Next session: KB exists and fresh

**Finishing a development branch (KB stale):**
1. User invokes `superpowers:finishing-a-development-branch`
2. PreToolUse fires, KB is stale
3. Agent receives: "MUST run superpowers-memory:update"
4. Agent runs update, KB committed to HEAD

**Session ends with stale KB (stop fires):**
1. Agent finishes session without updating KB
2. Stop hook detects staleness
3. Agent must run `:update` before session closes
