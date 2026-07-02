# designing-tests (Codex)

Risk-driven test design guidance, including architecture-aware test design, integration-test quality standards, and hand-off gates for verification evidence, skipped tests, and residual risk.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add designing-tests@skill-workshop-codex
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

If hooks do not appear after restart, confirm both `hooks = true` and `plugin_hooks = true` are enabled, open `/hooks` to review and trust plugin hooks, and upgrade Codex. If old fallback hooks in `~/.codex/hooks.json` still point at deleted plugin cache paths, remove those stale entries manually or run the plugin's `scripts/install-codex-hooks.js remove` helper from the installed plugin directory.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex. Current Codex versions do not require any setup step after upgrade.

Manual hook config is not recommended. Native lifecycle config lives in `hooks/hooks.json`. If stale fallback entries point at an old deleted cache version and cause hook failures, remove the stale fallback entries from `~/.codex/hooks.json` and restart Codex.

## Capabilities

- **UserPromptSubmit hook** — injects a compact test-design primer when the user explicitly mentions relevant `$superpowers:*` workflow skills
- **`designing-tests` skill** — full guidance on demand via `$designing-tests:designing-tests`
- 7 references (read on demand): architecture-test-design, handoff-gate, integration-quality, layer-selection, risk-catalog, test-case-patterns, test-quality-review

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts trigger skills with three different tiers:
- **planning tier** for `writing-plans` (lightweight reminder)
- **execution tier** for `executing-plans` / `subagent-driven-development` (condensed principles)
- **full tier** for `test-driven-development` (entire SKILL.md + reference index)

Codex does not expose native skill invocation as a hookable tool event, so all three tiers collapse into one compact primer. The primer is injected only when the user explicitly mentions relevant `$superpowers:*` workflow skills through UserPromptSubmit. Agent-self-decided skill invocation is still not hookable; the full SKILL.md loads on demand when the agent invokes `$designing-tests:designing-tests`.
