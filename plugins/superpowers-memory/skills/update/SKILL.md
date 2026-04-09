---
name: update
description: Use after completing a development branch or when prompted by Stop hook — incrementally updates project knowledge base from recent changes
---

# Update Project Knowledge

Incrementally update the project knowledge base based on changes from the current iteration.

**Announce at start:** "I'm updating the project knowledge base."

## Prerequisites

- `docs/project-knowledge/` must exist. If not, tell the user to run `superpowers-memory:rebuild` first.

## Process

### 1. Gather context

- Read existing knowledge files from `docs/project-knowledge/`. If fewer than 6 files exist (e.g., `glossary.md` missing from older versions), note which files are missing — they will be created during this update if relevant content is found, otherwise skipped.
- Identify the most recent plan file: list `docs/superpowers/plans/` sorted by modification time and pick the most recently modified file. If there are multiple files modified within the last 24 hours or no plan files exist, ask the user which plan triggered this update.
- Read the triggering plan file and its associated spec (from `docs/superpowers/specs/`)
- Determine the base branch: run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'` and fall back to `main` if the command fails. Then run `git diff <base-branch>...HEAD --stat` to see what files changed.

### 2. Structural change detection

Check for architecture-level changes beyond `git diff --stat`:

- New or deleted top-level module directories
- Changes to dependency injection / module registration files
- Renamed module directories

**If structural changes detected:**
  Warn: "Structural changes detected (new/deleted modules). Incremental update may be insufficient — consider running superpowers-memory:rebuild for a full rescan."
  If user confirms update: fully refresh architecture.md Components section (not just append).

**If no structural changes:** proceed with normal incremental update.

**Deletion awareness:** Check `git diff <base-branch>...HEAD --diff-filter=D --name-only`. If deleted files/modules are still referenced in knowledge files, remove stale references.

### 3. Analyze what changed

- New features implemented? → update `features.md`
- Architecture changed (new modules, changed data flow)? → update `architecture.md`
- New dependencies added? → update `tech-stack.md`
- New conventions established? → update `conventions.md`
- Significant design decisions made? → add ADR to `decisions.md` (Normal 3-line by default; CRITICAL if the decision has a seemingly reasonable but rejected alternative)
- New domain terms introduced? → update `glossary.md`

### 4. Apply updates

- Only modify files that need changes — do not rewrite unchanged files
- Preserve existing content; append or modify specific sections
- Update frontmatter in every modified file:
  - `last_updated`: today's date (YYYY-MM-DD)
  - `updated_by`: `superpowers-memory:update`
  - `triggered_by_plan`: the plan filename that triggered this update (e.g., `2026-03-31-superpowers-memory.md`); if no plan triggered this update, **preserve the existing value — do not overwrite with `null` or `"none"`**

### 4.5. Refresh machine state

Update `docs/project-knowledge/.state.json` alongside the markdown files.

- Preserve `version: 1`
- Update `base_revision` to the current `git rev-parse HEAD` result if available
- Update `generated_at` to the current ISO timestamp
- Update `generated_by` to `superpowers-memory:update`
- For each changed knowledge file, refresh `source_paths` so they reflect the code/doc/spec/plan paths you actually relied on in this update
- Keep unchanged knowledge files' `source_paths` unless you discover they are stale or incomplete
- Prefer repo-relative directories when an entire subtree is the evidence source; prefer single files for precise evidence
- Do NOT infer language-specific defaults; record only actual evidence paths
- If the update used uncommitted changes, set `workspace_dirty: true`

### 5. Abandoned plan cleanup

Check features.md for plans that appear abandoned (no corresponding commits in recent history, superseded by newer plans). If found, ask the user to confirm removal. Remove only after user confirmation.

### 6. Regenerate index.md

Always regenerate `docs/project-knowledge/index.md` in full (full overwrite — any file's key points may have changed):

- Re-read all existing knowledge files (including any you just updated or created)
- Extract 1-2 key points per file that help AI decide whether to load it in full
- Write `docs/project-knowledge/index.md` following the format in `templates/index.md`, setting `updated_by: superpowers-memory:update` and `triggered_by_plan: <plan-filename>`

**Size constraint:** Keep index.md under 50 lines total.

**Legacy cleanup:** If `docs/project-knowledge/MEMORY.md` exists (from an older version), delete it after creating `index.md`.

### 7. Verify (before commit)

Run these checks against updated content. Fix any issues found before committing.

**7a. Path existence:**
Extract file/directory paths referenced in knowledge files (including code locations in glossary.md). Verify each exists with `ls`. Remove or correct stale paths.

**7a.1. State existence and source coverage:**
- Verify `docs/project-knowledge/.state.json` exists
- Verify every `source_paths` entry still exists
- Add missing evidence paths for any knowledge file you updated

**7b. Version consistency:**
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

**7c. Module coverage:**
List actual top-level modules (e.g., `ls internal/` or `ls src/`). Confirm each appears in architecture.md Components section. Flag modules in code but missing from knowledge, or vice versa.

**7d. SSOT spot-check:**
Pick 2-3 concepts appearing in multiple files. Confirm full description only in designated owner file; other files use references only.

### 8. Size guard

Follow the size guard rules in [`content-rules.md`](../../content-rules.md) — check line counts, warn if exceeded, suggest compression actions. Do NOT auto-compress.

### 9. Commit

```bash
git add docs/project-knowledge/
git commit -m "docs: update project knowledge base from [plan-name]"
```

### 10. Report changes

- List which knowledge files were updated and what changed
- Confirm index.md was regenerated
- If no knowledge file updates were needed, still regenerate index.md

## Templates

Knowledge files follow the structure defined in the plugin templates:

- `architecture.md` → Pattern Overview, System Boundaries, Components, Data Flow (Mermaid), Key Design Decisions, + optional sections
- `tech-stack.md` → Flexible: by technology category or system boundary
- `features.md` → Implemented (plan-grouped lists), In Progress, Planned
- `conventions.md` → Naming, Code Style, Error Handling, Architecture Rules, Testing, Git & Workflow, + optional Domain-Specific
- `decisions.md` → Normal ADR (3-line) + CRITICAL ADR (full format), Known Issues
- `glossary.md` → Definition list: `**Term** — Definition. → \`path\``

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and size guard.

## Related Skills

- If `docs/project-knowledge/` does not exist, run `superpowers-memory:rebuild` instead.
- Run `superpowers-memory:load` before brainstorming or architectural work to surface the updated knowledge.
