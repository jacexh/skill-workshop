---
name: update
description: Use after completing a development branch — incrementally updates project knowledge base from recent changes
---

# Update Project Knowledge

Incrementally update the project knowledge base based on changes from the current iteration.

**Announce at start:** "I'm updating the project knowledge base."

## Prerequisites

- `docs/project-knowledge/` must exist. If not, tell the user to run `superpowers-memory:rebuild` first.
- Resolve `<plugin-root>` from this loaded skill path:

```text
<plugin-root>/skills/update/SKILL.md
```

Do not assume a fixed install directory; Codex marketplace installs commonly live under `~/.codex/plugins/cache/...`.

## Process

### 0. Acquire write lock

`docs/project-knowledge/` is write-protected by a PreToolUse hook. Acquire the lock before any KB edit, otherwise every Write/Edit/MultiEdit on a KB file will be blocked:

```bash
node "<plugin-root>/hooks/codex-runtime.js" lock superpowers-memory:update
```

Lock has a 60-minute TTL — if this skill aborts midway, the lock auto-expires and writes are blocked again.

### 1. Gather context

- Read existing knowledge files from `docs/project-knowledge/`. If fewer than 6 files exist (e.g., `glossary.md` missing from older versions), note which files are missing — they will be created during this update if relevant content is found, otherwise skipped.
- Determine the base branch: run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'` and fall back to `main` if the command fails. Then run `git diff <base-branch>...HEAD --stat` to see what files changed.
- **Plan context (optional):** If `docs/superpowers/plans/` exists and has files, identify the most recent plan file (sorted by modification time). If multiple files were modified within the last 24 hours, ask the user which plan triggered this update. Read the triggering plan and its associated spec from `docs/superpowers/specs/`. If no plan files exist, proceed with `git diff` analysis alone — plan association is not required.
- **Product source context:** Also look for PRDs, roadmaps, or product specs in common project locations such as `docs/roadmaps/`, `docs/prd/`, `docs/product/`, `docs/specs/`, `docs/design/`, and README sections referenced by the triggering plan/spec. Read only the documents that appear to describe the current branch or completed work.

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
- Architecture changes → update `architecture.md` per this decision table (route each change to its specific section; if none match, `architecture.md` doesn't need updating even if other files do):

  | Code change | architecture.md section to update |
  |-------------|-----------------------------------|
  | New / deleted / renamed top-level module, service, or bounded-context directory (by the project's own layout convention — e.g., Go `cmd/`+`internal/`, Java `src/main/java/<pkg>/`, Python top-level package, JS/TS `apps/` or `packages/`) | §Layering |
  | New / changed cross-module call path or event publish-subscribe edge | §Scenario Sequences (revise existing diagram or add a new one) |
  | Aggregate FSM gains / loses a state, or a transition changes which cross-BC event it emits | §Key Object FSMs |
  | New / replaced external infrastructure dependency (database, MQ, cache, external service) | §System Context |
  | Project-wide architectural style change (e.g., monolith → event-driven; new cross-cutting call-direction rule) | §Pattern Overview |

- New dependencies added? → update `tech-stack.md`
- New conventions established? → update `conventions.md`
- Significant design decisions made? → apply the 3-criteria granularity gate (cross-module scope, ≥2 substantive rejected alternatives, not trivially reversible). Failing any criterion → route to `tech-stack.md` / `conventions.md` / `docs/design/` instead. Passing all three → (a) add 4-line summary entry to `decisions.md` (heading + Decision + Trade-off + pointer to detail); (b) create `docs/project-knowledge/adr/ADR-NNN-<slug>.md` with full Context / Decision / Alternatives Rejected / Consequences. When an existing ADR is superseded → collapse its `decisions.md` entry to the 1-line supersede heading and add `superseded_by: ADR-MMM` to the detail file's frontmatter.
- New domain terms introduced? → update `glossary.md`
- Recurring code-change pattern observed? → consider `playbooks.md` + `playbooks/<slug>.md` per the 3-gate rule below

### 3-prime. Playbook candidate detection

After analyzing the branch diff, check whether the changes are an **instance of a recurring class** that warrants a playbook. **Concrete-evidence triggers only — vague "this might recur" is not a trigger.**

- The branch adds a structurally similar artifact to a class that **already exists ≥1 time** in the codebase (e.g., another HTTP endpoint when several already exist; another migration; another service split — this branch makes the total ≥2).
- A spec/plan in `docs/superpowers/specs/` or `docs/superpowers/plans/` contains an **explicit directive** to extract a reusable recipe (e.g., "next time we do X, follow these steps", "to add another Y, see this section"). Mere mention of future iteration ("this will probably happen again") does NOT count.

If a trigger fires, apply the 3-gate rule (see content-rules.md):

1. **Recurrence:** has this class of change happened ≥2 times (counting this one) **OR** does a spec/plan carry an explicit "do it this way next time" directive? Forward-looking intuition alone fails this gate.
2. **Multi-step cross-file:** does the recipe span ≥3 cross-file or cross-module actions?
3. **Non-obvious:** would a fresh contributor stumble without the recipe?

All three pass → write or update:
- A 1-line entry in `playbooks.md` index (create the index file if absent).
- A detail file at `docs/project-knowledge/playbooks/<slug>.md` following `templates/playbook-detail.md`.

Any gate fails → route as:
- One-off change → spec/plan stays in `docs/superpowers/`, no playbook.
- Single rule → add a line to `conventions.md` instead.
- Rationale only → add to `decisions.md` / `adr/` instead.

When updating an existing playbook (the recipe changed because code evolved), re-verify all `Steps` paths against current code before editing. Do not append "edit history" inside the playbook — the playbook describes the **current** correct recipe.

### 3a. Feature Capability Reconciliation

Before writing `features.md`, reconcile source requirements against the current capability map:

1. Extract capability candidates from the triggering plan/spec plus any relevant PRD, roadmap, product spec, README, and user-facing entry points. Prefer source terms that name product/business concepts and user-visible operations.
2. For each candidate, classify it as:
   - `Implemented` → write or update a `####` capability entry with `Enables`, `Actors / Entry Points`, `Capability Boundary`, and `References`.
   - `In Progress` → write a concise `Intent` + `Source` entry.
   - `Planned` → write a concise `Intent` + `Source` entry.
   - `Not a features.md entry` → route to `architecture.md`, `decisions.md`, `tech-stack.md`, `conventions.md`, `glossary.md`, or the plan file per the Ownership Matrix.
3. Preserve use-shaping product constraints in `Capability Boundary` when they change how users/operators experience the capability. Examples: one Issue can have at most one Work, Artifact is latest-only, a plugin requiring config is visible but unavailable for launch, global reports are deferred.
4. Assign implemented entries to the canonical group order from `content-rules.md`: `Product Capabilities`, `User / Operator Workflows`, `Platform Capabilities`, `Operations`. If a capability can be described in stable product language, place it in `Product Capabilities` before considering workflow or platform groups.
5. Do not convert the capability list into a runtime component inventory. Technical capabilities are valid only when they are platform/operator capabilities in their own right.
6. In the update report, mention important source capability candidates that were intentionally not represented in `features.md` and where they were routed.

### 3b. Exclusion Gate (before writing any new entry)

For EACH new entry about to be written, run this checklist against the entry's content shape:

- [ ] Does the entry pass the Exclusion List in `content-rules.md`? (no struct fields, no enum value catalogs, no method signatures, no single-module implementation detail, nothing derivable from git log)
- [ ] Does the entry fit its per-file format rule?
  - `glossary.md` entry: ≤2 lines, one-line definition, 1 path (+ ADR if applicable)
  - `features.md` entry: current capability map. Use `###` capability groups and `####` capability entries with fixed fields (`Enables`, `Actors / Entry Points`, `Capability Boundary`, `References`). NO long single-paragraph entries, commit SHAs, test counts, timestamps, or changelog narrative.
  - New ADR: passes the granularity gate (would a reader without this record re-propose the opposite?). If yes, default to NORMAL 3-line format. CRITICAL only when ≥2 rejected alts AND each has substantive analysis.
  - `architecture.md` entry: structure view (components, wiring, data flow). NOT capability description (that's features.md).

If ANY checklist item fails, either compress the entry to comply OR redirect it to the correct owner file per the Ownership Matrix.

### 3c. Single-Owner Principle

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

### 3d. Existing entry audit

Before writing any new entry, spot-check 2-3 existing entries in each file you will touch against the per-file format rule. If any are in a format forbidden by current `content-rules.md`, list them and rewrite them in Step 4 alongside the new entries. Common patterns to flag:

- **features.md**: entries with commit SHAs, test counts, "shipped YYYY-MM-DD" narrative, "Commits on hotfix/…" blocks, scope-boundary sections, or dense single-paragraph capability entries that should be split into `####` entries with fixed fields
- **decisions.md**: ADRs with full body (Context / Alternatives / Consequences sections) still inline — these should be split so the summary is 4-6 lines and the detail lives in `adr/ADR-NNN-*.md`. ADRs that fail the 3-criteria granularity gate (tool picks, single-rationale convention rules) — route to `tech-stack.md` / `conventions.md`. ADRs marked `Superseded by` but still carrying body content — collapse to the 1-line supersede heading.
- **glossary.md**: entries longer than 2 lines, paragraph-style explanations, method signatures, enum value catalogs
- **conventions.md**: sections describing data flow, component wiring, or sequences of runtime steps (those belong in `architecture.md`)
- **architecture.md**: entries carrying (a) implementation constants (port numbers, timeout values, keepalive settings, TTLs); (b) env var names, Redis key templates, HTTP header names; (c) FSM state names inlined as prose lists rather than Mermaid `stateDiagram-v2` with trigger + emitted-event labels; (d) capability descriptions that duplicate `features.md` entries; (e) missing required sections per the per-file format rule (Pattern Overview / System Context / Layering / Scenario Sequences / Key Object FSMs / Key Design Decisions); (f) §Layering as a flat bullet list when the project has ≥3 independent top-level modules (deploy units / services / major packages) — should use per-module `####` subsections capped at 3 lines each. Remediation: move (a) to `tech-stack.md` or drop; move (b) to `conventions.md` / `glossary.md`; reshape (c) as stateDiagram-v2 with `state_a --> state_b: Trigger / emits Event` labels; replace (d) with `"see features.md §..."` pointers; add (e) if the project genuinely has that dimension (e.g., skip §Key Object FSMs if the project has no aggregates with cross-BC state transitions — but declare this explicitly rather than silently omitting); restructure (f) into `####` subsections per the architecture.md granularity rule.
- **conventions.md**: missing or stale `## Cross-cutting concerns` section. Audit the codebase for middlewares/decorators imported across many files, broadly-imported utility modules, CI-enforced cross-file checks. If concerns exist, the section MUST list them as `**<topic>:** <one-line rule> → \`<canonical impl path>\``. If the project has none (pure library, plugin/skill repo, docs site), the section MUST contain `N/A: <reason>` rather than being absent.
- **playbooks.md** (if present): entries that no longer correspond to a real recipe (referenced path/module gone), entries that fail the 3-gate rule on re-audit (one-off retroactively, single-file recipe, derivable from code now), entries whose `When:` trigger is too vague to scan. Remediation: delete the index line and the detail file together; or compress the detail file in place if the recipe still applies but has drifted from current code.

**v1 decisions.md detection:** if `docs/project-knowledge/adr/` does not exist AND `decisions.md` carries ADR bodies beyond the summary shape (sections like `**Context:**`, `**Alternatives Rejected:**`, or `**Consequences:**` under any `## ADR-` heading), the KB is in pre-v1.8 single-file format. Surface this to the user and offer interactive migration — walk through each ADR, apply the granularity gate, split surviving ones into summary + detail, and drop or reroute the rest. Do not auto-migrate silently — the granularity gate needs human judgment on borderline cases.

This step exists because the skill's earlier versions allowed append-only behavior; files accumulated pre-rule entries that never get cleaned up unless this audit runs explicitly.

### 4. Apply updates

- Only modify files that need changes — do not rewrite unchanged files
- Apply Feature Capability Reconciliation (Step 3a), the Exclusion Gate (Step 3b), and the per-file format rule to **ALL entries in any file you touch, not just new ones**. If an existing entry violates current rules (changelog-shaped features entry, missing implemented feature fields, CRITICAL-format ADR without ≥2 substantive rejected alts, multi-line glossary entry, architecture facts inside conventions, etc.), rewrite it to comply in the same update. Do not preserve violations just because they predate the current rules.
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
- Write `docs/project-knowledge/index.md` following the format in `templates/index.md`, setting `updated_by: superpowers-memory:update`, `triggered_by_plan: <plan-filename>`, and `covers_branch: <branch>@<short-sha>` where `<branch>` is the output of `git branch --show-current` and `<short-sha>` is the output of `git rev-parse --short HEAD` (e.g., `covers_branch: hotfix-auth@a1b2c3d`). The SHA anchor ensures the finishing-a-development-branch guard detects new commits added after this update. The hook resolves short SHAs via `git rev-parse`, so any length git produces is acceptable.

**Size constraint:** Keep index.md under 50 lines total.

**Legacy cleanup:** If `docs/project-knowledge/MEMORY.md` exists (from an older version), delete it after creating `index.md`.

### 7. Verify (before commit)

Run the automated verification script first, then do manual spot-checks:

```bash
node "<plugin-root>/hooks/codex-runtime.js" verify
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
git add docs/project-knowledge/
# Use plan name if available, otherwise describe the trigger
git commit -m "docs: update project knowledge base from [plan-name or 'recent changes']"
```

Staging the directory root recursively picks up `adr/`, `playbooks/`, and all KB files. Do not list subdirectories explicitly — a literal pathspec that doesn't exist makes `git add` fail with `fatal: pathspec ... did not match any files`.

If the commit fails (e.g., pre-commit hook), report the error to the user. Do not retry with `--no-verify`.

**Recovery:** If the update is interrupted before this step, partially updated files are uncommitted and can be discarded with `git checkout -- docs/project-knowledge/`.

### 10. Report changes

- List which knowledge files were updated and what changed
- Confirm index.md was regenerated
- If no knowledge file updates were needed, still regenerate index.md

### 11. Release write lock

```bash
node "<plugin-root>/hooks/codex-runtime.js" unlock
```

Always run this — even if the commit in Step 9 failed or earlier steps surfaced errors. Releasing the lock is courtesy cleanup; the 60-minute TTL is the safety net if the skill aborts before reaching this step.

## Templates

Knowledge files follow the structure defined in the plugin templates:

- `architecture.md` → Pattern Overview (paradigm + 2–3 key characteristics, 1 paragraph), System Context (external actors + external systems, ≤10 lines), Layering (BCs/layers with responsibility + path + key abstractions, call-direction rules), Scenario Sequences (2–3 Mermaid `sequenceDiagram` for cross-module flows), Key Object FSMs (Mermaid `stateDiagram-v2` with trigger + emitted-event labels), Key Design Decisions (pointer list to ADRs only). No implementation constants (ports, timeouts, TTLs), no env var names, no HTTP header names, no prose FSM state lists, no capability descriptions (those belong in `features.md`).
- `tech-stack.md` → Flexible: by technology category or system boundary
- `features.md` → Current capability map. First reconcile PRD/roadmap/spec/plan capability candidates against current implementation status. Use `## Implemented` / `## In Progress` / `## Planned`; implemented `###` groups follow this order when content exists: `Product Capabilities`, `User / Operator Workflows`, `Platform Capabilities`, `Operations`; `####` individual capabilities use fixed fields: `Enables`, `Actors / Entry Points`, `Capability Boundary`, `References`. Do NOT group by plan/branch/iteration; do NOT include commit SHAs, test counts, "shipped YYYY-MM-DD" timestamps, scope-boundary blocks, or long single-paragraph entries.
- `conventions.md` → Naming, Code Style, Error Handling, Architecture Rules, Testing, Git & Workflow, + optional Domain-Specific. Rules only. If a section describes data flow, component wiring, or a sequence of runtime steps, it belongs in `architecture.md`.
- `decisions.md` → **summary only, 4 lines per ADR** (heading + Decision + Trade-off + pointer to detail file). Max 6 non-blank lines per entry. The 3-criteria granularity gate governs what qualifies as an ADR — failing any criterion routes the fact elsewhere. Superseded ADRs collapse to a 1-line heading (no body in the summary).
- `adr/ADR-NNN-<slug>.md` → **full rationale** loaded on demand. One file per ADR: Context / Decision / Alternatives Rejected (paragraph per alt) / Consequences. Target ~100 lines.
- `glossary.md` → Definition list: `**Term** — one-line definition. → \`path\` (ADR-NNN if applicable)`. **≤2 lines per term, hard rule.** No paragraphs, no method signatures, no enum catalogs. If a term needs more context, link to the owner file.
- `playbooks.md` + `playbooks/<slug>.md` (lazy slot) → Index file lists `- [<Verb-led title>](playbooks/<slug>.md) — When: <trigger>`. Detail files follow `templates/playbook-detail.md`: Preconditions / Steps / Verification / Pitfalls / References. Create only when the 3-gate rule passes (recurrence ≥2; ≥3 cross-file actions; non-obvious). Omit entirely if no recipes qualify.

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and size guard.

## Related Skills

- If `docs/project-knowledge/` does not exist, run `superpowers-memory:rebuild` instead.
- Run `superpowers-memory:load` before brainstorming or architectural work to surface the updated knowledge.
