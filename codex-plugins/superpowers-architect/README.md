# superpowers-architect (Codex)

Inject design pattern standards as constraints into planning, execution, and code review workflows.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-architect
```

In Codex:

```
$superpowers-architect:setup
```

Restart Codex.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex, re-run `$superpowers-architect:setup`. Restart.

Manual hook config is not recommended. `codex-hooks-snippet.json` contains a `${PLUGIN_ROOT}` placeholder that the setup installer resolves to the actual installed plugin path.

## Capabilities

- **SessionStart hook** — injects design pattern indexes (name + description + absolute path) plus a fused meta-rule covering both planning ("apply") and review ("verify") modes
- **UserPromptSubmit hook** — detects explicit upstream `superpowers` workflow skill mentions (`$superpowers:brainstorming`, `$superpowers:writing-plans`, `$superpowers:executing-plans`, `$superpowers:subagent-driven-development`, `$superpowers:requesting-code-review`, `$superpowers:receiving-code-review`) and injects the dynamic pattern index
- **`$superpowers-architect:standards` skill** — explicit standards workflow for designing, implementing, refactoring, or reviewing architecture-sensitive work
- Pattern dirs: bundled defaults + Claude global defaults (`~/.claude/superpowers-architect/design-patterns/`) + global (`$SP_ARCHITECT_DIR` or `$SPA_GLOBAL`) + project-local (`design-patterns/` for compatibility, then `docs/design-patterns/`); higher-priority dirs override lower-priority dirs by filename
- 8 bundled patterns: database, ddd-core, ddd-golang, ddd-modeling, ddd-python, ddd-typescript, frontend-patterns, rest-api. A Claude global directory may add more, such as browser-qa.

## Project-specific patterns

Place `.md` files in `docs/design-patterns/` at your project root. Files with the same name as a bundled or global pattern override it for that project.

Global pattern directories can be configured with either:

```bash
export SPA_GLOBAL="$HOME/my-team-standards/design-patterns"
```

or the earlier Codex-port name:

```bash
export SP_ARCHITECT_DIR="$HOME/my-team-standards/design-patterns"
```

To disable bundled defaults:

```bash
export SPA_DEFAULTS=false
```

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts trigger skills and injects different wording for plan vs review. Codex's PreToolUse matcher does not support skill names, so the Codex port uses three weaker signals instead: SessionStart standing context, UserPromptSubmit matching for explicit upstream `superpowers` skill mentions, and the explicit `$superpowers-architect:standards` skill.
