# superpowers-architect (Codex)

Inject design pattern standards as constraints into planning, execution, and code review workflows.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add superpowers-architect@skill-workshop-codex
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

If hooks do not appear after restart, confirm both `hooks = true` and `plugin_hooks = true` are enabled, open `/hooks` to review and trust plugin hooks, and upgrade Codex. If old fallback hooks in `~/.codex/hooks.json` still point at deleted plugin cache paths, remove those stale entries manually or run the plugin's `scripts/install-codex-hooks.js remove` helper from the installed plugin directory.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex. Current Codex versions do not require any setup step after upgrade.

Manual hook config is not recommended. Native lifecycle config lives in `hooks/hooks.json`. If stale fallback entries point at an old deleted cache version and cause `SessionStart hook (failed)`, remove the stale fallback entries from `~/.codex/hooks.json` and restart Codex.

## Capabilities

- **SessionStart hook** — injects only a lightweight reminder that architecture standards are available on demand through `$superpowers-architect:standards` or explicit upstream `$superpowers:*` workflow skill mentions
- **UserPromptSubmit hook** — detects explicit upstream `superpowers` workflow skill mentions (`$superpowers:brainstorming`, `$superpowers:writing-plans`, `$superpowers:executing-plans`, `$superpowers:subagent-driven-development`, `$superpowers:requesting-code-review`, `$superpowers:receiving-code-review`) and injects the dynamic pattern index plus architecture gate guidance
- **`$superpowers-architect:standards` skill** — explicit standards workflow for designing, implementing, refactoring, or reviewing architecture-sensitive work
- Pattern dirs: bundled defaults + Claude global defaults (`~/.claude/superpowers-architect/design-patterns/`) + global (`$SP_ARCHITECT_DIR` or `$SPA_GLOBAL`) + project-local (`design-patterns/` for compatibility, then `docs/design-patterns/`); higher-priority dirs override lower-priority dirs by filename
- 12 bundled patterns: database, ddd-agent-contract, ddd-core, ddd-golang, ddd-golang-events-messages, ddd-golang-runtime, ddd-golang-taskqueue, ddd-modeling, ddd-python, ddd-typescript, frontend-patterns, rest-api. A Claude global directory may add more, such as browser-qa.

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

Claude Code's PreToolUse:Skill hook intercepts trigger skills and injects different wording for plan vs review. Codex does not expose native skill invocation as a hookable tool or event, so the Codex port uses weaker signals instead: a lightweight SessionStart reminder, UserPromptSubmit matching for explicit upstream `superpowers` skill mentions, and the explicit `$superpowers-architect:standards` skill. The Codex port intentionally does not register a Stop hook because Stop fires after each assistant turn and feels intrusive in normal conversation.
