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
