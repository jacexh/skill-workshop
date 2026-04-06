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

- Read all 6 current knowledge files from `docs/project-knowledge/`
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

### 5. Abandoned plan cleanup

Check features.md for plans that appear abandoned (no corresponding commits in recent history, superseded by newer plans). If found, ask the user to confirm removal. Remove only after user confirmation.

### 6. Regenerate MEMORY.md index

Always regenerate `docs/project-knowledge/MEMORY.md` in full (full overwrite — any file's key points may have changed):

- Re-read all 6 knowledge files (including any you just updated)
- Extract 1-2 key points per file that help AI decide whether to load it in full
- Write `docs/project-knowledge/MEMORY.md` following the format in `templates/MEMORY.md`, setting `updated_by: superpowers-memory:update` and `triggered_by_plan: <plan-filename>`

**Size constraint:** Keep MEMORY.md under 50 lines total.

### 7. Verify (before commit)

Run these checks against updated content. Fix any issues found before committing.

**7a. Path existence:**
Extract file/directory paths referenced in knowledge files (including code locations in glossary.md). Verify each exists with `ls`. Remove or correct stale paths.

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

After applying updates, check line counts. If any file exceeds its threshold, warn the user and suggest specific compression actions. Do NOT auto-compress.

| File | Warning threshold |
|------|------------------|
| architecture.md | 200 |
| conventions.md | 150 |
| decisions.md | 150 |
| tech-stack.md | 120 |
| features.md | 100 |
| glossary.md | 80 |
| MEMORY.md | 50 |

Compression suggestions by file type:
- features.md: collapse old completed iterations into one-line summaries
- decisions.md: non-CRITICAL ADRs beyond 10 entries → merge into Historical section
- architecture.md: remove implementation details, keep module-level only
- conventions.md: remove rules already enforced by formatter/linter config
- tech-stack.md: remove deprecated or no-longer-used dependencies
- glossary.md: merge synonymous entries, remove terms only referenced in one file

### 9. Commit

```bash
git add docs/project-knowledge/
git commit -m "docs: update project knowledge base from [plan-name]"
```

### 10. Report changes

- List which knowledge files were updated and what changed
- Confirm MEMORY.md was regenerated
- If no knowledge file updates were needed, still regenerate MEMORY.md

## Templates

Knowledge files follow the structure defined in the plugin templates:

- `architecture.md` → Pattern Overview, System Boundaries, Components, Data Flow (Mermaid), Key Design Decisions, + optional sections
- `tech-stack.md` → Flexible: by technology category or system boundary
- `features.md` → Implemented (plan-grouped lists), In Progress, Planned
- `conventions.md` → Naming, Code Style, Error Handling, Architecture Rules, Testing, Git & Workflow, + optional Domain-Specific
- `decisions.md` → Normal ADR (3-line) + CRITICAL ADR (full format), Known Issues
- `glossary.md` → Definition list: `**Term** — Definition. → \`path\``

## Content Rules

**Language:** Generate content in the same language as the project's existing documentation (README, specs, plans, code comments). Section headings remain in English for skill parsing compatibility.

**Inclusion principle:** Only include information that requires crossing module/package boundaries to understand, changes only with architectural decisions, and affects understanding of multiple modules.

**Exclusion list — do NOT include:**
- Struct/class field lists — AI should read source code directly
- Enum/constant value mappings — these change with code and go stale
- Method signatures (unless enforcing non-obvious invariants)
- Single-module implementation details
- Information derivable from `git log` or `git blame`

**SSOT:** Each piece of information has one owner file per the ownership matrix in templates. Full content only in the owner; other files reference by pointer ("see ADR-011").

## Related Skills

- If `docs/project-knowledge/` does not exist, run `superpowers-memory:rebuild` instead.
- Run `superpowers-memory:load` before brainstorming or architectural work to surface the updated knowledge.
