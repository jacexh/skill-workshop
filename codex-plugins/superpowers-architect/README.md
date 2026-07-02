# superpowers-architect (Codex)

Explicit-only general architecture standards lookup for Codex.

This plugin no longer registers SessionStart or UserPromptSubmit hooks. Use it only when you explicitly want general standards guidance:

```text
$superpowers-architect:standards
```

DDD/backend architecture guardrails have moved to `superpowers-ddd-architect`.

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-architect
```

No hook feature flags are required for this plugin's explicit skill. Other plugins in this marketplace may still use hooks.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex after upgrade so plugin metadata refreshes.

### Legacy Fallback Hook Cleanup

Current installs do not add hooks for this plugin, and the current runtime is a no-op for old hook modes. If you previously used a setup-era fallback hook that points at an old cached `superpowers-architect` version in `~/.codex/hooks.json`, remove those stale `superpowers-architect` command entries manually or run the installed helper from the plugin directory:

```bash
node scripts/install-codex-hooks.js remove
```

Restart Codex after cleanup.

## Capabilities

- **`$superpowers-architect:standards` skill** — explicit standards workflow for general architecture-sensitive work.
- Pattern dirs: bundled defaults + Claude global defaults (`~/.claude/superpowers-architect/design-patterns/`) + global (`$SP_ARCHITECT_DIR` or `$SPA_GLOBAL`) + project-local (`design-patterns/` for compatibility, then `docs/design-patterns/`); higher-priority dirs override lower-priority dirs by filename.
- Bundled general patterns remain available for explicit use.

For DDD, Go backend layering, bounded contexts, ports, Domain Events, Integration Messages, taskqueue/runtime boundaries, and database-backed backend persistence, install and invoke `superpowers-ddd-architect`.

## Project-Specific Patterns

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
