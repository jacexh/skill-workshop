# MEMORY.md Knowledge Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `docs/project-knowledge/MEMORY.md` as a structured KB index — written by `rebuild`/`update`, injected by `session-start`, and explicitly required by `pre-tool-use` messages.

**Architecture:** Five targeted edits across skills and hooks. No new files created in the plugin (MEMORY.md is generated in the *user's* project at runtime). All changes are additive or substitutive — no structural rework.

**Tech Stack:** Bash (existing hook scripts), Markdown (SKILL.md files). Verification via `bash hook | python3 -m json.tool` and manual content checks.

**Spec:** `docs/superpowers/specs/2026-04-01-memory-index-design.md`

---

## File Map

| File | Action |
|------|--------|
| `plugins/superpowers-memory/skills/rebuild/SKILL.md` | Modify — add Step 3: generate MEMORY.md after 5 knowledge files |
| `plugins/superpowers-memory/skills/update/SKILL.md` | Modify — add final step: regenerate MEMORY.md; include in commit |
| `plugins/superpowers-memory/skills/load/SKILL.md` | Modify — two-phase process (index first, on-demand detail) |
| `plugins/superpowers-memory/hooks/session-start` | Modify — inject MEMORY.md content when it exists |
| `plugins/superpowers-memory/hooks/pre-tool-use` | Modify — fresh/stale messages for brainstorming + writing-plans point to MEMORY.md |
| `plugins/superpowers-memory/.claude-plugin/plugin.json` | Modify — bump version to 1.2.0 |
| `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/` | Sync — copy all changed files to installed location |

---

### Task 1: Update `rebuild` skill — generate MEMORY.md

**Files:**
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

- [ ] **Step 1: Overwrite rebuild/SKILL.md**

Write `plugins/superpowers-memory/skills/rebuild/SKILL.md`:

```markdown
---
name: rebuild
description: Use when initializing project knowledge for the first time or when knowledge has drifted too far from reality — full codebase scan and knowledge regeneration
---

# Rebuild Project Knowledge

Scan the entire codebase and generate a complete project knowledge base from scratch.

**Announce at start:** "I'm rebuilding the project knowledge base from the codebase."

## When to Use

- First time setting up the knowledge base for a project
- Knowledge base has drifted significantly from reality
- User explicitly requests a full rebuild

## Process

1. **Scan the codebase:**
   - Read project structure: `ls`, key directories, entry points
   - Read configuration files: `package.json`, `Cargo.toml`, `pyproject.toml`, `Makefile`, `docker-compose.yml`, etc.
   - Read existing documentation: `README.md`, `CLAUDE.md`, `docs/` directory
   - Read existing specs and plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
   - Check git log for recent development history: `git log --oneline -20`
   - Sample key source files to understand architecture patterns

2. **Generate knowledge files:**

   Create `docs/project-knowledge/` directory if it doesn't exist.

   For each of the 5 knowledge files, use the plugin template as the structural basis and fill in concrete content from the codebase analysis:

   - **architecture.md** — System overview, module structure (from directory layout and imports), data flow (from entry points and key modules)
   - **tech-stack.md** — Languages and frameworks (from config files), key dependencies (from package manifests), build tools (from scripts/Makefile)
   - **features.md** — Implemented features (from specs, README, and code), in-progress features (from plans with unchecked items)
   - **conventions.md** — Coding standards (from linter configs, existing patterns), architecture rules (from CLAUDE.md or observed patterns), testing conventions (from test directory structure and existing tests)
   - **decisions.md** — Extract significant decisions from git history, specs, and code comments. Create ADR entries for non-obvious architectural choices.

3. **Set frontmatter:**
   For every generated file:
   - `last_updated`: today's date (YYYY-MM-DD)
   - `updated_by`: `superpowers-memory:rebuild`
   - `triggered_by_plan`: `null`

4. **Generate MEMORY.md index:**

   After writing the 5 knowledge files, generate `docs/project-knowledge/MEMORY.md`:

   - For each of the 5 files, extract 2-3 concrete key points from the content you just wrote (e.g., specific pattern names, version numbers, rule names — not generic descriptions)
   - Write the file in this exact format:

   ```markdown
   ---
   last_updated: YYYY-MM-DD
   updated_by: superpowers-memory:rebuild
   triggered_by_plan: null
   ---

   # Project Knowledge Index

   - [architecture.md](architecture.md) — System overview, module structure, data flow
     Key points: [2-3 specific facts from architecture.md]

   - [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
     Key points: [2-3 specific facts from tech-stack.md]

   - [features.md](features.md) — Implemented features, in-progress work
     Key points: [2-3 specific facts from features.md]

   - [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
     Key points: [2-3 specific facts from conventions.md]

   - [decisions.md](decisions.md) — ADR log, known issues
     Key points: [2-3 specific facts from decisions.md]
   ```

   **Size constraint:** Keep MEMORY.md under 30 lines total.

5. **Commit:**

```bash
git add docs/project-knowledge/
git commit -m "docs: rebuild project knowledge base from codebase"
```

6. **Report:**
   - Summarize what was generated
   - Note any areas where information was sparse or uncertain
   - Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Quality Guidelines

- Be factual: only include what you can verify from the codebase. Do not speculate.
- Be concise: each file should be scannable in under 2 minutes
- Be structured: follow the template format strictly so incremental updates work cleanly
- Link to sources: reference file paths, spec files, and plan files where relevant
```

- [ ] **Step 2: Verify Step 4 (MEMORY.md generation) is present**

Run:
```bash
grep -c "MEMORY.md" plugins/superpowers-memory/skills/rebuild/SKILL.md
```
Expected: at least `3`

- [ ] **Step 3: Verify step numbering goes to 6**

Run:
```bash
grep "^[0-9]\." plugins/superpowers-memory/skills/rebuild/SKILL.md
```
Expected: lines `1.` through `6.`

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/skills/rebuild/SKILL.md
git commit -m "feat: rebuild skill — add MEMORY.md index generation step"
```

---

### Task 2: Update `update` skill — regenerate MEMORY.md

**Files:**
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`

- [ ] **Step 1: Overwrite update/SKILL.md**

Write `plugins/superpowers-memory/skills/update/SKILL.md`:

```markdown
---
name: update
description: Use after completing a development branch or when prompted by Stop hook — incrementally updates project knowledge base from recent changes
---

# Update Project Knowledge

Incrementally update the project knowledge base based on changes from the current iteration.

**Announce at start:** "I'm updating the project knowledge base."

## Prerequisites

- `docs/project-knowledge/` must exist. If not, tell the user to run `superpowers-memory:rebuild` first.

## Process

1. **Gather context:**
   - Read all 5 current knowledge files from `docs/project-knowledge/`
   - Identify the most recent plan file: check `docs/superpowers/plans/` for recently modified plans, or ask the user which plan triggered this update
   - Read the triggering plan file and its associated spec (from `docs/superpowers/specs/`)
   - Run `git diff main...HEAD --stat` (or appropriate base branch) to see what files changed

2. **Analyze what changed:**
   - New features implemented? → update `features.md`
   - Architecture changed (new modules, changed data flow)? → update `architecture.md`
   - New dependencies added? → update `tech-stack.md`
   - New conventions established? → update `conventions.md`
   - Significant design decisions made? → add ADR to `decisions.md`

3. **Apply updates:**
   - Only modify files that need changes — do not rewrite unchanged files
   - Preserve existing content; append or modify specific sections
   - Update frontmatter in every modified file:
     - `last_updated`: today's date (YYYY-MM-DD)
     - `updated_by`: `superpowers-memory:update`
     - `triggered_by_plan`: the plan filename that triggered this update (e.g., `2026-03-31-superpowers-memory.md`)

4. **Regenerate MEMORY.md index:**

   Always regenerate `docs/project-knowledge/MEMORY.md` in full (full overwrite — any file's key points may have changed):

   - Re-read all 5 knowledge files (including any you just updated)
   - Extract 2-3 concrete key points per file
   - Write `docs/project-knowledge/MEMORY.md` using this exact format:

   ```markdown
   ---
   last_updated: YYYY-MM-DD
   updated_by: superpowers-memory:update
   triggered_by_plan: <plan-filename>
   ---

   # Project Knowledge Index

   - [architecture.md](architecture.md) — System overview, module structure, data flow
     Key points: [2-3 specific facts from architecture.md]

   - [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
     Key points: [2-3 specific facts from tech-stack.md]

   - [features.md](features.md) — Implemented features, in-progress work
     Key points: [2-3 specific facts from features.md]

   - [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
     Key points: [2-3 specific facts from conventions.md]

   - [decisions.md](decisions.md) — ADR log, known issues
     Key points: [2-3 specific facts from decisions.md]
   ```

   **Size constraint:** Keep MEMORY.md under 30 lines total.

5. **Report changes:**
   - List which knowledge files were updated and what changed
   - Confirm MEMORY.md was regenerated
   - If no knowledge file updates were needed, still regenerate MEMORY.md

## Templates

Knowledge files follow the structure defined in the plugin templates. If you need to add a new section that doesn't exist in the current file, refer to the template for the expected format:

- `architecture.md` → System Overview, Module Structure, Data Flow, Key Design Decisions
- `tech-stack.md` → Languages & Frameworks, Key Dependencies, Build & Dev Tools, Infrastructure
- `features.md` → Implemented (with spec/plan links), In Progress
- `conventions.md` → Coding Standards, Architecture Rules, Testing Conventions, Git & Workflow
- `decisions.md` → ADR format (Context, Decision, Alternatives, Reason)

## Commit

After updating, commit the changes:

```bash
git add docs/project-knowledge/
git commit -m "docs: update project knowledge base from [plan-name]"
```
```

- [ ] **Step 2: Verify Step 4 (MEMORY.md regeneration) is present**

Run:
```bash
grep -c "MEMORY.md" plugins/superpowers-memory/skills/update/SKILL.md
```
Expected: at least `3`

- [ ] **Step 3: Verify "full overwrite" instruction is present**

Run:
```bash
grep "full overwrite" plugins/superpowers-memory/skills/update/SKILL.md
```
Expected: one matching line

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/skills/update/SKILL.md
git commit -m "feat: update skill — add MEMORY.md index regeneration step"
```

---

### Task 3: Update `load` skill — two-phase loading

**Files:**
- Modify: `plugins/superpowers-memory/skills/load/SKILL.md`

- [ ] **Step 1: Overwrite load/SKILL.md**

Write `plugins/superpowers-memory/skills/load/SKILL.md`:

```markdown
---
name: load
description: Use when starting brainstorming or needing to understand current project state — reads project knowledge base and presents structured context
---

# Load Project Knowledge

Read the project knowledge base from `docs/project-knowledge/` and present a structured summary so you can quickly understand the current project state.

**Announce at start:** "I'm loading the project knowledge base."

## Process

1. Check if `docs/project-knowledge/` exists
   - If not: tell the user "Project knowledge base not initialized. Please run superpowers-memory:rebuild to generate from codebase first." and stop

2. **Phase 1 — Index:**
   - Check if `docs/project-knowledge/MEMORY.md` exists
   - If yes: read it and present the index as the initial overview (see Output Format below)
   - If no (legacy project without MEMORY.md): skip to Phase 2 and read all 5 files directly

3. **Phase 2 — On-demand detail:**
   - After presenting the index (or after reading all 5 files in legacy mode), check `last_updated` in each file's frontmatter. If any file is older than 30 days, warn: "⚠ [filename] last updated on [date], consider running superpowers-memory:update to refresh."
   - State: "I can load any of these files in full if the current task requires it."
   - Load specific files based on task context (e.g., load `architecture.md` before brainstorming a structural change, load `decisions.md` before writing a new ADR)

### Output Format (MEMORY.md present)

```
## Project Knowledge Index

[MEMORY.md content displayed as-is]

---
Ready to load detail files on demand. Which areas are relevant to your current task?
```

### Output Format (legacy — no MEMORY.md)

```
## Project Knowledge Overview

### Architecture
[Key points from architecture.md: system overview, module structure]

### Tech Stack
[Key points from tech-stack.md: primary languages, frameworks, key dependencies]

### Implemented Features
[Summary from features.md: feature count, recent features, in-progress items]

### Design Constraints & Conventions
[Key rules from conventions.md: must-follow constraints, testing strategy]

### Key Decisions
[Recent decisions from decisions.md: latest 3-5 ADRs with status]
```

## After Loading

After presenting the summary, proceed with the task at hand (typically brainstorming). The loaded knowledge should inform your design decisions — reference specific constraints, existing patterns, and architectural choices from the knowledge base.
```

- [ ] **Step 2: Verify two-phase structure is present**

Run:
```bash
grep -n "Phase 1\|Phase 2\|MEMORY.md" plugins/superpowers-memory/skills/load/SKILL.md
```
Expected: lines mentioning Phase 1, Phase 2, and MEMORY.md

- [ ] **Step 3: Verify legacy fallback is present**

Run:
```bash
grep "legacy" plugins/superpowers-memory/skills/load/SKILL.md
```
Expected: at least one matching line

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/skills/load/SKILL.md
git commit -m "feat: load skill — two-phase loading (index first, on-demand detail)"
```

---

### Task 4: Update `session-start` hook — inject MEMORY.md

**Files:**
- Modify: `plugins/superpowers-memory/hooks/session-start`

- [ ] **Step 1: Overwrite session-start**

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
MEMORY_INDEX="$KNOWLEDGE_DIR/MEMORY.md"

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
elif [ -f "$MEMORY_INDEX" ]; then
    memory_content=$(cat "$MEMORY_INDEX")
    context="Project knowledge index loaded from docs/project-knowledge/MEMORY.md:\n\n${memory_content}"
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

- [ ] **Step 2: Make executable**

```bash
chmod +x plugins/superpowers-memory/hooks/session-start
```

- [ ] **Step 3: Verify valid JSON output — no MEMORY.md case (outputs `{}`)**

Run from a directory without `docs/project-knowledge/MEMORY.md` (use `/tmp`):
```bash
(cd /tmp && bash /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/session-start) | python3 -m json.tool
```
Expected: `{}`

- [ ] **Step 4: Verify valid JSON output — MEMORY.md present case**

Run from repo root (where `docs/project-knowledge/` exists but has no MEMORY.md yet — will output `{}`):
```bash
bash plugins/superpowers-memory/hooks/session-start | python3 -m json.tool
```
Expected: `{}` (MEMORY.md doesn't exist yet — falls through to silent branch)

- [ ] **Step 5: Verify MEMORY_INDEX variable and elif branch are present**

Run:
```bash
grep -n "MEMORY_INDEX\|elif" plugins/superpowers-memory/hooks/session-start
```
Expected: lines defining `MEMORY_INDEX` and the `elif [ -f "$MEMORY_INDEX" ]` branch

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-memory/hooks/session-start
git commit -m "feat: session-start — inject MEMORY.md index when present"
```

---

### Task 5: Update `pre-tool-use` hook — point to MEMORY.md

**Files:**
- Modify: `plugins/superpowers-memory/hooks/pre-tool-use`

Only the `fresh` and `stale` context strings for `superpowers:brainstorming` and `superpowers:writing-plans` change. Everything else stays identical.

- [ ] **Step 1: Overwrite pre-tool-use**

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
        if [ -z "$kb_last_commit" ]; then
            kb_state="not_initialized"
        elif [ "$kb_last_commit" != "$current_commit" ]; then
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
                context="WARNING: The project knowledge base is behind the current codebase. Consider running superpowers-memory:update first. If this brainstorming session itself introduces breaking architectural changes, the KB will need rebuilding afterward.\n\nBefore brainstorming, you MUST read docs/project-knowledge/MEMORY.md to get the project knowledge index, then load any relevant files listed there before proceeding."
                ;;
            fresh)
                context="Before brainstorming, you MUST read docs/project-knowledge/MEMORY.md to get the project knowledge index, then load any relevant files listed there before proceeding."
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
                context="WARNING: The project knowledge base may not reflect recent changes. The plan should be based on actual code state, not KB alone.\n\nBefore writing plans, you MUST read docs/project-knowledge/MEMORY.md to get the project knowledge index, then load any relevant files listed there before proceeding."
                ;;
            fresh)
                context="Before writing plans, you MUST read docs/project-knowledge/MEMORY.md to get the project knowledge index, then load any relevant files listed there before proceeding."
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

- [ ] **Step 2: Make executable**

```bash
chmod +x plugins/superpowers-memory/hooks/pre-tool-use
```

- [ ] **Step 3: Verify brainstorming fresh message points to MEMORY.md**

Run:
```bash
grep -A2 "fresh)" plugins/superpowers-memory/hooks/pre-tool-use | grep "MEMORY.md"
```
Expected: at least one line containing `MEMORY.md`

- [ ] **Step 4: Verify old "read docs/project-knowledge/" directory references are gone for brainstorming/writing-plans**

Run:
```bash
grep "read docs/project-knowledge/$" plugins/superpowers-memory/hooks/pre-tool-use
```
Expected: **no output** (the trailing slash with no filename should not appear)

- [ ] **Step 5: Test — brainstorming fresh produces MEMORY.md instruction**

Run (from repo root where KB is fresh):
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:brainstorming"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: valid JSON with `additionalContext` containing `MEMORY.md`

- [ ] **Step 6: Test — finishing-a-development-branch fresh is unchanged**

Run:
```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' \
  | bash plugins/superpowers-memory/hooks/pre-tool-use | python3 -m json.tool
```
Expected: valid JSON with `additionalContext` containing `superpowers-memory:update` (not MEMORY.md)

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-memory/hooks/pre-tool-use
git commit -m "feat: pre-tool-use — point brainstorming/writing-plans fresh+stale messages to MEMORY.md"
```

---

### Task 6: Sync to installed copy and bump version

**Files:**
- Modify: `plugins/superpowers-memory/.claude-plugin/plugin.json`
- Sync to: `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/`

- [ ] **Step 1: Copy changed files to installed location**

```bash
INSTALLED="/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory"

cp plugins/superpowers-memory/skills/rebuild/SKILL.md "$INSTALLED/skills/rebuild/SKILL.md"
cp plugins/superpowers-memory/skills/update/SKILL.md  "$INSTALLED/skills/update/SKILL.md"
cp plugins/superpowers-memory/skills/load/SKILL.md    "$INSTALLED/skills/load/SKILL.md"
cp plugins/superpowers-memory/hooks/session-start     "$INSTALLED/hooks/session-start"
cp plugins/superpowers-memory/hooks/pre-tool-use      "$INSTALLED/hooks/pre-tool-use"
```

- [ ] **Step 2: Verify installed copies match source**

Run:
```bash
INSTALLED="/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory"

diff plugins/superpowers-memory/skills/rebuild/SKILL.md "$INSTALLED/skills/rebuild/SKILL.md"
diff plugins/superpowers-memory/skills/update/SKILL.md  "$INSTALLED/skills/update/SKILL.md"
diff plugins/superpowers-memory/skills/load/SKILL.md    "$INSTALLED/skills/load/SKILL.md"
diff plugins/superpowers-memory/hooks/session-start     "$INSTALLED/hooks/session-start"
diff plugins/superpowers-memory/hooks/pre-tool-use      "$INSTALLED/hooks/pre-tool-use"
```
Expected: no output (files are identical)

- [ ] **Step 3: Bump version to 1.2.0 in source plugin.json**

Edit `plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 4: Bump version to 1.2.0 in installed plugin.json**

Edit `/home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json` — change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 5: Verify both plugin.json show 1.2.0**

Run:
```bash
grep '"version"' plugins/superpowers-memory/.claude-plugin/plugin.json
grep '"version"' /home/xuhao/.claude/plugins/marketplaces/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json
```
Expected: both lines show `"version": "1.2.0"`

- [ ] **Step 6: Commit version bump**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json
git commit -m "chore: bump superpowers-memory to v1.2.0"
```