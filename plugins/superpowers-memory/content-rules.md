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
| **Decision summary** (what was decided + one-line trade-off) | `decisions.md` (ADR-NNN) | "see ADR-NNN" |
| **Decision rationale detail** (context, rejected alternatives, consequences) | `docs/project-knowledge/adr/ADR-NNN-<slug>.md` | "see adr/ADR-NNN-*.md" |
| Dependency version + selection rationale | `tech-stack.md` | "see tech-stack.md" |
| Coding, workflow, CI rules | `conventions.md` | "see conventions.md §<section>" |
| Domain term definitions | `glossary.md` | "see glossary" |
| Delivery timeline (what shipped when) | `docs/superpowers/plans/<date>-*.md` | plan filename only — do NOT inline changelog in KB |

**Rule:** any claim ≥3 lines appearing in 2+ KB files MUST move to its owner, and the other files get a pointer (≤1 line).

## Per-File Format Rules

### architecture.md — structure view

Describes how modules/services are wired, how they interact over time, and how core aggregates transition. **Not** what capabilities exist (that's `features.md`).

**Required sections (in order):**

1. **Pattern Overview** — architecture paradigm + 2–3 key characteristics, one paragraph. Elevator pitch for a cold reader.
2. **System Context** — external actors + external systems (databases, MQ, external services). List form, ≤10 lines. Enumerate, don't narrate.
3. **Layering** — architectural layers or bounded contexts. For each: name + one-sentence responsibility + `path/` + key abstraction names only. State call-direction rules at the end of the section. No method signatures, no struct fields, no enum value catalogs.
4. **Scenario Sequences** — 2–3 Mermaid `sequenceDiagram` for cross-module flows of 3+ components. Single-module internal flows do NOT belong here.
5. **Key Object FSMs** — Mermaid `stateDiagram-v2` for aggregates whose transitions cross module boundaries (typically via cross-BC event emission). **Must be rendered as transition diagrams with trigger + emitted-event labels, not bullet lists of state names.** Bullet-list FSM enumerations are Exclusion List violations — they duplicate what code owns without capturing the cross-BC contract that makes the FSM architectural.
6. **Key Design Decisions** — pointer list only, 3–5 entries in the form `**[title]** — see ADR-NNN`. Full rationale lives in `decisions.md` + `adr/ADR-NNN-*.md` — never expand inline here.

**architecture.md Exclusion List (in addition to the global Exclusion List):**

| Pattern | Goes to |
|---------|---------|
| Implementation constants (ports, timeout values, TTLs, keepalive settings) | `tech-stack.md` or code |
| Env var names, Redis key templates, HTTP header names | `conventions.md` or `glossary.md` |
| FSM state names inlined as prose lists (`"states: a / b / c / d"`) | reshape as Mermaid `stateDiagram-v2` |
| Capability descriptions (what a component does for a user) | `features.md`; here use `"see features.md §..."` pointer |
| Full ADR rationale (Context / Alternatives / Consequences) | `decisions.md` summary + `adr/ADR-NNN-*.md` |

### features.md — current capability map

Describes **what the system can do now**. It is the current capability map for humans and agents: readers should understand the implemented capabilities, who or what uses them, where to enter the system, and which owner file to load next. Past versions are NOT documented (evolution lives in ADR supersede chains and plan files).

**Product-source rule:** When PRDs, roadmaps, specs, or plans exist, extract their user goals, business objects, actions, and use-shaping constraints as capability candidates before summarizing implementation paths. Product-facing capabilities should keep the source language where it is stable (for example "Issue-bound Work", "Plugin Marketplace", "Attachment", "Artifact", "Project Dashboard"). Do not let technical runtime components replace product capabilities; use technical groups only for platform/operator capabilities that are not product-facing.

**Relationship to other KB files:**

| Question | Owner |
|----------|-------|
| What can the system do now? | `features.md` |
| How are modules wired and how do flows cross components? | `architecture.md` |
| Why was the design chosen? | `decisions.md` + `adr/` |
| Which technologies and versions are used? | `tech-stack.md` |
| Which contribution/runtime rules must be followed? | `conventions.md` |
| What does a domain term mean? | `glossary.md` |

**Required structure:**

```markdown
## Implemented

### [Capability Group]

#### [Capability Name]

**Enables** — [1-2 sentences: externally meaningful current capability.]

**Actors / Entry Points** — [users, services, routes, RPCs, CLIs, or code paths.]

**Capability Boundary** — [what this capability covers from a user/system perspective; point implementation structure to architecture.md.]

**References** — [architecture section, ADRs, specs/plans if useful.]

## In Progress

### [Capability Group]

#### [Capability Name]

**Intent** — [1 sentence.]
**Source** — [plan/spec pointer.]

## Planned
```

**Grouping rules:**

- Use `##` only for lifecycle state: `Implemented`, `In Progress`, `Planned`.
- For `## Implemented`, use these `###` groups in this order when content exists:
  1. `Product Capabilities` — product-facing abilities named by users, PRDs, roadmaps, specs, or business workflows.
  2. `User / Operator Workflows` — cross-capability flows and operational actions that users/operators perform end to end.
  3. `Platform Capabilities` — system/platform abilities needed to understand runtime boundaries, integration, messaging, observability, or extension points.
  4. `Operations` — deployment, configuration, CI/CD, test infrastructure, and runbook-facing capabilities.
- Use `####` for individual capabilities.
- If a capability can be described in stable product language, put it under `Product Capabilities` before considering workflow or platform groups. Do not split one product capability into several technical component entries merely because the implementation crosses services.
- Technical platform groups are allowed, but must not replace product-facing capability entries.
- Do not use `#####` unless the user explicitly asks for deeper local detail.

**Entry rules:**

- Each implemented capability should use the fixed fields above. Keep each field to 1–3 lines.
- Each implemented `####` capability must include all fixed fields: `Enables`, `Actors / Entry Points`, `Capability Boundary`, and `References`. `verify` reports `feature_missing_field` when any field is absent.
- Long single-paragraph entries are forbidden. If a capability needs more than one short paragraph, split it into the fixed fields.
- `features.md` may mention key constraints that shape use of the capability, but detailed wiring, FSM diagrams, event flows, schema details, and implementation constants belong in owner files.

**Exclusions** (strict):
- Commit SHAs, commit ranges like `abc1234..HEAD`
- Test counts ("95 tests", "18 unit + 3 integration")
- Scope-boundary blocks ("Not in scope: ...")
- Per-iteration changelog narrative ("first shipped as X, then evolved to Y")
- Delivery timestamps ("shipped 2026-04-22")

**Include**:
- What the system can do now
- Product capabilities from PRDs, roadmaps, specs, and plans once implemented or clearly in progress/planned
- Actor / entry point / relevant path
- Capability boundary and externally meaningful constraints
- Pointers to owner files for structure, decisions, technology, conventions, or terminology
- ADR reference(s) that gate the capability

### decisions.md — ADR summary log (always loaded)

Carries **decision summaries only**. Every `load` injects this file into the session, so it must stay short and scannable. Full rationale (context, alternatives, consequences) lives in per-ADR detail files under `docs/project-knowledge/adr/` — loaded on demand by `Read`, never auto-loaded.

**Granularity gate — all three must hold** to record an ADR:

1. **Cross-module scope.** Touches ≥2 bounded contexts / services / packages. Single-module implementation choices are code comments or design docs, not ADRs.
2. **≥2 substantive rejected alternatives.** Each rejected alternative must have real analysis — why it was considered, what its trade-offs were, why rejected. One-line dismissals ("rejected: insufficient") do NOT count as substantive. If you cannot write a paragraph about why each was rejected, it is not ADR-worthy.
3. **Not trivially reversible.** Reversing the decision requires data migration, proto wire changes, external contract renegotiation, or coordinated multi-service deployment. Reversible-with-a-commit decisions are conventions, not ADRs.

**Fails the gate → not an ADR.** Route as:

| What you have | Goes to |
|--------------|---------|
| Library/tool pick with a single rationale | `tech-stack.md` (the "why chosen" column) |
| Coding / project-workflow / CI rule | `conventions.md` |
| Single-module structural choice | code comment or `docs/design/<topic>.md` |
| Temporary workaround with a cleanup plan | plan file under `docs/superpowers/plans/` |

**Summary format (per ADR in `decisions.md`):**

```
## ADR-NNN: [Decision Title]
**Decision:** [What was decided, one sentence]
**Trade-off:** [Known cost or limitation, one sentence. "None" if none]
→ [adr/ADR-NNN-<slug>.md](adr/ADR-NNN-<slug>.md)
```

Maximum **6 non-blank lines per ADR** in the summary file (heading + Decision + Trade-off + pointer = 4 typical; 2 extra lines allowed for multi-part decisions). Beyond 6 lines → move rationale to the detail file.

**Supersede format (1 line in summary):**

```
## ADR-NNN: Original Title (Superseded by ADR-MMM)
```

No body in the summary. The detail file at `adr/ADR-NNN-<slug>.md` stays (historical record) with `superseded_by: ADR-MMM` added to its frontmatter.

### adr/ADR-NNN-<slug>.md — ADR detail (on-demand load)

One file per ADR. Not loaded at session start — fetched by `Read` when the AI or user needs the full rationale (considering a reversal, writing a new ADR that builds on this one, architectural review).

**Format:**

```
---
adr: NNN
title: [Decision Title]
date: YYYY-MM-DD
status: Accepted | Superseded
superseded_by: ADR-MMM  # omit if status=Accepted
---

# ADR-NNN: [Decision Title]

## Context
[Motivating problem, constraints, what forced the decision]

## Decision
[What was decided, in full]

## Alternatives Rejected
- **[Alt A]**: [substantive analysis of why rejected — what it was, what its trade-offs were, why it lost]
- **[Alt B]**: [same]

## Consequences
[Operational effects now in force. Do NOT list forward-looking "X will need Y" work — that belongs in plan files.]
```

**Per-ADR-detail size guard:** each detail file should fit in a single browser-page read (~100 lines / ~2500 tokens). Beyond that, the decision probably mixes multiple ADRs.

### Migration from pre-1.8 format

If `decisions.md` still holds full-format ADRs (pre-v1.8 single-file structure):

1. For each ADR, extract the `## ADR-NNN:` block to `adr/ADR-NNN-<slug>.md` (create directory if missing).
2. Reduce the entry in `decisions.md` to the 4-line summary format above.
3. For superseded ADRs, collapse to the 1-line supersede format; keep the detail file with `superseded_by:` in frontmatter.
4. Re-run `verify` — `decisions.md` size should drop under threshold and `adr/` files are outside the token budget.

The `update` skill detects v1 format and offers interactive migration.

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
| architecture.md | 300 |
| conventions.md | 180 |
| decisions.md | 300 |
| tech-stack.md | 120 |
| features.md | 400 |
| glossary.md | 120 |
| index.md | 50 |

`adr/ADR-NNN-*.md` files are NOT aggregated into a threshold — each is judged individually against the per-ADR-detail guard (~100 lines). They do not count toward `decisions.md`'s line count.

Exceeding threshold → warning in `verify` output + compression suggestion. Commits are NOT blocked; user retains control over whether to compress or accept. `committable` reflects git state only (rebase/merge/detached-HEAD checks).

## Total Token Budget

Per-file caps don't compose. Aggregate check: sum of the seven canonical KB file bytes / 4 ≈ tokens. `adr/` detail files are excluded — they load on demand, not at session start.

- **Default budget: 30,000 tokens** (approx what a full `load` would inject; ~3% of 1M context).
- Exceed → warning in `verify` output with per-file breakdown. Warn-only; does not block commits.

## Quality

- Factual (verify against codebase; do not speculate).
- Concise (scannable in under 2 minutes per file).
- Structured (follow per-file format rule).
- Linked (file paths, spec files, plan files, ADR numbers).

## Compression Suggestions

When size guard / content-shape warnings fire, suggest specific compression actions:

- `decisions.md` over cap → (1) run every ADR through the 3-criteria granularity gate — downgrade tool/library picks to `tech-stack.md`, convention-shaped rules to `conventions.md`; (2) collapse superseded ADRs to 1-line supersede format; (3) move any remaining rationale detail from `decisions.md` into `adr/ADR-NNN-*.md` so the summary file carries only 4-6 lines per ADR.
- `features.md` over cap → strip changelog blocks, commit SHAs, test counts; merge redundant capability groups; keep fixed fields short; move wiring/flow detail to `architecture.md` and rationale to ADRs. Do not delete still-valid PRD/spec product capabilities merely to satisfy the line cap.
- `glossary.md` over cap → compress each entry to ≤2 lines; move context to owner file per Matrix.
- `architecture.md` over cap → remove implementation details; keep module-level wiring only.
- `conventions.md` over cap → remove rules already enforced by formatter/linter; remove rules duplicated from design patterns.
- `tech-stack.md` over cap → remove transitive deps; compress to top 5–10.

Do NOT auto-compress — always surface compression as a user decision.
