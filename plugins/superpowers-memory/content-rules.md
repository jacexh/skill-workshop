# Content Rules

Shared rules for `rebuild` and `update` skills. Single source of truth for content generation, ownership, format, and retrieval governance.

## Language

Generate content in the same language as the project's existing documentation (README, specs, plans, code comments). Section headings stay in English for skill parsing compatibility.

## Meta-Rule: Slots vs Topics

KB schema defines **slots** (file names, structural sections, ownership of fact types). It does NOT define **content topics** (which specific concerns, services, or terms a given project must cover).

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
| Delivery timeline (what shipped when) | `docs/superpowers/plans/<date>-*.md` | plan filename only — do NOT inline changelog in KB |

**Rule:** any claim ≥3 lines appearing in 2+ KB files MUST move to its owner, and the other files get a pointer (≤1 line).

## Progressive Knowledge Layout

`index.md` is the only always-injected hot-path file. Keep it small and scannable. All other KB files are storage and retrieval targets: valid knowledge MUST NOT be deleted merely to satisfy a line count or token estimate.

Each canonical file is an **entry file**, not a capacity ceiling:

- `architecture.md`
- `features.md`
- `conventions.md`
- `tech-stack.md`
- `decisions.md`
- `glossary.md`

For large or complex projects, any entry file except `index.md` may be split into sibling shard files named `<slot>-<domain>.md`, for example:

- `architecture-runtime.md`
- `architecture-billing.md`
- `features-admin.md`
- `conventions-testing.md`
- `tech-stack-frontend.md`
- `decisions-platform.md`
- `glossary-claims.md`

Split by stable domain, bounded context, submodule, platform capability, deploy unit, or workflow boundary. Do NOT split by arbitrary pagination (`architecture-1.md`, `architecture-2.md`) or only because a number is high.

Entry files should keep a short overview plus links to shards. Shards own their detailed content and follow the same per-file rules as their parent slot. `index.md` should list important shards with 1-2 key points so agents can load only the relevant file.

When `verify` reports high retrieval cost or split candidates, treat it as an advisory. The correct response is to improve routing, split by stable boundaries, remove duplicates, or fix shape violations — not to delete valid current project knowledge.

## Query-Grade Traversal

The Project Knowledge Base must support `query`, not only session-start orientation.

- `index.md` is the router. It lists owner files, shards, useful aliases, and 1-2 routing key points per file.
- Owner entries that claim durable behavior include a source reference: spec, plan, ADR, README, canonical source file, or another owner entry.
- Cross-owner relationships use `See:` or `Related:` pointers. Do not duplicate expanded facts across owner files.
- Shards must be reachable from `index.md`; if a parent owner file exists, it also links to its shards.
- Optional aliases are plain Markdown such as `Aliases: native hooks, Codex hooks, prompt router`.
- Query answers should be supported by read owner/source entries, not by search snippets alone.

## Core Query Coverage

Query-grade knowledge must preserve answerability for high-value project objects, not just a compact overview.

High-value objects are discovered from project sources. They are usually bounded contexts, services, major modules, product capabilities, or cross-service flows that appear in multiple specs, plans, ADRs, feature entries, glossary terms, or source entry points.

For each high-value object, one owner entry or shard should directly answer:

- Responsibility: what it owns and what it explicitly does not own.
- Internal layers/main components: the main layers, collaborators, or implementation parts. Prefer stable architecture structure from design docs when it exists: planes, subsystems, workflows, processors, policies, gates, projections, or named runtime components. Do not stop at generic `domain/application/infrastructure` labels when sources provide richer structure.
- Upstream/downstream interactions: callers, callees, events, APIs, storage, or external systems.
- Key state/flow/invariants: lifecycle, ordering, state transitions, or constraints that shape changes.
- Source refs: related ADRs, specs, plans, docs, and canonical source paths.

This is a coverage rule, not a completeness mandate. Do not create a file for every package or helper. Add detail only when a normal agent query about a high-value object would otherwise require broad code search or cross-file inference.

### Architecture Coverage Calibration

For complex engineering repositories, architecture knowledge must be deeper than a few isolated sequence diagrams. The target is a **query-grade architecture map**, not a full code tour.

This calibration applies when the project has any of these signals:

- ≥3 deployable services, entry points, apps, or major packages (`cmd/`, `apps/`, `services/`, `packages/`, `api/`, generated protocol contracts, deployment manifests).
- DDD, bounded contexts, CQRS/read models, event/message flows, runtime orchestration, plugin/runtime extension points, or multi-stage execution workflows.
- Multiple specs, plans, ADRs, or feature entries reference the same service, bounded context, cross-service flow, or aggregate lifecycle.

When the calibration applies, `architecture.md` or reachable `architecture-*.md` shards should cover:

1. **System topology / context map** — the main services, trust boundaries, data stores, message buses, runtime substrates, and call/event direction rules.
2. **Service architecture cards** — for each high-value service or bounded context, responsibility/non-responsibility, internal layers/main components, upstream/downstream interactions, owned state/read models, invariants, and source refs. If design docs define internal planes, subsystems, policies, processors, workflows, or projections, capture that architecture model instead of only listing code-layer directories.
3. **Scenario sequence coverage** — the core cross-service scenarios that shape future changes. Prefer 4-7 high-value scenarios for complex repos; 2-3 is enough only for small repos. Every scenario section must carry local source refs after the diagram.
4. **State / lifecycle coverage** — Mermaid FSMs or lifecycle cards for aggregates whose state transitions affect other contexts, messages, read models, runtime execution, or user-visible workflow.
5. **Source traceability** — every service card and scenario has stable source refs: ADR/spec/plan/doc paths plus canonical source/proto/config paths.

Before finalizing architecture files, run an answerability self-check for the top 3-5 high-value services/bounded contexts and flows. The KB should directly answer their internal architecture/layering, participating scenarios, key state/lifecycle/invariants, and validation source refs. If the answer requires broad cross-file inference, refine the owner entry or shard.

Use these discovery cues during bootstrap/full-refresh:

- Entry points and deploy units: `cmd/*`, `apps/*`, `services/*`, `package.json` scripts/bin, `Dockerfile`, Helm/Kubernetes manifests.
- Cross-context contracts: `api/**`, `proto/**`, OpenAPI/GraphQL schemas, event/message definitions, queue topics, stream processors.
- Internal module boundaries: `internal/<context>/domain`, `application`, `infrastructure`, `adapters`, `projections`, `readmodels`, `handlers`, `workers`.
- High-risk flows: specs/plans/ADRs mentioning orchestration, execution, provisioning, delivery, authorization, ingest, artifact/file handling, trace/metrics, comments/signals/decisions, async retries, or ownership transfer.

Do **not** document every package, helper, handler method, struct field, enum value, SQL table, route, or configuration constant. If a query asks for that depth, `query` should route to source refs after the architecture map has narrowed the search.

## Per-File Format Rules

### architecture.md — structure view

Describes how modules/services are wired, how they interact over time, and how core aggregates transition. **Not** what capabilities exist (that's `features.md`).

**Required sections (in order):**

1. **Pattern Overview** — architecture paradigm + 2–3 key characteristics, one paragraph. Elevator pitch for a cold reader.
2. **System Context** — external actors + external systems (databases, MQ, external services). List form, ≤10 lines. Enumerate, don't narrate.
3. **System Topology / Context Map** — static system map: services, bounded contexts, runtime substrates, stores, buses, trust boundaries, and call/event direction rules. For small single-deployable projects, this may be a short bullet list; for multi-service repos, use a Mermaid graph or table.
4. **Service Architecture Cards** — conditional but expected for complex repos. For each high-value service/bounded context: responsibility/non-responsibility, path/entry, internal layers/main components, upstream/downstream interactions, state/read models/invariants, and source refs. Prefer named planes/subsystems/workflows/processors/projections from design docs over bare directory-layer labels when available. Keep each card compact; split to `architecture-<domain>.md` when a card plus flows would make `architecture.md` noisy.
5. **Scenario Sequences** — Mermaid `sequenceDiagram` for cross-module flows of 3+ components. Complex repos should cover 4-7 high-value scenarios; small repos can cover 2-3. Single-module internal flows do NOT belong here unless they encode a stable architectural lifecycle. Put local `Source refs` after each scenario diagram.
6. **Key Object FSMs** — Mermaid `stateDiagram-v2` for aggregates whose transitions cross module boundaries (typically via cross-BC event emission). **Must be rendered as transition diagrams with trigger + emitted-event labels, not bullet lists of state names.** Bullet-list FSM enumerations are Exclusion List violations — they duplicate what code owns without capturing the cross-BC contract that makes the FSM architectural.
7. **Key Design Decisions** — pointer list only, 3–5 entries in the form `**[title]** — see ADR-NNN`. Full rationale lives in `decisions.md` + `adr/ADR-NNN-*.md` — never expand inline here.

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
- **Readiness calibration:** `Implemented` means the capability is usable under the documented prerequisites, not merely scaffolded in code. If an implemented capability depends on an external service, a partial adapter, an experimental host protocol, or scaffolded/not-yet-wired code, the `Capability Boundary` MUST say so explicitly (`requires ...`, `partial`, `experimental`, `scaffolded only`, `not implemented`, etc.). A capability whose key referenced path contains clear `not implemented` / `scaffolding only` / deferred-operational signals without this boundary calibration is a KB defect; `verify` reports `capability_readiness_uncalibrated`.

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

Carries **decision summaries only**. Indexed through `index.md` on the hot path; `superpowers-memory:query` loads this file only when on-demand routing needs decision context. Keep it short and scannable so `query` can orient from `index.md` first, then read the smallest useful owner files. Full rationale (context, alternatives, consequences) lives in per-ADR detail files under `docs/project-knowledge/adr/` — loaded on demand by `Read`, never auto-loaded.

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

**Per-ADR-detail shape check:** each detail file should be readable in one focused pass. If it grows large because it mixes unrelated decisions, split the ADR. If it is large because one decision genuinely has substantial context, keep the information and make the summary/index routing clearer.

### Migration from pre-1.8 format

If `decisions.md` still holds full-format ADRs (pre-v1.8 single-file structure):

1. For each ADR, extract the `## ADR-NNN:` block to `adr/ADR-NNN-<slug>.md` (create directory if missing).
2. Reduce the entry in `decisions.md` to the 4-line summary format above.
3. For superseded ADRs, collapse to the 1-line supersede format; keep the detail file with `superseded_by:` in frontmatter.
4. Re-run `verify` — `decisions.md` should contain only summaries, and `adr/` files remain on-demand detail.

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

### index.md

- ≤50 lines total.
- Each file or shard: 1-line description + "Key points:" with 1–2 decision-relevant facts that help the agent decide whether to load it in full.
- Include split shard files when they exist. Do not list omitted or legacy files.

## Exclusion List (applies to all files)

**NEVER include** — these are Exclusion List violations checked by `verify`:

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

## Retrieval Cost And Split Guidance

`index.md` is the only file with a strict line threshold because it is injected at SessionStart. Keep it ≤50 lines. If it exceeds that, `verify` reports `index_too_large` as a shape violation.

All other KB files and shards are storage/read-on-demand artifacts. They do not have hard line caps, and retrieval-cost output does not affect `verify.ok`.

`verify` may report:

- `retrievalCost` — estimated bytes/tokens for recognized top-level KB files and shards. Advisory only.
- `splitCandidates` — large non-index files that may be easier to use if split by stable domain or submodule. Advisory only.
- `sizeWarnings` — hot-path `index.md` size warnings only.
- `coverageGaps` — architecture answerability gaps for complex repos. Advisory only.

When a non-index file becomes large, decide whether the content is valid:

- Valid, cohesive, and useful → keep it.
- Valid but mixes several stable domains/submodules → split to `<slot>-<domain>.md` and link from the entry file plus `index.md`.
- Duplicated or wrong-owner facts → move to the owner file and replace duplicates with pointers.
- Changelog, commit SHAs, test counts, method signatures, enum catalogs, or single-module implementation detail → fix the shape violation.

Never delete still-valid project knowledge solely to satisfy a line count or token estimate.

## Verify Coverage

`verify` is the executable guardrail for this rule file. It reports:

- `staleRefs` — backtick path references that no longer exist.
- `shapeViolations` — feature field/density issues, glossary width/length issues, method signatures, legacy inline ADRs, ADR summary/detail mismatches, and oversized `index.md`.
- `readinessWarnings` — implemented capabilities that reference scaffolded/not-implemented code without Capability Boundary calibration.
- `ssotViolations` — near-duplicate multi-line facts across owner files.
- `sizeWarnings` — hot-path `index.md` line threshold only.
- `retrievalCost` — advisory estimated retrieval cost for recognized KB entry files and shards.
- `splitCandidates` — advisory list of large non-index files that may deserve vertical splitting.
- `coverageGaps` — advisory architecture answerability gaps for complex repos, such as missing service cards, shallow service cards that only name generic code layers, too few cross-service scenarios, scenario diagrams missing local source refs, missing lifecycle/FSM coverage, or missing source refs. These do not affect `verify.ok`; they are suggested ingest targets.

## Retrieval Cost

`verify` estimates retrieval cost as bytes / 4 ≈ tokens for recognized top-level KB files and shards: `architecture*.md`, `features*.md`, `conventions*.md`, `tech-stack*.md`, `decisions*.md`, `glossary*.md`, and `index.md`.

This is an observability metric, not a budget. High retrieval cost should lead to better routing and vertical splitting, not information loss.

## Quality

- Factual (verify against codebase; do not speculate).
- Concise (scannable in under 2 minutes per file).
- Structured (follow per-file format rule).
- Linked (file paths, spec files, plan files, ADR numbers).

## Split And Shape Suggestions

When retrieval-cost advisories or content-shape warnings fire, suggest specific actions:

- `decisions.md` large → (1) run every ADR through the 3-criteria granularity gate — downgrade tool/library picks to `tech-stack.md`, convention-shaped rules to `conventions.md`; (2) collapse superseded ADRs to 1-line supersede format; (3) move any remaining rationale detail from `decisions.md` into `adr/ADR-NNN-*.md` so the summary file carries only 4-6 lines per ADR.
- `features.md` large → strip changelog blocks, commit SHAs, and test counts; merge redundant capability groups; move wiring/flow detail to `architecture.md` and rationale to ADRs. If valid product capabilities remain large, split by stable product domain rather than deleting capabilities.
- `glossary.md` large → compress each entry to ≤2 lines; move context to owner file per Matrix.
- `architecture.md` large → remove implementation details and duplicate capability prose; if the remaining diagrams/flows are valid, split by bounded context, runtime subsystem, or cross-module flow family.
- `conventions.md` large → remove rules already enforced by formatter/linter and rules duplicated from design patterns; split by stable practice area if needed.
- `tech-stack.md` large → remove transitive deps; split by backend/frontend/runtime/tooling if a multi-stack project needs it.

Do NOT auto-compress or delete valid knowledge — always surface split/shape decisions to the user.
