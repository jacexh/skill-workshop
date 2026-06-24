# Project Knowledge Query Ingest Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `superpowers-memory` with the LLM Wiki-inspired `query`, `ingest`, and `lint` surface while preserving compatibility aliases and synchronizing Claude Code/Codex tracks.

**Architecture:** Keep the Project Knowledge Base as Markdown files under `docs/project-knowledge/`. Move primary behavior into three skill docs, reuse existing deterministic runtime `verify` checks for `lint`, and keep `load`/`update`/`rebuild` as thin compatibility aliases. Release scripts enforce same-name Claude Code/Codex version synchronization.

**Tech Stack:** Markdown skills/templates/content rules, Node.js hook runtimes, Bash release scripts, Bash fixture tests, `jq` for manifest edits.

---

## Working Notes

- Keep Claude Code files under `plugins/superpowers-memory/` and Codex files under `codex-plugins/superpowers-memory/` behaviorally synchronized.
- Do not delete `cleanup` from Codex. It remains maintenance-only and outside the primary memory surface.

## File Structure

- `plugins/superpowers-memory/skills/query/SKILL.md`: Claude Code primary read/query skill.
- `plugins/superpowers-memory/skills/ingest/SKILL.md`: Claude Code primary write/bootstrap/full-refresh skill.
- `plugins/superpowers-memory/skills/lint/SKILL.md`: Claude Code primary read-only health skill.
- `plugins/superpowers-memory/skills/load/SKILL.md`: thin compatibility alias to `query`.
- `plugins/superpowers-memory/skills/update/SKILL.md`: thin compatibility alias to incremental `ingest`.
- `plugins/superpowers-memory/skills/rebuild/SKILL.md`: thin compatibility alias to bootstrap/full-refresh `ingest`.
- `codex-plugins/superpowers-memory/skills/query/SKILL.md`: Codex primary read/query skill.
- `codex-plugins/superpowers-memory/skills/ingest/SKILL.md`: Codex primary write/bootstrap/full-refresh skill.
- `codex-plugins/superpowers-memory/skills/lint/SKILL.md`: Codex primary read-only health skill.
- `codex-plugins/superpowers-memory/skills/load/SKILL.md`: thin compatibility alias to `query`.
- `codex-plugins/superpowers-memory/skills/update/SKILL.md`: thin compatibility alias to incremental `ingest`.
- `codex-plugins/superpowers-memory/skills/rebuild/SKILL.md`: thin compatibility alias to bootstrap/full-refresh `ingest`.
- `plugins/superpowers-memory/hooks/hook-runtime.js`: add `lint` mode as read-only alias to verify output.
- `codex-plugins/superpowers-memory/hooks/codex-runtime.js`: add `lint` mode as read-only alias to verify output.
- `plugins/superpowers-memory/content-rules.md` and `codex-plugins/superpowers-memory/content-rules.md`: add query-grade density, traversal links, aliases, and source-reference rules.
- `plugins/superpowers-memory/templates/*.md` and `codex-plugins/superpowers-memory/templates/*.md`: update template comments to support traversal and owner-file density.
- `plugins/superpowers-memory/README.md` and `codex-plugins/superpowers-memory/README.md`: document `query`, `ingest`, `lint`, and compatibility aliases.
- `.claude-plugin/marketplace.json`, `plugins/superpowers-memory/.claude-plugin/plugin.json`, `codex-plugins/superpowers-memory/.codex-plugin/plugin.json`, `codex-plugins/superpowers-memory/codex-hooks-snippet.json`: synchronize visible metadata and versions.
- `scripts/release/detect-changed-plugins.sh`: detect same-name dual-track plugin changes.
- `scripts/release/bump-versions.sh`: bump same-name Claude/Codex plugin manifests together.
- `scripts/release/test/test_detect-changed-plugins.sh`, `scripts/release/test/test_bump-versions.sh`, `scripts/release/test/test_integration.sh`, `scripts/release/test/test_memory_skill_surface.sh`, `scripts/release/test/test_memory_verify.sh`: regression coverage.

---

### Task 1: Add Release Synchronization Failing Tests

**Files:**
- Modify: `scripts/release/test/test_detect-changed-plugins.sh`
- Modify: `scripts/release/test/test_bump-versions.sh`
- Modify: `scripts/release/test/test_integration.sh`

- [ ] **Step 1: Change detect test Case 1 expected Codex output**

In `scripts/release/test/test_detect-changed-plugins.sh`, change Case 1 from:

```bash
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS="
```

to:

```bash
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS=foo"
```

- [ ] **Step 2: Change detect test Case 2 expected Claude output**

In the same file, change Case 2 from:

```bash
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=bar"
```

to:

```bash
assert_eq "$(echo "$out" | grep ^CLAUDE_PLUGINS=)" "CLAUDE_PLUGINS=bar foo"
```

- [ ] **Step 3: Change detect test Case 4 expected Codex output**

Add this assertion after the existing Case 4 `CLAUDE_PLUGINS=foo` assertion:

```bash
assert_eq "$(echo "$out" | grep ^CODEX_PLUGINS=)" "CODEX_PLUGINS=foo"
```

- [ ] **Step 4: Add bump test for Codex-only same-name synchronization**

Append this case before `echo "  5 cases passed"` in `scripts/release/test/test_bump-versions.sh`:

```bash
# Case 6: codex-only same-name change also bumps Claude manifest and marketplace entry
dir=$(setup_repo)
( cd "$dir" && NEXT=6.0.0 CLAUDE_PLUGINS= CODEX_PLUGINS=foo bash "$SCRIPT" )
assert_eq "$(jq -r .metadata.version "$dir/.claude-plugin/marketplace.json")" "6.0.0"
assert_eq "$(jq -r '.plugins[]|select(.name=="foo").version' "$dir/.claude-plugin/marketplace.json")" "6.0.0"
assert_eq "$(jq -r .version "$dir/plugins/foo/.claude-plugin/plugin.json")" "6.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/.codex-plugin/plugin.json")" "6.0.0"
assert_eq "$(jq -r .version "$dir/codex-plugins/foo/codex-hooks-snippet.json")" "6.0.0"
```

Change the final line to:

```bash
echo "  6 cases passed"
```

- [ ] **Step 5: Update integration test for one-sided Claude change**

In `scripts/release/test/test_integration.sh`, change the expected Codex plugin version from:

```bash
[ "$(jq -r .version codex-plugins/alpha/.codex-plugin/plugin.json)" = "1.11.0" ] \
  || { echo "FAIL codex/alpha (R-X: only Claude side changed)"; exit 1; }
```

to:

```bash
[ "$(jq -r .version codex-plugins/alpha/.codex-plugin/plugin.json)" = "1.12.1" ] \
  || { echo "FAIL codex/alpha should sync with Claude alpha"; exit 1; }
```

- [ ] **Step 6: Run release tests and verify they fail**

Run:

```bash
bash scripts/release/test/test_detect-changed-plugins.sh
bash scripts/release/test/test_bump-versions.sh
bash scripts/release/test/test_integration.sh
```

Expected: at least one command FAILS because the scripts still use independent physical-path versioning.

---

### Task 2: Implement Same-Name Claude/Codex Release Synchronization

**Files:**
- Modify: `scripts/release/detect-changed-plugins.sh`
- Modify: `scripts/release/bump-versions.sh`

- [ ] **Step 1: Update detect script header comment**

Replace the top comment block in `scripts/release/detect-changed-plugins.sh` with:

```bash
#!/usr/bin/env bash
# Detect which Claude/Codex plugins changed between PREV_REF and HEAD.
# Same-name dual-track rule: when plugins/N/** or codex-plugins/N/**
# changes and the counterpart directory exists, both tracks report N so release
# bumping keeps same-name plugin versions synchronized.
# Inputs:
#   $1 — PREV_REF (any git rev: tag, sha, branch)
# Outputs (stdout):
#   CLAUDE_PLUGINS=<space-separated names, sorted; empty if none>
#   CODEX_PLUGINS=<space-separated names, sorted; empty if none>
```

- [ ] **Step 2: Add a sorted union helper to detect script**

Insert this function after `extract()`:

```bash
sync_existing_counterparts() {
  local own_prefix="$1"
  local other_prefix="$2"
  local own_list="$3"
  local other_list="$4"
  {
    for name in $own_list; do
      [ -d "$own_prefix/$name" ] && printf '%s\n' "$name"
    done
    for name in $other_list; do
      [ -d "$own_prefix/$name" ] && [ -d "$other_prefix/$name" ] && printf '%s\n' "$name"
    done
  } | sort -u | tr '\n' ' ' | sed 's/ $//'
}
```

- [ ] **Step 3: Use synchronized lists in detect script output**

Replace:

```bash
CLAUDE=$(extract plugins || true)
CODEX=$(extract codex-plugins || true)

echo "CLAUDE_PLUGINS=$CLAUDE"
echo "CODEX_PLUGINS=$CODEX"
```

with:

```bash
CLAUDE_RAW=$(extract plugins || true)
CODEX_RAW=$(extract codex-plugins || true)

CLAUDE=$(sync_existing_counterparts plugins codex-plugins "$CLAUDE_RAW" "$CODEX_RAW")
CODEX=$(sync_existing_counterparts codex-plugins plugins "$CODEX_RAW" "$CLAUDE_RAW")

echo "CLAUDE_PLUGINS=$CLAUDE"
echo "CODEX_PLUGINS=$CODEX"
```

- [ ] **Step 4: Update bump script header comment**

In `scripts/release/bump-versions.sh`, replace the first comment block with:

```bash
#!/usr/bin/env bash
# Bump version fields across marketplace + plugin manifests.
# Same-name dual-track rule: if CLAUDE_PLUGINS or CODEX_PLUGINS contains N
# and both plugins/N and codex-plugins/N exist, bump both track manifests.
# Inputs (env):
#   NEXT             — new version, e.g. "1.12.1" (required)
#   CLAUDE_PLUGINS   — space-separated plugin names changed or synchronized under plugins/
#   CODEX_PLUGINS    — space-separated plugin names changed or synchronized under codex-plugins/
```

- [ ] **Step 5: Add synchronized-list helpers to bump script**

Insert after the `NEXT` validation block:

```bash
unique_words() {
  tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ' | sed 's/ $//'
}

sync_claude_plugins() {
  {
    for name in $CLAUDE_PLUGINS; do
      [ -d "plugins/$name" ] && printf '%s\n' "$name"
    done
    for name in $CODEX_PLUGINS; do
      [ -d "plugins/$name" ] && [ -d "codex-plugins/$name" ] && printf '%s\n' "$name"
    done
  } | sort -u | tr '\n' ' ' | sed 's/ $//'
}

sync_codex_plugins() {
  {
    for name in $CODEX_PLUGINS; do
      [ -d "codex-plugins/$name" ] && printf '%s\n' "$name"
    done
    for name in $CLAUDE_PLUGINS; do
      [ -d "codex-plugins/$name" ] && [ -d "plugins/$name" ] && printf '%s\n' "$name"
    done
  } | sort -u | tr '\n' ' ' | sed 's/ $//'
}

SYNC_CLAUDE_PLUGINS=$(sync_claude_plugins)
SYNC_CODEX_PLUGINS=$(sync_codex_plugins)
```

- [ ] **Step 6: Use synchronized lists in bump loops**

Change:

```bash
for N in $CLAUDE_PLUGINS; do
```

to:

```bash
for N in $SYNC_CLAUDE_PLUGINS; do
```

Change:

```bash
for N in $CODEX_PLUGINS; do
```

to:

```bash
for N in $SYNC_CODEX_PLUGINS; do
```

- [ ] **Step 7: Run release tests**

Run:

```bash
bash scripts/release/test/test_detect-changed-plugins.sh
bash scripts/release/test/test_bump-versions.sh
bash scripts/release/test/test_integration.sh
```

Expected: all three commands PASS.

- [ ] **Step 8: Commit release synchronization**

Run:

```bash
git add scripts/release/detect-changed-plugins.sh scripts/release/bump-versions.sh scripts/release/test/test_detect-changed-plugins.sh scripts/release/test/test_bump-versions.sh scripts/release/test/test_integration.sh
git commit -m "release: sync same-name plugin versions"
```

---

### Task 3: Add Runtime `lint` Mode

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`
- Modify: `codex-plugins/superpowers-memory/hooks/codex-runtime.js`
- Modify: `scripts/release/test/test_memory_verify.sh`

- [ ] **Step 1: Add a test that Claude lint matches verify shape**

In `scripts/release/test/test_memory_verify.sh`, after the first clean `verify` assertion block, add:

```bash
lint_out="$(cd "$clean" && node "$ROOT/plugins/superpowers-memory/hooks/hook-runtime.js" lint)"
echo "$lint_out" | jq -e '.staleRefs and .shapeViolations and .ssotViolations and .retrievalCost' >/dev/null
```

- [ ] **Step 2: Add a test that Codex lint matches verify shape**

In the same area, add:

```bash
lint_codex_out="$(cd "$clean" && node "$ROOT/codex-plugins/superpowers-memory/hooks/codex-runtime.js" lint)"
echo "$lint_codex_out" | jq -e '.staleRefs and .shapeViolations and .ssotViolations and .retrievalCost' >/dev/null
```

- [ ] **Step 3: Run the memory test and verify it fails**

Run:

```bash
bash scripts/release/test/test_memory_verify.sh
```

Expected: FAIL because both runtimes reject `lint` mode.

- [ ] **Step 4: Add `lint` mode to Claude runtime**

In `plugins/superpowers-memory/hooks/hook-runtime.js`, replace:

```js
  if (mode === "verify") {
    process.stdout.write(JSON.stringify(buildVerifyOutput(), null, 2) + "\n");
    return;
  }
```

with:

```js
  if (mode === "verify" || mode === "lint") {
    process.stdout.write(JSON.stringify(buildVerifyOutput(), null, 2) + "\n");
    return;
  }
```

- [ ] **Step 5: Add `lint` mode to Codex runtime**

Make the same replacement in `codex-plugins/superpowers-memory/hooks/codex-runtime.js`.

- [ ] **Step 6: Run syntax checks and memory tests**

Run:

```bash
node --check plugins/superpowers-memory/hooks/hook-runtime.js
node --check codex-plugins/superpowers-memory/hooks/codex-runtime.js
bash scripts/release/test/test_memory_verify.sh
```

Expected: all commands PASS.

- [ ] **Step 7: Commit runtime lint mode**

Run:

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js codex-plugins/superpowers-memory/hooks/codex-runtime.js scripts/release/test/test_memory_verify.sh
git commit -m "memory: add lint runtime mode"
```

---

### Task 4: Add Memory Skill Surface Regression Test

**Files:**
- Create: `scripts/release/test/test_memory_skill_surface.sh`

- [ ] **Step 1: Create the failing test file**

Create `scripts/release/test/test_memory_skill_surface.sh` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

fail() {
  echo "  FAIL: $*"
  exit 1
}

for track in plugins codex-plugins; do
  base="$ROOT/$track/superpowers-memory/skills"
  for skill in query ingest lint load update rebuild; do
    [ -f "$base/$skill/SKILL.md" ] || fail "$track missing $skill skill"
  done

  grep -q "read-only" "$base/query/SKILL.md" || fail "$track query missing read-only rule"
  grep -q "Memory candidate" "$base/query/SKILL.md" || fail "$track query missing Memory candidate"
  grep -q "bootstrap" "$base/ingest/SKILL.md" || fail "$track ingest missing bootstrap mode"
  grep -q "full-refresh" "$base/ingest/SKILL.md" || fail "$track ingest missing full-refresh mode"
  grep -q "commit messages are weak hints" "$base/ingest/SKILL.md" || fail "$track ingest missing commit-message downgrade"
  grep -q "read-only" "$base/lint/SKILL.md" || fail "$track lint missing read-only rule"
  grep -q "suggested ingest targets" "$base/lint/SKILL.md" || fail "$track lint missing ingest target output"
  grep -q "superpowers-memory:query" "$base/load/SKILL.md" || fail "$track load not pointing to query"
  grep -q "superpowers-memory:ingest" "$base/update/SKILL.md" || fail "$track update not pointing to ingest"
  grep -q "superpowers-memory:ingest" "$base/rebuild/SKILL.md" || fail "$track rebuild not pointing to ingest"
done

diff -u "$ROOT/plugins/superpowers-memory/content-rules.md" "$ROOT/codex-plugins/superpowers-memory/content-rules.md" >/dev/null \
  || fail "content-rules differ between Claude and Codex"

echo "  memory skill surface checks passed"
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
bash scripts/release/test/test_memory_skill_surface.sh
```

Expected: FAIL because `query`, `ingest`, and `lint` skill directories do not exist yet.

- [ ] **Step 3: Commit only if this task is isolated**

Skip the commit until Tasks 5 and 6 create the files that make this test pass.

---

### Task 5: Add Claude Code Query, Ingest, Lint, And Alias Skills

**Files:**
- Create: `plugins/superpowers-memory/skills/query/SKILL.md`
- Create: `plugins/superpowers-memory/skills/ingest/SKILL.md`
- Create: `plugins/superpowers-memory/skills/lint/SKILL.md`
- Modify: `plugins/superpowers-memory/skills/load/SKILL.md`
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

- [ ] **Step 1: Create Claude query skill**

Create `plugins/superpowers-memory/skills/query/SKILL.md` with this content:

```markdown
---
name: query
description: Use before exploring the codebase, planning, architecture decisions, broad search, or answering project questions — reads Project Knowledge Base and answers from it without writing
---

# Query Project Knowledge

Read `docs/project-knowledge/` to answer a concrete project question. This skill is read-only.

**Announce at start:** "I'm querying the project knowledge base."

## Process

1. If `docs/project-knowledge/` does not exist, tell the user: "Project knowledge base not initialized. Run superpowers-memory:ingest bootstrap to create it."
2. Read `docs/project-knowledge/index.md`. If it does not exist, fall back to reading the canonical owner files that exist.
3. Normalize the user question into likely project terms and aliases.
4. Select the smallest useful set of owner files or shards, normally 1-3.
5. If the index is insufficient, search `docs/project-knowledge/` for the terms and aliases.
6. Read candidate owner entries.
7. Follow `See:`, `Related:`, ADR, spec, plan, or source references only when evidence is not yet sufficient.
8. Stop when at least one owner entry answers the question, linked references do not contradict it, and the answer can name its source.

## Output

```markdown
Answer:
[Direct answer grounded in project knowledge.]

Sources read:
- docs/project-knowledge/index.md
- docs/project-knowledge/<owner>.md

Confidence:
[High | Medium | Low] - [short reason]

Next:
[Optional source files or actions.]

Memory candidate:
[Optional one-paragraph candidate only when a durable fact is missing, stale, or contradictory.]
```

## Skip Conditions

Skip this skill for trivial local commands, exact narrow edits where the file is already known, pure formatting, or a follow-up in the same area when project knowledge was queried recently and nothing material changed.

## Related Skills

- Use `superpowers-memory:ingest` to write Memory candidates or update the Project Knowledge Base.
- Use `superpowers-memory:lint` to check knowledge health without answering a task question.
```

- [ ] **Step 2: Create Claude ingest skill**

Create `plugins/superpowers-memory/skills/ingest/SKILL.md` with this content:

```markdown
---
name: ingest
description: Use to create, incrementally update, or full-refresh Project Knowledge Base from specs, plans, ADRs, docs, memory candidates, and validated code facts
---

# Ingest Project Knowledge

Write durable project facts into `docs/project-knowledge/`. This is the only normal knowledge-writing path.

**Announce at start:** "I'm ingesting project knowledge."

## Modes

- **Incremental ingest:** default after a spec, plan, PR, or implementation branch. Read source documents first and update only affected owner files.
- **Bootstrap ingest:** use when `docs/project-knowledge/` does not exist. Read the project and create the initial owner files plus compact `index.md`.
- **Full-refresh ingest:** use when `superpowers-memory:lint` reports high drift, owner-file structure is obsolete, or the user explicitly asks to regenerate target files.

## Source Authority

Read sources in this order:

1. `docs/superpowers/specs/*.md`
2. `docs/superpowers/plans/*.md`
3. ADRs and project decision documents
4. README and user-facing documentation
5. Explicit Memory candidates from `query`
6. Code/diff inspection for validation, paths, names, and implementation status
7. Commit messages as weak hints only

## Process

1. Acquire the write lock:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" lock superpowers-memory:ingest
```

2. Identify changed or requested source documents.
3. Extract durable capabilities, boundaries, decisions, terms, conventions, dependencies, and lifecycle facts.
4. Route each fact to exactly one owner file per `content-rules.md`.
5. Validate anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
6. Update only affected owner files.
7. Regenerate `docs/project-knowledge/index.md` when routing or key points changed.
8. Run verification:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" verify
```

9. Fix `staleRefs`, `shapeViolations`, `readinessWarnings`, or `ssotViolations` before committing.
10. Release the write lock:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" unlock
```

## Compatibility

- `superpowers-memory:update` is a thin alias for incremental ingest.
- `superpowers-memory:rebuild` is a thin alias for bootstrap ingest when no KB exists, or full-refresh ingest when one exists.
```

- [ ] **Step 3: Create Claude lint skill**

Create `plugins/superpowers-memory/skills/lint/SKILL.md` with this content:

```markdown
---
name: lint
description: Use to health-check Project Knowledge Base without writing — reports stale references, shape violations, SSOT issues, retrieval cost, split candidates, and suggested ingest targets
---

# Lint Project Knowledge

Check `docs/project-knowledge/` without writing files.

**Announce at start:** "I'm linting the project knowledge base."

## Process

1. If `docs/project-knowledge/` does not exist, report that bootstrap ingest is needed.
2. Run deterministic checks:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" lint
```

3. Interpret the JSON output for the requested scope: whole KB, one owner file, or one topic.
4. Report issues by severity.
5. Report suggested ingest targets instead of editing files.

## Output

```markdown
Issues:
- [Critical | Important | Minor] [owner/source] [finding]

Suggested ingest targets:
- Owner: docs/project-knowledge/<owner>.md
  Source: <spec/plan/ADR/source>
  Reason: <missing | stale | contradiction | weak source | routing gap>

Advisory:
- [retrieval cost, split candidates, or non-blocking notes]
```

## Rules

- Do not write files.
- Do not acquire the write lock.
- Use `superpowers-memory:ingest` for fixes.
```

- [ ] **Step 4: Replace Claude load alias**

Replace `plugins/superpowers-memory/skills/load/SKILL.md` with:

```markdown
---
name: load
description: Compatibility alias for superpowers-memory:query — use query before exploring, planning, architecture decisions, or broad search
---

# Load Project Knowledge

`load` is a compatibility alias. Use `superpowers-memory:query` for the primary workflow.

Run the `query` process from `plugins/superpowers-memory/skills/query/SKILL.md`.
```

- [ ] **Step 5: Replace Claude update alias**

Replace `plugins/superpowers-memory/skills/update/SKILL.md` with:

```markdown
---
name: update
description: Compatibility alias for superpowers-memory:ingest incremental mode — updates project knowledge from stable source facts
---

# Update Project Knowledge

`update` is a compatibility alias for incremental `superpowers-memory:ingest`.

Use the `ingest` process from `plugins/superpowers-memory/skills/ingest/SKILL.md` with incremental mode.
```

- [ ] **Step 6: Replace Claude rebuild alias**

Replace `plugins/superpowers-memory/skills/rebuild/SKILL.md` with:

```markdown
---
name: rebuild
description: Compatibility alias for superpowers-memory:ingest bootstrap or full-refresh mode
---

# Rebuild Project Knowledge

`rebuild` is a compatibility alias for `superpowers-memory:ingest`.

- If `docs/project-knowledge/` does not exist, use ingest bootstrap mode.
- If the knowledge base exists, use ingest full-refresh mode for the requested owner file or whole KB.

Use the `ingest` process from `plugins/superpowers-memory/skills/ingest/SKILL.md`.
```

- [ ] **Step 7: Run skill surface test and verify Claude failures are gone**

Run:

```bash
bash scripts/release/test/test_memory_skill_surface.sh
```

Expected: still FAIL because Codex primary skill files have not been added yet.

---

### Task 6: Add Codex Query, Ingest, Lint, And Alias Skills

**Files:**
- Create: `codex-plugins/superpowers-memory/skills/query/SKILL.md`
- Create: `codex-plugins/superpowers-memory/skills/ingest/SKILL.md`
- Create: `codex-plugins/superpowers-memory/skills/lint/SKILL.md`
- Modify: `codex-plugins/superpowers-memory/skills/load/SKILL.md`
- Modify: `codex-plugins/superpowers-memory/skills/update/SKILL.md`
- Modify: `codex-plugins/superpowers-memory/skills/rebuild/SKILL.md`
- Modify: `scripts/release/test/test_memory_skill_surface.sh`

- [ ] **Step 1: Copy primary skill docs from Claude to Codex**

Run:

```bash
mkdir -p codex-plugins/superpowers-memory/skills/query codex-plugins/superpowers-memory/skills/ingest codex-plugins/superpowers-memory/skills/lint
cp plugins/superpowers-memory/skills/query/SKILL.md codex-plugins/superpowers-memory/skills/query/SKILL.md
cp plugins/superpowers-memory/skills/ingest/SKILL.md codex-plugins/superpowers-memory/skills/ingest/SKILL.md
cp plugins/superpowers-memory/skills/lint/SKILL.md codex-plugins/superpowers-memory/skills/lint/SKILL.md
```

- [ ] **Step 2: Replace Codex runtime command references**

In `codex-plugins/superpowers-memory/skills/ingest/SKILL.md` and `codex-plugins/superpowers-memory/skills/lint/SKILL.md`, replace:

```text
${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js
```

with:

```text
${PLUGIN_ROOT:-codex-plugins/superpowers-memory}/hooks/codex-runtime.js
```

- [ ] **Step 3: Replace Codex alias docs**

Run:

```bash
cp plugins/superpowers-memory/skills/load/SKILL.md codex-plugins/superpowers-memory/skills/load/SKILL.md
cp plugins/superpowers-memory/skills/update/SKILL.md codex-plugins/superpowers-memory/skills/update/SKILL.md
cp plugins/superpowers-memory/skills/rebuild/SKILL.md codex-plugins/superpowers-memory/skills/rebuild/SKILL.md
```

- [ ] **Step 4: Extend skill surface test to check platform runtime commands**

Append this to `scripts/release/test/test_memory_skill_surface.sh` before the final `echo`:

```bash
grep -q 'hook-runtime.js" lint' "$ROOT/plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Claude lint skill missing hook-runtime lint command"
grep -q 'codex-runtime.js" lint' "$ROOT/codex-plugins/superpowers-memory/skills/lint/SKILL.md" \
  || fail "Codex lint skill missing codex-runtime lint command"
grep -q 'hook-runtime.js" verify' "$ROOT/plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Claude ingest skill missing hook-runtime verify command"
grep -q 'codex-runtime.js" verify' "$ROOT/codex-plugins/superpowers-memory/skills/ingest/SKILL.md" \
  || fail "Codex ingest skill missing codex-runtime verify command"
```

- [ ] **Step 5: Run skill surface test**

Run:

```bash
bash scripts/release/test/test_memory_skill_surface.sh
```

Expected: PASS.

- [ ] **Step 6: Commit skill surface**

Run:

```bash
git add plugins/superpowers-memory/skills codex-plugins/superpowers-memory/skills scripts/release/test/test_memory_skill_surface.sh
git commit -m "memory: add query ingest lint skills"
```

---

### Task 7: Update Content Rules And Templates For Query-Grade Traversal

**Files:**
- Modify: `plugins/superpowers-memory/content-rules.md`
- Modify: `codex-plugins/superpowers-memory/content-rules.md`
- Modify: `plugins/superpowers-memory/templates/index.md`
- Modify: `codex-plugins/superpowers-memory/templates/index.md`
- Modify: `plugins/superpowers-memory/templates/features.md`
- Modify: `codex-plugins/superpowers-memory/templates/features.md`
- Modify: `plugins/superpowers-memory/templates/architecture.md`
- Modify: `codex-plugins/superpowers-memory/templates/architecture.md`
- Modify: `plugins/superpowers-memory/templates/decisions.md`
- Modify: `codex-plugins/superpowers-memory/templates/decisions.md`

- [ ] **Step 1: Add traversal section to Claude content rules**

Add this section to `plugins/superpowers-memory/content-rules.md` near the existing retrieval-cost guidance:

```markdown
## Query-Grade Traversal

The Project Knowledge Base must support `query`, not only session-start orientation.

- `index.md` is the router. It lists owner files, shards, useful aliases, and 1-3 routing key points per file.
- Owner entries that claim durable behavior include a source reference: spec, plan, ADR, README, canonical source file, or another owner entry.
- Cross-owner relationships use `See:` or `Related:` pointers. Do not duplicate expanded facts across owner files.
- Shards must be reachable from `index.md`; if a parent owner file exists, it also links to its shards.
- Optional aliases are plain Markdown such as `Aliases: native hooks, Codex hooks, prompt router`.
- Query answers should be supported by read owner/source entries, not by search snippets alone.
```

- [ ] **Step 2: Copy content rules to Codex**

Run:

```bash
cp plugins/superpowers-memory/content-rules.md codex-plugins/superpowers-memory/content-rules.md
```

- [ ] **Step 3: Update index templates with aliases**

In both `plugins/superpowers-memory/templates/index.md` and `codex-plugins/superpowers-memory/templates/index.md`, add this comment under the `# Project Knowledge Index` heading:

```markdown
<!-- Keep this file compact. It routes query to owner files and shards.
     Include aliases only when user-facing vocabulary differs from implementation vocabulary.
     Do not move owner-file detail into this hot path. -->
```

- [ ] **Step 4: Add owner entry source-reference guidance to feature templates**

In both feature templates, add this comment near the implemented capability entry format:

```markdown
<!-- Each implemented capability should include stable References.
     Use See:/Related: pointers for cross-owner relationships instead of duplicating architecture, decision, or glossary content. -->
```

- [ ] **Step 5: Add traversal guidance to architecture templates**

In both architecture templates, add this comment near cross-module flow or component sections:

```markdown
<!-- Use See:/Related: links to decisions, features, conventions, and source files when a query reader needs to traverse from structure to rationale or behavior. -->
```

- [ ] **Step 6: Add traversal guidance to decisions templates**

In both decisions templates, add this comment near ADR summary guidance:

```markdown
<!-- Decision summaries should link to ADR detail files and any owner entries affected by the decision. Query relies on these links to traverse from current behavior to rationale. -->
```

- [ ] **Step 7: Run content sync tests**

Run:

```bash
bash scripts/release/test/test_memory_skill_surface.sh
bash scripts/release/test/test_memory_verify.sh
```

Expected: both commands PASS.

- [ ] **Step 8: Commit content rules and templates**

Run:

```bash
git add plugins/superpowers-memory/content-rules.md codex-plugins/superpowers-memory/content-rules.md plugins/superpowers-memory/templates codex-plugins/superpowers-memory/templates
git commit -m "memory: add query-grade traversal rules"
```

---

### Task 8: Update README And Plugin Metadata

**Files:**
- Modify: `plugins/superpowers-memory/README.md`
- Modify: `codex-plugins/superpowers-memory/README.md`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `plugins/superpowers-memory/.claude-plugin/plugin.json`
- Modify: `codex-plugins/superpowers-memory/.codex-plugin/plugin.json`
- Modify: `codex-plugins/superpowers-memory/codex-hooks-snippet.json`

- [ ] **Step 1: Add README capability summary to Claude README**

In `plugins/superpowers-memory/README.md`, add this section near the top:

```markdown
## Primary Memory Skills

- `superpowers-memory:query` — read Project Knowledge Base, traverse owner files/source references, answer with confidence, and optionally emit Memory candidates.
- `superpowers-memory:ingest` — write Project Knowledge Base from stable source facts; supports incremental, bootstrap, and full-refresh modes.
- `superpowers-memory:lint` — read-only health check over stale refs, shape violations, SSOT duplication, retrieval cost, split candidates, and suggested ingest targets.

Compatibility aliases:

- `superpowers-memory:load` → `query`
- `superpowers-memory:update` → `ingest` incremental mode
- `superpowers-memory:rebuild` → `ingest` bootstrap/full-refresh mode
```

- [ ] **Step 2: Add the same README section to Codex README**

Add the same section to `codex-plugins/superpowers-memory/README.md`.

- [ ] **Step 3: Update Claude plugin descriptions**

In `.claude-plugin/marketplace.json`, update the `superpowers-memory` plugin entry description to:

```json
"Project Knowledge Base query, ingest, and lint for superpowers workflows"
```

In `plugins/superpowers-memory/.claude-plugin/plugin.json`, update `description` to the same string.

- [ ] **Step 4: Update Codex plugin descriptions**

In `codex-plugins/superpowers-memory/.codex-plugin/plugin.json`, update:

```json
"description": "Project Knowledge Base query, ingest, and lint for Codex superpowers workflows"
```

Update `interface.shortDescription` to:

```json
"Project KB query, ingest, and lint"
```

- [ ] **Step 5: Synchronize visible versions**

Set these fields to the same version string already used by `.claude-plugin/marketplace.json` `metadata.version`:

```text
.claude-plugin/marketplace.json plugins[name=superpowers-memory].version
plugins/superpowers-memory/.claude-plugin/plugin.json version
codex-plugins/superpowers-memory/.codex-plugin/plugin.json version
codex-plugins/superpowers-memory/codex-hooks-snippet.json version
```

Use:

```bash
NEXT="$(jq -r '.metadata.version' .claude-plugin/marketplace.json)"
jq --arg v "$NEXT" '(.plugins[] | select(.name == "superpowers-memory") | .version) = $v' .claude-plugin/marketplace.json > /tmp/marketplace.json
cp /tmp/marketplace.json .claude-plugin/marketplace.json
jq --arg v "$NEXT" '.version = $v' plugins/superpowers-memory/.claude-plugin/plugin.json > /tmp/claude-memory.json
cp /tmp/claude-memory.json plugins/superpowers-memory/.claude-plugin/plugin.json
jq --arg v "$NEXT" '.version = $v' codex-plugins/superpowers-memory/.codex-plugin/plugin.json > /tmp/codex-memory.json
cp /tmp/codex-memory.json codex-plugins/superpowers-memory/.codex-plugin/plugin.json
jq --arg v "$NEXT" '.version = $v' codex-plugins/superpowers-memory/codex-hooks-snippet.json > /tmp/codex-memory-hooks.json
cp /tmp/codex-memory-hooks.json codex-plugins/superpowers-memory/codex-hooks-snippet.json
```

- [ ] **Step 6: Verify metadata synchronization**

Run:

```bash
jq -r '.metadata.version' .claude-plugin/marketplace.json
jq -r '.plugins[] | select(.name=="superpowers-memory") | .version' .claude-plugin/marketplace.json
jq -r '.version' plugins/superpowers-memory/.claude-plugin/plugin.json
jq -r '.version' codex-plugins/superpowers-memory/.codex-plugin/plugin.json
jq -r '.version' codex-plugins/superpowers-memory/codex-hooks-snippet.json
```

Expected: all five commands print the same version string.

- [ ] **Step 7: Commit docs and metadata**

Run:

```bash
git add plugins/superpowers-memory/README.md codex-plugins/superpowers-memory/README.md .claude-plugin/marketplace.json plugins/superpowers-memory/.claude-plugin/plugin.json codex-plugins/superpowers-memory/.codex-plugin/plugin.json codex-plugins/superpowers-memory/codex-hooks-snippet.json
git commit -m "memory: document query ingest lint surface"
```

---

### Task 9: Final Verification

**Files:**
- All files changed in Tasks 1-8

- [ ] **Step 1: Run focused checks**

Run:

```bash
bash scripts/release/test/test_memory_skill_surface.sh
bash scripts/release/test/test_memory_verify.sh
bash scripts/release/test/test_detect-changed-plugins.sh
bash scripts/release/test/test_bump-versions.sh
bash scripts/release/test/test_integration.sh
```

Expected: all commands PASS.

- [ ] **Step 2: Run full release test suite**

Run:

```bash
bash scripts/release/test/run-tests.sh
```

Expected: summary reports `0 failed`.

- [ ] **Step 3: Check JavaScript syntax**

Run:

```bash
node --check plugins/superpowers-memory/hooks/hook-runtime.js
node --check codex-plugins/superpowers-memory/hooks/codex-runtime.js
```

Expected: both commands exit 0 with no syntax errors.

- [ ] **Step 4: Review final diff**

Run:

```bash
git diff --stat HEAD
git diff --check
```

Expected: only intended implementation files are modified; `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Commit any remaining verified changes**

If `git status --short` shows intended unstaged implementation files after the previous task commits, run:

```bash
git add .claude-plugin/marketplace.json plugins/superpowers-memory codex-plugins/superpowers-memory scripts/release
git status --short
git commit -m "memory: align project knowledge with query ingest lint"
```
