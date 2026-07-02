---
adr: 021
title: Dedicated DDD architect plugin replaces automatic architect injection
date: 2026-07-02
status: Accepted
---

# ADR-021: Dedicated DDD architect plugin replaces automatic architect injection

## Context

`superpowers-architect` had become a broad dynamic standards loader for architecture, REST, database, frontend, browser QA, runtime, and DDD guidance. The DDD reference set was useful, but the plugin identity encouraged more catalog growth and made agents route through a generic pattern directory before acting like a DDD/backend architect.

The talgent review also showed a second risk: compact checks can accidentally look like repository-specific bash recipes. DDD guardrails need to teach portable boundary decisions first, with search probes treated as calibrated examples.

## Decision

Create a dedicated `superpowers-ddd-architect` plugin on both Claude and Codex tracks.

The DDD plugin:

- owns automatic DDD/backend workflow injection;
- reads `ddd-risk-router.md` first, then only deeper DDD/backend references required by triggered cards or task scope;
- stores references under plugin-root `references/`, not a root `design-patterns/` directory;
- includes `database.md` plus the Go DDD reference family needed for backend work;
- describes probe commands as repo-shape-dependent examples that must be calibrated before use;
- keeps SessionStart lightweight on Codex and injects the risk-router index only for explicit upstream `$superpowers:*` workflow-skill mentions.

`superpowers-architect` remains installed as explicit-only general architecture standards lookup. Its automatic hook configs are empty so DDD/backend work does not receive both old generic and new DDD guardrails.

## Alternatives Rejected

1. **Keep expanding `superpowers-architect`.** This preserves one plugin name, but keeps the generic dynamic-loader identity and would continue growing the hot path.
2. **Retitle `superpowers-architect` as a DDD architect.** This reduces one plugin, but strands REST/frontend/general standards and keeps the old `design-patterns/` directory model in the DDD path.
3. **Use fixed bash scans as the risk router.** This is easy to test against one Go repository, but does not generalize across bounded-context names, generated-code layouts, RPC frameworks, or runtime wiring styles.

## Consequences

- DDD/backend architecture guidance now has a clearer product identity and smaller automatic loading scope. ADR-022 further refines this into `design`, `implement`, and `review` skills.
- The old architect plugin loses automatic injection and should not be assumed active unless explicitly invoked.
- Claude and Codex tracks must keep `superpowers-ddd-architect` reference files semantically aligned.
- Tests must guard that the DDD plugin has no root `design-patterns/` directory and that natural-language DDD prompts do not trigger Codex prompt injection by themselves.
- Future DDD reference growth should first consider whether a risk-router card can route to an existing reference before adding more hot-path content.

## References

- `docs/superpowers/specs/2026-07-02-superpowers-ddd-architect-design.md`
- `docs/superpowers/plans/2026-07-02-superpowers-ddd-architect.md`
- `plugins/superpowers-ddd-architect/skills/design/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/review/SKILL.md`
- `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`
- `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js`
