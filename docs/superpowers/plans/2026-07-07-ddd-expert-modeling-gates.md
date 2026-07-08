# ddd-expert Modeling Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

> Superseded note, 2026-07-08: this completed plan is historical. The modeling-gates reference remains, but the later ddd-expert simplification removed the separate `ddd-risk-router.md`; current review guidance is the six-step workflow in `review/SKILL.md` plus the Layer Baseline and on-demand concept/language references.

**Goal:** Add a compact modeling-gates thinking framework to `ddd-expert` and wire it into the four phase skills without turning the plugin into a rule catalog.

**Architecture:** Introduce `ddd-modeling-gates.md` as the domain-modeling/design thought spine, keep `ddd-risk-router.md` focused on implementation/review risk routing, and update phase skills to use the new reference at the right moment. Extend the existing release test so it protects both plugin tracks and behavior-oriented forward-test scenarios.

**Tech Stack:** Markdown skill/reference files, Bash release tests, dual plugin tracks under `plugins/ddd-expert` and `codex-plugins/ddd-expert`.

## Global Constraints

- Keep Claude and Codex plugin tracks semantically aligned.
- `ddd-modeling-gates.md` is a thinking-prompt reference, not a large DDD rule catalog.
- `ddd-risk-router.md` remains an implementation/review risk router.
- `domain-modeling` and `design` act like architecture coaches.
- `implement` and `review` act like senior reviewers requiring evidence.
- Forward tests assert reasoning outcomes and stop behavior, not exact long-form prose.

---

## File Map

- Create: `plugins/ddd-expert/references/ddd-modeling-gates.md`
- Create: `codex-plugins/ddd-expert/references/ddd-modeling-gates.md`
- Modify: `plugins/ddd-expert/skills/domain-modeling/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/domain-modeling/SKILL.md`
- Modify: `plugins/ddd-expert/skills/design/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/design/SKILL.md`
- Modify: `plugins/ddd-expert/skills/implement/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/implement/SKILL.md`
- Modify: `plugins/ddd-expert/skills/review/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/review/SKILL.md`
- Modify: `plugins/ddd-expert/references/ddd-risk-router.md`
- Modify: `codex-plugins/ddd-expert/references/ddd-risk-router.md`
- Modify: `plugins/ddd-expert/README.md`
- Modify: `codex-plugins/ddd-expert/README.md`
- Modify: `scripts/release/test/test_ddd_expert_plugin.sh`

## Task 1: Add Failing Release Tests

**Files:**
- Modify: `scripts/release/test/test_ddd_expert_plugin.sh`

**Interfaces:**
- Consumes: existing `CLAUDE_ROOT`, `CODEX_ROOT`, `fail`, and skill/reference validation helpers.
- Produces: release assertions that later tasks must satisfy.

- [x] **Step 1: Add tests for the new modeling gates reference**

Insert checks that both plugin tracks include `references/ddd-modeling-gates.md`, that the file contains the seven gate names, and that both copies are byte-identical.

- [x] **Step 2: Add tests for phase-skill routing**

Assert:

```bash
grep -q "ddd-modeling-gates.md" "$root/skills/domain-modeling/SKILL.md"
grep -q "ddd-modeling-gates.md" "$root/skills/design/SKILL.md"
grep -q "modeling evidence" "$root/skills/implement/SKILL.md"
grep -q "model evidence" "$root/skills/review/SKILL.md"
```

- [x] **Step 3: Add tests for risk-router role boundary**

Assert the risk router contains the phrase `implementation/review risk router` and routes modeling ambiguity to `ddd-modeling-gates.md`.

- [x] **Step 4: Add tests for forward-test scenarios**

Assert `ddd-modeling-gates.md` contains the scenario names:

```text
TaskAgreement Boundary Scenario
Noun-List Scenario
Event-as-Command Scenario
External-Language Leakage Scenario
Read-Model Backflow Scenario
Long-Running Coordination Scenario
```

- [x] **Step 5: Run release test and verify RED**

Run:

```bash
bash scripts/release/test/test_ddd_expert_plugin.sh
```

Expected: FAIL because `ddd-modeling-gates.md` does not exist yet.

## Task 2: Add Modeling Gates Reference

**Files:**
- Create: `plugins/ddd-expert/references/ddd-modeling-gates.md`
- Create: `codex-plugins/ddd-expert/references/ddd-modeling-gates.md`

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-07-ddd-expert-modeling-gates-design.md`.
- Produces: a compact reference loaded by `domain-modeling` and `design`.

- [x] **Step 1: Create Claude-track reference**

Write `plugins/ddd-expert/references/ddd-modeling-gates.md` with frontmatter, seven gate sections, phase usage notes, and forward-test scenarios.

- [x] **Step 2: Copy to Codex track**

Copy the same file to `codex-plugins/ddd-expert/references/ddd-modeling-gates.md`.

- [x] **Step 3: Run release test**

Run:

```bash
bash scripts/release/test/test_ddd_expert_plugin.sh
```

Expected: still FAIL until phase skills and router are updated.

## Task 3: Wire Modeling Gates Into Phase Skills

**Files:**
- Modify: `plugins/ddd-expert/skills/domain-modeling/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/domain-modeling/SKILL.md`
- Modify: `plugins/ddd-expert/skills/design/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/design/SKILL.md`
- Modify: `plugins/ddd-expert/skills/implement/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/implement/SKILL.md`
- Modify: `plugins/ddd-expert/skills/review/SKILL.md`
- Modify: `codex-plugins/ddd-expert/skills/review/SKILL.md`

**Interfaces:**
- Consumes: `ddd-modeling-gates.md`.
- Produces: phase-specific behavior that uses modeling gates without redoing modeling at implementation time.

- [x] **Step 1: Update domain-modeling skill**

Add `ddd-modeling-gates.md` to the initial evidence read and require compact `Model Decisions` when lifecycle, ownership, consistency, integration, or boundary decisions are material.

- [x] **Step 2: Update design skill**

Load `ddd-modeling-gates.md` with the brief and risk router. Require design to answer relevant gates before naming aggregates, repositories, handlers, ports, schemas, event payloads, or transactions.

- [x] **Step 3: Update implement skill**

Add a handoff check for missing modeling evidence. If the handoff asks for synchronous writes across several candidate aggregate roots without invariant/failure evidence, stop and return to design.

- [x] **Step 4: Update review skill**

Tell review to reconstruct expected model evidence and classify model ambiguity, design violation, implementation placement error, allowed exception, or evidence gap.

- [x] **Step 5: Mirror all edits across tracks**

Ensure Claude and Codex skill files remain semantically aligned.

## Task 4: Reposition Risk Router and README

**Files:**
- Modify: `plugins/ddd-expert/references/ddd-risk-router.md`
- Modify: `codex-plugins/ddd-expert/references/ddd-risk-router.md`
- Modify: `plugins/ddd-expert/README.md`
- Modify: `codex-plugins/ddd-expert/README.md`

**Interfaces:**
- Consumes: existing risk router and README capability descriptions.
- Produces: clearer routing boundaries for modeling vs implementation/review.

- [x] **Step 1: Update risk router description**

Clarify that the file is an implementation/review risk router and that domain-modeling/design ambiguity routes to `ddd-modeling-gates.md` and `ddd-modeling.md`.

- [x] **Step 2: Keep risk cards intact**

Avoid converting the risk router into a modeling rule catalog. Add only the role boundary and routing sentence.

- [x] **Step 3: Update README references**

Add `ddd-modeling-gates.md` to both README reference lists with concise wording.

## Task 5: Verify and Commit

**Files:**
- All files changed in Tasks 1-4.

**Interfaces:**
- Consumes: changed plugin docs and release test.
- Produces: verified hotfix branch.

- [x] **Step 1: Run release test**

Run:

```bash
bash scripts/release/test/test_ddd_expert_plugin.sh
```

Expected: PASS with `ddd-expert plugin: standalone routing-hook contract correct`.

- [x] **Step 2: Run diff checks**

Run:

```bash
git diff --check
diff -u plugins/ddd-expert/references/ddd-modeling-gates.md codex-plugins/ddd-expert/references/ddd-modeling-gates.md
```

Expected: both commands produce no output.

- [x] **Step 3: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended `ddd-expert` docs/tests and this plan changed.

- [x] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-07-07-ddd-expert-modeling-gates.md plugins/ddd-expert codex-plugins/ddd-expert scripts/release/test/test_ddd_expert_plugin.sh
git commit -m "feat: add ddd expert modeling gates"
```
