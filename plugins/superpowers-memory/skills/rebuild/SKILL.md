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
- Count significant commits since last update:
  `git log --oneline --since="<last_updated>" -E --grep="^(feat|refactor)" --no-merges | wc -l`
- If < 5 significant commits since last update: warn user
  "Knowledge base was recently updated on [date] with only N feat/refactor
  commits since. Full rebuild will overwrite incremental changes. Continue?"
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

### 5. Generate MEMORY.md index

After writing the 6 knowledge files, generate `docs/project-knowledge/MEMORY.md`:

- For each of the 6 files, extract 1-2 key points that help AI decide whether to load the file in full (e.g., specific pattern names, version numbers, counts — not generic descriptions)
- Write the file following the format in `templates/MEMORY.md`, setting `updated_by: superpowers-memory:rebuild` and `triggered_by_plan: null`

**Size constraint:** Keep MEMORY.md under 50 lines total.

### 6. Verify (before commit)

Run these checks against generated content. Fix any issues found before committing.

**6a. Path existence:**
Extract file/directory paths referenced in knowledge files (including code locations in glossary.md). Verify each exists with `ls`. Remove or correct stale paths.

**6b. Version consistency:**
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

**6c. Module coverage:**
List actual top-level modules (e.g., `ls internal/` or `ls src/`). Confirm each appears in architecture.md Components section. Flag modules in code but missing from knowledge, or vice versa.

**6d. SSOT spot-check:**
Pick 2-3 concepts appearing in multiple files. Confirm full description only in designated owner file; other files use references only.

### 7. Post-rebuild diff summary

If previous knowledge files existed:
- Output a brief diff summary: which files changed, what was added/removed/modified
- This helps the user verify the rebuild didn't lose important information.

### 8. Commit

```bash
git add docs/project-knowledge/
git commit -m "docs: rebuild project knowledge base from codebase"
```

### 9. Report

- Summarize what was generated
- Note any areas where information was sparse or uncertain
- Suggest running `superpowers-memory:update` after the next iteration to keep knowledge fresh

## Content Rules

Follow all rules defined in [`content-rules.md`](../../content-rules.md) — language, inclusion/exclusion, SSOT, quality, and **size guard** (check line counts after generating, warn if exceeded).
