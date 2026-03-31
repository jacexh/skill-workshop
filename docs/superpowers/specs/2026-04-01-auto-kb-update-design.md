# Auto KB Update Design

**Date:** 2026-04-01

**Scope:** Modify three existing hooks (`task-completed`, `stop`, `session-start`) in `plugins/superpowers-memory/hooks/` so that the project knowledge base is automatically updated during and after plan execution, without requiring the user to manually remember to call `superpowers-memory:update`.

---

## Problem

The current plugin has two defects:

1. **Weak language:** All three hooks use suggestive language ("Consider running", "remind the user") that agents routinely skip under time pressure.
2. **Broken detection in stop hook:** The stop hook checks `git diff --name-only HEAD -- docs/superpowers/plans/` which only catches *unstaged* plan file changes. Any work that has already been committed (the common case) is invisible to it.

Result: the KB is silently stale after every development session.

---

## Solution

Three-layer automatic triggering with mandatory language:

1. **TaskCompleted** — primary trigger: after each plan task completes, if KB is stale, mandate `:update` before proceeding to the next task.
2. **Stop** — session-end safety net: if KB is still stale when the session ends, mandate `:update` before closing.
3. **SessionStart** — cross-session safety net: if KB is stale at the start of a new session, mandate `:update` before any other work.

---

## Shared Detection Mechanism

All three hooks use the same staleness check:

```bash
kb_last_commit=$(git log -1 --format="%H" -- docs/project-knowledge/ 2>/dev/null || echo "")
current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
kb_is_stale=$([ -n "$kb_last_commit" ] && [ "$kb_last_commit" != "$current_commit" ] && echo "yes" || echo "no")
```

**Logic:**
- `kb_last_commit` = the SHA of the last commit that touched any file under `docs/project-knowledge/`
- `current_commit` = current HEAD SHA
- If they differ → new commits exist that aren't reflected in KB → stale
- If `kb_last_commit` is empty → KB has never been committed → skip detection (don't trigger)
- If no git repo → skip detection

**Advantages over current date-based approach:**
- Exact: SHA comparison has no false negatives
- Works intra-day: multiple commits on the same date are correctly detected
- No frontmatter changes required: reads git history directly

---

## Hook 1: task-completed

**File:** `plugins/superpowers-memory/hooks/task-completed`

**Trigger:** Any task marked complete (fires during plan execution via `executing-plans` or `subagent-driven-development`)

### Current behavior
Always injects: checkbox update reminder.

### New behavior

```
if docs/project-knowledge/ exists AND kb_is_stale == "yes":
    inject MANDATORY:
      "Task completed. You MUST do both of the following before moving to the next task:
       1. Update the checkbox in the corresponding plan file: change `- [ ]` to `- [x]`
       2. Run superpowers-memory:update to incrementally update the project knowledge
          base for the content you just changed."

else:
    inject original checkbox reminder (unchanged)
```

**Key decisions:**
- Mandatory language ("MUST"), not suggestive ("consider")
- Sequential: checkbox first, then KB update
- Only fires when KB is actually stale — no noise on tasks that produce no commits

---

## Hook 2: stop

**File:** `plugins/superpowers-memory/hooks/stop`

**Trigger:** Session ends normally

### Current behavior (broken)
Checks `git diff --name-only HEAD -- docs/superpowers/plans/` for unstaged plan file changes. Misses all committed changes.

### New behavior

```
if not in git repo:
    output {}

if docs/project-knowledge/ exists AND kb_is_stale == "yes":
    inject MANDATORY:
      "This session has commits not yet reflected in the project knowledge base.
       You MUST run superpowers-memory:update before this session ends."

else:
    output {} (no injection)
```

**Key decisions:**
- Remove old `git diff --name-only HEAD -- docs/superpowers/plans/` detection entirely
- Replace with unified KB staleness check (consistent with other hooks)
- Language upgraded from "Consider running" to "MUST run"

---

## Hook 3: session-start

**File:** `plugins/superpowers-memory/hooks/session-start`

**Trigger:** Session startup, clear, compact

### Current behavior
Checks if `docs/project-knowledge/` exists → injects behavior guidelines or "run rebuild" prompt. No staleness check.

### New behavior

```
if docs/project-knowledge/ does NOT exist:
    inject original "run rebuild" prompt (unchanged)

else if kb_is_stale == "yes":
    inject MANDATORY gate:
      "The project knowledge base is behind the current codebase (there are commits
       not yet reflected in it). You MUST run superpowers-memory:update before
       starting any other work this session."
    (do NOT inject the 5 behavior guidelines — they reference stale knowledge)

else (KB exists and is fresh):
    inject original 5 behavior guidelines (unchanged)
```

**Key decisions:**
- Stale KB gets a hard gate: no behavior guidelines injected until KB is current
- This prevents agents from making decisions based on outdated architecture/feature knowledge
- Once update runs and KB is committed, next session start will inject the full guidelines normally

---

## Summary of Changes

| Hook | Change Type | What Changes |
|------|------------|--------------|
| `task-completed` | Logic + language | Add staleness check; upgrade to mandatory when stale |
| `stop` | Bug fix + logic + language | Remove broken plan-diff detection; add staleness check; mandatory language |
| `session-start` | Logic | Add staleness branch between "no KB" and "fresh KB" |

No other files change. Zero-modification principle preserved — superpowers core files untouched.

---

## Behavior Walkthrough

**During plan execution (TaskCompleted fires):**
1. Agent completes a task and commits changes
2. TaskCompleted hook fires
3. Hook detects `kb_last_commit != HEAD` → KB is stale
4. Agent sees mandatory instruction: update checkbox AND run `:update`
5. Agent runs `:update`, which commits to `docs/project-knowledge/`
6. Next TaskCompleted: `kb_last_commit == HEAD` → only checkbox reminder injected

**Session ends without completing update (Stop fires):**
1. Agent finishes session with uncommitted KB
2. Stop hook fires, detects staleness
3. Agent must run `:update` before session closes

**Next session starts with stale KB (SessionStart fires):**
1. New session starts, KB still behind HEAD
2. SessionStart detects staleness
3. Agent must run `:update` before any other work
4. After update + commit, KB is fresh → next session gets full guidelines
