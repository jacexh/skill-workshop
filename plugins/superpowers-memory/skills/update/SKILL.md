---
name: update
description: Use after completing a development branch — incrementally updates project knowledge base from recent changes
---

# Update Project Knowledge

Incrementally update the project knowledge base based on changes from the current iteration.

**Announce at start:** "I'm updating the project knowledge base."

## Prerequisites

- `docs/project-knowledge/` must exist. If not, tell the user to run `superpowers-memory:rebuild` first.

## Process

### 1. Gather context

- Read existing knowledge files from `docs/project-knowledge/`. If fewer than 6 files exist (e.g., `glossary.md` missing from older versions), note which files are missing — they will be created during this update if relevant content is found, otherwise skipped.
- Determine the base branch: run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'` and fall back to `main` if the command fails. Then run `git diff <base-branch>...HEAD --stat` to see what files changed.
- **Plan context (optional):** If `docs/superpowers/plans/` exists and has files, identify the most recent plan file (sorted by modification time). If multiple files were modified within the last 24 hours, ask the user which plan triggered this update. Read the triggering plan and its associated spec from `docs/superpowers/specs/`. If no plan files exist, proceed with `git diff` analysis alone — plan association is not required.

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
- Significant design decisions made? → apply the 3-criteria granularity gate (cross-module scope, ≥2 substantive rejected alternatives, not trivially reversible). Failing any criterion → route to `tech-stack.md` / `conventions.md` / `docs/design/` instead. Passing all three → (a) add 4-line summary entry to `decisions.md` (heading + Decision + Trade-off + pointer to detail); (b) create `docs/project-knowledge/adr/ADR-NNN-<slug>.md` with full Context / Decision / Alternatives Rejected / Consequences. When an existing ADR is superseded → collapse its `decisions.md` entry to the 1-line supersede heading and add `superseded_by: ADR-MMM` to the detail file's frontmatter.
- New domain terms introduced? → update `glossary.md`

### 3a. Exclusion Gate (before writing any new entry)

For EACH new entry about to be written, run this checklist against the entry's content shape:

- [ ] Does the entry pass the Exclusion List in `content-rules.md`? (no struct fields, no enum value catalogs, no method signatures, no single-module implementation detail, nothing derivable from git log)
- [ ] Does the entry fit its per-file format rule?
  - `glossary.md` entry: ≤2 lines, one-line definition, 1 path (+ ADR if applicable)
  - `features.md` entry: capability view (current state, ≤6 lines, ADR-referenced). NO commit SHAs, NO test counts, NO timestamps, NO changelog narrative.
  - New ADR: passes the granularity gate (would a reader without this record re-propose the opposite?). If yes, default to NORMAL 3-line format. CRITICAL only when ≥2 rejected alts AND each has substantive analysis.
  - `architecture.md` entry: structure view (components, wiring, data flow). NOT capability description (that's features.md).

If ANY checklist item fails, either compress the entry to comply OR redirect it to the correct owner file per the Ownership Matrix.

### 3b. Single-Owner Principle

For every piece of information being added, pick ONE owner file per the Ownership Matrix in `content-rules.md`:

| Info type | Owner |
|-----------|-------|
| Structure / wiring / data flow | architecture.md |
| Capability / current behavior | features.md |
| Decision summary (what + trade-off) | decisions.md |
| Decision rationale detail (context, alternatives, consequences) | adr/ADR-NNN-<slug>.md |
| Dep version + pick rationale | tech-stack.md |
| Coding / workflow rules | conventions.md |
| Term definition | glossary.md |
| Delivery timeline | plan files (NOT KB) |

Other files that need to reference this information get a ≤1-line pointer ("see ADR-NNN", "see architecture.md §Components"). Never duplicate the expansion.

### 3c. Existing entry audit

Before writing any new entry, spot-check 2-3 existing entries in each file you will touch against the per-file format rule. If any are in a format forbidden by current `content-rules.md`, list them and rewrite them in Step 4 alongside the new entries. Common patterns to flag:

- **features.md**: entries with commit SHAs, test counts, "shipped YYYY-MM-DD" narrative, "Commits on hotfix/…" blocks, scope-boundary sections
- **decisions.md**: ADRs with full body (Context / Alternatives / Consequences sections) still inline — these should be split so the summary is 4-6 lines and the detail lives in `adr/ADR-NNN-*.md`. ADRs that fail the 3-criteria granularity gate (tool picks, single-rationale convention rules) — route to `tech-stack.md` / `conventions.md`. ADRs marked `Superseded by` but still carrying body content — collapse to the 1-line supersede heading.
- **glossary.md**: entries longer than 2 lines, paragraph-style explanations, method signatures, enum value catalogs
- **conventions.md**: sections describing data flow, component wiring, or sequences of runtime steps (those belong in `architecture.md`)

**v1 decisions.md detection:** if `decisions.md` has >150 lines AND `docs/project-knowledge/adr/` does not exist, the KB is in pre-v1.8 single-file format. Surface this to the user and offer interactive migration — walk through each ADR, apply the granularity gate, split surviving ones into summary + detail, and drop or reroute the rest. Do not auto-migrate silently — the granularity gate needs human judgment on borderline cases.

This step exists because the skill's earlier versions allowed append-only behavior; files accumulated pre-rule entries that never get cleaned up unless this audit runs explicitly.

### 4. Apply updates

- Only modify files that need changes — do not rewrite unchanged files
- Apply the Exclusion Gate (Step 3a) and per-file format rule to **ALL entries in any file you touch, not just new ones**. If an existing entry violates current rules (changelog-shaped features entry, CRITICAL-format ADR without ≥2 substantive rejected alts, multi-line glossary entry, architecture facts inside conventions, etc.), rewrite it to comply in the same update. Do not preserve violations just because they predate the current rules.
- Update frontmatter in every modified file:
  - `last_updated`: today's date (YYYY-MM-DD)
  - `updated_by`: `superpowers-memory:update`
  - `triggered_by_plan`: the plan filename that triggered this update (e.g., `2026-03-31-superpowers-memory.md`); if no plan triggered this update, **preserve the existing value — do not overwrite with `null` or `"none"`**

### 5. Abandoned plan cleanup

Check features.md for plans that appear abandoned (no corresponding commits in recent history, superseded by newer plans). If found, ask the user to confirm removal. Remove only after user confirmation.

### 6. Regenerate index.md

Always regenerate `docs/project-knowledge/index.md` in full (full overwrite — any file's key points may have changed):

- Re-read all existing knowledge files (including any you just updated or created)
- Extract 1-2 key points per file that help AI decide whether to load it in full
- Write `docs/project-knowledge/index.md` following the format in `templates/index.md`, setting `updated_by: superpowers-memory:update`, `triggered_by_plan: <plan-filename>`, and `covers_branch: <current-branch>` (the output of `git branch --show-current`)

**Size constraint:** Keep index.md under 50 lines total.

**Legacy cleanup:** If `docs/project-knowledge/MEMORY.md` exists (from an older version), delete it after creating `index.md`.

### 7. Verify (before commit)

Run the automated verification script first, then do manual spot-checks:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" verify
```

The script checks: file size thresholds, stale path references, content-shape violations, and git commit readiness. Fix any `staleRefs`, `sizeWarnings`, or `shapeViolations` it reports before proceeding. Shape violations must be corrected in-place per the per-file format rule — do not suppress them or leave them for a future pass.

**Manual checks (on top of automated):**

**7a. Version consistency:**
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

**7b. Module coverage:**
List actual top-level source directories. Confirm each appears in architecture.md Components section. Flag modules in code but missing from knowledge, or vice versa.

**7c. SSOT spot-check:**
Pick 2-3 concepts appearing in multiple files. Confirm full description only in designated owner file; other files use references only.

### 8. Size guard

Follow the size guard rules in [`content-rules.md`](../../content-rules.md) — check line counts, warn if exceeded, suggest compression actions. Do NOT auto-compress.

### 9. Commit

Check the `committable` field from the step 7 verify output. If `false`, skip the commit — leave files uncommitted and tell the user why (mid-rebase, mid-merge, or detached HEAD).

```bash
git add docs/project-knowledge/ docs/project-knowledge/adr/
# Use plan name if available, otherwise describe the trigger
git commit -m "docs: update project knowledge base from [plan-name or 'recent changes']"
```

If the commit fails (e.g., pre-commit hook), report the error to the user. Do not retry with `--no-verify`.

**Recovery:** If the update is interrupted before this step, partially updated files are uncommitted and can be discarded with `git checkout -- docs/project-knowledge/`.

### 10. Report changes

- List which knowledge files were updated and what changed
- Confirm index.md was regenerated
- If no knowledge file updates were needed, still regenerate index.md

## Templates

Knowledge files follow the structure defined in the plugin templates:

- `architecture.md` → Pattern Overview, System Boundaries, Components, Data Flow (Mermaid), Key Design Decisions, + optional sections. Components list: name + one-sentence responsibility + path + key abstractions only. No method signatures, no capability descriptions (those belong in `features.md`).
- `tech-stack.md` → Flexible: by technology category or system boundary
- `features.md` → Implemented (**capability-grouped, current state only**), In Progress, Planned. Each capability = one entry describing what the system can do now. Do NOT group by plan/branch/iteration; do NOT include commit SHAs, test counts, "shipped YYYY-MM-DD" timestamps, or scope-boundary blocks.
- `conventions.md` → Naming, Code Style, Error Handling, Architecture Rules, Testing, Git & Workflow, + optional Domain-Specific. Rules only. If a section describes data flow, component wiring, or a sequence of runtime steps, it belongs in `architecture.md`.
- `decisions.md` → **summary only, 4 lines per ADR** (heading + Decision + Trade-off + pointer to detail file). Max 6 non-blank lines per entry. The 3-criteria granularity gate governs what qualifies as an ADR — failing any criterion routes the fact elsewhere. Superseded ADRs collapse to a 1-line heading (no body in the summary).
- `adr/ADR-NNN-<slug>.md` → **full rationale** loaded on demand. One file per ADR: Context / Decision / Alternatives Rejected (paragraph per alt) / Consequences. Target ~100 lines.
- `glossary.md` → Definition list: `**Term** — one-line definition. → \`path\` (ADR-NNN if applicable)`. **≤2 lines per term, hard rule.** No paragraphs, no method signatures, no enum catalogs. If a term needs more context, link to the owner file.

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and size guard.

## Related Skills

- If `docs/project-knowledge/` does not exist, run `superpowers-memory:rebuild` instead.
- Run `superpowers-memory:load` before brainstorming or architectural work to surface the updated knowledge.
