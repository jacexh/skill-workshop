---
name: rebuild
description: Use when initializing project knowledge for the first time or when knowledge has drifted too far from reality — full codebase scan and knowledge regeneration
---

# Rebuild Project Knowledge

Scan the entire codebase and generate a complete project knowledge base from scratch.

**Announce at start:** "I'm rebuilding the project knowledge base from the codebase."

## When to Use

- First time setting up the knowledge base for a project
- Knowledge base has drifted significantly from reality
- User explicitly requests a full rebuild

## Pre-check

If `docs/project-knowledge/` already exists:
- Read `last_updated` from any knowledge file
- Count commits since last update using two-tier detection (excluding the KB directory itself):
  - Tier 1: `git log --oneline --since="<last_updated>" -E -i --grep="^(feat|refactor)" --no-merges -- . ':!docs/project-knowledge' | wc -l`
  - Tier 2 (if tier 1 = 0): `git log --oneline --since="<last_updated>" --no-merges -- . ':!docs/project-knowledge' | wc -l`
- If tier 1 ≥ 5: proceed without warning (significant changes justify rebuild)
- If tier 1 = 0 AND tier 2 ≥ 20: proceed without warning (many commits justify rebuild)
- Otherwise: warn user
  "Knowledge base was recently updated on [date] with only N commits
  since. Full rebuild will overwrite incremental changes. Continue?"
- Wait for confirmation before proceeding.

## Process

### 1. Phase 1 — General scan

- Read project structure: `ls`, key directories
- Read configuration files: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `Makefile`, `docker-compose.yml`, etc.
- Read existing documentation: `README.md`, `CLAUDE.md`, `docs/` directory
- Read existing specs and plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Check git log for recent development history: `git log --oneline -20`

### 2. Phase 2 — Deep scan

Based on Phase 1 findings, identify the project's top-level modules (directories representing independent functional units). For each module:
- Read the core abstraction file (primary types, interfaces, or entry point)
- Read 2-3 cross-module integration points, prioritizing flows that span 3+ components

Prioritize reading:
1. Files referenced in README.md or CLAUDE.md
2. Module entry points / registration files
3. Interface or contract definitions (APIs, events, repository interfaces)

Do NOT read: test files, generated code, vendor/node_modules, migration files, or single-module implementation details.

### 2a. Exclusion Gate + Single-Owner (before generating files)

Before writing any file:

1. **Exclusion Gate** — for each fact harvested in Phase 2, check against the Exclusion List in `content-rules.md`:
   - No struct / class field lists
   - No enum / constant value catalogs
   - No method signatures (unless the signature IS the cross-cutting invariant)
   - No single-module implementation details
   - No information derivable from git log / git blame (commit SHAs, timestamps, author names)
   - No test counts or test paths in features.md

2. **Single-Owner Principle** — for each fact, pick ONE owner file per the Ownership Matrix:

   | Info type | Owner |
   |-----------|-------|
   | Structure / wiring / data flow | architecture.md |
   | Capability / current behavior | features.md |
   | Decision rationale (WHY) | decisions.md |
   | Dep version + pick rationale | tech-stack.md |
   | Coding / workflow rules | conventions.md |
   | Term definition | glossary.md |
   | Delivery timeline | plan files (NOT KB) |

   Other files get ≤1-line pointers only.

3. **Per-file format rules** (from `content-rules.md`):
   - `decisions.md`: default NORMAL 3-line; CRITICAL only when ≥2 rejected alts AND each has substantive analysis. Supersede entries collapse to 2 lines.
   - `glossary.md`: ≤2 lines per term, one-line definition, 1 path.
   - `features.md`: capability view — current state in 3–6 lines + ADR ref. No SHAs, no test counts, no changelog narrative.
   - `architecture.md`: structure view — modules, wiring, data flow. Not capabilities.

### 3. Generate knowledge files

Create `docs/project-knowledge/` directory if it doesn't exist.

For each of the 6 knowledge files, use the plugin template as the structural basis and fill in concrete content from the codebase analysis:

- **architecture.md** — System boundaries (external actors + dependencies), components (modules/contexts with responsibilities + locations + key abstraction names), data flows (2-3 Mermaid sequenceDiagrams for core cross-module scenarios), key design decisions (summary + ADR reference). Optional sections (Entry Points, Layers, Error Handling, Cross-Cutting Concerns) only if project has them.
- **tech-stack.md** — Languages and frameworks (from config files), key dependencies (from package manifests), build tools (from scripts/Makefile). Organize by technology category or system boundary — whichever fits better.
- **features.md** — Implemented features grouped by plan/iteration (from specs, README, and code), in-progress features (from plans with unchecked items), planned features (from specs without plans).
- **conventions.md** — Coding standards (from linter configs, existing patterns), architecture rules (project-specific only — do not duplicate general DDD/Clean Architecture rules from design-pattern docs), testing conventions (framework, mock principle, coverage target), git workflow. Add Domain-Specific Conventions (DB, API, frontend standards) only if non-obvious project-specific rules exist.
- **decisions.md** — Extract significant decisions from git history, specs, and code comments. Use Normal 3-line format by default. Use CRITICAL format when the decision has a seemingly reasonable but rejected alternative that AI might re-propose.
- **glossary.md** — Domain terms from Ubiquitous Language: terms where the business meaning is not obvious from the code name, or the same word means different things in different contexts. Use definition list format: `**Term** — Definition. → \`path\``

### 4. Set frontmatter

For every generated file:
- `last_updated`: today's date (YYYY-MM-DD)
- `updated_by`: `superpowers-memory:rebuild`
- `triggered_by_plan`: `null`

### 5. Generate index.md

After writing the 6 knowledge files, generate `docs/project-knowledge/index.md`:

- For each of the 6 files, extract 1-2 key points that help AI decide whether to load the file in full (e.g., specific pattern names, version numbers, counts — not generic descriptions)
- Write the file following the format in `templates/index.md`, setting `updated_by: superpowers-memory:rebuild`, `triggered_by_plan: null`, and `covers_branch: <current-branch>` (the output of `git branch --show-current`)

**Size constraint:** Keep index.md under 50 lines total.

**Legacy cleanup:** If `docs/project-knowledge/MEMORY.md` exists (from an older version), delete it after creating `index.md`.

### 6. Verify (before commit)

Run the automated verification script first, then do manual spot-checks:

```bash
node "${CLAUDE_PLUGIN_ROOT:-plugins/superpowers-memory}/hooks/hook-runtime.js" verify
```

The script checks: file size thresholds, stale path references, and git commit readiness. Fix any `staleRefs` or `sizeWarnings` it reports before proceeding.

**Manual checks (on top of automated):**

**6a. Version consistency:**
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

**6b. Module coverage:**
List actual top-level source directories. Confirm each appears in architecture.md Components section. Flag modules in code but missing from knowledge, or vice versa.

**6c. SSOT spot-check:**
Pick 2-3 concepts appearing in multiple files. Confirm full description only in designated owner file; other files use references only.

### 7. Post-rebuild diff summary

If previous knowledge files existed:
- Output a brief diff summary: which files changed, what was added/removed/modified
- This helps the user verify the rebuild didn't lose important information.

### 8. Commit

Check the `committable` field from the step 6 verify output. If `false`, skip the commit — leave files uncommitted and tell the user why (mid-rebase, mid-merge, or detached HEAD).

```bash
git add docs/project-knowledge/
git commit -m "docs: rebuild project knowledge base from codebase"
```

If the commit fails (e.g., pre-commit hook), report the error to the user. Do not retry with `--no-verify`.

**Recovery:** If the rebuild is interrupted before this step, the previous KB can be restored with `git checkout HEAD -- docs/project-knowledge/` (assuming it was committed).

### 9. Report

- Summarize what was generated
- Note any areas where information was sparse or uncertain
- Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and **size guard** (check line counts after generating, warn if exceeded).
