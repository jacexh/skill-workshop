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

## Capabilities

- **SessionStart hook** — injects design pattern indexes (name + description + absolute path) plus a fused meta-rule covering both planning ("apply") and review ("verify") modes
- Two-layer pattern dirs: global (`$SP_ARCHITECT_DIR`) + project-local (`./design-patterns/`); project overrides global by filename
- 8+ bundled patterns: browser-qa, database, ddd-core, ddd-golang, ddd-modeling, ddd-python, ddd-typescript, frontend-patterns, rest-api

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts the 5 trigger skills (writing-plans / executing-plans / subagent-driven-development / requesting-code-review / receiving-code-review) and injects different wording for plan vs review. Codex's PreToolUse matcher does not support skill names, so all wording is fused into the SessionStart primer (always present, never per-skill targeted). The agent self-disambiguates based on its current task.
