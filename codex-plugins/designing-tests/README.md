# designing-tests (Codex)

Risk-driven test design guidance.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install designing-tests
```

In Codex:

```
$designing-tests:setup
```

Restart Codex.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

In Codex: `$designing-tests:setup`. Restart.

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
