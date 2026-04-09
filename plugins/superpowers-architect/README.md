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
- `ddd-core.md` — dependency direction, bounded contexts, and service layer boundaries
- `ddd-golang.md` — Go-specific implementation guidance for the DDD core standard
- `ddd-python.md` — Python-specific implementation guidance for the DDD core standard
- `frontend-patterns.md` — frontend development patterns for React, Next.js, and UI architecture
