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

- `design` — product-semantics-to-DDD/backend boundary design before implementation.
- `implement` — model-to-code placement and dependency-boundary guardrails during implementation/refactor.
- `review` — evidence-to-judgment boundary audit for plans, code, or diffs.

All three skills share plugin-root `references/`. Hooks map upstream workflow phases to the matching mode: planning skills to design guidance, execution skills to implementation guardrails, and code-review skills to boundary review. Hook injection uses phase-specific reference budgets instead of listing every DDD reference: the active phase skill plus `ddd-risk-router.md`. Prompt-time guidance is a compact route reminder only; the phase skills own the full thinking frameworks and minimum output contracts: `design/SKILL.md` owns Product semantics intake, Existing model inventory, Strategic/Tactical Model Gates, and Spec trace; `implement/SKILL.md` owns Design input check / Accepted model source / Placement Translation Gates / Model-to-code placement / Implementation trace; and `review/SKILL.md` owns Evidence Preconditions / Evidence map / Expected model vs observed code / Finding triage plus severity calibration. The Risk Router owns the routing matrix for required references, required evidence, and allowed exceptions. Probe-derived conclusions are handled by the phase skill or routed reference, not duplicated in hook text.

## Consequences

- Skill invocation becomes simpler: `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, `$superpowers-ddd-architect:review`.
- Shared DDD references move out of `skills/standards/references/` to plugin-root `references/` so no single skill owns the reference set.
- The plugin avoids the old "load standards, then infer intent" shape; each entry point has its own output contract.
- `implement` must trace accepted model decisions to code files, mapping boundaries, and tests before editing; `review` must reconstruct expected model and observed code before triaging findings.
- Prompt-time guidance remains compact: each phase lists only the active phase skill plus `ddd-risk-router.md`; modeling/core/agent-contract/language/runtime/taskqueue/event/database references load only when a phase skill, risk card, task scope, or Architecture Gate requires them.
- Phase skills must keep small tasks narrow through Minimum Output Contract sections; full templates are reserved for boundary/model/mechanism changes or broad reviews.
- Review findings use severity calibration to distinguish Blocker, Major, Minor, Harmless local style, and Evidence gap.
- The legacy general `superpowers-architect:standards` skill remains the explicit general standards lookup; ADR-023 removes its bundled DDD/database defaults.

## References

- `plugins/superpowers-ddd-architect/skills/design/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`
- `plugins/superpowers-ddd-architect/skills/review/SKILL.md`
- `plugins/superpowers-ddd-architect/references/ddd-risk-router.md`
- `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js`
- `plugins/superpowers-ddd-architect/hooks/pre-tool-use`
