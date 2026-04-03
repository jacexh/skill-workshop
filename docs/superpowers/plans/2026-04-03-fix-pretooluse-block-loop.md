# Fix PreToolUse Block Infinite Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the infinite loop where `pre-tool-use` blocks `brainstorming` and `writing-plans` with an unresolvable stale condition, unify stale detection across hooks, and eliminate redundant MEMORY.md re-read instructions.

**Architecture:** Three hooks modified: `pre-tool-use` (block/inject logic rewrite + stale detection), `session-start` (stale detection only). `stop` is already correct — no change needed.

**Tech Stack:** Bash with `set -euo pipefail`, `printf` for JSON, `python3 -c` for stdin JSON parsing.

**Spec:** `docs/superpowers/specs/2026-04-03-fix-pretooluse-block-loop-design.md`

---

## File Map

| File | Action |
|------|--------|
| `plugins/superpowers-memory/hooks/pre-tool-use` | Modify — rewrite block/inject logic + stale detection |
| `plugins/superpowers-memory/hooks/session-start` | Modify — update stale detection to feat/refactor filtering |
| `plugins/superpowers-memory/.claude-plugin/plugin.json` | Modify — bump version to 1.3.3 |

---

### Task 1: Rewrite pre-tool-use hook

**Files:**
- Modify: `plugins/superpowers-memory/hooks/pre-tool-use`

Three changes in this file:
1. Replace naive stale detection (`kb_last_commit != HEAD`) with feat/refactor commit filtering
2. Move block/inject decision inside each skill's case branch (remove blanket block at bottom)
3. Update context messages to say "load detail files" instead of "read MEMORY.md"

- [ ] **Step 1: Replace the stale detection block (lines 36-48)**

Replace the current stale detection:

```bash
# OLD (lines 36-48):
kb_state="not_initialized"
if [ -d "docs/project-knowledge" ]; then
    kb_state="fresh"
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
        current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
        if [ -z "$kb_last_commit" ]; then
            kb_state="not_initialized"
        elif [ "$kb_last_commit" != "$current_commit" ]; then
            kb_state="stale"
        fi
    fi
fi
```

With:

```bash
# NEW:
kb_state="not_initialized"
if [ -d "docs/project-knowledge" ]; then
    kb_state="fresh"
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
        if [ -z "$kb_last_commit" ]; then
            kb_state="not_initialized"
        elif git log --format="%s" "${kb_last_commit}..HEAD" 2>/dev/null | grep -qE "^(feat|refactor):"; then
            kb_state="stale"
        fi
    fi
fi
```

- [ ] **Step 2: Rewrite the brainstorming case with inline block/inject decisions**

Replace the brainstorming case content with:

```bash
    superpowers:brainstorming)
        case "$kb_state" in
            not_initialized)
                decision="block"
                context="Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before starting brainstorming."
                ;;
            stale)
                decision="inject"
                context="WARNING: The project knowledge base is behind the current codebase. Consider running superpowers-memory:update first.\n\nLoad the detail files from docs/project-knowledge/ relevant to this brainstorming task before proceeding."
                ;;
            fresh)
                decision="inject"
                context="Load the detail files from docs/project-knowledge/ relevant to this brainstorming task before proceeding."
                ;;
        esac
        ;;
```

- [ ] **Step 3: Rewrite the writing-plans case**

Replace the writing-plans case content with:

```bash
    superpowers:writing-plans)
        case "$kb_state" in
            not_initialized)
                decision="block"
                context="Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before writing plans."
                ;;
            stale)
                decision="inject"
                context="WARNING: The project knowledge base may not reflect recent changes. The plan should be based on actual code state, not KB alone.\n\nLoad the detail files from docs/project-knowledge/ relevant to this plan before proceeding."
                ;;
            fresh)
                decision="inject"
                context="Load the detail files from docs/project-knowledge/ relevant to this plan before proceeding."
                ;;
        esac
        ;;
```

- [ ] **Step 4: Rewrite the finishing-a-development-branch case**

Replace the finishing-a-development-branch case content with:

```bash
    superpowers:finishing-a-development-branch)
        case "$kb_state" in
            not_initialized)
                decision="block"
                context="Project knowledge base does not exist. You MUST run superpowers-memory:rebuild as part of finishing this branch to create the initial KB."
                ;;
            stale)
                decision="block"
                context="The project knowledge base is behind the current codebase. You MUST run superpowers-memory:update before finishing this branch."
                ;;
            fresh)
                decision="inject"
                context="After completing this development branch, you MUST run superpowers-memory:update to keep the project knowledge base current."
                ;;
        esac
        ;;
```

- [ ] **Step 5: Replace the blanket block + inject output logic (lines 95-116)**

Initialize `decision` before the skill case block:

```bash
decision="inject"
```

Then replace everything from `if [ -z "$context" ]` to end-of-file with:

```bash
if [ -z "$context" ]; then
    printf '{}\n'
    exit 0
fi

escaped_context=$(escape_for_json "$context")

if [ "$decision" = "block" ]; then
    printf '{\n  "decision": "block",\n  "reason": "%s"\n}\n' "$escaped_context"
    exit 0
fi

# Inject context as additional guidance
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PreToolUse",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

- [ ] **Step 6: Verify — unknown skill produces empty JSON**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"some:other-skill"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: `{}`

- [ ] **Step 7: Verify — brainstorming with fresh KB produces inject (not block)**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:brainstorming"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use
```
Expected: JSON with `additionalContext` containing "Load the detail files", NO `"decision": "block"`

- [ ] **Step 8: Verify — finishing-a-development-branch with not_initialized produces block**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' \
  | (cd /tmp && bash /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/pre-tool-use)
```
Expected: JSON with `"decision": "block"` containing "run superpowers-memory:rebuild"

- [ ] **Step 9: Verify — no blanket block logic remains**

```bash
grep -n "kb_state.*not_initialized.*stale" plugins/superpowers-memory/hooks/pre-tool-use
```
Expected: **no output** (the old blanket `if` is gone)

- [ ] **Step 10: Commit**

```bash
git add plugins/superpowers-memory/hooks/pre-tool-use
git commit -m "fix(superpowers-memory): resolve infinite loop — skill-aware block/inject + feat/refactor stale detection"
```

---

### Task 2: Update session-start stale detection

**Files:**
- Modify: `plugins/superpowers-memory/hooks/session-start`

Replace the naive `kb_last_commit != HEAD` check with feat/refactor commit filtering to match `stop` and the updated `pre-tool-use`.

- [ ] **Step 1: Replace the stale detection block (lines 33-38)**

Replace:

```bash
        kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
        current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
        if [ -n "$kb_last_commit" ] && [ "$kb_last_commit" != "$current_commit" ]; then
            stale_warning="WARNING: Project knowledge base is behind the current codebase. Run superpowers-memory:update to sync before starting work.\n\n"
        fi
```

With:

```bash
        kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
        if [ -n "$kb_last_commit" ] && git log --format="%s" "${kb_last_commit}..HEAD" 2>/dev/null | grep -qE "^(feat|refactor):"; then
            stale_warning="WARNING: Project knowledge base is behind the current codebase. Run superpowers-memory:update to sync before starting work.\n\n"
        fi
```

- [ ] **Step 2: Verify — session-start with only chore commits since KB update produces no warning**

```bash
bash plugins/superpowers-memory/hooks/session-start | python3 -m json.tool
```
Expected: valid JSON. Since the most recent commits on this repo are `chore:` bumps, the stale warning should **not** appear. The output should contain MEMORY.md content without "WARNING".

- [ ] **Step 3: Verify — no `current_commit` variable remains**

```bash
grep "current_commit" plugins/superpowers-memory/hooks/session-start
```
Expected: **no output**

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/hooks/session-start
git commit -m "fix(superpowers-memory): session-start stale detection — only feat/refactor commits count"
```

---

### Task 3: Sync to installed copy and bump version

**Files:**
- Modify: `plugins/superpowers-memory/.claude-plugin/plugin.json`
- Sync: installed copy at `~/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/`

- [ ] **Step 1: Copy updated hooks to installed location**

```bash
INSTALLED="$HOME/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory"
cp plugins/superpowers-memory/hooks/pre-tool-use "$INSTALLED/hooks/pre-tool-use"
cp plugins/superpowers-memory/hooks/session-start "$INSTALLED/hooks/session-start"
```

- [ ] **Step 2: Verify installed copies match source**

```bash
INSTALLED="$HOME/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory"
diff plugins/superpowers-memory/hooks/pre-tool-use "$INSTALLED/hooks/pre-tool-use"
diff plugins/superpowers-memory/hooks/session-start "$INSTALLED/hooks/session-start"
```
Expected: no diff output

- [ ] **Step 3: Bump version to 1.3.3**

Edit `plugins/superpowers-memory/.claude-plugin/plugin.json`: change `"version": "1.3.2"` to `"version": "1.3.3"`.

Also update the installed copy:

```bash
INSTALLED="$HOME/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory"
cp plugins/superpowers-memory/.claude-plugin/plugin.json "$INSTALLED/.claude-plugin/plugin.json"
```

- [ ] **Step 4: Verify version**

```bash
grep '"version"' plugins/superpowers-memory/.claude-plugin/plugin.json
```
Expected: `"version": "1.3.3"`

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json
git commit -m "chore: bump superpowers-memory to v1.3.3"
```
