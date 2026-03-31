# Superpowers Memory Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to the superpowers workflow, with zero modification to superpowers itself.

**Architecture:** Independent plugin using SessionStart/TaskCompleted/Stop hooks to inject behavior guidelines into the agent context, plus three skills (load/update/rebuild) for managing a project knowledge base stored in `docs/project-knowledge/`. Hook scripts are bash with cross-platform wrapper, outputting JSON for context injection.

**Tech Stack:** Bash (hook scripts), Markdown (skills, templates), JSON (plugin config, hook output)

**Spec:** `docs/superpowers/specs/2026-03-31-superpowers-memory-design.md`

---

### Task 1: Plugin Metadata

**Files:**
- Create: `plugins/superpowers-memory/.claude-plugin/plugin.json`

- [x] **Step 1: Create plugin.json**

```bash
mkdir -p plugins/superpowers-memory/.claude-plugin
```

Write `plugins/superpowers-memory/.claude-plugin/plugin.json`:

```json
{
  "name": "superpowers-memory",
  "description": "Project knowledge persistence and plan checkpoint tracking for superpowers workflows",
  "version": "1.0.0",
  "author": {
    "name": "xuhao"
  },
  "license": "MIT",
  "keywords": ["superpowers", "memory", "project-knowledge", "plan-tracking"]
}
```

- [x] **Step 2: Verify plugin.json is valid JSON**

Run: `cat plugins/superpowers-memory/.claude-plugin/plugin.json | python3 -m json.tool`
Expected: Pretty-printed JSON output with no errors

- [x] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json
git commit -m "feat: add superpowers-memory plugin metadata"
```

---

### Task 2: Hook Infrastructure

**Files:**
- Create: `plugins/superpowers-memory/hooks/hooks.json`
- Create: `plugins/superpowers-memory/hooks/run-hook.cmd`

- [x] **Step 1: Create hooks.json**

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
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" task-completed",
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
    ]
  }
}
```

- [x] **Step 2: Verify hooks.json is valid JSON**

Run: `cat plugins/superpowers-memory/hooks/hooks.json | python3 -m json.tool`
Expected: Pretty-printed JSON with no errors

- [x] **Step 3: Create run-hook.cmd (cross-platform polyglot wrapper)**

Write `plugins/superpowers-memory/hooks/run-hook.cmd`:

```batch
: << 'CMDBLOCK'
@echo off
setlocal enabledelayedexpansion

set "HOOK_NAME=%~1"
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Try Git for Windows bash first
where bash >nul 2>nul
if %errorlevel% equ 0 (
    bash "%SCRIPT_DIR%/%HOOK_NAME%" %*
    exit /b %errorlevel%
)

REM Try common bash locations
for %%B in (
    "C:\Program Files\Git\bin\bash.exe"
    "C:\Program Files (x86)\Git\bin\bash.exe"
    "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
    "C:\msys64\usr\bin\bash.exe"
    "C:\cygwin64\bin\bash.exe"
) do (
    if exist %%B (
        %%B "%SCRIPT_DIR%/%HOOK_NAME%" %*
        exit /b %errorlevel%
    )
)

echo {"error": "bash not found. Install Git for Windows or WSL."} >&2
exit /b 1
CMDBLOCK

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="$1"
shift

exec "$SCRIPT_DIR/$HOOK_NAME" "$@"
```

- [x] **Step 4: Make run-hook.cmd executable**

Run: `chmod +x plugins/superpowers-memory/hooks/run-hook.cmd`

- [x] **Step 5: Verify run-hook.cmd structure**

Run: `head -3 plugins/superpowers-memory/hooks/run-hook.cmd`
Expected: First line is `: << 'CMDBLOCK'` (polyglot pattern)

- [x] **Step 6: Commit**

```bash
git add plugins/superpowers-memory/hooks/hooks.json plugins/superpowers-memory/hooks/run-hook.cmd
git commit -m "feat: add hook infrastructure (hooks.json + cross-platform wrapper)"
```

---

### Task 3: SessionStart Hook

**Files:**
- Create: `plugins/superpowers-memory/hooks/session-start`

The SessionStart hook detects whether `docs/project-knowledge/` exists in the current project directory and injects appropriate behavior guidelines into the agent context.

- [x] **Step 1: Create session-start hook script**

Write `plugins/superpowers-memory/hooks/session-start`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# JSON escape function: handle backslash, quote, newline, carriage return, tab
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

if [ -d "$KNOWLEDGE_DIR" ]; then
    # Knowledge base exists — inject full behavior guidelines
    context="Project knowledge base initialized. Please follow these behavior guidelines:\n\n"
    context+="1. The project knowledge base is located at docs/project-knowledge/, containing architecture, tech stack, feature list, conventions, and decision records.\n\n"
    context+="2. Before Brainstorming:\n"
    context+="   - Read the project knowledge base first to understand current project state\n"
    context+="   - Make design decisions based on existing architecture and constraints, not from scratch\n\n"
    context+="3. When executing Tasks in a Plan:\n"
    context+="   - After completing a Task, update the corresponding checkbox in the plan file from \`- [x]\` to \`- [x]\`\n"
    context+="   - This makes the plan a living document that supports interruption recovery\n\n"
    context+="4. When dispatching SubAgents:\n"
    context+="   - Include key information from the knowledge base (architecture, conventions, tech stack) in the Context section\n"
    context+="   - Inform the subagent of the knowledge base path for self-reference\n\n"
    context+="5. After completing a development branch (finishing-a-development-branch):\n"
    context+="   - Remind the user to run superpowers-memory:update to refresh the project knowledge base"
else
    # Knowledge base not initialized
    context="Project knowledge base not initialized. Run superpowers-memory:rebuild to generate the full knowledge base from the codebase."
fi

escaped_context=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

- [x] **Step 2: Make executable**

Run: `chmod +x plugins/superpowers-memory/hooks/session-start`

- [x] **Step 3: Verify — without knowledge base directory**

Run: `cd /tmp && bash $(pwd)/plugins/superpowers-memory/hooks/session-start | python3 -m json.tool`
Expected: JSON output containing "Project knowledge base not initialized" in the context field

- [x] **Step 4: Verify — with knowledge base directory**

Run: `mkdir -p /tmp/test-session-start/docs/project-knowledge && cd /tmp/test-session-start && bash $(pwd)/plugins/superpowers-memory/hooks/session-start | python3 -m json.tool && rm -rf /tmp/test-session-start`
Expected: JSON output containing "Project knowledge base initialized" and all 5 behavior guidelines

- [x] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/hooks/session-start
git commit -m "feat: add SessionStart hook — inject behavior guidelines based on knowledge base presence"
```

---

### Task 4: TaskCompleted Hook

**Files:**
- Create: `plugins/superpowers-memory/hooks/task-completed`

The TaskCompleted hook fires whenever any task is marked complete. It reminds the agent to update the corresponding plan file checkbox.

- [x] **Step 1: Create task-completed hook script**

Write `plugins/superpowers-memory/hooks/task-completed`:

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

context="Please update the checkbox in the corresponding plan file: change completed steps from \`- [x]\` to \`- [x]\`, making the plan a living document that supports interruption recovery."

escaped_context=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "TaskCompleted",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

- [x] **Step 2: Make executable**

Run: `chmod +x plugins/superpowers-memory/hooks/task-completed`

- [x] **Step 3: Verify output is valid JSON**

Run: `bash plugins/superpowers-memory/hooks/task-completed | python3 -m json.tool`
Expected: JSON with "Please update the checkbox in the corresponding plan file" in additionalContext

- [x] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/hooks/task-completed
git commit -m "feat: add TaskCompleted hook — remind agent to update plan checkboxes"
```

---

### Task 5: Stop Hook

**Files:**
- Create: `plugins/superpowers-memory/hooks/stop`

The Stop hook fires at session end. It checks `git diff --name-only` for changes in `docs/superpowers/plans/` and suggests running `superpowers-memory:update` if plan files were modified.

- [x] **Step 1: Create stop hook script**

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
    # Not a git repo — nothing to check
    printf '{}\n'
    exit 0
fi

# Check for plan file changes (staged + unstaged)
plan_changes=$(git diff --name-only HEAD -- docs/superpowers/plans/ 2>/dev/null || true)
plan_staged=$(git diff --name-only --cached -- docs/superpowers/plans/ 2>/dev/null || true)

if [ -n "$plan_changes" ] || [ -n "$plan_staged" ]; then
    context="This session modified plan files. Consider running superpowers-memory:update to incrementally update the project knowledge base."
    escaped_context=$(escape_for_json "$context")

    if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "Stop",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
    elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    else
        printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
    fi
else
    # No plan changes — output empty JSON (no injection)
    printf '{}\n'
fi

exit 0
```

- [x] **Step 2: Make executable**

Run: `chmod +x plugins/superpowers-memory/hooks/stop`

- [x] **Step 3: Verify — no plan changes**

Run: `bash plugins/superpowers-memory/hooks/stop`
Expected: `{}` (empty JSON, no plan file changes detected)

- [x] **Step 4: Verify — with plan changes**

To test with actual plan changes, create a temporary modification:

Run: `echo "test" >> docs/superpowers/plans/2026-03-31-superpowers-memory.md && bash plugins/superpowers-memory/hooks/stop | python3 -m json.tool && git checkout -- docs/superpowers/plans/2026-03-31-superpowers-memory.md`
Expected: JSON containing "Consider running superpowers-memory:update" before the checkout restores the file

- [x] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/hooks/stop
git commit -m "feat: add Stop hook — detect plan changes and suggest knowledge base update"
```

---

### Task 6: Knowledge Base Templates

**Files:**
- Create: `plugins/superpowers-memory/templates/architecture.md`
- Create: `plugins/superpowers-memory/templates/tech-stack.md`
- Create: `plugins/superpowers-memory/templates/features.md`
- Create: `plugins/superpowers-memory/templates/conventions.md`
- Create: `plugins/superpowers-memory/templates/decisions.md`

These templates are used by the `rebuild` and `update` skills as the structural basis for generating knowledge base files. The agent fills in concrete content based on codebase analysis.

- [x] **Step 1: Create architecture.md template**

Write `plugins/superpowers-memory/templates/architecture.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Architecture

## System Overview

<!-- One paragraph describing what this system does and its high-level architecture -->

## Module Structure

<!-- List each major module/package with:
  - Name
  - Responsibility (one sentence)
  - Key interfaces it exposes
  - What it depends on
-->

| Module | Responsibility | Key Interfaces | Dependencies |
|--------|---------------|----------------|--------------|
| | | | |

## Data Flow

<!-- Describe the primary data flows through the system. Use numbered steps:
  1. Input comes from...
  2. Processed by...
  3. Stored in...
  4. Output to...
-->

## Key Design Decisions

<!-- Brief notes on architectural choices that affect the whole system.
     Detailed rationale goes in decisions.md -->
```

- [x] **Step 2: Create tech-stack.md template**

Write `plugins/superpowers-memory/templates/tech-stack.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Version | Notes |
|-----------|------|---------|-------|
| | | | |

## Key Dependencies

| Package | Purpose | Why Chosen |
|---------|---------|------------|
| | | |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| | |

## Infrastructure

<!-- Hosting, CI/CD, databases, external services, etc. -->
```

- [x] **Step 3: Create features.md template**

Write `plugins/superpowers-memory/templates/features.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Features

## Implemented

<!-- List completed features with links to their spec/plan files -->

| Feature | Description | Spec | Plan |
|---------|------------|------|------|
| | | | |

## In Progress

<!-- List features currently being implemented -->

| Feature | Description | Plan | Status |
|---------|------------|------|--------|
| | | | |
```

- [x] **Step 4: Create conventions.md template**

Write `plugins/superpowers-memory/templates/conventions.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Conventions

## Coding Standards

<!-- Language-specific coding conventions, naming rules, formatting -->

## Architecture Rules

<!-- Hard constraints: what is NOT allowed, boundaries that must not be crossed -->

## Testing Conventions

<!-- Testing strategy: unit/integration/e2e split, naming, where tests live, coverage expectations -->

## Git & Workflow

<!-- Branch naming, commit message format, PR process -->
```

- [x] **Step 5: Create decisions.md template**

Write `plugins/superpowers-memory/templates/decisions.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Decisions

<!-- Architecture Decision Records (ADR) format.
     Add new decisions at the top. Do not remove old decisions — mark superseded ones. -->

## ADR-NNN: [Decision Title]

**Date:** YYYY-MM-DD

**Status:** Proposed | Accepted | Superseded by ADR-NNN

**Context:** <!-- What is the issue that we're seeing that is motivating this decision? -->

**Decision:** <!-- What is the change that we're proposing/doing? -->

**Alternatives Considered:**
<!-- What other options were evaluated? Why were they rejected? -->
- Alternative A: ...
- Alternative B: ...

**Reason:** <!-- Why was this decision made over the alternatives? -->
```

- [x] **Step 6: Verify all 5 templates exist**

Run: `ls -la plugins/superpowers-memory/templates/`
Expected: 5 files — architecture.md, tech-stack.md, features.md, conventions.md, decisions.md

- [x] **Step 7: Commit**

```bash
git add plugins/superpowers-memory/templates/
git commit -m "feat: add 5 knowledge base templates (architecture, tech-stack, features, conventions, decisions)"
```

---

### Task 7: Load Skill

**Files:**
- Create: `plugins/superpowers-memory/skills/load/SKILL.md`

This skill reads all project knowledge files and presents a structured summary to the agent, enabling rapid project context acquisition at the start of brainstorming.

- [x] **Step 1: Create load skill**

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
2. Read all 5 knowledge files:
   - `docs/project-knowledge/architecture.md`
   - `docs/project-knowledge/tech-stack.md`
   - `docs/project-knowledge/features.md`
   - `docs/project-knowledge/conventions.md`
   - `docs/project-knowledge/decisions.md`
3. Check `last_updated` in each file's frontmatter. If any file is older than 30 days, warn: "⚠ [filename] last updated on [date], consider running superpowers-memory:update to refresh."
4. Present a structured summary:

### Output Format

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

- [x] **Step 2: Verify SKILL.md frontmatter is valid**

Run: `head -4 plugins/superpowers-memory/skills/load/SKILL.md`
Expected:
```
---
name: load
description: Use when starting brainstorming or needing to understand current project state — reads project knowledge base and presents structured context
---
```

- [x] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/skills/load/SKILL.md
git commit -m "feat: add load skill — read and present project knowledge base"
```

---

### Task 8: Update Skill

**Files:**
- Create: `plugins/superpowers-memory/skills/update/SKILL.md`

This skill incrementally updates the project knowledge base based on changes made during the current development iteration.

- [x] **Step 1: Create update skill**

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

4. **Report changes:**
   - List which knowledge files were updated and what changed
   - If no updates were needed, say so

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

- [x] **Step 2: Verify SKILL.md frontmatter is valid**

Run: `head -4 plugins/superpowers-memory/skills/update/SKILL.md`
Expected:
```
---
name: update
description: Use after completing a development branch or when prompted by Stop hook — incrementally updates project knowledge base from recent changes
---
```

- [x] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/skills/update/SKILL.md
git commit -m "feat: add update skill — incremental project knowledge update"
```

---

### Task 9: Rebuild Skill

**Files:**
- Create: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

This skill performs a full scan of the codebase and generates the complete project knowledge base from scratch.

- [x] **Step 1: Create rebuild skill**

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

4. **Commit:**

```bash
git add docs/project-knowledge/
git commit -m "docs: rebuild project knowledge base from codebase"
```

5. **Report:**
   - Summarize what was generated
   - Note any areas where information was sparse or uncertain
   - Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Quality Guidelines

- Be factual: only include what you can verify from the codebase. Do not speculate.
- Be concise: each file should be scannable in under 2 minutes
- Be structured: follow the template format strictly so incremental updates work cleanly
- Link to sources: reference file paths, spec files, and plan files where relevant
```

- [x] **Step 2: Verify SKILL.md frontmatter is valid**

Run: `head -4 plugins/superpowers-memory/skills/rebuild/SKILL.md`
Expected:
```
---
name: rebuild
description: Use when initializing project knowledge for the first time or when knowledge has drifted too far from reality — full codebase scan and knowledge regeneration
---
```

- [x] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/skills/rebuild/SKILL.md
git commit -m "feat: add rebuild skill — full codebase scan and knowledge generation"
```

---

### Task 10: README

**Files:**
- Create: `plugins/superpowers-memory/README.md`

- [x] **Step 1: Create README.md**

Write `plugins/superpowers-memory/README.md`:

```markdown
# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch. Additionally, plan file checkboxes are never updated during execution, preventing session recovery.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains 5 knowledge files (`docs/project-knowledge/`) covering architecture, tech stack, features, conventions, and decisions. Updated incrementally after each iteration.

2. **Plan Live Documents** — Hooks remind the agent to update plan checkboxes (`- [x]` → `- [x]`) as tasks complete, enabling mid-session recovery.

3. **Zero Modification** — Does not modify superpowers. Influences agent behavior through hook context injection and independent skills.

## Installation

Install as a Claude Code plugin:

```bash
claude plugin add <path-or-url-to-superpowers-memory>
```

## Skills

| Skill | Purpose | When to Use |
|-------|---------|------------|
| `superpowers-memory:load` | Read and present project knowledge | Before brainstorming |
| `superpowers-memory:update` | Incremental knowledge update | After completing a development branch |
| `superpowers-memory:rebuild` | Full knowledge regeneration | First setup, or when knowledge has drifted |

## Hooks

| Hook | Event | Behavior |
|------|-------|----------|
| SessionStart | startup, clear, compact | Inject behavior guidelines (read knowledge, update checkboxes, pass context to subagents) |
| TaskCompleted | Any task marked done | Remind to update plan checkbox |
| Stop | Session end | If plan files changed, suggest `superpowers-memory:update` |

## Knowledge Base Structure

After running `superpowers-memory:rebuild`, your project will have:

```
docs/project-knowledge/
├── architecture.md   # System structure, modules, data flow
├── tech-stack.md     # Languages, frameworks, dependencies
├── features.md       # Implemented and in-progress features
├── conventions.md    # Coding standards, architecture rules
└── decisions.md      # Architecture Decision Records
```

## License

MIT
```

- [x] **Step 2: Commit**

```bash
git add plugins/superpowers-memory/README.md
git commit -m "docs: add README for superpowers-memory plugin"
```

---

### Task 11: End-to-End Verification

Verify the complete plugin structure matches the spec.

- [x] **Step 1: Verify directory structure**

Run: `find plugins/superpowers-memory -type f | sort`
Expected output:
```
plugins/superpowers-memory/.claude-plugin/plugin.json
plugins/superpowers-memory/README.md
plugins/superpowers-memory/hooks/hooks.json
plugins/superpowers-memory/hooks/run-hook.cmd
plugins/superpowers-memory/hooks/session-start
plugins/superpowers-memory/hooks/stop
plugins/superpowers-memory/hooks/task-completed
plugins/superpowers-memory/skills/load/SKILL.md
plugins/superpowers-memory/skills/rebuild/SKILL.md
plugins/superpowers-memory/skills/update/SKILL.md
plugins/superpowers-memory/templates/architecture.md
plugins/superpowers-memory/templates/conventions.md
plugins/superpowers-memory/templates/decisions.md
plugins/superpowers-memory/templates/features.md
plugins/superpowers-memory/templates/tech-stack.md
```

- [x] **Step 2: Verify all hook scripts are executable**

Run: `ls -la plugins/superpowers-memory/hooks/session-start plugins/superpowers-memory/hooks/task-completed plugins/superpowers-memory/hooks/stop plugins/superpowers-memory/hooks/run-hook.cmd`
Expected: All files show `-rwxr-xr-x` (executable permissions)

- [x] **Step 3: Verify all hooks produce valid JSON**

Run: `bash plugins/superpowers-memory/hooks/session-start | python3 -m json.tool && bash plugins/superpowers-memory/hooks/task-completed | python3 -m json.tool && bash plugins/superpowers-memory/hooks/stop | python3 -m json.tool`
Expected: Three valid JSON outputs, no errors

- [x] **Step 4: Verify skill frontmatter consistency**

Run: `for f in plugins/superpowers-memory/skills/*/SKILL.md; do echo "=== $f ==="; head -4 "$f"; echo; done`
Expected: Each file has `---` delimiters with `name` and `description` fields

- [x] **Step 5: Verify template frontmatter consistency**

Run: `for f in plugins/superpowers-memory/templates/*.md; do echo "=== $f ==="; head -5 "$f"; echo; done`
Expected: Each template has `last_updated: YYYY-MM-DD`, `updated_by: superpowers-memory:<skill-name>`, `triggered_by_plan: null`

- [x] **Step 6: Cross-check against spec**

Verify spec coverage by checking each spec section has a corresponding implementation:
- Plugin Structure ✓ (Task 1-10)
- Project Knowledge Files format ✓ (Task 6 templates)
- Hook 1: SessionStart ✓ (Task 3)
- Hook 2: TaskCompleted ✓ (Task 4)
- Hook 3: Stop ✓ (Task 5)
- hooks.json ✓ (Task 2)
- Skill: load ✓ (Task 7)
- Skill: update ✓ (Task 8)
- Skill: rebuild ✓ (Task 9)
- Zero-Modification Principle ✓ (no superpowers files touched)
