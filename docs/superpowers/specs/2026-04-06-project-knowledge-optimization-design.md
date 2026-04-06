# Project Knowledge Base Optimization Design

**Date:** 2026-04-06

**Scope:** Redesign superpowers-memory templates and skills (rebuild/load/update) to fix structural mismatches, eliminate information redundancy, and improve generated knowledge quality.

---

## Problem

Analysis of templates (`plugins/superpowers-memory/templates/`) against a real-world DDD project (`fireman/docs/project-knowledge/`) reveals systemic issues:

### 1. Template-instance structural divergence

Templates guide horizontal organization (Layers / Entry Points / Error Handling), but DDD projects organize vertically by Bounded Context. The fireman instance completely abandoned template structure — `architecture.md` replaced all template sections with domain-specific content. `features.md` abandoned table format for Plan-grouped lists. `decisions.md` collapsed full ADR format into single-line summaries.

### 2. Information redundancy violates Single Source of Truth

Same facts appear in multiple files with no ownership rules:
- "connWriter mutex" → architecture.md, tech-stack.md, decisions.md
- "BootstrapFetcher cross-context" → architecture.md, features.md, decisions.md
- "Redis cache not implemented" → tech-stack.md, features.md

Updates to one file without the others create internal contradictions.

### 3. No content boundary — knowledge files bloat with code-derivable details

`architecture.md` grew to 220 lines, 100+ of which are aggregate root field lists (e.g., `int8: 0=Skill, 1=Hook`) that AI can get by reading one source file. No template or skill defines what should NOT be in the knowledge base.

### 4. ADR format too heavy for AI generation

Template requires 4-section ADR (Context/Decision/Alternatives/Reason). All 17 fireman ADRs collapsed to 1-2 lines. Security-critical ADR-016 (JWT via query param) lost its alternatives and risk analysis.

### 5. Skills lack verification before commit

Both `rebuild` and `update` commit generated content without any validation — stale paths, wrong version numbers, missing modules, and SSOT violations go undetected.

### 6. Staleness detection uses arbitrary 30-day threshold

`load` warns when files are older than 30 days regardless of project activity. A fast-moving project may be stale in a week; a stable project may be fine for months.

---

## Solution

### Part A: Template Redesign

#### A1. Content inclusion/exclusion framework

Add to every template file and to rebuild/update skills:

**Principle:** If AI can get the information by reading 1-2 source files, and that information may change without an architectural decision, it does not belong in the knowledge base.

Evaluation dimensions:
| Dimension | Include | Exclude |
|-----------|---------|---------|
| Retrieval cost | Requires crossing module/package boundaries to understand | Read 1-2 files directly |
| Change frequency | Architecture-level changes only | Every commit may change |
| Cross-module scope | Affects understanding of multiple modules | Local to one module |

Examples of what to EXCLUDE:
- Struct/class field lists
- Enum/constant value mappings
- Method signatures (unless enforcing non-obvious invariants)
- Single-module implementation details

Examples of what to INCLUDE:
- Cross-module relationships requiring cross-boundary understanding
- Constraints not expressed in code
- Decisions and their WHY
- System-level data flows spanning multiple modules

#### A2. architecture.md — universal skeleton + optional sections

New structure:

```markdown
# Architecture

## Pattern Overview
<!-- Architecture paradigm + 2-3 key characteristics. One paragraph. -->

## System Boundaries
<!-- C4 L1: Who/what uses this system? What external services does it depend on? -->

## Components
<!-- C4 L2-L3: Core modules/components.
     DDD: Bounded Context list + responsibilities + aggregate root names
     Layered: Layer responsibilities + locations
     Each component: name, responsibility (1 sentence), location, key abstraction name only.
     Note: location is retained as navigation index, exempt from A1 exclusion rule.
     DO NOT include field lists or method signatures. -->

## Data Flow
<!-- 2-3 core cross-module scenarios using Mermaid sequenceDiagram.
     Only flows spanning 3+ components. -->

## Key Design Decisions
<!-- 3-5 architectural decisions affecting the whole system.
     Summary only — detailed rationale in decisions.md, reference by ADR number. -->

## Entry Points [OPTIONAL]
<!-- File paths of main entry points. ≤10 lines. -->

## Layers [OPTIONAL]
<!-- Layer names + dependency direction. Reference to design pattern docs. ≤10 lines. -->

## Error Handling [OPTIONAL]
<!-- System-level strategy only. Code-level patterns go in conventions.md. -->

## Cross-Cutting Concerns [OPTIONAL]
<!-- Logging, validation, authentication approaches. Only if project-wide. -->
```

Target: ≤200 lines (soft warning).

#### A3. SSOT information ownership matrix

Each piece of information has exactly one owner file. Other files reference by pointer only.

| Information type | Owner file |
|-----------------|------------|
| System boundaries, module responsibilities, cross-module relationships, data flows | architecture.md |
| Languages, frameworks, dependencies, version numbers | tech-stack.md |
| Feature list, implementation status, roadmap | features.md |
| Naming conventions, code style, architecture rules, testing conventions | conventions.md |
| Design decisions (WHY), known issues, tech debt | decisions.md |
| Domain term definitions (Ubiquitous Language) | glossary.md |

Boundary clarification: Bounded Context names and aggregate root names appear in architecture.md (as component identifiers); their business meaning definitions belong in glossary.md.

Cross-reference rule: full content only in owner file; other files use "see ADR-011" or "see architecture.md Components" — never duplicate content.

Add ownership declaration comment at the top of each template file.

Architecture Rules in conventions.md are project-specific constraints only. For general DDD/Clean Architecture rules, reference design-pattern documents — do not duplicate.

#### A4. decisions.md — tiered ADR format

**Tier criterion:** Does this decision have a "seemingly reasonable but rejected alternative"?

**Normal ADR** (default — 3 lines):
```markdown
## ADR-NNN: [Decision Title]
**Decision:** [What was decided, one sentence]
**Why:** [Why this over alternatives, one sentence]
**Trade-off:** [Known cost or limitation. None if none]
```

**CRITICAL ADR** (mark `[CRITICAL]`) — for decisions with non-obvious rejected alternatives:
```markdown
## ADR-NNN: [Decision Title] [CRITICAL]
**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** [What issue motivated this decision]
**Decision:** [What was decided]
**Alternatives Considered:**
- [Alt A]: [why rejected]
- [Alt B]: [why rejected]
**Reason:** [Why current approach was chosen]
**Consequences:** [Positive and negative outcomes, including known risks]
```

Guidelines for AI — mark as CRITICAL when:
- The rejected alternative looks reasonable and AI might re-propose it
- Examples: security trade-offs, DDD principle exceptions, protocol choices with viable alternatives

#### A5. conventions.md — universal skeleton

Remove JS/TS-specific sections (Quotes, Semicolons, Import Organization 4-level breakdown, Path Aliases, Barrel files, JSDoc/TSDoc, Max parameters, Exports).

Retain:
```markdown
# Conventions
## Naming Patterns
## Code Style
  **Formatter:** [tool + config]
  **Linter:** [tool + config]
  <!-- Only style rules that deviate from formatter/linter defaults.
       Principle: if the formatter handles it, don't repeat it here. -->
## Error Handling
## Architecture Rules
## Testing Conventions
  **Framework & command:** [e.g., "go test ./..."]
  **Mock principle:** [what to mock / what NOT to mock]
  **Coverage target:** [e.g., "80% line" or "no formal requirement"]
  <!-- Optional: Fixtures, E2E strategy, performance benchmarks -->
## Git & Workflow
## Domain-Specific Conventions [OPTIONAL]
  <!-- Add sections based on project needs:
       - Database Standards (naming, migrations, indexing)
       - API Standards (routing, versioning, response format)
       - Frontend Standards (component patterns, state management)
       Only add sections with non-obvious, project-specific rules. -->
```

#### A6. features.md — list format with three stages

Replace table format with Plan-grouped lists:

```markdown
# Features

## Implemented
<!-- Group by plan/iteration. Each feature: one line + spec/plan link.
     Only list features non-obvious from codebase structure. -->

### [Plan/Iteration Name]
<!-- Link: [spec](../superpowers/specs/xxx.md) | [plan](../superpowers/plans/xxx.md) -->
- [Feature description]

## In Progress
<!-- Features currently being implemented. -->
### [Plan Name]
<!-- Link: [plan](../superpowers/plans/xxx.md) -->
- [Feature description]

## Planned
<!-- Features with specs but not yet started. -->
- [Feature description] — [spec](../superpowers/specs/xxx.md)
```

Cleanup rule: During `update`, AI identifies plans that appear abandoned (no corresponding commits, superseded by newer plans) and asks the user to confirm removal. Abandoned plans are removed only after user confirmation.

#### A7. glossary.md — new template

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

# Glossary

<!-- Ubiquitous Language: domain terms with code-name mappings.
     Include terms where:
     - The same word means different things in different Bounded Contexts
     - The business meaning is not obvious from the code name
     DO NOT include: standard technical terms (REST, gRPC, JWT),
     terms used only within a single module. -->

**TermName** — Business definition of the term. → `path/to/code/location`
```

Format: definition list (`**Term** — Definition. → \`path\``) for git-diff and AI-generation friendliness.

#### A8. tech-stack.md — flexible organization

Add template comment allowing two organization modes:

```markdown
<!-- Organize by EITHER technology category (Languages / Runtime / Dependencies)
     OR system boundary (Backend / Frontend / Database / Infrastructure).
     Choose whichever fits the project better.
     Core constraint: every technology choice must include version and selection rationale. -->
```

#### A9. MEMORY.md — Key Points redefinition

Change Key Points guidance from "2-3 specific facts" to:

```markdown
Key points: [1-2 facts that help AI decide whether to load this file in full.
             Good: "6 bounded contexts; DDD + Clean Architecture"
             Good: "Go 1.25 + React 19 + K8s"
             Bad: "system architecture information"
             Bad: verbose summaries that duplicate file content]
```

#### A10. frontmatter consistency

Unify `triggered_by_plan` default: `null` (YAML null) everywhere. Fix rebuild skill from `"none"` (string) to `null`.

#### A11. Language rule

Add to rebuild and update skills:

```markdown
**Language:** Generate content in the same language as the project's
existing documentation (README, specs, plans, code comments).
Section headings remain in English for skill parsing compatibility.
```

### Part B: Skill Improvements

#### B1. Verify step (rebuild + update)

Insert before the commit step in both skills:

```markdown
## Verify (before commit)

Run these checks against generated/updated content.
Fix any issues found before committing.

### 1. Path existence
Extract file/directory paths referenced in knowledge files
(including code locations in glossary.md).
Verify each exists with `ls`. Remove or correct stale paths.

### 2. Version consistency
Compare version numbers in tech-stack.md against actual manifests:
- Go: `grep '^go ' go.mod`
- Node: `node -v` or `cat .node-version`
- Key deps: spot-check 2-3 against go.mod / package.json

### 3. Module coverage
List actual top-level modules (e.g., `ls internal/` or `ls src/`).
Confirm each appears in architecture.md Components section.
Flag modules in code but missing from knowledge, or vice versa.

### 4. SSOT spot-check
Pick 2-3 concepts appearing in multiple files.
Confirm full description only in designated owner file;
other files use references only.
```

#### B2. load — git-activity staleness detection

Replace 30-day threshold:

```markdown
## Staleness check

For each knowledge file, read `last_updated` from frontmatter.
Count significant commits since that date:

    git log --oneline --since="<last_updated>" -E --grep="^(feat|refactor)" --no-merges | wc -l

- ≥ 5 significant commits → warn: "⚠ [filename] may be stale —
  N feat/refactor commits since last update on [date].
  Consider running superpowers-memory:update."
- < 5 → no warning
```

#### B3. rebuild — two-phase scan

```markdown
## Scan process

### Phase 1 — General scan
- Read project structure: `ls`, key directories
- Read config files: package.json, go.mod, Cargo.toml, etc.
- Read existing docs: README.md, CLAUDE.md, docs/
- Read specs and plans: docs/superpowers/specs/, plans/
- Check recent history: `git log --oneline -20`

### Phase 2 — Deep scan
Based on Phase 1 findings, identify the project's top-level modules
(directories representing independent functional units). For each module:
- Read the core abstraction file (primary types, interfaces, or entry point)
- Read 2-3 cross-module integration points, prioritizing flows that span 3+ components

Prioritize:
1. Files referenced in README.md or CLAUDE.md
2. Module entry points / registration files
3. Interface or contract definitions (APIs, events, repository interfaces)

Do NOT read: test files, generated code, vendor/node_modules,
migration files, or single-module implementation details.
```

#### B4. update — structural change detection

Insert after gathering context:

```markdown
## Structural change detection

Check for architecture-level changes beyond `git diff --stat`:

- New or deleted top-level module directories
- Changes to dependency injection / module registration files
- Renamed module directories

**If structural changes detected:**
  Warn: "Structural changes detected. Consider running
  superpowers-memory:rebuild for a full rescan."
  If user confirms update: fully refresh architecture.md Components
  (not just append).

**If no structural changes:** normal incremental update.

**Deletion awareness:** Check `git diff --diff-filter=D`.
If deleted files/modules are still referenced in knowledge files,
remove stale references.
```

#### B5. update — size guard (soft warning)

```markdown
## Size guard

After applying updates, check line counts.
If any file exceeds its threshold, warn the user and suggest
specific compression actions. Do NOT auto-compress.

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
```

#### B6. rebuild — pre-check + diff summary

```markdown
## Pre-check (before scanning)

If `docs/project-knowledge/` already exists:
- Read `last_updated` from any knowledge file
- Count significant commits since last update:
  `git log --oneline --since="<last_updated>" -E --grep="^(feat|refactor)" --no-merges | wc -l`
- If < 5 significant commits since last update: warn user
  "Knowledge base was recently updated on [date] with only N feat/refactor
  commits since. Full rebuild will overwrite incremental changes. Continue?"
- Wait for confirmation before proceeding.
  (Note: this uses the same activity-based logic as B2 staleness detection,
  not a hard-coded time threshold.)

## Post-rebuild diff summary (after generating, before commit)

If previous knowledge files existed:
- Output a brief diff summary: which files changed, what was added/removed/modified
- This helps the user verify the rebuild didn't lose important information.
```

---

## Changed Files

| File | Change |
|------|--------|
| `plugins/superpowers-memory/templates/architecture.md` | Rewrite: universal skeleton + optional sections + exclusion comments + SSOT declaration |
| `plugins/superpowers-memory/templates/tech-stack.md` | Add flexible organization comment + SSOT declaration |
| `plugins/superpowers-memory/templates/features.md` | Rewrite: list format, three stages, cleanup rule |
| `plugins/superpowers-memory/templates/conventions.md` | Rewrite: remove JS/TS sections, universal skeleton + optional Domain-Specific area |
| `plugins/superpowers-memory/templates/decisions.md` | Rewrite: tiered ADR format (normal 3-line + CRITICAL full) |
| `plugins/superpowers-memory/templates/glossary.md` | **New file**: domain glossary template |
| `plugins/superpowers-memory/templates/MEMORY.md` | Update Key Points guidance (A9) + add glossary.md entry + fix frontmatter default to null (A10) |
| `plugins/superpowers-memory/skills/rebuild/SKILL.md` | Add Phase 2 scan (B3), Verify step (B1), pre-check + diff summary (B6), exclusion rules (A1), language rule (A11), fix triggered_by_plan to null (A10) |
| `plugins/superpowers-memory/skills/load/SKILL.md` | Replace 30-day threshold with git-activity staleness (B2) |
| `plugins/superpowers-memory/skills/update/SKILL.md` | Add structural change detection (B4), Verify step (B1), size guard (B5), deletion awareness, exclusion rules (A1), language rule (A11), abandoned plan cleanup with user confirmation |

---

## Design Decisions

### Why soft warning for size guard instead of auto-compression?

Auto-compression by AI is a lossy, irreversible operation without human review. While git provides rollback capability, the risk of silently losing valuable domain knowledge outweighs the benefit of automation. Soft warnings keep the human in the loop for destructive decisions.

### Why not hard-code architecture style detection in rebuild Phase 2?

DDD is a methodology, not a framework — there is no standardized directory naming convention. `domain/` could be `model/`, `application/` could be `usecase/`. Hard-coding directory patterns would fail across languages and team conventions. Instead, Phase 2 relies on AI's understanding from Phase 1 to make contextual decisions about what to scan deeply.

### Why definition list format for glossary instead of table?

Tables in Markdown are hard to diff (one-column change rewrites the whole row) and AI frequently produces misaligned tables during generation. Definition list format (`**Term** — Definition. → \`path\``) is one-entry-per-line, making git diffs clean and AI generation reliable.

### Why "rejected reasonable alternative" as the sole CRITICAL ADR criterion?

The purpose of detailed ADR documentation is to prevent AI from re-proposing rejected approaches. If no reasonable alternative was rejected (the decision was obvious), the 3-line format captures everything needed. This criterion is operationally clear for AI to evaluate during generation.
