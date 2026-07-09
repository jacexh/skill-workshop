# CLAUDE.md

## Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Project conventions

### Dual-track plugin changes

When changing a plugin under `plugins/<name>/` or `codex-plugins/<name>/`, update the same-named counterpart track in the same change. The Claude track and Codex track must stay semantically aligned.

The exception is host-specific capability support. If a capability cannot be aligned because Claude Code and Codex CLI expose different mechanisms, such as incompatible hook protocols, keep the behavior aligned where possible and document why the implementation differs.

### Verification for plugin changes

For plugin behavior, hook, manifest, or release-script changes, run the relevant focused test plus `bash scripts/release/test/run-tests.sh` before reporting completion.

Documentation-only changes may use targeted checks, but the final summary must state why the full release test suite was not run.

### Root README sync

When changing plugin README files or user-visible install, capability, marketplace, hook, repository-structure, or release behavior, review the root `README.md` in the same change.

Update the root README when needed. If no root README update is needed, state that explicitly in the final summary.

### ADR threshold

Create an ADR for decisions that change long-lived repository shape or release/distribution contracts, such as adding or removing a plugin, changing marketplace schemas, changing release-versioning behavior, changing hook architecture, or deliberately breaking Claude/Codex track parity.

Do not create ADRs for routine fixes, wording changes, or straightforward test updates.

### Work entry rules

For small, well-scoped fixes, agents may work directly in the current branch after inspecting the relevant files.

For cross-plugin changes, release/distribution contract changes, hook architecture changes, or unclear requirements, create or update a GitHub issue/spec first and split multi-session work into tickets before implementation.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `jacexh/skill-workshop`; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage labels use the canonical default vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Domain docs use a single-context layout. See `docs/agents/domain.md`.
