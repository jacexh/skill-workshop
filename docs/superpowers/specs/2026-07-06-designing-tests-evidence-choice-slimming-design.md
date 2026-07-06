# designing-tests Evidence Choice Slimming - Design Spec

**Date:** 2026-07-06
**Status:** Ready for user review
**Triggering case study:** `/home/xuhao/talgent/`

---

## Context

The `designing-tests` plugin is strong at intent-first test design, real
boundary selection, integration quality, and hand-off evidence. A review across
the skill and references found that it can distinguish spec intent from
implementation branches, covers broad risk shapes, and encourages short
verification chains.

The practical issue is posture. In real projects such as `talgent`, agents can
over-apply the guidance to low-ROI surfaces: thin `main()` functions, deployment
helper scripts, static wiring, and simple config glue. Some tests in those areas
are valuable when they protect real deployment, security, contract, or historical
incident risks. But the plugin currently makes it too easy to translate
"deployment-like risk" into "write a test" before asking whether a lighter
verification artifact is better evidence.

The plugin should be slimmed while strengthening judgment. The target is not a
larger exclusion rulebook. The target is a smaller decision framework that treats
tests as one evidence type, not the default answer.

## Goals

1. Reframe the skill from "design tests" to "choose verification evidence".
2. Reduce prompt and reference bulk without weakening high-risk test guidance.
3. Make "do not add a test" a valid, explicit, high-quality outcome when no
   automatable regression risk justifies it.
4. Preserve strong behavior for business rules, contracts, security boundaries,
   async flows, data persistence, migrations, and historical incidents.
5. Keep hook usage restrained: hooks should provide short reminders at key
   workflow moments, not inject the full methodology.
6. Fix the Codex prompt-router gap for
   `$superpowers:finishing-a-development-branch`.

## Non-goals

- Do not add a file-type ban list such as "never test main.go" or "never test
  deployment scripts".
- Do not remove the ability to write tests for entrypoints, deployment config,
  or scripts when they protect real production risk.
- Do not convert the plugin into a security, performance, or load-testing
  playbook.
- Do not make hooks noisy or broad. No Codex `SessionStart` hook is added.
- Do not change unrelated plugins or `talgent` tests in this iteration.

## Design

### D1 - Replace the main workflow with Intent / Risk / Evidence

Rewrite the core `SKILL.md` around three gates:

1. **Intent Gate**
   - State the requirement source: PRD/spec, API contract, ADR, acceptance
     criteria, issue/bug report, sequence diagram, or architecture note.
   - If intent comes only from function names, file roles, or implementation
     shape, mark it as an assumption.
   - If intent is ambiguous and the risk is high, do not fabricate a test plan;
     ask for or state the missing requirement.

2. **Risk Gate**
   - State the observable regression in one sentence:
     `If <behavior breaks>, users/system observe <failure>.`
   - If no meaningful observable failure can be stated, do not add tests for
     that surface.
   - Identify whether the risk is business behavior, contract drift, security,
     data durability, async/retry/order, migration/config, UI behavior,
     operability, or historical incident prevention.

3. **Evidence Gate**
   - Choose the lowest-cost reliable evidence:
     `test`, `check`, `dry-run`, `smoke`, `manual`, or `residual risk`.
   - A test is selected only when it is the narrowest reliable way to catch the
     stated regression.
   - If selecting a test, state why lighter evidence such as build, lint,
     typecheck, static validation, shell syntax check, schema validation,
     dry-run, or smoke is insufficient.
   - If not selecting a test, record the chosen evidence and residual risk.

This keeps the intent-first strength while reducing the tendency to generate a
test list for every changed surface.

### D2 - Make "no new test" a first-class output

The skill should allow evidence records such as:

```text
Evidence Choice
- check: go test ./cmd/dispatcher -run TestFxGraph
- dry-run: kubectl apply --dry-run=server -f deploy/k3s/talgent.yaml
- not tested: thin main() glue has no independent observable behavior beyond
  compile and DI validation
- residual risk: live cluster admission policies are not covered locally
```

This is not a lower bar. It is a more precise bar: every verification claim must
map to a risk, and tests must justify their extra cost.

### D3 - Preserve high-risk upgrade conditions

Slimming must not make the plugin permissive around high-risk boundaries. The
core skill should keep a short "risk lens" that requires stronger evidence when
the change touches:

- security, auth, permission, tenancy, or secret handling
- data persistence, migration, uniqueness, transactions, or irreversible state
- external API, message, schema, generated client, route, or topic contracts
- async retry, deduplication, idempotency, ordering, timeout, or recovery
- environment/profile/config translation that can break deployment
- user-visible critical journeys or production incident regressions

For these risks, a lightweight command can still be valid, but the hand-off must
explain why it is sufficient. Otherwise choose a real test at the narrowest
boundary that fails like production.

### D4 - Weaken blanket test-count heuristics

The current "success path + meaningful failure path + edge path" heuristic is
useful after a test has been selected, but it reads like a default obligation for
any behavior change. Change it to:

- When tests are the selected evidence for a meaningful behavior risk, start
  with the smallest set that proves the regression cannot happen.
- Add success/failure/edge cases only when those cases protect distinct risks.
- Do not mirror unit, integration, and E2E coverage unless each layer protects a
  different failure mode.

This preserves quality while reducing ritual coverage.

### D5 - Soften mandatory intent comments

Replace "every test MUST have an intent comment" with:

- Every non-obvious test needs an intent note in the test name, comment, or
  enclosing context.
- Add an explicit comment when the protected regression is not obvious from the
  test name, when the test scans config/source text, or when the boundary is
  architecture or deployment evidence.

This keeps reviewability without forcing ceremony in self-explanatory suites.

### D6 - Consolidate references

Keep fewer, sharper reference files:

- `handoff-gate.md`: rewrite as an evidence hand-off gate covering tested,
  checked, not covered, skipped/unavailable, and residual risk.
- `integration-quality.md`: keep and slim; it remains the guide for deciding
  when a test is a real integration/contract/seam test.
- `architecture-test-design.md`: keep and slim; focus on architecture claims,
  goal/risk/evidence, state ownership, quality assumptions, and residual risk.

Merge or retire:

- `risk-catalog.md`: fold a short high-risk lens into `SKILL.md`.
- `test-case-patterns.md`: fold the small case-design heuristics into the core
  skill or integration reference.
- `layer-selection.md`: fold into Evidence Gate and integration-quality.
- `test-quality-review.md`: fold real/shallow/fake labels into hand-off and
  integration references.

This reduces navigation overhead and makes the main skill usable without
opening many side files.

### D7 - Keep hooks restrained

Hook behavior should follow these constraints:

- Hooks inject only a compact primer, not full methodology.
- Hooks should remind agents to choose evidence before tests.
- Hooks should not fire on unrelated natural-language prompts.
- Codex continues to avoid `SessionStart` for `designing-tests`.
- Full guidance remains available through the explicit skill.

Claude tiers:

- Planning: one compact reminder to include evidence choice and hand-off
  evidence steps when code changes.
- Execution: short Intent / Risk / Evidence primer.
- TDD: load the slimmed full skill, because the user or workflow explicitly
  entered test-writing mode.
- Hand-off: evidence hand-off gate, not a test-only gate.

Codex:

- Keep UserPromptSubmit only.
- Keep prompt matching explicit and narrow.
- Add `$superpowers:finishing-a-development-branch` to the supported workflow
  trigger list.
- The injected primer should be compact and evidence-oriented.

### D8 - Update output contracts

Replace the test-list-first output with an evidence-first output:

```text
Evidence Plan: <change or component>
Intent source: <spec/contract/ADR/bug report/assumption>

Risk map:
- <risk>: If <behavior breaks>, <observable failure>

Evidence choice:
- test/check/dry-run/smoke/manual/residual: <what proves or does not prove it>
  -> protects <risk>

Tests, if selected:
- <boundary>: <scenario> -> <expected outcome>

Not covered:
- <risk> -> <why not covered and residual impact>
```

The hand-off record should use:

```text
Verification evidence:
- tested: <test/command> protects <risk>
- checked: <command/static validation> protects <risk>
- not covered/skipped: <reason> leaves <risk>
- residual risk: <remaining gap>
```

## Expected Behavior Changes

Before:

- Agents often produce a test list after code changes.
- Deployment-like surfaces are more likely to receive tests.
- Hand-off focuses on test labels and skipped tests.

After:

- Agents first choose evidence.
- Thin entrypoints and simple glue usually get compile, DI validation, syntax
  checks, dry-runs, or smoke checks instead of new tests.
- High-risk entrypoints, config, and scripts still receive tests when tests are
  the best evidence.
- Hand-off reports all verification evidence, not only tests.

## Runtime And Test Coverage

Update `scripts/release/test/test_designing_tests_runtime.sh` to verify:

1. Claude planning guidance includes evidence choice and does not imply all code
   changes need tests.
2. Claude execution guidance includes Intent / Risk / Evidence.
3. Claude hand-off guidance reports tested, checked, skipped/unavailable, and
   residual risk.
4. Codex UserPromptSubmit includes the compact evidence primer for supported
   workflow skills.
5. Codex `$superpowers:finishing-a-development-branch` triggers the evidence
   hand-off primer.
6. Codex unrelated prompts still return `{}`.
7. Architecture guidance still mentions architecture claims, goal/risk/evidence,
   and residual architecture risk.
8. Reference presence checks match the new consolidated file set.

Manual probes should include:

- A low-risk thin entrypoint prompt that should choose `check`, not a new test.
- A high-risk config or deployment prompt that should choose test or explicit
  residual risk.
- A business-rule prompt that should still produce a concise, real test plan.

## File Scope

Primary files:

- `plugins/designing-tests/skills/designing-tests/SKILL.md`
- `plugins/designing-tests/skills/designing-tests/references/*.md`
- `plugins/designing-tests/hooks/pre-tool-use`
- `plugins/designing-tests/README.md`
- `codex-plugins/designing-tests/skills/designing-tests/SKILL.md`
- `codex-plugins/designing-tests/references/*.md`
- `codex-plugins/designing-tests/hooks/codex-runtime.js`
- `codex-plugins/designing-tests/README.md`
- `scripts/release/test/test_designing_tests_runtime.sh`

Secondary files if metadata changes:

- `.claude-plugin/marketplace.json`
- `codex-plugins/designing-tests/.codex-plugin/plugin.json`
- `codex-plugins/designing-tests/hooks/hooks.json`
- `codex-plugins/designing-tests/codex-hooks-snippet.json`

## Risks And Trade-offs

- The plugin will be less aggressive about adding tests. That is intentional,
  but high-risk upgrade conditions must remain visible.
- Fewer references reduce coverage of specialized testing techniques. The core
  skill should point to general techniques only when the chosen evidence is a
  test and the risk requires case expansion.
- Hook restraint means agents must still invoke the full skill for deeper test
  work. The hook should nudge, not replace skill use.
- Consolidating references changes paths and may require release tests to stop
  expecting retired files.

## Success Criteria

- The full skill is shorter and easier to read.
- Hook output is compact and evidence-oriented.
- The plugin can justify not writing tests for low-risk glue.
- The plugin still escalates to real tests for high-risk behavior.
- Claude and Codex tracks remain semantically aligned.
- Runtime tests catch the Codex finishing-branch trigger.
- Hand-off language reports evidence and residual risk without implying tests
  are the only acceptable proof.
