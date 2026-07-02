---
adr: 022
title: DDD architect uses phase-specific skills
date: 2026-07-02
status: Accepted
---

# ADR-022: DDD architect uses phase-specific skills

## Context

The initial `superpowers-ddd-architect` split exposed one `standards` skill. That name described a document category rather than an agent action, and it mixed three different moments: designing boundaries, placing code, and reviewing diffs. Agents need different emphasis at each moment, not one complete but unfocused standards workflow.

## Decision

Replace the DDD plugin's `standards` skill with three action-oriented skills:

- `design` — DDD/backend boundary design before implementation.
- `implement` — code placement and dependency-boundary guardrails during implementation/refactor.
- `review` — evidence-based boundary audit for plans, code, or diffs.

All three skills share plugin-root `references/` and read `ddd-risk-router.md` first. Hooks map upstream workflow phases to the matching mode: planning skills to design guidance, execution skills to implementation guardrails, and code-review skills to boundary review. Hook injection uses phase-specific reference budgets instead of listing every DDD reference, and probe-derived conclusions require a short Repo calibration first.

## Consequences

- Skill invocation becomes simpler: `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, `$superpowers-ddd-architect:review`.
- Shared DDD references move out of `skills/standards/references/` to plugin-root `references/` so no single skill owns the reference set.
- The plugin avoids the old "load standards, then infer intent" shape; each entry point has its own output contract.
- Prompt-time guidance remains compact: design lists risk-router/modeling/core/database, while implement and review list risk-router/agent-contract/core/primary Go guide and rely on risk cards for deeper support files.
- The legacy general `superpowers-architect:standards` skill remains the explicit general standards lookup; ADR-023 removes its bundled DDD/database defaults.

## References

- `plugins/superpowers-ddd-architect/skills/design/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/review/SKILL.md`
- `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`
- `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js`
- `plugins/superpowers-ddd-architect/hooks/pre-tool-use`
