# Features Capability Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `superpowers-memory` preserve product-facing capabilities from PRDs/specs/roadmaps in `features.md`.

**Architecture:** The semantic reconciliation lives in skill instructions and content rules. The Node hook runtime adds only deterministic structure lint for required implemented-capability fields so bad output is visible during `verify`.

**Tech Stack:** Markdown skills/templates plus Node.js hook runtimes and Bash fixture tests.

---

### Task 1: Add Feature Shape Regression Test

**Files:**
- Create: `plugins/superpowers-memory/hooks/fixtures/missing-feature-fields/docs/project-knowledge/features.md`
- Create: `scripts/release/test/test_memory_verify.sh`

- [ ] **Step 1: Create a fixture with a malformed implemented capability**

```markdown
---
last_updated: 2026-05-13
updated_by: superpowers-memory:update
triggered_by_plan: null
---

# Features

## Implemented

### Product Capabilities

#### Issue-Bound Work

**Enables** — Users can start work from an issue.

**References** — docs/roadmaps/0515.md
```

- [ ] **Step 2: Add a Bash test that expects `feature_missing_field`**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$ROOT/plugins/superpowers-memory/hooks/fixtures/missing-feature-fields"

out="$(cd "$FIXTURE" && node ../../hook-runtime.js verify)"
echo "$out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null

codex_out="$(cd "$FIXTURE" && node ../../../../codex-plugins/superpowers-memory/hooks/codex-runtime.js verify)"
echo "$codex_out" | jq -e '.shapeViolations[] | select(.kind == "feature_missing_field")' >/dev/null
```

- [ ] **Step 3: Run test and verify it fails before runtime implementation**

Run: `bash scripts/release/test/test_memory_verify.sh`
Expected: FAIL because neither runtime emits `feature_missing_field` yet.

### Task 2: Implement Fixed-Field Feature Lint

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`

- [ ] **Step 1: Update `lintFeatures` to inspect `####` entries under `## Implemented`**

Required fields:

```js
const REQUIRED_IMPLEMENTED_FEATURE_FIELDS = [
  "Enables",
  "Actors / Entry Points",
  "Capability Boundary",
  "References",
];
```

For each `####` entry in the Implemented lifecycle section, collect structured field labels before the next heading. Emit:

```js
{
  line: entryStart + 1,
  kind: "feature_missing_field",
  sample: "Capability Name missing Actors / Entry Points, Capability Boundary"
}
```

- [ ] **Step 2: Run the new test**

Run: `bash scripts/release/test/test_memory_verify.sh`
Expected: PASS.

### Task 3: Strengthen Memory Rules and Skills

**Files:**
- Modify: `plugins/superpowers-memory/content-rules.md`
- Modify: `codex-plugins/superpowers-memory/content-rules.md`
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`
- Modify: `codex-plugins/superpowers-memory/skills/update/SKILL.md`
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`
- Modify: `codex-plugins/superpowers-memory/skills/rebuild/SKILL.md`
- Modify: `plugins/superpowers-memory/templates/features.md`
- Modify: `codex-plugins/superpowers-memory/templates/features.md`

- [ ] **Step 1: Add product-capability positioning**

State that `features.md` should prefer PRD/spec/roadmap capability language for product features and avoid grouping only by technical runtime components.

- [ ] **Step 2: Add Feature Capability Reconciliation**

In update and rebuild, require agents to list source capability candidates from PRDs/specs/roadmaps/plans, classify each, and either represent it in `features.md` or route it to the correct owner.

- [ ] **Step 3: Update template guidance**

Add concise template comments that product requirements should become capability candidates before implementation paths are summarized.

### Task 4: Verify

**Files:**
- All modified files above

- [ ] **Step 1: Run focused memory verify test**

Run: `bash scripts/release/test/test_memory_verify.sh`
Expected: PASS.

- [ ] **Step 2: Run existing release tests**

Run: `bash scripts/release/test/run-tests.sh`
Expected: all tests PASS.
