# Auto KB Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broad session-start KB injection and checkbox tracking with precise PreToolUse interception of three superpowers skills, fixing the broken stop hook detection along the way.

**Architecture:** Add a new `pre-tool-use` hook that intercepts `superpowers:brainstorming`, `superpowers:writing-plans`, and `superpowers:finishing-a-development-branch` via stdin JSON parsing, injecting KB-state-aware context at each call. Simplify `session-start` to only handle uninitialized KB. Fix `stop`'s broken `git diff` detection with SHA-based staleness check. Delete `task-completed` entirely.

**Tech Stack:** Bash (POSIX + bash extensions — all hook files use `#!/usr/bin/env bash`). JSON output injected via `hookSpecificOutput.additionalContext`. Stdin JSON parsed via `python3 -c`.

**Spec:** `docs/superpowers/specs/2026-04-01-auto-kb-update-design.md`

---

## File Map

| File | Action |
|------|--------|
| `plugins/superpowers-memory/hooks/hooks.json` | Modify — remove `TaskCompleted`, add `PreToolUse` |
| `plugins/superpowers-memory/hooks/task-completed` | Delete |
| `plugins/superpowers-memory/hooks/stop` | Modify — replace broken `git diff` with SHA staleness check |
| `plugins/superpowers-memory/hooks/session-start` | Modify — remove behavior guidelines, keep only "not initialized" branch |
| `plugins/superpowers-memory/hooks/pre-tool-use` | Create — new PreToolUse intercept hook |
| `plugins/superpowers-memory/.claude-plugin/plugin.json` | Modify — bump version to 1.0.9 |
| `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/hooks/*` | Sync — copy all changed hooks to installed location |
| `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json` | Modify — bump version to 1.0.9 |

---

### Task 1: Update hooks.json

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hooks.json`

- [ ] **Step 1: Overwrite hooks.json with new content**

Write `plugins/superpowers-memory/hooks/hooks.json`:

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

- [ ] **Step 2: Verify TaskCompleted is gone and PreToolUse is present**

Run:
```bash
grep "TaskCompleted" plugins/superpowers-memory/hooks/hooks.json
```
Expected: **no output**

Run:
```bash
grep "PreToolUse" plugins/superpowers-memory/hooks/hooks.json
```
Expected: one match

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/hooks/hooks.json
git commit -m "feat: hooks.json — remove TaskCompleted, add PreToolUse Skill matcher"
```

---

### Task 2: Delete task-completed hook

**Files:**
- Delete: `plugins/superpowers-memory/hooks/task-completed`

- [ ] **Step 1: Delete the file**

```bash
rm plugins/superpowers-memory/hooks/task-completed
```

- [ ] **Step 2: Verify deletion**

Run:
```bash
ls plugins/superpowers-memory/hooks/task-completed 2>&1
```
Expected: `No such file or directory`

- [ ] **Step 3: Commit**

```bash
git add -u plugins/superpowers-memory/hooks/task-completed
git commit -m "feat: remove task-completed hook — superpowers handles checkbox tracking"
```

---

### Task 3: Fix stop hook

**Files:**
- Modify: `plugins/superpowers-memory/hooks/stop`

The current hook uses `git diff --name-only HEAD -- docs/superpowers/plans/` which only detects unstaged changes. Replace with SHA-based KB staleness check.

- [ ] **Step 1: Overwrite stop hook**

Write `plugins/superpowers-memory/hooks/stop`:

```bash
#!/usr/bin/env bash
set -euo pipefail

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf '{}\n'
    exit 0
fi

# Check KB staleness
kb_is_stale="no"
if [ -d "docs/project-knowledge" ]; then
    kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
    current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [ -n "$kb_last_commit" ] && [ "$kb_last_commit" != "$current_commit" ]; then
        kb_is_stale="yes"
    fi
fi

if [ "$kb_is_stale" = "yes" ]; then
    context="This session has commits not yet reflected in the project knowledge base. You MUST run superpowers-memory:update before this session ends."
    escaped_context=$(escape_for_json "$context")

    if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "Stop",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
    elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    else
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    fi
else
    printf '{}\n'
fi

exit 0
```

- [ ] **Step 2: Verify hook produces valid JSON**

Run:
```bash
bash plugins/superpowers-memory/hooks/stop | python3 -m json.tool
```
Expected: valid JSON without errors

- [ ] **Step 3: Verify old broken detection is gone**

Run:
```bash
grep "git diff" plugins/superpowers-memory/hooks/stop
```
Expected: **no output**

- [ ] **Step 4: Verify new staleness detection is present**

Run:
```bash
grep -c "kb_last_commit" plugins/superpowers-memory/hooks/stop
grep -c "MUST run" plugins/superpowers-memory/hooks/stop
```
Expected: both output `1`

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/hooks/stop
git commit -m "fix: stop hook — replace broken git-diff detection with SHA-based KB staleness check"
```

---

### Task 4: Simplify session-start hook

**Files:**
- Modify: `plugins/superpowers-memory/hooks/session-start`

Remove behavior guidelines and staleness detection. Keep only the "KB not initialized" branch. Everything else is now handled by PreToolUse.

- [ ] **Step 1: Overwrite session-start hook**

Write `plugins/superpowers-memory/hooks/session-start`:

```bash
#!/usr/bin/env bash
set -euo pipefail

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

KNOWLEDGE_DIR="docs/project-knowledge"

if [ ! -d "$KNOWLEDGE_DIR" ]; then
    context="Project knowledge base not initialized. Run superpowers-memory:rebuild to generate the full knowledge base from the codebase."
    escaped_context=$(escape_for_json "$context")

    if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
    elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    else
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    fi
else
    printf '{}\n'
fi

exit 0
```

- [ ] **Step 2: Verify hook produces valid JSON**

Run:
```bash
bash plugins/superpowers-memory/hooks/session-start | python3 -m json.tool
```
Expected: valid JSON. Output will be `{}` (KB exists in this repo) or the rebuild prompt (KB missing).

- [ ] **Step 3: Verify behavior guidelines are removed**

Run:
```bash
grep "behavior guidelines" plugins/superpowers-memory/hooks/session-start
```
Expected: **no output**

- [ ] **Step 4: Verify only one branch remains**

Run:
```bash
grep -c "KNOWLEDGE_DIR" plugins/superpowers-memory/hooks/session-start
```
Expected: `2` (the assignment and the `if` check)

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/hooks/session-start
git commit -m "feat: session-start — simplify to not-initialized check only; KB context moved to PreToolUse"
```

---

### Task 5: Create pre-tool-use hook

**Files:**
- Create: `plugins/superpowers-memory/hooks/pre-tool-use`

This is the core new hook. It reads stdin JSON to extract `tool_input.skill`, then injects KB-state-aware context for the three target skills.

- [ ] **Step 1: Create the hook file**

Write `plugins/superpowers-memory/hooks/pre-tool-use`:

```bash
#!/usr/bin/env bash
set -euo pipefail

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

# Read stdin JSON and extract tool_input.skill
input=$(cat)
skill_name=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('skill', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# Only handle the three target skills
case "$skill_name" in
    superpowers:brainstorming|superpowers:writing-plans|superpowers:finishing-a-development-branch)
        ;;
    *)
        printf '{}\n'
        exit 0
        ;;
esac

# Determine KB state: not_initialized / stale / fresh
kb_state="not_initialized"
if [ -d "docs/project-knowledge" ]; then
    kb_state="fresh"
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
        current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
        if [ -n "$kb_last_commit" ] && [ "$kb_last_commit" != "$current_commit" ]; then
            kb_state="stale"
        fi
    fi
fi

# Build context string based on skill + KB state
context=""

case "$skill_name" in
    superpowers:brainstorming)
        case "$kb_state" in
            not_initialized)
                context="Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before starting brainstorming."
                ;;
            stale)
                context="WARNING: The project knowledge base is behind the current codebase. Consider running superpowers-memory:update first. If this brainstorming session itself introduces breaking architectural changes, the KB will need rebuilding afterward.\n\nBefore brainstorming, read docs/project-knowledge/ to understand the current architecture and constraints."
                ;;
            fresh)
                context="Before brainstorming, you MUST read docs/project-knowledge/ to understand the current architecture, tech stack, conventions, and decisions."
                ;;
        esac
        ;;
    superpowers:writing-plans)
        case "$kb_state" in
            not_initialized)
                printf '{}\n'
                exit 0
                ;;
            stale)
                context="WARNING: The project knowledge base may not reflect recent changes. The plan should be based on actual code state, not KB alone."
                ;;
            fresh)
                context="Before writing plans, you MUST read docs/project-knowledge/ to ensure alignment with existing architecture, conventions, and decisions."
                ;;
        esac
        ;;
    superpowers:finishing-a-development-branch)
        case "$kb_state" in
            not_initialized)
                context="Project knowledge base does not exist. You MUST run superpowers-memory:rebuild as part of finishing this branch to create the initial KB."
                ;;
            stale)
                context="The project knowledge base is behind the current codebase. You MUST run superpowers-memory:update before finishing this branch."
                ;;
            fresh)
                context="After completing this development branch, you MUST run superpowers-memory:update to keep the project knowledge base current."
                ;;
        esac
        ;;
esac

if [ -z "$context" ]; then
    printf '{}\n'
    exit 0
fi

escaped_context=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PreToolUse",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

- [ ] **Step 2: Make hook executable**

```bash
chmod +x plugins/superpowers-memory/hooks/pre-tool-use
```

- [ ] **Step 3: Test — unknown skill produces empty JSON**

Run:
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"some:other-skill"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: `{}`

- [ ] **Step 4: Test — brainstorming with fresh KB produces load instruction**

Run (from repo root where `docs/project-knowledge/` exists and is current):
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:brainstorming"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: valid JSON with `additionalContext` containing "read docs/project-knowledge/"

- [ ] **Step 5: Test — writing-plans with no KB produces empty JSON**

Run (simulate missing KB):
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:writing-plans"}}' \
  | (cd /tmp && bash /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/pre-tool-use) \
  | python3 -m json.tool
```
Expected: `{}` (no KB dir in /tmp → not_initialized → writing-plans no-op)

- [ ] **Step 6: Test — finishing-a-development-branch always produces context**

Run:
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: valid JSON with `additionalContext` containing "superpowers-memory:update"

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-memory/hooks/pre-tool-use
git commit -m "feat: add pre-tool-use hook — precise KB context injection for superpowers skills"
```

---

### Task 6: Install to installed copy and bump version

**Files:**
- Modify: `plugins/superpowers-memory/.claude-plugin/plugin.json`
- Modify: `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json`
- Sync hooks to: `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/hooks/`

- [ ] **Step 1: Copy updated hooks to installed location**

```bash
INSTALLED="/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/hooks"

cp plugins/superpowers-memory/hooks/hooks.json "$INSTALLED/hooks.json"
cp plugins/superpowers-memory/hooks/stop "$INSTALLED/stop"
cp plugins/superpowers-memory/hooks/session-start "$INSTALLED/session-start"
cp plugins/superpowers-memory/hooks/pre-tool-use "$INSTALLED/pre-tool-use"
rm -f "$INSTALLED/task-completed"
```

- [ ] **Step 1b: Make installed pre-tool-use executable**

```bash
chmod +x /home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/hooks/pre-tool-use
```

- [ ] **Step 2: Verify installed copies match source**

Run:
```bash
INSTALLED="/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/hooks"

diff plugins/superpowers-memory/hooks/hooks.json "$INSTALLED/hooks.json"
diff plugins/superpowers-memory/hooks/stop "$INSTALLED/stop"
diff plugins/superpowers-memory/hooks/session-start "$INSTALLED/session-start"
diff plugins/superpowers-memory/hooks/pre-tool-use "$INSTALLED/pre-tool-use"
ls "$INSTALLED/task-completed" 2>&1
```
Expected: no diff output for the first four; last line shows `No such file or directory`

- [ ] **Step 3: Bump version in source plugin.json**

Edit `plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version": "1.0.8"` to `"version": "1.0.9"`.

- [ ] **Step 4: Bump version in installed plugin.json**

Edit `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version": "1.0.8"` to `"version": "1.0.9"`.

- [ ] **Step 5: Verify both plugin.json files show 1.0.9**

Run:
```bash
grep '"version"' plugins/superpowers-memory/.claude-plugin/plugin.json
grep '"version"' /home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json
```
Expected: both lines show `"version": "1.0.9"`

- [ ] **Step 6: Commit version bump**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json
git commit -m "chore: bump superpowers-memory to v1.0.9"
```
