# covers_branch Guard: Block Finishing Without KB Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block `superpowers:finishing-a-development-branch` unless `superpowers-memory:update` has been run for the current branch, using a `covers_branch` field in index.md frontmatter.

**Architecture:** Add `covers_branch` to index.md frontmatter. The `update` skill writes current branch name on every run. The `rebuild` skill writes it too. The PreToolUse hook reads the field and blocks `finishing-a-development-branch` when it doesn't match the current branch (with escape for main/master).

**Tech Stack:** Node.js (hook-runtime.js), Markdown (SKILL.md, template)

---

### Task 1: Add `covers_branch` to index.md template

**Files:**
- Modify: `plugins/superpowers-memory/templates/index.md:1-5`

- [ ] **Step 1: Add covers_branch field to frontmatter**

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
covers_branch: null
---
```

- [ ] **Step 2: Commit**

```bash
git add plugins/superpowers-memory/templates/index.md
git commit -m "feat: add covers_branch field to index.md template"
```

---

### Task 2: Update skill writes `covers_branch`

**Files:**
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`

- [ ] **Step 1: Add covers_branch to Step 6 (Regenerate index.md)**

In Step 6, the skill already says to set `updated_by` and `triggered_by_plan` when regenerating index.md. Add `covers_branch` to that same instruction.

Find this text in Step 6:

```
Write `docs/project-knowledge/index.md` following the format in `templates/index.md`, setting `updated_by: superpowers-memory:update` and `triggered_by_plan: <plan-filename>`
```

Replace with:

```
Write `docs/project-knowledge/index.md` following the format in `templates/index.md`, setting `updated_by: superpowers-memory:update`, `triggered_by_plan: <plan-filename>`, and `covers_branch: <current-branch>` (the output of `git branch --show-current`)
```

- [ ] **Step 2: Commit**

```bash
git add plugins/superpowers-memory/skills/update/SKILL.md
git commit -m "feat: update skill writes covers_branch to index.md frontmatter"
```

---

### Task 3: Rebuild skill writes `covers_branch`

**Files:**
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

- [ ] **Step 1: Add covers_branch to Step 5 (Generate index.md)**

Find this text in Step 5:

```
setting `updated_by: superpowers-memory:rebuild` and `triggered_by_plan: null`
```

Replace with:

```
setting `updated_by: superpowers-memory:rebuild`, `triggered_by_plan: null`, and `covers_branch: <current-branch>` (the output of `git branch --show-current`)
```

- [ ] **Step 2: Add covers_branch to Step 4 (Set frontmatter)**

Step 4 sets frontmatter for the 6 knowledge files (not index.md), so no `covers_branch` needed there. Verify this is correct — `covers_branch` only goes in index.md. No change needed here.

- [ ] **Step 3: Commit**

```bash
git add plugins/superpowers-memory/skills/rebuild/SKILL.md
git commit -m "feat: rebuild skill writes covers_branch to index.md frontmatter"
```

---

### Task 4: Hook blocks finishing-a-development-branch without matching covers_branch

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`

- [ ] **Step 1: Add helper function to read covers_branch from index.md**

Add after `findIndexPath()` function (after line 30):

```javascript
function readCoversBranch() {
  const indexPath = findIndexPath();
  if (!indexPath) return null;
  const content = fs.readFileSync(indexPath, "utf8");
  const match = content.match(/^covers_branch:\s*(.+)$/m);
  if (!match) return null;
  const value = match[1].trim();
  return value === "null" || value === "" ? null : value;
}
```

- [ ] **Step 2: Add helper function to get current branch**

Add after `readCoversBranch()`:

```javascript
function getCurrentBranch() {
  const result = run("git", ["branch", "--show-current"]);
  return result.code === 0 ? result.stdout.trim() : null;
}
```

- [ ] **Step 3: Add helper function to detect base branch**

Add after `getCurrentBranch()`:

```javascript
function getBaseBranch() {
  const result = run("git", ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (result.code === 0) {
    return result.stdout.trim().replace("refs/remotes/origin/", "");
  }
  return "main";
}
```

- [ ] **Step 4: Modify buildPreToolUseOutput to block finishing skill**

In `buildPreToolUseOutput`, after the `if (!kbReady)` block (line 129) and before the final `return hookPayload(...)` (line 131), add the finishing-branch guard:

```javascript
  if (skill === "superpowers:finishing-a-development-branch") {
    const currentBranch = getCurrentBranch();
    const baseBranch = getBaseBranch();

    // On base branch — no guard needed
    if (!currentBranch || currentBranch === baseBranch) {
      return hookPayload("PreToolUse", advisory);
    }

    const coversBranch = readCoversBranch();
    if (coversBranch !== currentBranch) {
      return {
        decision: "block",
        reason:
          "Project knowledge base has not been updated for this branch. " +
          "Run superpowers-memory:update before finishing the branch. " +
          "(covers_branch: " + (coversBranch || "null") + ", current: " + currentBranch + ")",
      };
    }
  }
```

- [ ] **Step 5: Verify the full buildPreToolUseOutput function reads correctly**

The final function should be:

```javascript
function buildPreToolUseOutput(input) {
  let skill = "";
  try {
    skill = JSON.parse(input || "{}")?.tool_input?.skill || "";
  } catch {
    skill = "";
  }

  const advisory = skillAdvisory[skill];
  if (!advisory) return {};

  const kbExists = hasKnowledgeBase();
  const indexPath = findIndexPath();
  const kbReady = kbExists && indexPath;

  if (!kbReady) {
    const reason = kbExists
      ? "Project knowledge base exists but the index file is missing. You MUST run superpowers-memory:rebuild before using this workflow."
      : "Project knowledge base not initialized. You MUST run superpowers-memory:rebuild before using this workflow.";
    return { decision: "block", reason };
  }

  if (skill === "superpowers:finishing-a-development-branch") {
    const currentBranch = getCurrentBranch();
    const baseBranch = getBaseBranch();

    if (!currentBranch || currentBranch === baseBranch) {
      return hookPayload("PreToolUse", advisory);
    }

    const coversBranch = readCoversBranch();
    if (coversBranch !== currentBranch) {
      return {
        decision: "block",
        reason:
          "Project knowledge base has not been updated for this branch. " +
          "Run superpowers-memory:update before finishing the branch. " +
          "(covers_branch: " + (coversBranch || "null") + ", current: " + currentBranch + ")",
      };
    }
  }

  return hookPayload("PreToolUse", advisory);
}
```

- [ ] **Step 6: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js
git commit -m "feat: block finishing-a-development-branch when covers_branch misses current branch"
```

---

### Task 5: Update current index.md with covers_branch field

**Files:**
- Modify: `docs/project-knowledge/index.md:1-5`

- [ ] **Step 1: Add covers_branch to existing frontmatter**

```yaml
---
last_updated: 2026-04-15
updated_by: superpowers-memory:update
triggered_by_plan: null
covers_branch: main
---
```

Set to `main` since current KB was generated on main.

- [ ] **Step 2: Commit**

```bash
git add docs/project-knowledge/index.md
git commit -m "feat: add covers_branch field to current index.md"
```

---

### Task 6: Manual test

- [ ] **Step 1: Verify hook blocks on mismatched branch**

Create a test branch and invoke the hook:

```bash
git checkout -b test/covers-branch-guard
echo '{"tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' | node plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected output: `{ "decision": "block", "reason": "Project knowledge base has not been updated for this branch. ..." }`

- [ ] **Step 2: Verify hook allows after covers_branch matches**

Manually set `covers_branch: test/covers-branch-guard` in `docs/project-knowledge/index.md`, then rerun:

```bash
echo '{"tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' | node plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected output: advisory (hookSpecificOutput), NOT a block.

- [ ] **Step 3: Verify hook allows on main branch**

```bash
git checkout main
echo '{"tool_input":{"skill":"superpowers:finishing-a-development-branch"}}' | node plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected output: advisory, NOT a block.

- [ ] **Step 4: Verify other skills are unaffected**

```bash
echo '{"tool_input":{"skill":"superpowers:brainstorming"}}' | node plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected output: advisory about loading KB, no block.

- [ ] **Step 5: Clean up test branch**

```bash
git checkout main
git branch -D test/covers-branch-guard
```