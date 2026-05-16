# Content Rules

Shared rules for `rebuild` and `update` skills. Single source of truth for content generation, ownership, format, and size governance.

## Language

Generate content in the same language as the project's existing documentation (README, specs, plans, code comments). Section headings stay in English for skill parsing compatibility.

## Meta-Rule: Slots vs Topics

KB schema defines **slots** (file names, structural sections, ownership of fact types). It does NOT define **content topics** (which specific concerns, services, terms, or playbooks a given project must cover).

Any concrete list inside a slot definition (e.g., "auth / logging / tracing" as cross-cutting concerns; "ports / timeouts" as implementation constants) is an **example**, not a contract. Per-project content is discovered by reading the codebase.

When extending the schema with a new slot or rule:

1. Define the **slot** universally (what kind of fact lives here, what shape).
2. Provide a **discovery cue** for how a per-project rebuild populates it (where to look, what to grep for).
3. If the slot only applies to a subset of project types (e.g., backend services, multi-service repos), mark it as **conditional** and state the trigger.
4. If a project has no content for the slot, the slot is **omitted** — or the file marks `N/A: <reason>` — never forced.

A rule that hard-codes domain-specific topics into the schema is a defect: replace the topic list with a discovery cue.

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
| **Procedural recipe** (ordered steps for a recurring class of code change) | `playbooks.md` (index) + `playbooks/<slug>.md` (detail) | "see playbooks/<slug>.md" |
| Delivery timeline (what shipped when) | `docs/superpowers/plans/<date>-*.md` | plan filename only — do NOT inline changelog in KB |

**Rule:** any claim ≥3 lines appearing in 2+ KB files MUST move to its owner, and the other files get a pointer (≤1 line).

## Per-File Format Rules

### architecture.md — structure view

Describes how modules/services are wired, how they interact over time, and how core aggregates transition. **Not** what capabilities exist (that's `features.md`).

**Required sections (in order):**

1. **Pattern Overview** — architecture paradigm + 2–3 key characteristics, one paragraph. Elevator pitch for a cold reader.
2. **System Context** — external actors + external systems (databases, MQ, external services). List form, ≤10 lines. Enumerate, don't narrate.
3. **Layering** — architectural layers or bounded contexts. For each: name + one-sentence responsibility + `path/` + key abstraction names only. State call-direction rules at the end of the section. No method signatures, no struct fields, no enum value catalogs. **Granularity rule:** if the project has **≥3 independent top-level modules** (deploy units / services / major packages — discovery cues: count of `main` packages in Go, `bin` entries in `package.json`, `__main__.py` files, top-level service directories under `cmd/`/`apps/`/`services/`, distinct deploy manifests), each module gets its own `####` subsection capped at 3 lines (responsibility / `path/` + entry / key abstraction names). For ≤2 modules or a single-deployable project, a flat bullet list is sufficient.
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

### decisions.md — ADR summary log

Carries **decision summaries only**. Indexed at SessionStart via `index.md`; the file itself is loaded by `superpowers-memory:load` or `Read` when an agent needs decision context. Because `load` reads it on most architectural sessions, it must stay short and scannable. Full rationale (context, alternatives, consequences) lives in per-ADR detail files under `docs/project-knowledge/adr/` — loaded on demand by `Read`, never auto-loaded.

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
- **Cross-cutting concerns section (required, may be N/A):** include a `## Cross-cutting concerns` section that indexes rules applying across most code paths in the project. Format per concern: `**<topic>:** <one-line rule> → \`<canonical impl path>\``. Topics are **discovered per project** — not a fixed list. Typical discovery cues: middlewares/decorators imported across many files; utility modules with broad fan-in; CI-enforced cross-file checks; framework hooks wired globally. Common topic names when present include auth, logging, tracing, error handling, config, observability, persistence, caching, rate limiting, i18n — but only list what the project actually has. If the project has no cross-cutting concerns (pure library, plugin/skill repo, docs site), write `N/A: <reason>` as the sole content under the heading.

### playbooks.md — procedural recipes (index)

Carries an **index of reusable code-change recipes**. Indexed at SessionStart via `index.md`; the file itself is loaded by `superpowers-memory:load` or `Read` when an agent recognizes its task may match a recipe. Detail files (`playbooks/<slug>.md`) are loaded on demand via `Read`.

**A playbook is** a procedural recipe — an ordered sequence of code-change steps that a contributor (human or agent) follows when doing a specific class of recurring change. Typical examples (illustrative, not a contract): "add a new HTTP endpoint", "add a new database migration", "add a new service to the monorepo", "promote a feature flag to default-on", "add a new ADR", "bump a codegen-bearing dependency".

**3-gate creation rule — all three must hold** to write a playbook:

1. **Recurrence.** The same class of change has occurred **≥2 times** in the project (concrete instances, not anticipated ones), **OR** a spec/plan carries an explicit directive that this should become a reusable recipe (e.g., "next time we do X, follow these steps"). Forward-looking intuition alone ("this will probably happen again") fails this gate.
2. **Multi-step cross-file.** The recipe spans **≥3 cross-file or cross-module actions**. Single-file edits don't warrant a playbook.
3. **Non-obvious.** The steps are not derivable by reading the affected code in isolation (would a fresh contributor stumble? if no, no playbook needed).

Fails any gate → not a playbook. Route as:

| What you have | Goes to |
|--------------|---------|
| One-off change for a specific feature | spec/plan under `docs/superpowers/` |
| Single-rule constraint ("must X / must not Y") | `conventions.md` |
| Rationale for why this approach exists | `decisions.md` / `adr/` |
| Live-system operation (incident, deploy, on-call) | runbook under `docs/runbooks/` (NOT KB) |
| Architecture/concept explanation | `architecture.md` |

**Boundary with neighbors:**

- **vs convention:** convention is declarative (rule any change must satisfy); playbook is procedural (steps to follow). They often pair — convention sets the rule, playbook teaches how to satisfy it.
- **vs ADR:** ADR explains WHY a decision was made; playbook executes the CONSEQUENCE. Playbook entries typically reference the relevant ADR in their `References` section.
- **vs spec/plan:** spec/plan is one-shot (specific change); playbook is reusable (a class of change). Judgment test: "Will this be done a second time?" Yes → playbook.
- **vs runbook:** runbook targets a running system (incident, deploy, on-call); playbook targets development-time code changes.

**Index format (per playbook in `playbooks.md`):**

```
- [<Verb-led title>](playbooks/<slug>.md) — When: <one-line trigger condition>
```

The `When:` clause must be scannable — a code agent at SessionStart matches its current task against the trigger without opening the detail file.

**Size cap:** `playbooks.md` ≤200 lines. Detail files are NOT counted toward this cap; they're loaded on demand.

**Lazy slot:** if the project has no recurring change classes that pass the 3-gate rule, `playbooks.md` may be omitted entirely. Do not create an empty index just to satisfy the schema.

**Discovery cue (for rebuild):** scan `docs/superpowers/specs/` and `docs/superpowers/plans/` for clusters of files describing the same class of change (e.g., multiple `*service-split*` or `*add-*-endpoint*` files); scan `conventions.md` for existing step-style entries that should be promoted; scan `README.md` for "how to add X" sections. Each cluster is a candidate that must pass the 3-gate rule before being written.

### playbooks/<slug>.md — playbook detail (on-demand load)

One file per playbook. Not referenced by `index.md` — fetched by `Read` when a contributor recognizes the playbook applies to their current task.

**Format:**

```
---
playbook: <slug>
title: <Verb-led title>
last_updated: YYYY-MM-DD
---

# <Verb-led title>

**When:** <one-line trigger condition — identical to the index entry>
**Why this exists:** <optional — link to the ADR or convention that motivates the recipe>

## Preconditions
- <fact that must be true before starting, e.g., "branch off main">

## Steps
1. <file/function-granularity action with concrete path>
2. ...

## Verification
- <how to confirm it worked: which test, which log, which command output>

## Pitfalls
- <known traps, e.g., "remember the reverse migration">

## References
- adr/ADR-NNN-<slug>.md
- related playbooks: [<title>](<slug>.md)
```

**Per-playbook size guard:** each detail file should fit a single browser-page read (~100 lines / ~2500 tokens). Beyond that, the playbook is probably two playbooks fused together — split.

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
| playbooks.md | 200 |
| index.md | 50 |

`adr/ADR-NNN-*.md` and `playbooks/<slug>.md` files are NOT aggregated into a threshold — each is judged individually against its per-detail guard (~100 lines). They do not count toward `decisions.md`'s or `playbooks.md`'s line count.

Exceeding threshold → warning in `verify` output + compression suggestion. Commits are NOT blocked; user retains control over whether to compress or accept. `committable` reflects git state only (rebase/merge/detached-HEAD checks).

## Total Token Budget

Per-file caps don't compose. Aggregate check: sum of the canonical KB index files (`architecture.md`, `tech-stack.md`, `features.md`, `conventions.md`, `decisions.md`, `glossary.md`, `playbooks.md` if present) bytes / 4 ≈ tokens. `adr/` and `playbooks/` detail files are excluded — they load on demand, not at session start.

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
