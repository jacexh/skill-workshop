---
last_updated: 2026-07-05
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-02-superpowers-ddd-architect.md"
---

# ADR-026: Restore superpowers-architect v1.13.10 content

## Status

Accepted.

## Context

`superpowers-architect` had been changed into an explicit-only general standards plugin after DDD/backend guidance moved into a dedicated DDD plugin and then into standalone `ddd-expert`. That made the old architect plugin smaller, but it also removed the dynamic Superpowers workflow behavior and bundled pattern catalog that existed in v1.13.10.

The current direction keeps `ddd-expert` standalone so it can work in hookless and non-Superpowers skill systems, while restoring the older `superpowers-architect` experience for users who still rely on automatic design-pattern standards injection.

## Decision

Restore `plugins/superpowers-architect/` and `codex-plugins/superpowers-architect/` from tag `v1.13.10`.

This restores:

- Claude `PreToolUse` dynamic pattern injection;
- Codex SessionStart and UserPromptSubmit architect hooks;
- `$superpowers-architect:standards`;
- bundled `database.md`, `ddd-*.md`, REST, and frontend pattern files;
- the v1.13.10 hook runtime and fallback installer behavior.

Keep the current Codex README install command form (`codex plugin add <plugin>@<marketplace>`) because current release tests require the modern Codex CLI syntax.

Do not restore `superpowers-ddd-architect`. It remains deleted from both plugin trees and marketplaces. `ddd-expert` remains standalone, explicit, and hookless with phase skills and preflight implementation gates.

## Consequences

- `superpowers-architect` is no longer explicit-only; it is again a dynamic design-pattern standards plugin.
- Bundled DDD/database guidance exists in both restored `superpowers-architect/design-patterns/` and standalone `ddd-expert/references/`, so future edits must account for drift risk.
- `ddd-expert` remains the preferred phase-skill surface for hookless or non-Superpowers systems and for explicit DDD/backend design, implementation, and review.
- ADR-021 and ADR-023 remain valid history but their consequences for old-architect hook removal and DDD/database bundled-pattern removal are superseded.
- ADR-025 remains current for retiring `superpowers-ddd-architect`.

## Affected Files

- `plugins/superpowers-architect/`
- `codex-plugins/superpowers-architect/`
- `README.md`
- `scripts/release/test/test_codex_architect_runtime.sh`
- `scripts/release/test/test_codex_hook_setup.sh`
- `docs/superpowers/memory/`
