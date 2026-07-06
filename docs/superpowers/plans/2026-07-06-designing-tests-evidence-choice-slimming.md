# designing-tests Evidence Choice Slimming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slim `designing-tests` into an evidence-choice skill that chooses tests only when tests are the best verification evidence.

**Architecture:** Rewrite the main skill around Intent / Risk / Evidence, consolidate references to three focused files, and keep hook output compact. Preserve Claude/Codex semantic parity and fix the Codex finishing-branch prompt trigger.

**Tech Stack:** Markdown skills and references, Bash Claude hook, Node.js Codex hook runtime, shell release tests.

## Global Constraints

- Hook usage must remain restrained: compact reminders only, no Codex `SessionStart`.
- Do not add file-type ban rules; choose evidence from observable risk.
- Do not weaken high-risk guidance for security, data, contracts, async, migration/config, or historical incident regressions.
- Keep Claude and Codex tracks semantically aligned.

---

## File Map

- Modify `scripts/release/test/test_designing_tests_runtime.sh` to assert evidence-choice behavior and the Codex finishing trigger.
- Modify `plugins/designing-tests/skills/designing-tests/SKILL.md` and `codex-plugins/designing-tests/skills/designing-tests/SKILL.md` with the slim Intent / Risk / Evidence workflow.
- Modify `plugins/designing-tests/skills/designing-tests/references/{handoff-gate.md,integration-quality.md,architecture-test-design.md}` and Codex mirror references.
- Delete retired references in both tracks: `risk-catalog.md`, `test-case-patterns.md`, `layer-selection.md`, `test-quality-review.md`.
- Modify `plugins/designing-tests/hooks/pre-tool-use` and `codex-plugins/designing-tests/hooks/codex-runtime.js` with compact evidence-oriented prompts.
- Modify `plugins/designing-tests/README.md` and `codex-plugins/designing-tests/README.md` to describe evidence choice.

## Task 1: Runtime Tests First

**Files:**
- Modify: `scripts/release/test/test_designing_tests_runtime.sh`

**Interfaces:**
- Consumes: current Claude hook CLI and Codex `user-prompt-submit` runtime.
- Produces: failing release-test expectations for evidence-choice wording and Codex finishing trigger.

- [x] **Step 1: Add evidence-choice assertions**

Update the release test so Claude planning/execution/handoff checks look for:

```text
evidence choice
Intent / Risk / Evidence
checked
tested
residual risk
```

Also add a Codex prompt probe for:

```text
Run $superpowers:finishing-a-development-branch and prepare hand-off evidence
```

Expected output should include the Codex evidence primer.

- [x] **Step 2: Verify RED**

Run:

```bash
bash scripts/release/test/test_designing_tests_runtime.sh
```

Expected: FAIL before implementation because current hooks do not emit the new evidence-choice wording and Codex finishing returns `{}`.

## Task 2: Slim Skill And References

**Files:**
- Modify: `plugins/designing-tests/skills/designing-tests/SKILL.md`
- Modify: `codex-plugins/designing-tests/skills/designing-tests/SKILL.md`
- Modify: `plugins/designing-tests/skills/designing-tests/references/handoff-gate.md`
- Modify: `plugins/designing-tests/skills/designing-tests/references/integration-quality.md`
- Modify: `plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md`
- Modify: `codex-plugins/designing-tests/references/handoff-gate.md`
- Modify: `codex-plugins/designing-tests/references/integration-quality.md`
- Modify: `codex-plugins/designing-tests/references/architecture-test-design.md`
- Delete: retired references listed in File Map.

**Interfaces:**
- Produces: slim full-skill guidance and three reference files used by hook full mode and explicit skill invocation.

- [x] **Step 1: Rewrite SKILL.md around Intent / Risk / Evidence**

Replace the main workflow with:

```markdown
1. Intent Gate
2. Risk Gate
3. Evidence Gate
4. Boundary Selection, only when test is chosen
5. Hand-off Evidence
```

Keep real/shallow/fake labels for selected tests, but make evidence choice the first output.

- [x] **Step 2: Rewrite retained references**

Write concise references:

```text
handoff-gate.md -> evidence record
integration-quality.md -> real integration/contract/seam tests only
architecture-test-design.md -> architecture claims to goal/risk/evidence
```

- [x] **Step 3: Remove retired references**

Delete the merged reference files from both tracks.

## Task 3: Compact Hooks And README

**Files:**
- Modify: `plugins/designing-tests/hooks/pre-tool-use`
- Modify: `codex-plugins/designing-tests/hooks/codex-runtime.js`
- Modify: `plugins/designing-tests/README.md`
- Modify: `codex-plugins/designing-tests/README.md`

**Interfaces:**
- Consumes: slim skill/reference files.
- Produces: restrained hook prompts and updated docs.

- [x] **Step 1: Update Claude hook tiers**

Use compact evidence-choice text for planning, execution, and handoff. Keep full mode for explicit TDD workflow, but it loads the now-slimmed skill.

- [x] **Step 2: Update Codex prompt runtime**

Use a compact Evidence Choice primer and add `finishing-a-development-branch` to `PROMPT_TRIGGERS`.

- [x] **Step 3: Update README positioning**

Describe the plugin as evidence-choice guidance, not test-list generation.

## Task 4: Verification And Commit

**Files:**
- All touched files.

**Interfaces:**
- Produces: passing runtime test suite and clean syntax checks.

- [x] **Step 1: Run syntax checks**

Run:

```bash
bash -n plugins/designing-tests/hooks/pre-tool-use
node --check codex-plugins/designing-tests/hooks/codex-runtime.js
```

Expected: both pass.

- [x] **Step 2: Run release test**

Run:

```bash
bash scripts/release/test/test_designing_tests_runtime.sh
```

Expected: PASS.

- [x] **Step 3: Inspect diff**

Run:

```bash
git diff --stat
git diff --check
```

Expected: no whitespace errors and only intended files changed.

- [x] **Step 4: Commit**

Run:

```bash
git add <touched files>
git commit -m "refactor: slim designing-tests guidance"
```
