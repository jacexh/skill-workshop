# superpowers-architect

Explicit-only general architecture standards lookup for Claude Code.

This plugin no longer injects design-pattern context automatically into planning, execution, or code review workflows. Use it when you explicitly want to load general project/team standards.

DDD/backend architecture guardrails have moved to `superpowers-ddd-architect`.

## Usage

Invoke the skill explicitly:

```text
$superpowers-architect:standards
```

The skill discovers applicable general standards from the configured pattern locations and asks Claude to read the relevant files before planning, editing, or reviewing.

## What Belongs Here

- General architecture standards used on demand.
- REST/API conventions.
- Frontend architecture patterns.
- Project/global database standards when provided outside this bundled plugin.
- Project-specific generic standards under `docs/design-patterns/`.

Bundled DDD/backend and database references have moved out of this plugin. For DDD, Go/Python/TypeScript backend layering, bounded contexts, ports, Domain Events, Integration Messages, taskqueue/runtime boundaries, and database-backed backend persistence, use `superpowers-ddd-architect`.

## Setup

The explicit skill works out of the box with bundled standards.

### Optional Project-Specific Patterns

Place `.md` files in `docs/design-patterns/` at your project root. Files with the same name as a bundled pattern override it for that project.

### Optional Global Patterns

```bash
export SPA_GLOBAL="$HOME/my-team-standards/design-patterns"
```

### Optional Disable Bundled Patterns

```bash
export SPA_DEFAULTS=false
```

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

```text
<project>/docs/design-patterns/    # highest priority
$SPA_GLOBAL
<plugin>/design-patterns/          # bundled defaults
```

Files with the same name in a higher layer override lower layers.
