# Fix PreToolUse Block Infinite Loop Design

**Date:** 2026-04-03

**Scope:** Fix the infinite loop in `plugins/superpowers-memory/hooks/pre-tool-use` where `stale` KB state blocks `brainstorming` and `writing-plans` with an unresolvable condition, and unify stale detection across all three hooks.

---

## Problem

Three interrelated defects in the superpowers-memory hook system:

### 1. Infinite loop on stale + brainstorming/writing-plans

Commit `5e7f4f9` added a blanket block at the bottom of `pre-tool-use`:

```bash
if [ "$kb_state" = "not_initialized" ] || [ "$kb_state" = "stale" ]; then
    printf '{"decision": "block", "reason": "%s"}\n'
```

This blocks ALL skill invocations when KB is stale, regardless of which skill. The block reason for `writing-plans` and `brainstorming` says "read MEMORY.md first", but reading a file does not change git state. The hook re-checks `kb_last_commit != HEAD` on retry → still stale → blocks again → infinite loop.

**Root cause:** A PreToolUse block's reason must describe an action that changes the condition the hook checks. "Read MEMORY.md" does not change any git commit SHA.

### 2. Redundant MEMORY.md injection

`session-start` (also modified in `5e7f4f9`) now injects the full MEMORY.md content + stale warning at session start. When `pre-tool-use` then tells the agent to "read MEMORY.md", the agent already has that content in context. The two hooks don't know about each other's injections.

### 3. Inconsistent stale detection

| Hook | Algorithm | Effect |
|---|---|---|
| `session-start` | `kb_last_commit != HEAD` | Any commit (even `chore: bump version`) = stale |
| `pre-tool-use` | `kb_last_commit != HEAD` | Same — too aggressive |
| `stop` | commits in `kb_last_commit..HEAD` matching `^(feat\|refactor):` | Only meaningful changes = stale |

The `stop` hook was optimized in commit `1957910` to only count `feat:` and `refactor:` commits. This improvement was never applied to the other two hooks.

---

## Solution

### Fix 1: Precise block conditions

Replace the blanket block with skill-aware decisions. The rule: **only block when the reason describes an action that resolves the checked condition.**

| KB state | brainstorming | writing-plans | finishing-a-development-branch |
|---|---|---|---|
| `not_initialized` | **block** — "run rebuild" (resolvable: rebuild commits KB, HEAD changes) | **block** — "run rebuild" (resolvable) | **block** — "run rebuild" (resolvable) |
| `stale` | **inject** — warning + "load detail files" (non-blocking) | **inject** — warning (non-blocking) | **block** — "run update" (resolvable: update commits KB, HEAD changes) |
| `fresh` | **inject** — "load detail files" | **inject** — "load detail files" | **inject** — "run update after finishing" |

Implementation: move the block/inject decision inside each skill's case branch instead of a blanket `if` at the bottom.

### Fix 2: Eliminate redundant MEMORY.md re-read

Since `session-start` already injects the MEMORY.md index into context, `pre-tool-use` should NOT tell the agent to "read MEMORY.md". Instead, for `brainstorming` and `writing-plans` in fresh/stale states, the message should say:

- "Load the detail files from docs/project-knowledge/ relevant to this task before proceeding."

This avoids redundant work and points the agent to the action that actually adds value (loading architecture.md, conventions.md, etc. — not the index it already has).

### Fix 3: Unified stale detection function

Extract the `stop` hook's smarter detection (`feat:/refactor:` commit filtering) into a shared pattern used by all three hooks:

```bash
# Determine KB state: not_initialized / stale / fresh
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

This means a `chore: bump version` commit no longer makes KB stale. Only `feat:` and `refactor:` commits — the ones that actually change architecture, features, or code structure — trigger staleness.

---

## Changed Files

| File | Change |
|------|--------|
| `plugins/superpowers-memory/hooks/pre-tool-use` | Rewrite block/inject logic per skill; update stale detection; update context messages |
| `plugins/superpowers-memory/hooks/session-start` | Update stale detection to feat/refactor filtering |
| `plugins/superpowers-memory/hooks/stop` | No change (already has correct detection) |

---

## Behavior Walkthrough

### Writing a plan (KB stale — previously infinite loop)

1. Session starts → `session-start` injects MEMORY.md index + "WARNING: KB behind codebase"
2. Agent calls `superpowers:writing-plans`
3. `pre-tool-use` fires → detects stale → returns `additionalContext`: "WARNING: KB may not reflect recent changes. Load relevant detail files from docs/project-knowledge/ before proceeding."
4. Skill proceeds (not blocked) → agent loads detail files → writes plan
5. **No loop.**

### Brainstorming (KB stale)

1. Session starts → MEMORY.md index + stale warning injected
2. Agent calls `superpowers:brainstorming`
3. `pre-tool-use` fires → stale → injects warning + "load detail files"
4. Skill proceeds → agent loads relevant files → brainstorms with full context

### Finishing a branch (KB stale)

1. Agent calls `superpowers:finishing-a-development-branch`
2. `pre-tool-use` fires → stale → **blocks**: "run superpowers-memory:update"
3. Agent runs update → update commits KB → HEAD changes → now fresh
4. Agent retries → `pre-tool-use` fires → fresh → injects context → proceeds

### Brainstorming after a chore commit (KB was fresh, only chore: commits since)

1. Session starts → stale detection uses feat/refactor filter → no feat/refactor commits → KB is **fresh**
2. Agent calls `superpowers:brainstorming` → `pre-tool-use` → fresh → injects "load detail files"
3. **Previously this would have been incorrectly flagged as stale.**
