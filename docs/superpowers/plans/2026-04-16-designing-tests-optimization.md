# Designing-Tests Plugin Optimization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the designing-tests plugin so it (1) automatically injects test guidance during the superpowers plan-execute workflow, and (2) produces higher quality tests driven by intent rather than implementation.

**Architecture:** Two-layer hook expansion (writing-plans gets TDD planning reminder; executing-plans and subagent-driven-development get condensed test design principles). SKILL.md content strengthened with intent-first workflow, test list format, intent comments, and formal test design techniques moved to references.

**Tech Stack:** Bash hooks with inline Node.js (following existing plugin conventions), Markdown skill/reference files.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `plugins/designing-tests/hooks/pre-tool-use` | Three-tier skill interception (writing-plans / executing+subagent / TDD) |
| Modify | `plugins/designing-tests/skills/designing-tests/SKILL.md` | Intent-first workflow, test list format, intent comment rule |
| Modify | `plugins/designing-tests/skills/designing-tests/references/test-case-patterns.md` | Add EP, BVA, Decision Table definitions |
| Modify | `plugins/designing-tests/.claude-plugin/plugin.json` | Version bump |

---

### Task 1: Rewrite SKILL.md — Intent-First Workflow and Test List

**Files:**
- Modify: `plugins/designing-tests/skills/designing-tests/SKILL.md`

The core change: reorder the workflow so test intent is derived BEFORE reading implementation code, add a test list step, and add the intent comment requirement.

- [ ] **Step 1: Rewrite the Workflow section**

Replace the current `## Workflow` section (lines 8-28) with:

```markdown
## Workflow

1. Identify the intent of the code under test.
   - Sources (in priority order): product spec, API contract, acceptance criteria, issue/bug report, ADR — then function signature, naming, docstring, and architectural role.
   - If formal docs are missing, derive intent from the function's public contract (name, parameters, return type, module role). Mark inferred intent as assumptions.
2. Generate a test list from intent — before reading implementation code.
   - For each test, write one line: `<unit/integration/e2e>: <what to test> → <expected outcome>`
   - Apply equivalence partitioning for ranges, boundary value analysis for limits, decision tables for multi-condition logic. See [references/test-case-patterns.md](references/test-case-patterns.md) for techniques.
   - This is a planning step output in your response, not a file to create.
3. Read the implementation and existing tests.
   - Purpose: determine the real test boundary and check what is already covered, duplicated, shallow, or fake.
   - Do NOT add or remove test cases based on implementation details discovered here. The test list from step 2 is locked.
4. State the regression each test protects.
   - Write one sentence per test: `If <behavior breaks>, users/system will observe <failure>.`
5. Choose the narrowest real boundary that can catch each regression.
6. Write test code.
   - Each test MUST have an intent comment above it: one sentence explaining what regression this test catches, written in the language of the test file.
   - Default minimum: one main success path, one meaningful failure path, one edge or bug-shaped path.
7. Prefer assertions on externally visible behavior.
   - User-visible result, contract-visible state, or key side effect.
8. Keep mocks at the system edge.
   - Do not mock the unit under test or copy the production logic into the test.
9. Run the relevant tests and verify each one protects its stated regression.
```

- [ ] **Step 2: Replace the Requirement Sources section**

Replace the current `## Requirement Sources` section (lines 42-56) with an Intent-First Rule section:

```markdown
## Intent-First Rule

Derive test cases from the function's **intent** (what it should do), not its **implementation** (how it does it).

Intent sources:
- formal spec, API contract, acceptance criteria, issue description
- function signature, naming, docstring
- the function's role in the module and who calls it

Read implementation code only to determine the **test boundary** and check **existing coverage** — never to decide what to test.

Common violations:
- reading an `if/else` branch and writing an assert for each branch → tests the implementation, not the intent
- copying internal logic into the test setup → the test passes by construction, not by verification
- testing private methods directly → couples tests to implementation structure
```

- [ ] **Step 3: Add Test List Format section**

Insert a new section after `## Intent-First Rule` and before `## Quality Labels`:

```markdown
## Test List Format

Before writing test code, output a test list in your response:

```
Test List: <function or component name>
Intent source: <where you derived the intent from>

- [ ] unit: <what to test> → <expected outcome>
- [ ] integration: <scenario> → <expected side effect or status>
```

Example for `OrderService.place_order` (intent source: API spec — max 10 items, qty > 0):

```
- [ ] unit: valid items list → returns order with generated id
- [ ] unit: empty items list → raises ValidationError
- [ ] unit: item qty = 0 (boundary) → raises ValidationError
- [ ] unit: 10 items (max boundary) → succeeds
- [ ] unit: 11 items (above max) → raises ValidationError
- [ ] integration: valid payload, authenticated → 201, order persisted
- [ ] integration: unauthenticated → 401
```

This is a planning step, not a file to create.
```

- [ ] **Step 4: Add Intent Comment Rule section**

Insert a new section after `## Test List Format` and before `## Quality Labels`:

```markdown
## Intent Comment Rule

Every test MUST have a comment above it explaining what regression it protects. Write the comment in the language of the test file.

```go
// When order items exceed the maximum (10), placing the order should fail
// with a validation error rather than silently truncating.
func TestPlaceOrder_ExceedsMaxItems_ReturnsValidationError(t *testing.T) {
```

```python
# Duplicate idempotency keys within the 5-minute window must return the
# original order, not create a second one.
def test_place_order_duplicate_idempotency_key_returns_same_order():
```

The comment states the **intent** (what should happen and why it matters), not the **mechanism** (what the test code does).
```

- [ ] **Step 5: Verify SKILL.md is well-formed**

Read the complete file and verify:
- Frontmatter is intact (name and description fields)
- Workflow steps are numbered 1-9
- All existing sections preserved: Boundary Selection Rule, Quality Labels, Coverage Heuristic, Assertion Rule, Mocking Rule, Failure Triage Rule, When to Read References
- No broken markdown links

- [ ] **Step 6: Commit**

```bash
git add plugins/designing-tests/skills/designing-tests/SKILL.md
git commit -m "feat(designing-tests): rewrite workflow to intent-first with test list and intent comments"
```

---

### Task 2: Expand test-case-patterns.md with Formal Techniques

**Files:**
- Modify: `plugins/designing-tests/skills/designing-tests/references/test-case-patterns.md`

Add explicit definitions for Equivalence Partitioning, Boundary Value Analysis, and Decision Table. The current file mentions them by name but doesn't define them.

- [ ] **Step 1: Expand the Range or format rules section**

Replace the current `### Range or format rules` subsection with two separate subsections:

```markdown
### Equivalence Partitioning

Divide the input space into classes where all values in a class produce the same behavior. Test **one representative per class**. Testing more within the same class adds no detection value.

Typical classes for any input:
- valid range / valid format
- below minimum / above maximum
- invalid type or format
- empty / null / zero-length

### Boundary Value Analysis

Bugs cluster at boundaries. For every valid range `[min, max]`, test these six points:

```
min-1  (just outside lower → invalid)
min    (lower boundary → valid)
min+1  (just inside lower → valid)
max-1  (just inside upper → valid)
max    (upper boundary → valid)
max+1  (just outside upper → invalid)
```

Always apply alongside equivalence partitioning — boundaries are the edges of equivalence classes.
```

- [ ] **Step 2: Expand the Multi-condition decisions section**

Replace the current `### Multi-condition decisions` subsection with:

```markdown
### Decision Table

For logic controlled by multiple independent conditions, enumerate combinations to avoid missing cases.

| Condition A | Condition B | Expected Outcome |
|-------------|-------------|-----------------|
| true        | true        | result X        |
| true        | false       | result Y        |
| false       | true        | error Z         |
| false       | false       | error W         |

When the number of combinations is large, use **pairwise testing** — cover every pair of condition values at least once rather than all N-way combinations.
```

- [ ] **Step 3: Verify test-case-patterns.md**

Read the file and confirm:
- Minimal Set section unchanged
- EP, BVA, Decision Table sections are clear and self-contained
- State machines, Async, and UI flows sections unchanged

- [ ] **Step 4: Commit**

```bash
git add plugins/designing-tests/skills/designing-tests/references/test-case-patterns.md
git commit -m "feat(designing-tests): add EP, BVA, decision table definitions to test-case-patterns reference"
```

---

### Task 3: Rewrite pre-tool-use Hook with Three-Tier Interception

**Files:**
- Modify: `plugins/designing-tests/hooks/pre-tool-use`

Expand from intercepting 1 skill to intercepting 4 skills, with different injection content per tier:
- **Tier 1 (writing-plans):** Brief planning reminder — require TDD steps in the plan
- **Tier 2 (executing-plans, subagent-driven-development):** Condensed test design principles
- **Tier 3 (test-driven-development):** Full SKILL.md + reference index (existing behavior)

- [ ] **Step 1: Rewrite the hook script**

Replace the entire `plugins/designing-tests/hooks/pre-tool-use` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parse skill name from stdin JSON
input=$(cat)
skill_name=$(printf '%s' "$input" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  try{console.log(JSON.parse(d).tool_input?.skill||'')}
  catch(e){console.log('')}
})
" 2>/dev/null || echo "")

# Determine injection tier
case "$skill_name" in
    superpowers:writing-plans)
        tier="planning"
        ;;
    superpowers:executing-plans|\
    superpowers:subagent-driven-development)
        tier="execution"
        ;;
    superpowers:test-driven-development)
        tier="full"
        ;;
    *)
        printf '{}\n'
        exit 0
        ;;
esac

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SKILL_DIR="$PLUGIN_ROOT/skills/designing-tests"

# --- Tier: planning ---
# Brief reminder for writing-plans to include TDD steps
if [ "$tier" = "planning" ]; then
    context="====== Test Design: Planning ======
When implementation involves code changes, include test-driven development steps:
1. Require invoking superpowers:test-driven-development for each component that needs tests.
2. Test steps BEFORE implementation steps — write tests first, implement second.
3. Each test step should specify: what intent to verify, which boundary (unit/integration/E2E).
Plans for code changes without a test strategy are incomplete.
======================================"

    context_json=$(node -e "console.log(JSON.stringify(process.argv[1]))" "$context" 2>/dev/null || echo '""')
    sys_msg='"Test Design: injected planning guidance"'
fi

# --- Tier: execution ---
# Condensed test design principles for plan execution
if [ "$tier" = "execution" ]; then
    context="====== Test Design: Execution Guidance ======
When executing steps that involve writing tests, follow these rules:

1. INTENT-FIRST: Derive test cases from the function's INTENT (what it should do), not its IMPLEMENTATION (how it does it). Intent sources: spec, API contract, function signature, naming, docstring, architectural role. Do NOT decide what to test by reading if/else branches.

2. TEST LIST BEFORE CODE: Before writing any test code, list each planned test case: <what to test> -> <expected outcome>. Apply equivalence partitioning for ranges, boundary value analysis for limits, decision tables for multi-condition logic.

3. INTENT COMMENTS: Every test MUST have a comment above it explaining what regression it protects, in the language of the test file.

4. BOUNDARY SELECTION: Pick the lowest layer that catches the real bug. Do not duplicate the same check across unit/integration/E2E.

5. QUALITY CHECK: A test is 'real' only if it would fail when intended behavior regresses. Tests that only check trivial shape/status are 'shallow'. Tests that reimplement business logic in assertions are 'fake'.

6. MINIMUM COVERAGE: One success path + one meaningful failure path + one edge/boundary path. Expand only when risk justifies it.

For full test design guidance, invoke the designing-tests:designing-tests skill.
================================================="

    context_json=$(node -e "console.log(JSON.stringify(process.argv[1]))" "$context" 2>/dev/null || echo '""')
    sys_msg='"Test Design: injected execution guidance"'
fi

# --- Tier: full ---
# Full SKILL.md + reference index (original behavior)
if [ "$tier" = "full" ]; then
    context=""

    # Read main skill guidance
    if [ -f "$SKILL_DIR/SKILL.md" ]; then
        content=$(node -e "
const fs=require('fs');
const raw=fs.readFileSync(process.argv[1],'utf8');
let body=raw;
if(raw.startsWith('---')){
  const end=raw.indexOf('---',3);
  if(end!==-1) body=raw.slice(end+3).trim();
}
console.log(body);
" "$SKILL_DIR/SKILL.md" 2>/dev/null || true)
        if [ -n "$content" ]; then
            context="$content"
        fi
    fi

    # Append reference summaries
    ref_dir="$SKILL_DIR/references"
    if [ -d "$ref_dir" ]; then
        for ref in "$ref_dir"/*.md; do
            [ -f "$ref" ] || continue
            summary=$(node -e "
const fs=require('fs');
const raw=fs.readFileSync(process.argv[1],'utf8');
let body=raw;
if(raw.startsWith('---')){
  const end=raw.indexOf('---',3);
  if(end!==-1) body=raw.slice(end+3).trim();
}
const lines=body.split('\n');
let title='';
for(const l of lines){
  if(l.startsWith('#')){title=l.replace(/^#+\s*/,'');break;}
}
console.log('- ['+title+'] Reference: '+process.argv[1]);
" "$ref" 2>/dev/null || true)
            if [ -n "$summary" ]; then
                context="$context
$summary"
            fi
        done
    fi

    if [ -z "$context" ]; then
        printf '{}\n'
        exit 0
    fi

    context_json=$(node -e "console.log(JSON.stringify(process.argv[1]))" "$context" 2>/dev/null || echo '""')
    sys_msg='"Test Design: loaded full test design guidance"'
fi

# Output JSON
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PreToolUse",\n    "additionalContext": %s\n  },\n  "systemMessage": %s\n}\n' "$context_json" "$sys_msg"
else
    printf '{\n  "additional_context": %s,\n  "systemMessage": %s\n}\n' "$context_json" "$sys_msg"
fi

exit 0
```

- [ ] **Step 2: Verify hook is executable and valid**

```bash
chmod +x plugins/designing-tests/hooks/pre-tool-use
```

Test each tier with simulated input:

```bash
# Tier: planning
echo '{"tool_input":{"skill":"superpowers:writing-plans"}}' | CLAUDE_PLUGIN_ROOT="plugins/designing-tests" bash plugins/designing-tests/hooks/pre-tool-use

# Tier: execution
echo '{"tool_input":{"skill":"superpowers:executing-plans"}}' | CLAUDE_PLUGIN_ROOT="plugins/designing-tests" bash plugins/designing-tests/hooks/pre-tool-use

# Tier: full
echo '{"tool_input":{"skill":"superpowers:test-driven-development"}}' | CLAUDE_PLUGIN_ROOT="plugins/designing-tests" bash plugins/designing-tests/hooks/pre-tool-use

# Non-matching (should return {})
echo '{"tool_input":{"skill":"superpowers:brainstorming"}}' | CLAUDE_PLUGIN_ROOT="plugins/designing-tests" bash plugins/designing-tests/hooks/pre-tool-use
```

Expected:
- Planning: JSON with "Test Design: injected planning guidance"
- Execution: JSON with "Test Design: injected execution guidance"
- Full: JSON with "Test Design: loaded full test design guidance" + SKILL.md body + reference index
- Non-matching: `{}`

- [ ] **Step 3: Commit**

```bash
git add plugins/designing-tests/hooks/pre-tool-use
git commit -m "feat(designing-tests): expand hook to three-tier interception (writing-plans, execution, TDD)"
```

---

### Task 4: Bump Version

**Files:**
- Modify: `plugins/designing-tests/.claude-plugin/plugin.json`

- [ ] **Step 1: Bump version from 1.5.7 to 1.6.0**

This is a minor version bump (new hook interception points + SKILL.md workflow redesign).

Change `"version": "1.5.7"` to `"version": "1.6.0"`.

- [ ] **Step 2: Commit**

```bash
git add plugins/designing-tests/.claude-plugin/plugin.json
git commit -m "chore(designing-tests): bump version to 1.6.0"
```

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Verify all files are consistent**

Check:
- SKILL.md workflow references `test-case-patterns.md` → file exists and has EP/BVA/Decision Table
- SKILL.md references all 4 reference files in "When to Read References" → all exist
- Hook script references `SKILL.md` path → file exists at that path
- `plugin.json` version is `1.6.0`

- [ ] **Step 2: Verify hook tiers produce valid JSON**

Run all 4 test commands from Task 3 Step 2 and pipe each output through `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` to confirm valid JSON.

- [ ] **Step 3: Verify no regressions in existing behavior**

The `superpowers:test-driven-development` tier must produce output identical in structure (not content, since SKILL.md changed) to the pre-change behavior:
- Has `hookSpecificOutput.additionalContext` containing SKILL.md body
- Has `systemMessage`
- Reference index lists all 4 reference files
