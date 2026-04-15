# superpowers-architect

Automatically injects architectural design pattern standards as hard constraints into planning, execution, and code review workflows — so every plan and implementation stays consistent with team-defined standards.

## How It Works

When you invoke any of the following skills, the plugin scans your pattern files and injects a compact index as context. Claude then reads only the relevant patterns in full before proceeding.

**Triggered on:**
- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `superpowers:executing-plans`
- `superpowers:subagent-driven-development`
- `superpowers:requesting-code-review`
- `superpowers:receiving-code-review`

This is **progressive loading**: the hook only injects names + descriptions, not full content. Claude decides which patterns are relevant and loads them on demand via the `Read` tool.

## Setup

The plugin works out of the box — its bundled patterns load automatically when installed.

### (Optional) Add project-specific patterns

Place `.md` files in `docs/design-patterns/` at your project root. Files with the same name as a bundled pattern will override it for that project.

### (Optional) Set a global patterns directory

```bash
# ~/.zshrc or ~/.bashrc
export SPA_GLOBAL="$HOME/my-team-standards/design-patterns"
```

### (Optional) Disable bundled patterns

```bash
export SPA_DEFAULTS=false
```

When disabled, only `SPA_GLOBAL` and project-level patterns are loaded.

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
<project>/docs/design-patterns/    ← highest priority (project-specific)
$SPA_GLOBAL                        ← user global (skipped if not set)
<plugin>/design-patterns/           ← plugin defaults (disable with SPA_DEFAULTS=false)
```

Files with the same name in a higher layer override the lower layer.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPA_DEFAULTS` | *(enabled)* | Set to `false` to disable bundled patterns |
| `SPA_GLOBAL` | *(unset)* | Path to a global patterns directory |

## Bundled Patterns

See the `design-patterns/` directory:
- `database.md` — schema conventions, index strategy, migrations
- `rest-api.md` — URL naming, status codes, pagination, error format
- `ddd-core.md` — dependency direction, bounded contexts, and service layer boundaries
- `ddd-golang.md` — Go-specific implementation guidance for the DDD core standard
- `ddd-python.md` — Python-specific implementation guidance for the DDD core standard
- `frontend-patterns.md` — frontend development patterns for React, Next.js, and UI architecture
