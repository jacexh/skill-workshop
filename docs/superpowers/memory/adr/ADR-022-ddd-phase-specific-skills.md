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

Replace the DDD plugin's `standards` skill with action-oriented phase skills:

- `domain-modeling` — evidence-first strategic modeling and event-storming interview before design.
- `design` — product-semantics-to-DDD/backend boundary design before implementation.
- `implement` — model-to-code placement and dependency-boundary guardrails during implementation/refactor.
- `review` — evidence-to-judgment boundary audit for plans, code, or diffs.

All phase skills share plugin-root `references/`. Hooks map upstream workflow phases to the matching DDD phase with compact route reminders only; they do not inject reference content, risk cards, or checklist payloads. The phase skills own their thinking frameworks and output contracts: `domain-modeling/SKILL.md` owns the one-question-at-a-time strategic interview and Domain Modeling Brief; `design/SKILL.md` owns accepted model intake, modeling gates, and Implementation handoff; `implement/SKILL.md` owns accepted-model-to-code placement, reference routing from touched evidence, rule status, and verification; `review/SKILL.md` owns expected-model reconstruction, Workflow-driven Smell List closure, Layer Baseline comparison, synthesis, findings, returns, evidence gaps, and no-finding notes. `ddd-core.md` owns compact cross-phase DDD defaults and evidence rules, while modeling, language, runtime, database, and agent-contract references load only when the phase skill or concrete evidence requires them.

## Consequences

- Skill invocation becomes simpler: `$ddd-expert:domain-modeling`, `$ddd-expert:design`, `$ddd-expert:implement`, `$ddd-expert:review`.
- Shared DDD references move out of `skills/standards/references/` to plugin-root `references/` so no single skill owns the reference set.
- The plugin avoids the old "load standards, then infer intent" shape; each entry point has its own output contract.
- `implement` must trace accepted model decisions to code files, mapping boundaries, and tests before editing; `review` must reconstruct expected model and observed code shape before closing smell verdicts.
- Prompt-time guidance remains compact: route to the active phase skill only; modeling/core/agent-contract/language/runtime/taskqueue/event/database references load only when a phase skill, task scope, touched evidence, or Architecture Gate requires them.
- Phase skills must keep small tasks narrow through concise output sections; full templates are reserved for boundary/model/mechanism changes or broad reviews.
- Review findings use severity calibration to distinguish Blocker, Major, Minor, non-smell positive notes, and Evidence gap.
- The legacy general `superpowers-architect:standards` skill remains the explicit general standards lookup; ADR-023 removes its bundled DDD/database defaults.

## References

- `plugins/ddd-expert/skills/domain-modeling/SKILL.md`
- `plugins/ddd-expert/skills/design/SKILL.md`
- `plugins/ddd-expert/skills/implement/SKILL.md`
- `plugins/ddd-expert/skills/review/SKILL.md`
- `plugins/ddd-expert/references/ddd-core.md`
- `plugins/ddd-expert/references/ddd-modeling-gates.md`
- `codex-plugins/ddd-expert/hooks/codex-runtime.js`
- `plugins/ddd-expert/hooks/pre-tool-use`
