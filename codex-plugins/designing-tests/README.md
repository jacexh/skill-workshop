# designing-tests (Codex)

Risk-driven test design guidance.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install designing-tests
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

If hooks do not appear after restart on an older Codex build, run `$designing-tests:setup` as a compatibility fallback. The setup skill writes equivalent entries to `~/.codex/hooks.json`.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex. Re-run `$designing-tests:setup` only if you are using the fallback `~/.codex/hooks.json` installer path.

Manual hook config is not recommended. Native lifecycle config lives in `hooks/hooks.json`; the setup fallback resolves `${PLUGIN_ROOT}` to the actual installed plugin path.

## Capabilities

- **SessionStart hook** — injects execution-tier test design principles (intent-first, intent comments, boundary selection, quality labels, layer selection) plus 4 reference file indexes
- **`designing-tests` skill** — full guidance on demand via `$designing-tests:designing-tests`
- 4 references (read on demand): layer-selection, risk-catalog, test-case-patterns, test-quality-review

## Known Codex protocol gap (vs Claude Code)

Claude Code's PreToolUse:Skill hook intercepts the 4 trigger skills with three different tiers:
- **planning tier** for `writing-plans` (lightweight reminder)
- **execution tier** for `executing-plans` / `subagent-driven-development` (condensed principles)
- **full tier** for `test-driven-development` (entire SKILL.md + reference index)

Codex's PreToolUse matcher does not support skill names, so all three tiers collapse into the SessionStart primer (always-present execution tier + reference index). The full SKILL.md is not auto-injected — it loads on demand when the agent invokes `$designing-tests:designing-tests`.
