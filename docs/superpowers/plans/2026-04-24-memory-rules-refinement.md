# superpowers-memory Rules Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine `superpowers-memory` plugin's content rules, templates, skills, and verify logic to prevent the three drift categories observed in talgent's KB (size overflow via granularity creep, SSOT breakdown, Exclusion List violations).

**Architecture:** Markdown documents (rules/templates) + Node.js hook runtime + skill Markdown specs. No new framework. Verification is fixture-based integration: each new `verify` check ships with scenario KB directories exercising success + failure paths. All changes scoped to `plugins/superpowers-memory/`.

**Tech Stack:** Node.js (no deps beyond stdlib), Markdown, YAML frontmatter. Git for commits.

**Reference spec:** `docs/superpowers/specs/2026-04-24-memory-rules-refinement-design.md`

---

## File Structure

### Modified
- `plugins/superpowers-memory/content-rules.md` — add ownership matrix, ADR gate, per-file entry rules, token budget, tighten exclusion list
- `plugins/superpowers-memory/templates/decisions.md` — single-question gate + NORMAL default + CRITICAL tightening + 2-line supersede
- `plugins/superpowers-memory/templates/features.md` — rewrite as capability view
- `plugins/superpowers-memory/templates/glossary.md` — ≤2-line rule + tombstone example
- `plugins/superpowers-memory/templates/architecture.md` — add boundary paragraph vs features.md
- `plugins/superpowers-memory/skills/update/SKILL.md` — add Exclusion Gate + Single-Owner steps
- `plugins/superpowers-memory/skills/rebuild/SKILL.md` — mirror
- `plugins/superpowers-memory/hooks/hook-runtime.js` — add ssotCheck, contentShapeLint, totalTokenBudget (all warn-only; no hard committable gate per D6-REJECTED); raise `decisions.md` size threshold from 150 → 300
- `docs/project-knowledge/conventions.md` — document the new rules
- `docs/project-knowledge/decisions.md` — add ADR-009

### Created
- `plugins/superpowers-memory/hooks/fixtures/clean/docs/project-knowledge/*.md` — all checks pass
- `plugins/superpowers-memory/hooks/fixtures/ssot-violation/docs/project-knowledge/*.md` — ssotCheck fires
- `plugins/superpowers-memory/hooks/fixtures/shape-violation/docs/project-knowledge/*.md` — contentShapeLint fires

---

## Task 1: Rewrite `content-rules.md`

**Files:**
- Modify: `plugins/superpowers-memory/content-rules.md` (full rewrite)

- [ ] **Step 1.1: Replace the file with new content**

Write the following to `plugins/superpowers-memory/content-rules.md`:

```markdown
# Content Rules

Shared rules for `rebuild` and `update` skills. Single source of truth for content generation, ownership, format, and size governance.

## Language

Generate content in the same language as the project's existing documentation (README, specs, plans, code comments). Section headings stay in English for skill parsing compatibility.

## Ownership Matrix (SSOT)

Every fact in the KB has exactly one owner file. Other files reference the owner by pointer (≤1 line).

| Info type | Owner | Others reference by |
|-----------|-------|--------------------|
| Structure: components, boundaries, how modules are wired, data flows | `architecture.md` | "see architecture.md §<section>" |
| **Capability: what the system can DO (current state, not history)** | `features.md` | "see features.md §<capability>" |
| Decision rationale (WHY something is the way it is) | `decisions.md` (ADR-NNN) | "see ADR-NNN" |
| Dependency version + selection rationale | `tech-stack.md` | "see tech-stack.md" |
| Coding, workflow, CI rules | `conventions.md` | "see conventions.md §<section>" |
| Domain term definitions | `glossary.md` | "see glossary" |
| Delivery timeline (what shipped when) | `docs/superpowers/plans/<date>-*.md` | plan filename only — do NOT inline changelog in KB |

**Rule:** any claim ≥3 lines appearing in 2+ KB files MUST move to its owner, and the other files get a pointer (≤1 line).

## Per-File Format Rules

### architecture.md — structure view

- Describes how modules/services are wired and talk to each other. **Not** what capabilities exist (that's `features.md`).
- Components list: name + one-sentence responsibility + `path/` + key abstraction names only. No method signatures, no struct fields, no enum value catalogs.
- Data flows: 2–3 Mermaid sequence diagrams for cross-module scenarios (3+ components). Single-module internal flows do NOT belong here.
- Design decision context collapsed to "see ADR-NNN" references; full rationale in `decisions.md`.

### features.md — capability view

Describes **current** capabilities of the system. Each entry = system's current state in 3–6 lines + ADR reference. Past versions are NOT documented (evolution lives in ADR supersede chains).

**Exclusions** (strict):
- Commit SHAs, commit ranges like `abc1234..HEAD`
- Test counts ("95 tests", "18 unit + 3 integration")
- Scope-boundary blocks ("Not in scope: ...")
- Per-iteration changelog narrative ("first shipped as X, then evolved to Y")
- Delivery timestamps ("shipped 2026-04-22")

**Include**:
- What the system can do now (capability name + one-paragraph description)
- Entry point / relevant path
- Key invariants or constraints that shape how it's used
- ADR reference(s) that gate the capability

### decisions.md — ADR log

**Granularity gate** (single question):
> If a future reader (human or AI) did NOT see this record, would they plausibly re-propose the opposite choice?

- YES → record ADR
- NO → not an ADR. If the fact is useful, capture in `conventions.md`; otherwise skip.

**Default format is NORMAL (3 lines)**:

```
## ADR-NNN: [Decision Title]
**Decision:** [What was decided, one sentence]
**Why:** [Why this over alternatives, one sentence]
**Trade-off:** [Known cost or limitation, one sentence. "None" if none]
```

**CRITICAL format** — use ONLY when BOTH conditions met:
1. ≥2 rejected alternatives
2. Each rejected alternative has substantive analysis (not a one-line dismissal)

```
## ADR-NNN: [Title] [CRITICAL]
**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** [Motivating problem]
**Decision:** [What was decided]
**Alternatives Considered:**
- [Alt A]: [substantive analysis of why rejected]
- [Alt B]: [substantive analysis of why rejected]
**Reason:** [Why current approach was chosen]
**Consequences:** [Positive + negative outcomes, known risks]
```

**Supersede format (2 lines)** — when an ADR is superseded, collapse to:

```
## ADR-NNN: Original Title (Superseded by ADR-MMM on YYYY-MM-DD)
**Original:** [one-line summary of what was originally decided]
```

### glossary.md — term dictionary

- **≤ 2 lines per term.** Hard rule.
- Format: `**Term** — one-line business definition. → \`path\` (ADR-NNN if applicable)`
- If a term needs more context, link to `architecture.md` / `decisions.md` — do NOT expand inline.
- **Deleted-term tombstone**: `**Term** — DELETED (ADR-NNN). Replaced by [NewTerm].`

### tech-stack.md

- List 5–10 most critical dependencies. Table form: name + version + purpose + why chosen.
- Skip dependencies that are obvious stdlib / dev-only / transitive.

### conventions.md

- Project-specific rules only. Do NOT duplicate rules enforced by formatter/linter.
- Do NOT duplicate general design-pattern rules (DDD, Clean Architecture, etc.) — reference the pattern doc.

### index.md

- ≤50 lines total.
- Each file: 1-line description + "Key points:" with 1–2 decision-relevant facts that help Claude decide whether to load the file in full.

## Exclusion List (applies to all files)

**NEVER include** — these are Exclusion List violations checked by `verify contentShapeLint`:

- Struct / class field lists (AI reads source code)
- Enum / constant value catalogs (change with code, go stale)
- Method signatures (unless the signature IS the cross-cutting invariant being documented)
- Single-module implementation details
- Information derivable from `git log` or `git blame` (commit SHAs, timestamps, author names)
- Test counts / test file paths in features.md

**Exclusion Gate** — before writing any new entry, run this checklist:

- [ ] Does this content shape pass the Exclusion List above?
- [ ] Does the entry fit the per-file format rule for its owner file?
- [ ] Is the same fact already captured in its owner (per Ownership Matrix) — if so, use a pointer instead?

## Size Guard

Per-file line thresholds (enforced by `verify sizeWarnings` — warn-only, does not block commits):

| File | Warning threshold |
|------|------------------|
| architecture.md | 200 |
| conventions.md | 150 |
| decisions.md | 300 |
| tech-stack.md | 120 |
| features.md | 100 |
| glossary.md | 80 |
| index.md | 50 |

Exceeding threshold → warning in `verify` output + compression suggestion. Commits are NOT blocked; user retains control over whether to compress or accept. `committable` reflects git state only (rebase/merge/detached-HEAD checks).

## Total Token Budget

Per-file caps don't compose. Aggregate check: sum of all KB file bytes / 4 ≈ tokens.

- **Default budget: 20,000 tokens** (approx what a full `load` would inject; ~2% of 1M context).
- Exceed → warning in `verify` output with per-file breakdown. Warn-only; does not block commits.

## Quality

- Factual (verify against codebase; do not speculate).
- Concise (scannable in under 2 minutes per file).
- Structured (follow per-file format rule).
- Linked (file paths, spec files, plan files, ADR numbers).

## Compression Suggestions

When size guard / content-shape warnings fire, suggest specific compression actions:

- `decisions.md` over cap → first check granularity gate on every ADR; most overflow comes from ADRs that shouldn't exist. Next: convert CRITICAL-format ADRs to NORMAL where the CRITICAL conditions are not both met.
- `features.md` over cap → strip changelog blocks, commit SHAs, test counts; reduce each capability to its current-state description.
- `glossary.md` over cap → compress each entry to ≤2 lines; move context to owner file per Matrix.
- `architecture.md` over cap → remove implementation details; keep module-level wiring only.
- `conventions.md` over cap → remove rules already enforced by formatter/linter; remove rules duplicated from design patterns.
- `tech-stack.md` over cap → remove transitive deps; compress to top 5–10.

Do NOT auto-compress — always surface compression as a user decision.
```

- [ ] **Step 1.2: Verify file contents**

Run: `wc -l plugins/superpowers-memory/content-rules.md`
Expected: 130–150 lines (was 50 before). The size increase is intentional — this is the SSOT.

- [ ] **Step 1.3: Commit**

```bash
git add plugins/superpowers-memory/content-rules.md
git commit -m "refactor(superpowers-memory): rewrite content-rules.md with ownership matrix, ADR gate, exclusion gate"
```

---

## Task 2: Rewrite `templates/decisions.md`

**Files:**
- Modify: `plugins/superpowers-memory/templates/decisions.md` (full rewrite)

- [ ] **Step 2.1: Replace file content**

Write to `plugins/superpowers-memory/templates/decisions.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Design decisions (WHY something is the way it is), known issues, tech debt.
     This is the sole owner file for decision rationale.
     Other files reference ADRs by number (e.g., "see ADR-011"); never duplicate full rationale here.

     GRANULARITY GATE (see content-rules.md §decisions.md):
     An ADR is needed only when a future reader (human or AI), without this record,
     would plausibly re-propose the opposite choice. If not, don't write an ADR —
     put the fact in conventions.md or skip it entirely.

     FORMAT DEFAULT IS NORMAL (3 lines). CRITICAL only when BOTH conditions met:
       1. ≥2 rejected alternatives, AND
       2. each rejected alternative has substantive analysis (not one-line dismissal).

     SUPERSEDE: when an ADR is superseded, collapse to the 2-line short format
     (see below). Do NOT leave the original full format in place. -->

# Decisions

## Known Issues

<!-- Living record of known problems. Remove entries when resolved. -->

### Tech Debt

<!-- Format: **[Area]** (`path/to/file`) — description. Fix: approach. -->

### Known Bugs

<!-- Format: **[Bug]** — symptom. Reproduces when: condition. Location: `path/to/file`. -->

### Security Considerations

<!-- Format: **[Risk]** — description. Mitigation: current approach. -->

---

<!-- ADR list below — add new decisions at the top. Do not delete old decisions —
     collapse superseded ones to the 2-line short format. -->

<!--
NORMAL ADR (default — 3 lines):

## ADR-NNN: [Decision Title]
**Decision:** [What was decided, one sentence]
**Why:** [Why this over alternatives, one sentence]
**Trade-off:** [Known cost or limitation. "None" if none]

CRITICAL ADR (use only when BOTH criteria met; see header comment):

## ADR-NNN: [Title] [CRITICAL]
**Date:** YYYY-MM-DD
**Status:** Accepted
**Context:** [What issue motivated this decision]
**Decision:** [What was decided]
**Alternatives Considered:**
- [Alt A]: [substantive analysis of why rejected]
- [Alt B]: [substantive analysis of why rejected]
**Reason:** [Why current approach was chosen]
**Consequences:** [Positive + negative outcomes, including known risks]

SUPERSEDE (2-line collapsed format — replaces original when superseded):

## ADR-NNN: Original Title (Superseded by ADR-MMM on YYYY-MM-DD)
**Original:** [one-line summary of the original decision]
-->
```

- [ ] **Step 2.2: Commit**

```bash
git add plugins/superpowers-memory/templates/decisions.md
git commit -m "refactor(superpowers-memory): tighten decisions template to single-question gate"
```

---

## Task 3: Rewrite `templates/features.md` as capability view

**Files:**
- Modify: `plugins/superpowers-memory/templates/features.md`

- [ ] **Step 3.1: Replace file content**

Write to `plugins/superpowers-memory/templates/features.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Current capabilities of the system — what it can DO.
     This is the capability view. Structure (how modules are wired) lives in architecture.md.

     EACH ENTRY describes the CURRENT state (3–6 lines) + ADR reference.
     Do NOT write evolution history here (that lives in decisions.md supersede chains).
     Do NOT write delivery timestamps (those live in docs/superpowers/plans/).

     EXCLUSIONS (strict — checked by `verify contentShapeLint`):
     - Commit SHAs or commit ranges (e.g., abc1234, bfb1dc1..HEAD)
     - Test counts (e.g., "18 unit tests", "3 integration tests")
     - Scope-boundary blocks ("Not in scope: ...")
     - Per-iteration changelog narrative
     - "Shipped 2026-MM-DD" dates — put in plan filename reference only

     INCLUDE:
     - Capability name (what the system does from outside)
     - One-paragraph description of current state
     - Entry point / relevant path
     - Invariants or constraints shaping usage
     - ADR reference(s) gating the capability -->

# Features

## Current Capabilities

<!-- One section per capability. Group by domain if there are many.

### [Capability Name]

[3–6 lines: what the system can do now, entry point or relevant code path,
key invariants, ADR references. No history, no timestamps, no SHAs, no test counts.]

See also: [ADR-NNN](#), [plan](../superpowers/plans/YYYY-MM-DD-name.md) -->

## In Progress

<!-- Capabilities currently being built. Remove once they land in Current Capabilities. -->

## Planned

<!-- Capabilities with a spec but not yet started. -->

- [Capability name] — [spec](../superpowers/specs/YYYY-MM-DD-name.md)
```

- [ ] **Step 3.2: Commit**

```bash
git add plugins/superpowers-memory/templates/features.md
git commit -m "refactor(superpowers-memory): rewrite features template as capability view (path B)"
```

---

## Task 4: Rewrite `templates/glossary.md` with ≤2-line rule

**Files:**
- Modify: `plugins/superpowers-memory/templates/glossary.md`

- [ ] **Step 4.1: Replace file content**

Write to `plugins/superpowers-memory/templates/glossary.md`:

```markdown
---
last_updated: YYYY-MM-DD
updated_by: superpowers-memory:<skill-name>
triggered_by_plan: null
---

<!-- OWNER: Domain term definitions (Ubiquitous Language).
     Bounded Context names and aggregate root names APPEAR in architecture.md as component identifiers;
     their BUSINESS MEANING DEFINITIONS belong here.

     PER-ENTRY FORMAT (hard rule):
       **Term** — one-line business definition. → `path/to/code` (ADR-NNN if applicable)

     ≤2 LINES PER ENTRY. If more context is needed, link to architecture.md or
     decisions.md. Do NOT expand the definition inline — the glossary stays a dictionary.

     DELETED-TERM TOMBSTONE (when a term is removed or renamed):
       **Term** — DELETED (ADR-NNN). Replaced by [NewTerm].

     INCLUDE terms where:
     - The same word means different things in different Bounded Contexts
     - Business meaning is not obvious from the code name
     - The term maps to a specific code construct (type, interface, module)

     DO NOT include:
     - Standard technical terms (REST, gRPC, JWT, WebSocket, etc.)
     - Terms used only within a single module
     - Struct field lists, enum value catalogs, method signatures (all Exclusion List)

     TARGET: ≤80 lines. -->

# Glossary

**TermName** — One-line business definition. → `path/to/code` (ADR-NNN)

**DeletedTerm** — DELETED (ADR-NNN). Replaced by [NewTerm].
```

- [ ] **Step 4.2: Commit**

```bash
git add plugins/superpowers-memory/templates/glossary.md
git commit -m "refactor(superpowers-memory): enforce ≤2-line rule in glossary template"
```

---

## Task 5: Add boundary paragraph to `templates/architecture.md`

**Files:**
- Modify: `plugins/superpowers-memory/templates/architecture.md:6-18` (the leading OWNER comment block)

- [ ] **Step 5.1: Replace the OWNER comment block**

Find lines 6–18 (the `<!-- OWNER: ... -->` comment block) and replace with:

```markdown
<!-- OWNER: Structure — components, module responsibilities, how modules are wired, data flows.

     BOUNDARY vs features.md:
     - This file describes HOW the system is structured (modules, boundaries, communication).
     - features.md describes WHAT the system can do (capabilities from the outside).
     If you're writing about a capability's user-facing behavior, it belongs in features.md.
     If you're writing about component wiring or data flow, it belongs here.

     Design decision rationale belongs in decisions.md — reference by ADR number only.
     Domain term business definitions belong in glossary.md — use term names only here.

     CONTENT EXCLUSION: Do NOT include information that AI can get by reading 1-2 source files
     and that may change without an architectural decision:
     - Struct/class field lists
     - Enum/constant value mappings (e.g., int8: 0=Skill)
     - Method signatures (unless enforcing non-obvious invariants)
     - Single-module implementation details

     TARGET: ≤200 lines. -->
```

- [ ] **Step 5.2: Commit**

```bash
git add plugins/superpowers-memory/templates/architecture.md
git commit -m "docs(superpowers-memory): clarify architecture.md vs features.md boundary in template"
```

---

## Task 6: Add Exclusion Gate + Single-Owner steps to `update` skill

**Files:**
- Modify: `plugins/superpowers-memory/skills/update/SKILL.md`

- [ ] **Step 6.1: Insert new step "3a" between current step 3 and step 4**

Find the line `### 3. Analyze what changed` — the content under step 3 ends before `### 4. Apply updates`. Insert a new section between them:

```markdown
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
| Decision rationale (WHY) | decisions.md |
| Dep version + pick rationale | tech-stack.md |
| Coding / workflow rules | conventions.md |
| Term definition | glossary.md |
| Delivery timeline | plan files (NOT KB) |

Other files that need to reference this information get a ≤1-line pointer ("see ADR-NNN", "see architecture.md §Components"). Never duplicate the expansion.
```

- [ ] **Step 6.2: Commit**

```bash
git add plugins/superpowers-memory/skills/update/SKILL.md
git commit -m "feat(superpowers-memory): add Exclusion Gate + Single-Owner steps to update skill"
```

---

## Task 7: Mirror the two steps into `rebuild` skill

**Files:**
- Modify: `plugins/superpowers-memory/skills/rebuild/SKILL.md`

- [ ] **Step 7.1: Insert the same gating checklist before "### 3. Generate knowledge files"**

Find the line `### 3. Generate knowledge files` in `plugins/superpowers-memory/skills/rebuild/SKILL.md` and insert BEFORE it:

```markdown
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
```

- [ ] **Step 7.2: Commit**

```bash
git add plugins/superpowers-memory/skills/rebuild/SKILL.md
git commit -m "feat(superpowers-memory): mirror Exclusion Gate + Single-Owner steps to rebuild skill"
```

---

## Task 8: Create `clean` fixture and add `ssotCheck` to hook-runtime.js

**Files:**
- Create: `plugins/superpowers-memory/hooks/fixtures/clean/docs/project-knowledge/{index,architecture,tech-stack,features,conventions,decisions,glossary}.md`
- Create: `plugins/superpowers-memory/hooks/fixtures/ssot-violation/docs/project-knowledge/{architecture,features}.md`
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`

- [ ] **Step 8.1: Create the clean fixture**

Create `plugins/superpowers-memory/hooks/fixtures/clean/docs/project-knowledge/` with 7 minimal files. Content for each:

`index.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
covers_branch: main
---

# Project Knowledge Index

- [architecture.md](architecture.md) — Structure
  Key points: single service, Go
- [tech-stack.md](tech-stack.md) — Dependencies
  Key points: Go 1.26
- [features.md](features.md) — Capabilities
  Key points: one capability
- [conventions.md](conventions.md) — Rules
  Key points: gofmt
- [decisions.md](decisions.md) — ADR log
  Key points: 1 ADR
- [glossary.md](glossary.md) — Terms
  Key points: 1 term
```

`architecture.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Architecture

Single Go service at `cmd/server/`. Handles HTTP requests per ADR-001.
```

`tech-stack.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Tech Stack

- Go 1.26
```

`features.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Current Capabilities

### HTTP API

Serves JSON requests on port 8080. Entry point `cmd/server/main.go`. See ADR-001.
```

`conventions.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Conventions

- gofmt for formatting
```

`decisions.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Decisions

## ADR-001: Use Go
**Decision:** Implement the server in Go 1.26.
**Why:** Team expertise + stdlib HTTP is sufficient.
**Trade-off:** None.
```

`glossary.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Glossary

**Server** — HTTP service entrypoint. → `cmd/server/` (ADR-001)
```

- [ ] **Step 8.2: Create the ssot-violation fixture**

Create 2 files under `plugins/superpowers-memory/hooks/fixtures/ssot-violation/docs/project-knowledge/`:

`architecture.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Architecture

The dispatcher service runs on port 8083 and coordinates executor sessions via Redis ownership directory.
Kafka eventbus publishes cross-BC events with topic equal to the proto full name.
ClickHouse async_insert stores UnifiedMessage rows partitioned by month.
```

`features.md`:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Current Capabilities

### Dispatch
The dispatcher service runs on port 8083 and coordinates executor sessions via Redis ownership directory.
Kafka eventbus publishes cross-BC events with topic equal to the proto full name.
ClickHouse async_insert stores UnifiedMessage rows partitioned by month.
```

(Three identical lines in two files — intentionally triggering ssotCheck.)

- [ ] **Step 8.3: Add `ssotCheck` function to hook-runtime.js**

Edit `plugins/superpowers-memory/hooks/hook-runtime.js`. Locate the `buildVerifyOutput` function (starts around line 178). Before the `return { ok: ..., sizeWarnings, staleRefs, committable }` statement, compute `ssotViolations`:

First, add this helper function near the top of the file (after `relativePath`, before `hookPayload`):

```javascript
function normalizeLine(line) {
  return line
    .toLowerCase()
    .replace(/[`*_#>-]/g, "")        // strip common markdown markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // link text only
    .replace(/https?:\/\/\S+/g, "")  // strip URLs
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim();
}

function ssotCheckKnowledgeBase(files) {
  const WINDOW = 3;
  const MIN_LINE_LEN = 40;
  const windowMap = new Map();

  for (const [filename, content] of files) {
    const lines = content.split("\n")
      .map(normalizeLine)
      .filter((l) => l.length >= MIN_LINE_LEN);

    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const window = lines.slice(i, i + WINDOW).join("\n");
      if (!windowMap.has(window)) {
        windowMap.set(window, new Set());
      }
      windowMap.get(window).add(filename);
    }
  }

  const violations = [];
  for (const [window, fileSet] of windowMap) {
    if (fileSet.size >= 2) {
      violations.push({
        files: [...fileSet].sort(),
        sample: window.split("\n")[0].slice(0, 120),
      });
    }
  }

  return violations;
}
```

Then in `buildVerifyOutput`, after the existing sizeWarnings/staleRefs loops finish (line ~219, just before the `// Git commit readiness` comment), add:

```javascript
  // SSOT check — detect near-duplicate 3-line blocks across KB files
  const fileContents = [];
  for (const filename of Object.keys(sizeThresholds)) {
    const filePath = path.join(knowledgeDir, filename);
    if (fs.existsSync(filePath)) {
      fileContents.push([filename, fs.readFileSync(filePath, "utf8")]);
    }
  }
  const ssotViolations = ssotCheckKnowledgeBase(fileContents);
```

And update the final `return` statement to include `ssotViolations` and adjust `ok`:

```javascript
  return {
    ok: staleRefs.length === 0 && sizeWarnings.length === 0 && ssotViolations.length === 0,
    sizeWarnings,
    staleRefs,
    ssotViolations,
    committable,
  };
```

- [ ] **Step 8.4: Verify ssotCheck against fixtures**

Run against `clean` fixture:
```bash
cd plugins/superpowers-memory/hooks/fixtures/clean && node ../../hook-runtime.js verify
```
Expected: `"ssotViolations": []` in output.

Run against `ssot-violation` fixture:
```bash
cd plugins/superpowers-memory/hooks/fixtures/ssot-violation && node ../../hook-runtime.js verify
```
Expected: `ssotViolations` array with 1+ entry; each entry's `files` contains both `architecture.md` and `features.md`; `sample` shows the shared line.

- [ ] **Step 8.5: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js plugins/superpowers-memory/hooks/fixtures/
git commit -m "feat(superpowers-memory): add ssotCheck to verify (fixture-tested)"
```

---

## Task 9: Create shape-violation fixture and add `contentShapeLint`

**Files:**
- Create: `plugins/superpowers-memory/hooks/fixtures/shape-violation/docs/project-knowledge/{features,glossary,decisions}.md`
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`

- [ ] **Step 9.1: Create the shape-violation fixture**

Create 3 files under `plugins/superpowers-memory/hooks/fixtures/shape-violation/docs/project-knowledge/`:

`features.md` — contains commit SHA and test count:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Features

## Current Capabilities

### Dispatch
Handles dispatch. Shipped in commit `abc1234` through `def5678..HEAD` with 18 unit tests and 3 integration tests.
```

`glossary.md` — contains a multi-line term entry and a method signature:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Glossary

**MessageBus** — A component that routes messages.
It has method `Publish(ctx, msg)` which takes a context and message.
It also has method `Subscribe(ctx) (<-chan Msg, error)` returning a channel.
Used across multiple modules in the dispatcher context for event propagation.

**Server** — HTTP entrypoint. → `cmd/server/`
```

`decisions.md` — must exist but clean:
```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Decisions

## ADR-001: Use Go
**Decision:** Use Go.
**Why:** Team expertise.
**Trade-off:** None.
```

- [ ] **Step 9.2: Add `contentShapeLint` to hook-runtime.js**

Add these helpers near `ssotCheckKnowledgeBase`:

```javascript
const SHA_PATTERN = /\b[0-9a-f]{7,40}\b/;
const TEST_COUNT_PATTERN = /\b\d+\s+(?:unit|integration|e2e|end-to-end|smoke)?\s*tests?\b/i;
const METHOD_SIG_PATTERN = /\b\w+\s*\(\s*ctx\b/;

function lintFeatures(content) {
  const findings = [];
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    if (SHA_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "commit_sha", sample: line.trim().slice(0, 120) });
    }
    if (TEST_COUNT_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "test_count", sample: line.trim().slice(0, 120) });
    }
  });
  return findings;
}

function lintGlossary(content) {
  const findings = [];
  const lines = content.split("\n");

  // Detect entries > 2 lines. A glossary entry starts with **Term** — ...
  let entryStart = -1;
  let entryLineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isEntryStart = /^\*\*[^*]+\*\*\s+—/.test(trimmed);
    const isBlank = trimmed === "";

    if (isEntryStart) {
      if (entryStart >= 0 && entryLineCount > 2) {
        findings.push({
          line: entryStart + 1,
          kind: "glossary_entry_too_long",
          sample: lines[entryStart].trim().slice(0, 120),
        });
      }
      entryStart = i;
      entryLineCount = 1;
    } else if (entryStart >= 0 && !isBlank) {
      entryLineCount++;
    } else if (entryStart >= 0 && isBlank) {
      if (entryLineCount > 2) {
        findings.push({
          line: entryStart + 1,
          kind: "glossary_entry_too_long",
          sample: lines[entryStart].trim().slice(0, 120),
        });
      }
      entryStart = -1;
      entryLineCount = 0;
    }

    if (METHOD_SIG_PATTERN.test(line)) {
      findings.push({ line: i + 1, kind: "method_signature", sample: trimmed.slice(0, 120) });
    }
  }
  // tail
  if (entryStart >= 0 && entryLineCount > 2) {
    findings.push({
      line: entryStart + 1,
      kind: "glossary_entry_too_long",
      sample: lines[entryStart].trim().slice(0, 120),
    });
  }
  return findings;
}

function contentShapeLintKnowledgeBase(files) {
  const violations = [];
  for (const [filename, content] of files) {
    let findings = [];
    if (filename === "features.md") findings = lintFeatures(content);
    else if (filename === "glossary.md") findings = lintGlossary(content);
    // Other files: only method signature lint
    else {
      content.split("\n").forEach((line, i) => {
        if (METHOD_SIG_PATTERN.test(line)) {
          findings.push({ line: i + 1, kind: "method_signature", sample: line.trim().slice(0, 120) });
        }
      });
    }
    for (const f of findings) {
      violations.push({ file: filename, ...f });
    }
  }
  return violations;
}
```

In `buildVerifyOutput`, after `const ssotViolations = ...` line, add:

```javascript
  const shapeViolations = contentShapeLintKnowledgeBase(fileContents);
```

Update `return`:

```javascript
  return {
    ok: staleRefs.length === 0 && sizeWarnings.length === 0 && ssotViolations.length === 0 && shapeViolations.length === 0,
    sizeWarnings,
    staleRefs,
    ssotViolations,
    shapeViolations,
    committable,
  };
```

- [ ] **Step 9.3: Verify against fixtures**

Run against `clean` fixture (same fixture as Task 8):
```bash
cd plugins/superpowers-memory/hooks/fixtures/clean && node ../../hook-runtime.js verify
```
Expected: `"shapeViolations": []`.

Run against `shape-violation` fixture:
```bash
cd plugins/superpowers-memory/hooks/fixtures/shape-violation && node ../../hook-runtime.js verify
```
Expected: `shapeViolations` contains:
- 1 entry for `features.md` with `kind: "commit_sha"` (matching `abc1234`)
- 1 entry for `features.md` with `kind: "test_count"` (matching `18 unit tests`)
- 1 entry for `glossary.md` with `kind: "glossary_entry_too_long"` (for MessageBus)
- 1+ entries for `glossary.md` with `kind: "method_signature"` (`Publish(ctx,` and `Subscribe(ctx)`)

- [ ] **Step 9.4: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js plugins/superpowers-memory/hooks/fixtures/shape-violation/
git commit -m "feat(superpowers-memory): add contentShapeLint to verify (commit SHA, test count, glossary length, method sig)"
```

---

## Task 10: Add `totalTokenBudget` check (warn-only)

**Files:**
- Modify: `plugins/superpowers-memory/hooks/hook-runtime.js`
- Create: `plugins/superpowers-memory/hooks/fixtures/README.md`

**Scope note:** per design decision D6 (REJECTED 2026-04-24), there is NO hard committable gate on size/shape/token violations. `committable` logic stays git-state-only (rebase/merge/detached-HEAD). This task adds only the token budget measurement + warning, AND updates the `decisions.md` size threshold per the design decision in D3.

- [ ] **Step 10.1: Raise `decisions.md` size threshold from 150 → 300**

Locate `buildVerifyOutput` in `plugins/superpowers-memory/hooks/hook-runtime.js` (around line 183). Find the `sizeThresholds` object and change the `decisions.md` value:

Old:
```javascript
    "decisions.md": 150,
```

New:
```javascript
    "decisions.md": 300,
```

- [ ] **Step 10.2: Add `TOKEN_BUDGET` constant and token computation**

In the same `buildVerifyOutput` function, after the `sizeThresholds` declaration, add the token budget constant:

```javascript
  const TOKEN_BUDGET = 20000;
```

After `fileContents` is populated (from Task 8), compute the token budget violation:

```javascript
  const totalBytes = fileContents.reduce((sum, [, content]) => sum + Buffer.byteLength(content, "utf8"), 0);
  const estimatedTokens = Math.ceil(totalBytes / 4);
  const perFileTokens = fileContents.map(([filename, content]) => ({
    file: filename,
    tokens: Math.ceil(Buffer.byteLength(content, "utf8") / 4),
  }));
  const tokenBudgetViolation = estimatedTokens > TOKEN_BUDGET
    ? { estimatedTokens, budget: TOKEN_BUDGET, bytes: totalBytes, perFile: perFileTokens }
    : null;
```

Update the final `return` statement (the one set up in Tasks 8 and 9) to include `tokenBudgetViolation` in both `ok` and the output:

```javascript
  return {
    ok:
      staleRefs.length === 0 &&
      sizeWarnings.length === 0 &&
      ssotViolations.length === 0 &&
      shapeViolations.length === 0 &&
      !tokenBudgetViolation,
    sizeWarnings,
    staleRefs,
    ssotViolations,
    shapeViolations,
    tokenBudgetViolation,
    committable,
  };
```

**Do NOT** modify `committable` computation — it remains git-state-only as in the original hook-runtime.js.

- [ ] **Step 10.3: Verify against `clean` fixture (should NOT trigger)**

```bash
cd plugins/superpowers-memory/hooks/fixtures/clean && node ../../hook-runtime.js verify
```
Expected: `"tokenBudgetViolation": null`, `"ok": true` (assuming no other violations).

The `clean` fixture's total bytes are well under 80,000 (≈ 20K-token threshold), so this check passes trivially.

- [ ] **Step 10.4: Verify against talgent's real KB (should trigger)**

```bash
cd /home/xuhao/talgent && node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js verify 2>/dev/null | node -e "const d = JSON.parse(require('fs').readFileSync(0)); console.log(JSON.stringify(d.tokenBudgetViolation, null, 2));"
```
Expected:
```json
{
  "estimatedTokens": <around 42000-43000>,
  "budget": 20000,
  "bytes": <around 171000>,
  "perFile": [ ... per-file token breakdown ... ]
}
```

This confirms the check fires on the actual drift case that motivated this refactor.

- [ ] **Step 10.5: Create fixtures README**

Create `plugins/superpowers-memory/hooks/fixtures/README.md`:

```markdown
# Verify Fixtures

Each subdirectory is a scenario KB for manually exercising `hook-runtime.js verify` behavior.
`verify` uses `process.cwd()` as the repo root; run from inside the scenario directory.

## Running

```bash
cd plugins/superpowers-memory/hooks/fixtures/<scenario>
node ../../hook-runtime.js verify
```

No git init required — the `committable` field is only meaningful in a real repo, but `verify` does not fail when `committable: false`.

## Scenarios

- **clean/** — minimal valid KB; all checks return empty violations.
- **ssot-violation/** — three identical lines span architecture.md + features.md; triggers `ssotViolations`.
- **shape-violation/** — commit SHA + test count in features.md; multi-line term + method signatures in glossary.md; triggers `shapeViolations`.

For `tokenBudgetViolation` (>20K tokens ≈ >80KB of content), use a real large KB (e.g., `/home/xuhao/talgent/`) rather than a dedicated fixture — mocking 80KB of filler content here has no additional signal over the real-data dry-run in Task 11.
```

- [ ] **Step 10.6: Commit**

```bash
git add plugins/superpowers-memory/hooks/hook-runtime.js plugins/superpowers-memory/hooks/fixtures/README.md
git commit -m "feat(superpowers-memory): add totalTokenBudget warning (20K default) + raise decisions.md size threshold to 300"
```

---

## Task 11: Dry-run against talgent's real KB, document findings

**Files:**
- Create: `plugins/superpowers-memory/hooks/fixtures/README.md` (already created in Task 10)

- [ ] **Step 11.1: Run `verify` against talgent's KB**

```bash
cd /home/xuhao/talgent && node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js verify > /tmp/talgent-verify.json 2>&1
cat /tmp/talgent-verify.json | head -200
```

Expected output will contain:
- `sizeWarnings`: `decisions.md` (472 > 300), `features.md` (319 > 100), `glossary.md` (178 > 80), `conventions.md` at-or-near 150 limit
- `shapeViolations`: many — commit SHAs in features.md, method signatures + >2-line entries in glossary.md
- `ssotViolations`: multiple — Dispatcher-split narrative duplicated across files
- `tokenBudgetViolation`: present — ~43K estimated tokens against 20K budget, with per-file breakdown
- `committable: true` (assuming clean git state — warnings do not block commits by design per D6-REJECTED)
- `ok: false` (because violations are non-empty)

- [ ] **Step 11.2: Capture the findings as evidence**

Append the findings to `docs/superpowers/specs/2026-04-24-memory-rules-refinement-design.md` under a new section `## Evidence: verify run against talgent's real KB (post-plugin-changes)`. Include:

- 5-line summary: which checks fired, how many findings each
- What talgent's KB would need to do to pass verify
- Note: this is one-off evidence, not a regression test — the talgent KB isn't in this repo.

Format:

```markdown
## Evidence: verify run against talgent's real KB (post-plugin-changes)

Running `verify` on `/home/xuhao/talgent/docs/project-knowledge/` after the plugin changes surfaces:

- **sizeWarnings**: N findings (largest: decisions.md 472 / 300 cap post-refinement)
- **shapeViolations**: N findings (commit SHAs in features.md, method sigs in glossary.md, glossary entries >2 lines)
- **ssotViolations**: N findings (Dispatcher-split narrative duplicated across K files)
- **tokenBudgetViolation**: { estimatedTokens ≈ 43000, budget 20000, bytes ≈ 171000, perFile: [...] }
- **committable**: true (warnings are non-blocking per D6-REJECTED)
- **ok**: false

Conclusion: the enriched warning set surfaces exactly the drift categories observed in the design case study. User has a concrete, evidence-backed task list to compress talgent's KB — but retains the choice whether to compress or accept the warnings.
```

- [ ] **Step 11.3: Commit**

```bash
git add docs/superpowers/specs/2026-04-24-memory-rules-refinement-design.md
git commit -m "docs: capture verify evidence from talgent KB dry-run"
```

---

## Task 12: Update skill-workshop's own KB

**Files:**
- Modify: `docs/project-knowledge/conventions.md`
- Modify: `docs/project-knowledge/decisions.md`

- [ ] **Step 12.1: Add new section to `docs/project-knowledge/conventions.md`**

Append this section to the end of `docs/project-knowledge/conventions.md`:

```markdown
## Knowledge Base Content Rules (plugin-enforced)

- **Ownership matrix** — see `plugins/superpowers-memory/content-rules.md`. Each fact has ONE owner file; others reference by pointer (≤1 line).
- **ADR granularity gate** — new ADRs only when a future reader without this record would re-propose the opposite (NORMAL 3-line default; CRITICAL only when ≥2 rejected alts with substantive analysis).
- **`features.md` is capability view** — current state in 3–6 lines + ADR ref. No commit SHAs, test counts, timestamps, changelog narrative.
- **`glossary.md` entries ≤2 lines** — one-line business definition + 1 path.
- **Exclusion Gate** in `update` / `rebuild` skills checks every new entry against the content-shape rules before write.
- **`verify` surfaces** `ssotViolations`, `shapeViolations`, `tokenBudgetViolation` (20K default), and `sizeWarnings`. All warn-only — commits are not blocked (hard gate rejected 2026-04-24 per D6). `committable` reflects git state only.
```

- [ ] **Step 12.2: Add ADR-009 to `docs/project-knowledge/decisions.md`**

Insert at the TOP of the ADR list (after the header lines but before ADR-008):

```markdown
## ADR-009: Plugin-level enforcement of KB content discipline

**Decision:** Add explicit Ownership Matrix, single-question ADR gate, capability-view `features.md`, ≤2-line `glossary.md` rule, Exclusion Gate step in update/rebuild skills, and three new warn-only `verify` checks (`ssotCheck`, `contentShapeLint`, `totalTokenBudget` 20K default). `decisions.md` size cap raised from 150 → 300.
**Why:** User case study (talgent KB) showed pre-existing rules (implied ownership in template comments, Exclusion List never invoked as a skill step, only coarse size warnings) allowed progressive drift across three categories — size overflow via granularity creep, SSOT breakdown, Exclusion List violations. Explicit matrix + gates + richer `verify` warnings give users specific, actionable feedback at update time.
**Trade-off:** No hard enforcement — `verify` stays warn-only, `committable` remains git-state-only. Users retain control over whether to compress or accept warnings. Machine-checkable format rules (especially ≤2-line glossary) will surface legacy patterns as violations; re-shaping legacy KBs happens progressively on subsequent updates, not forced in one shot.

---
```

- [ ] **Step 12.3: Update frontmatter in both files**

Change `last_updated` to `2026-04-24` and set `triggered_by_plan: "2026-04-24-memory-rules-refinement.md"` in both files' YAML frontmatter.

- [ ] **Step 12.4: Regenerate `docs/project-knowledge/index.md`**

Re-read all KB files and regenerate `index.md`:

```markdown
---
last_updated: 2026-04-24
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-24-memory-rules-refinement.md"
covers_branch: main
---

# Project Knowledge Index

- [architecture.md](architecture.md) — System boundaries, components, data flows
  Key points: 3 plugins (superpowers-memory, superpowers-architect, designing-tests); Node.js hook runtime; designing-tests uses three-tier PreToolUse hook across 4 skills; progressive index-first loading

- [tech-stack.md](tech-stack.md) — Languages, frameworks, key dependencies
  Key points: Node.js + Bash + Markdown + JSON; GitHub Actions release workflow

- [features.md](features.md) — Implemented features, in-progress work
  Key points: superpowers-memory v1.5.5 (3 hooks + verify + 3 skills + 7 templates); superpowers-architect v1.5.6 (6 design patterns); designing-tests v1.6.0

- [conventions.md](conventions.md) — Coding standards, architecture rules, workflow
  Key points: hook-runtime.js for superpowers-memory hooks; content-rules.md as SSOT with Ownership Matrix + ADR gate + Exclusion Gate

- [decisions.md](decisions.md) — ADR log (9 ADRs, 0 CRITICAL)
  Key points: ADR-009 plugin-level KB content discipline enforcement; ADR-008 evidence-based staleness; ADR-007 Node.js hook runtime

- [glossary.md](glossary.md) — Domain terminology
  Key points: 5 terms — Knowledge Base, Progressive Loading, Hook Runtime, Evidence Paths, Trigger Skills
```

- [ ] **Step 12.5: Run verify on own KB and confirm it passes**

```bash
cd /home/xuhao/skill-workshop && node plugins/superpowers-memory/hooks/hook-runtime.js verify
```
Expected: `ok: true`, `committable: true`, all violation arrays empty, no tokenBudgetViolation. If any fire, compress the offending content before commit.

- [ ] **Step 12.6: Commit**

```bash
git add docs/project-knowledge/
git commit -m "docs: record KB content discipline rules (ADR-009) in own KB"
```

---

## Final Review Checklist

After all 12 tasks, run this self-review:

- [ ] Re-read spec and confirm every Design Decision (D1–D9) has an implementing task or documented rejection (D6)
- [ ] Run `cd /home/xuhao/skill-workshop && node plugins/superpowers-memory/hooks/hook-runtime.js verify`; must report `ok: true` (fix any violations Task 12.5 surfaces first)
- [ ] Run `cd /home/xuhao/talgent && node /home/xuhao/skill-workshop/plugins/superpowers-memory/hooks/hook-runtime.js verify`; must surface the expected violations (≥3 categories); `committable` should still be `true` per warn-only design
- [ ] Inspect commit log — 12 commits with conventional prefixes (`refactor:`, `feat:`, `docs:`)
- [ ] Confirm no new runtime dependencies added (only Node.js stdlib used in hook changes)
- [ ] Confirm `hook-runtime.js` `committable` logic is unchanged (git-state-only — no size-based gating)

## Out of scope (follow-up for user)

After this plan lands, the user (with Claude's help) can:

1. **Reshape talgent's KB progressively** — run `superpowers-memory:update` on talgent; the new gates will force compression of decisions.md / features.md / glossary.md over the next few iterations.
2. **Revisit caps / budget per project** — current thresholds are global defaults. If a specific project genuinely needs higher caps or token budget, consider a per-project override (e.g., `content-rules.local.md` or env var). Warn-only design means this can wait until the default causes actual friction.
3. **Fuzzy ssotCheck** — current `ssotCheck` uses exact-match after normalization. If talgent's thematic (not textual) duplication is missed, consider shingle-based similarity. Defer until evidence shows exact-match is insufficient.
