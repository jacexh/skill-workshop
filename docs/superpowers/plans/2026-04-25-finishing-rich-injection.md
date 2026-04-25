# Finishing-Branch Rich Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `superpowers:finishing-a-development-branch` is invoked manually on a feature branch where the KB does not yet cover the latest commits, replace the current single-line advisory (and the staleness hard-block) with an architect-style rich-context injection that reliably induces the model to invoke `superpowers-memory:update` as its very next tool call.

**Architecture:** Modify `plugins/superpowers-memory/hooks/hook-runtime.js`. (1) Generalize `skillAdvisory` so values may be either strings (existing behavior) or functions returning strings (new). (2) Add a `buildFinishingRichContext()` helper that gathers `git log` + `git diff --name-only` between `covers_branch@sha` and `HEAD`, and emits an architect-style block with imperative MUST + numbered checklist + escape hatch. (3) Rewire the `finishing-a-development-branch` branch of `buildPreToolUseOutput`: when on a non-base branch and KB does not cover current HEAD, return the rich context (was: `decision: "block"`); when KB already covers, fall through to the existing soft advisory. (4) Keep the KB-missing hard block (catastrophic case) untouched.

**Tech Stack:** Node.js (no new deps), `git` CLI via `cp.spawnSync`. Plugin version bump 1.9.0 → 1.10.0 in `plugins/superpowers-memory/.claude-plugin/plugin.json` and the matching marketplace entry in `.claude-plugin/marketplace.json`.

**Convention notes:**
- This repo has no automated test suite (`docs/project-knowledge/conventions.md:28`). "Tests" below are crafted-input verifications via `echo '<json>' | node hook-runtime.js pre-tool-use`.
- Architect design patterns (database / ddd-* / frontend / REST API): not applicable to a hook script change. Stated explicitly per architect-standards instruction.

---

## File Structure

| File | Change | Responsibility |
|--|--|--|
| `plugins/superpowers-memory/hooks/hook-runtime.js` | Modify | Add `buildFinishingRichContext()`, generalize advisory dispatch, rewire finishing flow. |
| `plugins/superpowers-memory/.claude-plugin/plugin.json` | Modify | Bump `version` 1.9.0 → 1.10.0. |
| `.claude-plugin/marketplace.json` | Modify | Bump matching `version` field for `superpowers-memory` entry. |
| `docs/project-knowledge/*` | Out of scope | Updated post-merge via `superpowers-memory:update` (cannot be edited directly per ADR-010). |

No new files. No splits.

---

## Task 1: Add `buildFinishingRichContext()` helper

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js` (insert helper after `getBaseBranch()` around line 135)

- [ ] **Step 1: Write the verification command (defines expected behavior)**

The helper takes a context object and returns a single string. Verification will exercise it via the existing `pre-tool-use` mode end-to-end (Task 3); for this isolated step, write a one-shot Node REPL check:

```bash
node -e '
  const fns = require("/home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js");
  // helper not exported yet — this MUST fail with TypeError
  console.log(fns.buildFinishingRichContext);
'
```

Expected: `undefined` printed (file does not export helpers — that is fine; this is just a sanity check that the module loads after our edit). The real coverage is end-to-end in Task 3.

- [ ] **Step 2: Run the command above to confirm baseline (file loads cleanly)**

Run the command from Step 1. Expected output: `undefined` (the module loads with no syntax error).

- [ ] **Step 3: Insert the helper**

Insert this block in `hook-runtime.js` immediately after the `getBaseBranch()` function (currently ends near line 135):

```js
// Builds an architect-style rich-context block telling the model it MUST
// invoke `superpowers-memory:update` as its very next tool call.
// Used by finishing-a-development-branch when KB does not yet cover HEAD.
function buildFinishingRichContext({ currentBranch, currentSHA, covered, resolvedStoredSHA, reasonDetail }) {
  const shortCurrent = currentSHA ? currentSHA.slice(0, 12) : "(unknown)";
  const coveredRepr = covered
    ? (covered.sha ? covered.branch + "@" + covered.sha.slice(0, 12) : covered.branch + " (legacy: no SHA)")
    : "(none recorded)";

  // Compute commits + files since covered SHA; fall back gracefully when SHA unresolvable.
  let commitLines = [];
  let fileLines = [];
  if (resolvedStoredSHA) {
    const range = resolvedStoredSHA + "..HEAD";
    const logResult = run("git", ["log", "--oneline", "--no-merges", "-n", "20", range]);
    if (logResult.code === 0 && logResult.stdout.trim()) {
      commitLines = logResult.stdout.trim().split("\n");
    }
    const diffResult = run("git", ["diff", "--name-only", range]);
    if (diffResult.code === 0 && diffResult.stdout.trim()) {
      fileLines = diffResult.stdout.trim().split("\n").slice(0, 30);
    }
  }

  const sections = [
    "====== Memory: Finishing-Branch Update Required ======",
    "Your project knowledge base does not yet cover the latest commits on this branch.",
    "You MUST invoke `superpowers-memory:update` as your VERY NEXT tool call.",
    "Do not call `superpowers:finishing-a-development-branch` again until the update completes.",
    "",
    "Context:",
    "- Current branch: " + (currentBranch || "(unknown)") + "@" + shortCurrent,
    "- Knowledge base covers: " + coveredRepr,
    "- Reason: " + reasonDetail,
  ];

  if (commitLines.length > 0) {
    sections.push("");
    sections.push("Commits since last KB update (max 20):");
    for (const line of commitLines) sections.push("  " + line);
  }

  if (fileLines.length > 0) {
    sections.push("");
    sections.push("Files changed since last KB update (max 30):");
    for (const line of fileLines) sections.push("  " + line);
  }

  sections.push("");
  sections.push("Required workflow:");
  sections.push("  1. Invoke `superpowers-memory:update` (it will read the diff above and refresh docs/project-knowledge/).");
  sections.push("  2. Wait for it to complete (the KB write-lock will be released automatically).");
  sections.push("  3. Re-invoke `superpowers:finishing-a-development-branch` to continue.");
  sections.push("");
  sections.push("Escape hatch:");
  sections.push("  If you have inspected the diff above and are confident none of it changes architecture, conventions,");
  sections.push("  features, dependencies, decisions, or glossary terms (e.g., pure formatting, comment-only edits),");
  sections.push("  state that explicitly in your next message and proceed. Otherwise, run update first.");
  sections.push("======================================================");

  return sections.join("\n");
}
```

- [ ] **Step 4: Verify the file still parses**

Run:

```bash
node --check /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js
```

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js
git commit -m "feat(superpowers-memory): add buildFinishingRichContext helper"
```

---

## Task 2: Generalize `skillAdvisory` dispatch and rewire finishing flow

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js:402-481` (the `skillAdvisory` map and the `buildPreToolUseOutput` function)

- [ ] **Step 1: Convert `skillAdvisory` value for finishing skill to a sentinel**

The other 4 entries stay as plain strings. The finishing entry becomes a marker indicating "use rich-context flow." Change lines 412-414 from:

```js
  "superpowers:finishing-a-development-branch":
    "IMPORTANT: You MUST run superpowers-memory:update for this branch before finishing it.",
```

to:

```js
  // Sentinel: actual content is built by buildFinishingRichContext() inside
  // buildPreToolUseOutput when KB does not cover HEAD. When KB does cover,
  // this string is used as the soft reminder.
  "superpowers:finishing-a-development-branch":
    "Knowledge base already covers this branch. You may proceed with finishing.",
```

- [ ] **Step 2: Rewrite the finishing branch in `buildPreToolUseOutput`**

Replace the block currently at lines 446-479 (the `if (skill === "superpowers:finishing-a-development-branch") { ... }` block) with:

```js
  if (skill === "superpowers:finishing-a-development-branch") {
    const currentBranch = getCurrentBranch();
    const baseBranch = getBaseBranch();

    // On base branch or detached HEAD — finishing is meaningless; pass through.
    if (!currentBranch || currentBranch === baseBranch) {
      return hookPayload("PreToolUse", advisory);
    }

    const covered = readCoversBranch();
    const currentSHA = getCurrentSHA();
    const resolvedStoredSHA = covered && covered.sha ? resolveStoredSHA(covered.sha) : null;
    const branchMatches = covered && covered.branch === currentBranch;
    const shaMatches = resolvedStoredSHA && currentSHA && resolvedStoredSHA === currentSHA;

    if (branchMatches && shaMatches) {
      // KB is current — soft reminder is enough.
      return hookPayload("PreToolUse", advisory);
    }

    // Stale or never-covered — inject rich context.
    let reasonDetail;
    if (!covered) reasonDetail = "Knowledge base has no covers_branch recorded.";
    else if (!branchMatches) reasonDetail = "Knowledge base covers a different branch.";
    else if (!covered.sha) reasonDetail = "Legacy covers_branch format (no SHA recorded).";
    else if (!resolvedStoredSHA) reasonDetail = "Stored SHA is unresolvable (amended or garbage-collected).";
    else reasonDetail = "New commits on this branch since last KB update.";

    const richContext = buildFinishingRichContext({
      currentBranch, currentSHA, covered, resolvedStoredSHA, reasonDetail,
    });
    return hookPayload("PreToolUse", richContext);
  }
```

Key differences from the old block:
- No more `decision: "block"` — staleness now uses rich injection per the documented preference (`feedback_finishing_block_is_intentional.md`).
- Branch-matches-AND-sha-matches is the new "happy path" returning the soft advisory.
- The old `storedRepr` / `currentRepr` formatting is no longer needed — `buildFinishingRichContext()` owns presentation.

- [ ] **Step 3: Verify the file still parses**

```bash
node --check /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js
```

Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js
git commit -m "feat(superpowers-memory)!: rich-context injection for finishing-a-development-branch staleness

Replaces the staleness hard-block with architect-style rich injection per the
documented design preference. KB-missing block (catastrophic) is unchanged."
```

---

## Task 3: End-to-end manual verification

**Files:**
- Verify against: `plugins/superpowers-memory/hooks/hook-runtime.js` (live behavior)

This task uses the actual hook script, fed crafted JSON on stdin, in a throwaway temp git repo. Run all four scenarios in sequence. Each step shows the exact command and the assertion to make on the output.

- [ ] **Step 1: Set up a throwaway git repo with a stub KB**

```bash
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
git init -q
git config user.email test@test
git config user.name test
mkdir -p docs/project-knowledge
printf 'first\n' > a.txt
git add a.txt && git commit -qm "initial"
git checkout -qb feature/x
printf 'second\n' > b.txt
git add b.txt && git commit -qm "feat: add b"
SHA_INITIAL=$(git rev-parse HEAD~1)
SHA_HEAD=$(git rev-parse HEAD)
echo "TMPDIR=$TMPDIR"
echo "SHA_INITIAL=$SHA_INITIAL  SHA_HEAD=$SHA_HEAD"
```

Expected: prints the temp dir path and two SHAs. Keep this shell open for subsequent steps.

- [ ] **Step 2: Scenario A — KB missing (must still hard-block)**

```bash
# No index.md exists yet.
INPUT='{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}'
echo "$INPUT" | node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected output (JSON): contains `"decision": "block"` and a reason mentioning `superpowers-memory:rebuild`. **This is the catastrophic-case hard block; it must remain.**

- [ ] **Step 3: Scenario B — KB present, on base branch (passthrough)**

```bash
cat > docs/project-knowledge/index.md <<EOF
---
covers_branch: main@$SHA_INITIAL
---
# Index
EOF
git checkout -q main  # or whatever base your test repo created
INPUT='{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}'
echo "$INPUT" | node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected: JSON containing `additionalContext` (or `additional_context`) with the **soft reminder string** ("Knowledge base already covers this branch..."). No `decision: "block"`. No "Memory: Finishing-Branch Update Required" header.

- [ ] **Step 4: Scenario C — KB present, on feature branch, KB stale (RICH INJECTION)**

```bash
git checkout -q feature/x  # HEAD = SHA_HEAD; covers_branch still says main@SHA_INITIAL
INPUT='{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}'
echo "$INPUT" | node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected: JSON containing `additionalContext` whose value:
- starts with `====== Memory: Finishing-Branch Update Required ======`
- contains `You MUST invoke \`superpowers-memory:update\` as your VERY NEXT tool call.`
- contains the line `- Reason: Knowledge base covers a different branch.`
- contains `Commits since last KB update` followed by the `feat: add b` line
- contains `Files changed since last KB update` followed by `b.txt`
- contains `Escape hatch:` paragraph

**No `decision: "block"`.** That is the whole point — staleness is now soft-but-imperative.

- [ ] **Step 5: Scenario D — KB covers HEAD (happy path)**

```bash
# Update KB to cover current branch+SHA
SHA_NOW=$(git rev-parse HEAD)
cat > docs/project-knowledge/index.md <<EOF
---
covers_branch: feature/x@$SHA_NOW
---
# Index
EOF
INPUT='{"tool_name":"Skill","tool_input":{"skill":"superpowers:finishing-a-development-branch"}}'
echo "$INPUT" | node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js pre-tool-use
```

Expected: same as Scenario B — soft reminder, no rich block, no `decision: "block"`.

- [ ] **Step 6: Cleanup**

```bash
cd /home/xuhao/skill-workshop
rm -rf "$TMPDIR"
```

- [ ] **Step 7: No commit needed for verification**

(Verification leaves no artifacts in the workshop repo.)

---

## Task 4: Bump plugin version

**Files:**
- Modify: `plugins/superpowers-memory/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Read current versions**

```bash
grep -n '"version"' /home/xuhao/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json /home/xuhao/skill-workshop/.claude-plugin/marketplace.json
```

Expected: both files show `"version": "1.9.0"` for the memory plugin entry.

- [ ] **Step 2: Bump `plugin.json`**

In `plugins/superpowers-memory/.claude-plugin/plugin.json`, change:

```json
  "version": "1.9.0",
```

to:

```json
  "version": "1.10.0",
```

- [ ] **Step 3: Bump `marketplace.json`**

In `.claude-plugin/marketplace.json`, locate the `superpowers-memory` entry (it lists `version`) and change `"1.9.0"` → `"1.10.0"`.

- [ ] **Step 4: Verify**

```bash
grep -n '"version"' /home/xuhao/skill-workshop/plugins/superpowers-memory/.claude-plugin/plugin.json /home/xuhao/skill-workshop/.claude-plugin/marketplace.json
```

Expected: both show `1.10.0`.

- [ ] **Step 5: Commit**

```bash
git add plugins/superpowers-memory/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "chore(superpowers-memory): bump 1.9.0 -> 1.10.0"
```

---

## Task 5: Update knowledge base via `superpowers-memory:update`

**Files:**
- Out of scope for direct edit (KB write-lock per ADR-010); invoked as a skill call.

- [ ] **Step 1: Invoke the update skill**

```
superpowers-memory:update
```

Pass `triggered_by_plan: 2026-04-25-finishing-rich-injection.md`. The skill will:
- Re-read `architecture.md` and refresh the data-flow #4 description (PreToolUse interception now describes rich injection, not hard block).
- Re-read `decisions.md` and add a NORMAL-granularity ADR (or extend ADR-010) describing the staleness-via-rich-injection decision.
- Update `features.md` superpowers-memory line to note v1.10.0 + rich injection.
- Update `index.md` `last_updated`, `covers_branch`, `triggered_by_plan`.

- [ ] **Step 2: Verify**

After the skill completes, run:

```bash
node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js verify
```

Expected: `"ok": true` (or only warn-level findings; no hard errors).

- [ ] **Step 3: No separate commit**

The update skill commits its own KB changes. After it completes, the working tree should be clean.

---

## Self-Review

**1. Spec coverage** — the goal has two parts:
- (a) "manually invoke finishing → automatically trigger update" → covered by Task 1 (helper) + Task 2 (rewire). The rich injection's MUST-language + numbered checklist + escape hatch are the "auto-trigger" mechanism (within the constraint that hooks cannot literally invoke skills).
- (b) "align with prior feedback (no hard-block on staleness)" → covered by Task 2 step 2, which removes the `decision: "block"` from the staleness branch.

**2. Placeholder scan** — no TBD/TODO/"add appropriate". Code blocks are complete.

**3. Type consistency** — `buildFinishingRichContext` is defined in Task 1 and called in Task 2 with matching argument names (`{currentBranch, currentSHA, covered, resolvedStoredSHA, reasonDetail}`). All match.

**4. Convention compliance** — verification approach matches `conventions.md:28` (manual, no automated suite). Version bump matches `conventions.md:35`. Commit messages match `<type>(<scope>): <description>` per `conventions.md:33`.

---

## Open question for the user before execution

This plan removes the staleness hard-block (lines 461-478 of current `hook-runtime.js`) in favor of rich injection. That is consistent with `feedback_finishing_block_is_intentional.md`, but it's a behavior change for anyone relying on the block. Confirm:
- ✅ proceed with rich injection only (this plan as-written)
- ⚠ or keep the staleness block AND add rich injection on top (defense in depth, but redundant and noisier)
