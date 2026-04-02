# superpowers-architect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that injects a progressive-loading design patterns index into planning, execution, and code review skills as hard constraints.

**Architecture:** A single `pre-tool-use` hook intercepts five target skills, scans a two-layer patterns directory (global `$SP_ARCHITECT_DIR` + project `docs/design-patterns/`), merges them with project taking priority, builds a compact index (name + description + path), and injects it as `additionalContext`. Claude then uses the `Read` tool on demand to load only relevant pattern files — no full-content injection.

**Tech Stack:** bash (`set -euo pipefail`), python3 (stdlib only — `os`, `glob`, `sys`), Markdown + YAML frontmatter

---

### Task 1: Plugin manifest and hook registration

**Files:**
- Create: `plugins/superpowers-architect/.claude-plugin/plugin.json`
- Create: `plugins/superpowers-architect/hooks/hooks.json`
- Create: `plugins/superpowers-architect/hooks/run-hook.cmd`

- [ ] **Step 1: Create plugin.json**

```json
{
  "name": "superpowers-architect",
  "description": "Injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows",
  "version": "1.0.0",
  "author": {
    "name": "xuhao"
  },
  "license": "MIT",
  "keywords": [
    "superpowers",
    "architect",
    "design-patterns",
    "standards"
  ]
}
```

Save to `plugins/superpowers-architect/.claude-plugin/plugin.json`.

- [ ] **Step 2: Verify plugin.json is valid JSON**

```bash
python3 -m json.tool plugins/superpowers-architect/.claude-plugin/plugin.json
```

Expected: JSON printed cleanly with no errors.

- [ ] **Step 3: Create hooks.json**

```json
{
  "hooks": {
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

Save to `plugins/superpowers-architect/hooks/hooks.json`.

- [ ] **Step 4: Verify hooks.json is valid JSON**

```bash
python3 -m json.tool plugins/superpowers-architect/hooks/hooks.json
```

Expected: JSON printed cleanly with no errors.

- [ ] **Step 5: Create run-hook.cmd (cross-platform dispatcher)**

Copy the exact content from `plugins/superpowers-memory/hooks/run-hook.cmd` — it is a generic dispatcher that routes to the named hook script by first argument. No modification needed.

```bash
cp plugins/superpowers-memory/hooks/run-hook.cmd plugins/superpowers-architect/hooks/run-hook.cmd
```

- [ ] **Step 6: Verify run-hook.cmd is executable**

```bash
ls -la plugins/superpowers-architect/hooks/run-hook.cmd
```

Expected: file exists. If not executable, run:
```bash
chmod +x plugins/superpowers-architect/hooks/run-hook.cmd
```

- [ ] **Step 7: Commit**

```bash
git add plugins/superpowers-architect/.claude-plugin/plugin.json \
        plugins/superpowers-architect/hooks/hooks.json \
        plugins/superpowers-architect/hooks/run-hook.cmd
git commit -m "feat(superpowers-architect): add plugin manifest and hook registration"
```

---

### Task 2: pre-tool-use hook

**Files:**
- Create: `plugins/superpowers-architect/hooks/pre-tool-use`

- [ ] **Step 1: Create pre-tool-use hook**

Save the following to `plugins/superpowers-architect/hooks/pre-tool-use`:

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

# Parse skill name from stdin JSON
input=$(cat)
skill_name=$(printf '%s' "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('skill', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

# Only handle trigger skills
case "$skill_name" in
    superpowers:writing-plans|\
    superpowers:executing-plans|\
    superpowers:subagent-driven-development|\
    superpowers:requesting-code-review|\
    superpowers:receiving-code-review)
        ;;
    *)
        printf '{}\n'
        exit 0
        ;;
esac

# Determine wording mode based on skill
case "$skill_name" in
    superpowers:requesting-code-review|superpowers:receiving-code-review)
        skill_type="review"
        ;;
    *)
        skill_type="plan"
        ;;
esac

# Build merged pattern index via python3:
# - Scans $SP_ARCHITECT_DIR (global) then docs/design-patterns/ (project)
# - Project files override global files with the same filename
# - Extracts name + description from frontmatter
# - Outputs formatted index string, or nothing if no patterns found
context=$(SKILL_TYPE="$skill_type" SP_ARCHITECT_DIR="${SP_ARCHITECT_DIR:-}" python3 -c "
import os, glob, sys

skill_type = os.environ.get('SKILL_TYPE', 'plan')
global_dir = os.environ.get('SP_ARCHITECT_DIR') or os.path.expanduser('~/.claude/superpowers-architect/design-patterns')
project_dir = 'docs/design-patterns'

files = {}

if os.path.isdir(global_dir):
    for f in sorted(glob.glob(os.path.join(global_dir, '*.md'))):
        files[os.path.basename(f)] = f

if os.path.isdir(project_dir):
    for f in sorted(glob.glob(os.path.join(project_dir, '*.md'))):
        files[os.path.basename(f)] = f

if not files:
    sys.exit(0)

entries = []
for fname, fpath in sorted(files.items()):
    try:
        content = open(fpath).read()
        name = fname
        description = ''
        if content.startswith('---'):
            end = content.find('---', 3)
            if end != -1:
                fm = content[3:end]
                for line in fm.splitlines():
                    if line.startswith('name:'):
                        name = line[5:].strip()
                    elif line.startswith('description:'):
                        description = line[12:].strip()
        entries.append('- [' + name + ']\n  ' + description + '\n  Path: ' + fpath)
    except Exception:
        pass

if not entries:
    sys.exit(0)

if skill_type == 'review':
    header = 'The following design patterns define the hard constraints for this codebase.\nRead any that are relevant and use them as the review criteria.'
else:
    header = 'The following design patterns define hard constraints for this codebase.\nRead any that are relevant to the current task and apply them strictly\nbefore writing the plan or generating code.'

print('====== Architect Standards ======')
print(header)
print()
print('\n\n'.join(entries))
print()
print('If none are relevant to the current task, skip.')
print('=' * 34)
" 2>/dev/null || true)

# Exit silently if no patterns found
if [ -z "$context" ]; then
    printf '{}\n'
    exit 0
fi

escaped_context=$(escape_for_json "$context")

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PreToolUse",\n    "additionalContext": "%s"\n  }\n}\n' "$escaped_context"
else
    printf '{\n  "additional_context": "%s"\n}\n' "$escaped_context"
fi

exit 0
```

- [ ] **Step 2: Make hook executable**

```bash
chmod +x plugins/superpowers-architect/hooks/pre-tool-use
```

- [ ] **Step 3: Verify executable bit**

```bash
ls -la plugins/superpowers-architect/hooks/pre-tool-use
```

Expected: `-rwxr-xr-x` (or similar with x bit set).

- [ ] **Step 4: Test — non-trigger skill returns `{}`**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:brainstorming"}}' \
  | bash plugins/superpowers-architect/hooks/pre-tool-use
```

Expected output:
```
{}
```

- [ ] **Step 5: Test — trigger skill with no patterns directories returns `{}`**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:writing-plans"}}' \
  | bash plugins/superpowers-architect/hooks/pre-tool-use
```

Expected output (when `~/.claude/superpowers-architect/design-patterns/` does not exist and `docs/design-patterns/` does not exist):
```
{}
```

- [ ] **Step 6: Test — trigger skill with patterns returns valid JSON**

Create a temporary pattern file and verify injection:

```bash
mkdir -p /tmp/test-patterns
cat > /tmp/test-patterns/api.md << 'EOF'
---
name: API Design Standards
description: RESTful naming and status code conventions
---
All endpoints must use kebab-case.
EOF

echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:writing-plans"}}' \
  | SP_ARCHITECT_DIR=/tmp/test-patterns bash plugins/superpowers-architect/hooks/pre-tool-use
```

Expected: JSON output containing `additionalContext` with `API Design Standards` in the text.

- [ ] **Step 7: Validate output JSON is well-formed**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:writing-plans"}}' \
  | SP_ARCHITECT_DIR=/tmp/test-patterns bash plugins/superpowers-architect/hooks/pre-tool-use \
  | python3 -m json.tool
```

Expected: JSON printed cleanly with no errors.

- [ ] **Step 8: Test — code review skill uses review wording**

```bash
echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:requesting-code-review"}}' \
  | SP_ARCHITECT_DIR=/tmp/test-patterns bash plugins/superpowers-architect/hooks/pre-tool-use
```

Expected: output contains `review criteria` (not `writing the plan`).

- [ ] **Step 9: Test — project-level overrides global**

```bash
mkdir -p /tmp/test-patterns
echo $'---\nname: Global DB\ndescription: global version\n---\nGlobal content.' > /tmp/test-patterns/database.md

mkdir -p docs/design-patterns
echo $'---\nname: Project DB\ndescription: project version\n---\nProject content.' > docs/design-patterns/database.md

echo '{"tool_name":"Skill","tool_input":{"skill":"superpowers:writing-plans"}}' \
  | SP_ARCHITECT_DIR=/tmp/test-patterns bash plugins/superpowers-architect/hooks/pre-tool-use

rm -rf docs/design-patterns
```

Expected: output contains `Project DB` and `project version`, NOT `Global DB`.

- [ ] **Step 10: Clean up temp files**

```bash
rm -rf /tmp/test-patterns
```

- [ ] **Step 11: Commit**

```bash
git add plugins/superpowers-architect/hooks/pre-tool-use
git commit -m "feat(superpowers-architect): implement pre-tool-use hook with progressive pattern loading"
```

---

### Task 3: Example pattern files

**Files:**
- Create: `plugins/superpowers-architect/design-patterns/database.md`
- Create: `plugins/superpowers-architect/design-patterns/rest-api.md`
- Create: `plugins/superpowers-architect/design-patterns/architecture.md`

These files are **examples only** — the hook does not load them. They serve as templates for users to copy to `~/.claude/superpowers-architect/design-patterns/`.

- [ ] **Step 1: Create database.md example**

```markdown
---
name: Database Design Standards
description: Table schema conventions, index strategy, and migration rules
---

## Schema Conventions

- All tables MUST have `created_at` and `updated_at` timestamp columns (non-nullable, default `now()`)
- Primary keys use UUID v4 (`gen_random_uuid()`)
- Foreign key columns are named `<table_singular>_id` (e.g., `user_id`)
- Boolean columns are prefixed with `is_` or `has_` (e.g., `is_active`)
- Deleted records use soft-delete via `deleted_at` timestamp (nullable); never hard-delete

## Index Strategy

- Index every foreign key column
- Add composite indexes for common query patterns (profile the query first)
- Unique constraints are implemented as unique indexes, not column constraints

## Migrations

- Migrations are forward-only; no down migrations
- Each migration file is named `YYYYMMDDHHMMSS_<description>.sql`
- Migrations must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`)
- Never alter column types in-place on large tables; use shadow-table migration pattern
```

Save to `plugins/superpowers-architect/design-patterns/database.md`.

- [ ] **Step 2: Create rest-api.md example**

```markdown
---
name: REST API Design Standards
description: RESTful naming, HTTP status codes, pagination, and error response conventions
---

## URL Naming

- Use kebab-case for URL paths: `/user-profiles`, not `/userProfiles` or `/user_profiles`
- Resources are plural nouns: `/users`, `/orders`, not `/user`, `/order`
- Nested resources for ownership: `/users/{id}/orders`
- Actions that don't map to CRUD use verb phrases under `/actions`: `/orders/{id}/actions/cancel`

## HTTP Status Codes

- `200 OK` — successful GET, PUT, PATCH
- `201 Created` — successful POST that creates a resource; include `Location` header
- `204 No Content` — successful DELETE
- `400 Bad Request` — malformed request or validation failure; include error details in body
- `401 Unauthorized` — missing or invalid authentication
- `403 Forbidden` — authenticated but not authorized
- `404 Not Found` — resource does not exist
- `409 Conflict` — state conflict (e.g., duplicate creation)
- `422 Unprocessable Entity` — semantically invalid request
- `500 Internal Server Error` — unexpected server failure; never leak stack traces

## Error Response Body

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "details": [{ "field": "email", "issue": "invalid format" }]
  }
}
```

## Pagination

- Use cursor-based pagination for large or frequently-updated collections
- Response includes `data` array and `pagination` object: `{ "cursor": "...", "has_more": true }`
- Page size default: 20, maximum: 100; controlled by `limit` query param
```

Save to `plugins/superpowers-architect/design-patterns/rest-api.md`.

- [ ] **Step 3: Create architecture.md example**

```markdown
---
name: Architecture Standards
description: Service boundaries, dependency direction, module structure, and layering rules
---

## Dependency Direction

- Dependencies flow inward: `handlers → services → domain → (no outward dependencies)`
- Domain layer has zero infrastructure dependencies (no database imports, no HTTP clients)
- Services orchestrate domain logic and coordinate infrastructure via interfaces
- Handlers (HTTP, CLI, workers) translate external I/O into service calls

## Module Structure

- One module per bounded context; bounded contexts do not import each other directly
- Cross-context communication goes through events or explicit API contracts
- Shared utilities live in `internal/shared/`; shared domain concepts do NOT (each context owns its model)

## Service Boundaries

- A service owns its data; no direct database access across service boundaries
- Services expose interfaces, not implementations; callers depend on the interface
- Constructor injection only — no service locator pattern, no global state

## File Size

- No file exceeds 300 lines; split by responsibility when approaching this limit
- Test files may be longer but must remain readable without scrolling for a single test case
```

Save to `plugins/superpowers-architect/design-patterns/architecture.md`.

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-architect/design-patterns/
git commit -m "feat(superpowers-architect): add example design pattern files"
```

---

### Task 4: README

**Files:**
- Create: `plugins/superpowers-architect/README.md`

- [ ] **Step 1: Create README.md**

```markdown
# superpowers-architect

Automatically injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows — so every plan and implementation stays consistent with team-defined standards.

## How It Works

When you invoke any of the following skills, the plugin scans your pattern files and injects a compact index as context. Claude then reads only the relevant patterns in full before proceeding.

**Triggered on:**
- `superpowers:writing-plans`
- `superpowers:executing-plans`
- `superpowers:subagent-driven-development`
- `superpowers:requesting-code-review`
- `superpowers:receiving-code-review`

This is **progressive loading**: the hook only injects names + descriptions, not full content. Claude decides which patterns are relevant and loads them on demand via the `Read` tool.

## Setup

### 1. Create your global patterns directory

```bash
mkdir -p ~/.claude/superpowers-architect/design-patterns
```

Copy or adapt the example patterns from `design-patterns/` in this repo.

### 2. (Optional) Customize the global directory path

```bash
# ~/.zshrc or ~/.bashrc
export SP_ARCHITECT_DIR="$HOME/my-team-standards/design-patterns"
```

### 3. (Optional) Add project-specific patterns

Place `.md` files in `docs/design-patterns/` at your project root. Files with the same name as a global pattern will override it for that project.

## Pattern File Format

```markdown
---
name: Your Standard Name
description: One-line description shown in the index
---

## Rules

Your design constraints here, written in plain language for Claude to read.
```

## Priority Order

```
<project>/docs/design-patterns/    ← highest priority
$SP_ARCHITECT_DIR                   ← user global (default: ~/.claude/superpowers-architect/design-patterns/)
design-patterns/                    ← examples only, NOT loaded by the hook
```

## Example Patterns

See the `design-patterns/` directory for ready-to-use examples:
- `database.md` — schema conventions, index strategy, migrations
- `rest-api.md` — URL naming, status codes, pagination, error format
- `architecture.md` — dependency direction, module structure, service boundaries
```

Save to `plugins/superpowers-architect/README.md`.

- [ ] **Step 2: Commit**

```bash
git add plugins/superpowers-architect/README.md
git commit -m "docs(superpowers-architect): add README with setup and usage instructions"
```

---

### Task 5: Register plugin in marketplace

**Files:**
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Add superpowers-architect entry to marketplace.json**

Open `.claude-plugin/marketplace.json`. The current content is:

```json
{
  "name": "skill-workshop",
  "owner": {
    "name": "xuhao"
  },
  "metadata": {
    "description": "A marketplace for Claude Code productivity and development plugins",
    "version": "1.2.3"
  },
  "plugins": [
    {
      "name": "superpowers-memory",
      "source": "./plugins/superpowers-memory",
      "description": "Project knowledge persistence and plan checkpoint tracking for superpowers workflows",
      "version": "1.2.3",
      "author": {
        "name": "xuhao"
      },
      "license": "MIT",
      "keywords": [
        "superpowers",
        "memory",
        "project-knowledge",
        "plan-tracking"
      ]
    }
  ]
}
```

Add the new plugin entry to the `plugins` array:

```json
{
  "name": "skill-workshop",
  "owner": {
    "name": "xuhao"
  },
  "metadata": {
    "description": "A marketplace for Claude Code productivity and development plugins",
    "version": "1.2.3"
  },
  "plugins": [
    {
      "name": "superpowers-memory",
      "source": "./plugins/superpowers-memory",
      "description": "Project knowledge persistence and plan checkpoint tracking for superpowers workflows",
      "version": "1.2.3",
      "author": {
        "name": "xuhao"
      },
      "license": "MIT",
      "keywords": [
        "superpowers",
        "memory",
        "project-knowledge",
        "plan-tracking"
      ]
    },
    {
      "name": "superpowers-architect",
      "source": "./plugins/superpowers-architect",
      "description": "Injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows",
      "version": "1.0.0",
      "author": {
        "name": "xuhao"
      },
      "license": "MIT",
      "keywords": [
        "superpowers",
        "architect",
        "design-patterns",
        "standards"
      ]
    }
  ]
}
```

- [ ] **Step 2: Validate marketplace.json**

```bash
python3 -m json.tool .claude-plugin/marketplace.json
```

Expected: JSON printed cleanly with no errors.

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(marketplace): register superpowers-architect plugin"
```
