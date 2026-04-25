---
adr: 11
title: Rich-context injection for finishing-a-development-branch staleness
status: Accepted
date: 2026-04-25
supersedes: null
superseded_by: null
---

# ADR-011: Rich-context injection for finishing-a-development-branch staleness

## Context

The `superpowers:finishing-a-development-branch` skill marks the end of a development branch — at that point the project KB should reflect the work done on the branch, otherwise downstream consumers (the next session, ultrareview, anyone reading `docs/project-knowledge/`) will see stale state.

Up through v1.9.0 the memory PreToolUse hook implemented two distinct behaviors when this skill was invoked:

- **Catastrophic case** — KB directory missing or `index.md` missing → `decision: "block"` with a reason pointing at `superpowers-memory:rebuild`.
- **Staleness case** — KB exists but `covers_branch` ≠ current branch, or stored SHA ≠ current HEAD → also `decision: "block"`.
- **Happy path** — KB covers HEAD → 1-line advisory string ("IMPORTANT: You MUST run superpowers-memory:update...").

Two problems with this design surfaced in practice:

1. **The happy-path advisory was ineffective.** Even when KB was technically up to date, the 1-line string was easy to glance over. When the user manually invoked finishing on a fresh branch where the auto-update hadn't run, no rich diff context was provided — just "please run update". The model frequently treated this as a soft suggestion and proceeded.
2. **The staleness hard-block contradicted the documented design philosophy.** The user's persistent feedback (`feedback_finishing_block_is_intentional.md`) explicitly states: "Hard block in finishing hook is for catastrophic only (KB/index missing); semantic freshness goes through architect-style rich injection." The staleness branch in the code was a deviation from this principle.

Hooks in Claude Code cannot directly invoke skills — only the model can. So "auto-trigger `superpowers-memory:update` before finishing" is fundamentally a question of how forcefully the hook can nudge the model.

## Decision

When `superpowers:finishing-a-development-branch` is invoked, the hook now uses a 4-way classifier:

| Condition | Hook output |
|--|--|
| KB missing (no `docs/project-knowledge/index.md`) | `decision: "block"` (catastrophic — unchanged) |
| On base branch / detached HEAD | `{}` (no-op — finishing-a-development-branch does not apply, and no KB-coverage check is possible) |
| Feature branch, KB does not cover HEAD | architect-style rich-context block from `buildFinishingRichContext()` |
| Feature branch, KB covers HEAD | soft 1-line reminder ("Knowledge base already covers this branch...") |

The rich-context block contains:

- A header (`====== Memory: Finishing-Branch Update Required ======`).
- Imperative MUST language: "You MUST invoke `superpowers-memory:update` as your VERY NEXT tool call."
- Concrete context: current branch + SHA, what `covers_branch` says, why the classifier triggered (5 distinct `reasonDetail` strings).
- Up to 20 commits and up to 30 changed file paths since `covers_branch@SHA`, computed via `git log` and `git diff --name-only`.
- A numbered workflow ("1. Invoke update; 2. Wait for lock release; 3. Re-invoke finishing").
- An escape hatch ("If you have inspected the diff and are confident none of it changes architecture/conventions/features/dependencies/decisions/glossary, state that explicitly and proceed").

The pattern mirrors how `superpowers-architect` injects design-pattern standards: substantive content placed directly in `additionalContext` rather than a one-line advisory pointing elsewhere.

## Alternatives Rejected

### A. Keep the staleness hard-block

Strengths: Reliable — the model literally cannot proceed with finishing until update runs. No reliance on prompt compliance.

Why rejected: Contradicts the documented preference (`feedback_finishing_block_is_intentional.md`). More importantly, the hard-block reason is reflected back to the model as an error condition, which it then tries to "resolve" — but the resolution path (run update) requires another tool call, and the model has historically gotten stuck in re-invoking the blocked tool with slightly different input rather than pivoting to update. Rich injection sidesteps that loop by making the next correct action explicitly the only described path forward, with full context to execute it.

### B. Modify the `superpowers:finishing-a-development-branch` skill itself

Strengths: Most reliable — make "step 0: invoke superpowers-memory:update" the first line of the skill body, no hook coordination needed.

Why rejected: That skill lives in the `superpowers` plugin (external), not in this workshop repo. The user's persistent preference (`feedback_edit_in_repo.md`) is to make changes in `plugins/` of this repo, not in `~/.claude/plugins/marketplaces/`. Forking the skill into the workshop just for this one-line change would create a maintenance fork — bad cost-benefit.

## Consequences

### Positive

- Aligns staleness handling with the documented design philosophy. Hard-block is now reserved purely for catastrophic (KB/index missing) cases.
- Provides actionable diff context the model can act on immediately, not a "go run X" pointer.
- The escape hatch makes pure-formatting / comment-only branches still finishable without forcing a no-op KB update.
- The `buildFinishingRichContext()` helper is reusable if other skills later need similar treatment.

### Negative

- A determined model can still ignore the injection (no hard enforcement). Mitigation: imperative MUST language + concrete diff scope + step-numbered workflow.
- The hook now runs `git log` and `git diff` on every invocation of finishing-a-development-branch on a feature branch. Cost is negligible for typical branches (≤30 file paths, ≤20 commits) but could add latency on very large branches. Mitigation: `slice(0, 30)` cap on file output is enforced Node-side, not git-side.
- Behavioral break for any user who relied on the staleness hard-block as an error gate. Documented in commit `feat(superpowers-memory)!:` with `!` breaking-change marker. Plugin version bumped to 1.10.0.

### Neutral

- The KB-missing case is still a hard block. That deliberately stays — without `docs/project-knowledge/index.md` there is no SHA to compare and no rich context to inject; rebuild is genuinely the only path forward.
