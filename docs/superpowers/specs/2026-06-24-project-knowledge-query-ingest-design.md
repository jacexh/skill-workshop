---
date: 2026-06-24
status: proposed
---

# Project Knowledge Query And Ingest Design

## Context

`superpowers-memory` currently exposes project knowledge through `load`, `update`, and `rebuild`. This works as a compact memory layer, but it misses two useful behaviors from the LLM Wiki pattern:

1. A `query` operation is not just a search. It is a deliberate knowledge-reading action that answers a task question from the maintained knowledge base, identifies confidence, and can surface missing knowledge.
2. An `ingest` operation should fold durable source material into the maintained knowledge base. It should not depend primarily on commit messages or broad code archaeology.

The existing project direction is still correct: this plugin owns a Project Knowledge Base, not a general wiki product. The design should borrow the useful operational shape from LLM Wiki while keeping the skill surface small and the behavior restrained.

The Talgent project knowledge sample also shows the right density target: a small hot-path `index.md`, plus medium-density owner files (`features.md`, `architecture.md`, `conventions.md`, `decisions.md`, `glossary.md`, `tech-stack.md`) that are rich enough for an agent to answer useful questions before opening source code.

## Architecture Gate

Applicable standards:

- No current `superpowers-architect` pattern file directly applies. This is a plugin and skill design for Markdown knowledge, shell/Node hook behavior, and agent workflow guidance, not a REST API, DDD domain model, database schema, frontend app, or browser QA flow.

Design constraints that apply anyway:

- Preserve single-source ownership across knowledge files.
- Keep runtime hooks deterministic and cheap.
- Keep skill behavior auditable from explicit files and visible source references.
- Avoid adding new commands when an existing command can carry the behavior clearly.

## Goals

1. Add `query` as the preferred read path for project knowledge.
2. Add `ingest` as the preferred write/sync path for project knowledge.
3. Keep compatibility with existing `load` and `update` users.
4. Make spec and plan files the primary durable source for ingest.
5. Use code/diff inspection as validation and enrichment, not as the primary narrative source.
6. Raise knowledge density enough that `query` is useful without turning the hot path into a token sink.
7. Keep the number of primary skills small and aligned with the emerging LLM Wiki vocabulary.
8. Keep internal wording consistent: Project Knowledge Base, project knowledge, knowledge query, knowledge ingest.

## Non-Goals

- Do not build a generic wiki, note-taking system, or vector database.
- Do not add a large command surface such as separate `doctor`, `capture`, `source`, `lint`, or `compact` skills.
- Do not make `query` write files by default.
- Do not make `ingest` perform a full repository rebuild by default.
- Do not rely on natural-language hook triggers to force every user prompt through memory.
- Do not rename the stored knowledge base to "wiki". "Wiki" remains the name of the external pattern being borrowed from, or a product feature in projects that explicitly have one.

## Core Decision

Rename the primary mental model from:

- `load`: read knowledge before work
- `update`: update knowledge after work

to:

- `query`: ask project knowledge before work or before broad investigation
- `ingest`: fold durable source material into project knowledge after design or implementation work

The implementation should preserve old skill names as compatibility aliases:

| Primary skill | Compatibility alias | Role |
| --- | --- | --- |
| `superpowers-memory:query` | `superpowers-memory:load` | Read project knowledge and answer/orient from it |
| `superpowers-memory:ingest` | `superpowers-memory:update` | Sync project knowledge from source facts |
| `superpowers-memory:rebuild` | none | Regenerate project knowledge when drift is too high |
| `superpowers-memory:cleanup` | none | Maintenance-only hook cleanup |

The user-facing documentation should gradually prefer `query` and `ingest`. Existing automation may continue to call `load` and `update` until migrated.

## Terminology

- Project Knowledge Base: the maintained Markdown knowledge directory, normally `docs/project-knowledge/`.
- Knowledge query: a read-only operation that answers a repo question from the Project Knowledge Base and points to likely next files.
- Knowledge ingest: a write operation that folds durable source facts into owner files.
- Owner file: the knowledge file responsible for a fact category.
- Source document: a spec, plan, ADR, README, roadmap, or other stable file that declares intent or durable behavior.
- Memory candidate: a small proposed knowledge update emitted by `query` when it finds a gap or contradiction.
- Query-grade density: enough content in owner files for an agent to answer useful repo questions before opening source code.

Avoid using "wiki" in generated project knowledge text unless the project domain itself uses that term.

## Knowledge Model

Keep the existing owner-file model. The change is density and routing, not a new storage architecture.

`index.md` remains the hot path:

- Lists owner files and optional shards.
- Gives 1-3 high-signal key points per file.
- Routes the agent to the right knowledge files.
- Should stay compact. If `index.md` grows, route better; do not summarize more.

Owner files carry query-grade density:

- `features.md`: current capability map. It should be able to answer "what can this product/plugin do?" without requiring source search. Implemented feature entries keep the fixed fields: `Enables`, `Actors / Entry Points`, `Capability Boundary`, and `References`.
- `architecture.md`: system boundaries, components, cross-module data flows, lifecycle, and non-obvious structural relationships.
- `conventions.md`: actionable rules for coding, workflow, testing, and architecture that are specific enough to change behavior.
- `decisions.md`: accepted decisions with `Decision`, `Why`, and `Trade-off`, plus links to detailed ADRs when needed.
- `glossary.md`: stable terms, domain language, abbreviations, and overloaded names.
- `tech-stack.md`: languages, runtimes, important dependencies, toolchain assumptions, and dependency rationale when it affects implementation.

Density rules:

- Do not compress away durable facts just to keep every file short.
- Do not move hot-path detail into `index.md`.
- If an owner file becomes too large, split by stable domain or subsystem, for example `features-runtime.md`, `features-marketplace.md`, or `architecture-hooks.md`.
- Shards must still have one owner category. A feature shard remains feature-owned; it should not mix decisions and glossary definitions.
- Do not duplicate facts across owner files. Cross-reference the owner instead.

## Query Behavior

`query` is the default memory entry point before broad repo reasoning.

Use `query` before:

- Answering "why", "how", "where", "should", or "what is the current design" questions about the project.
- Planning implementation in an unfamiliar area.
- Reviewing architecture or project behavior.
- Starting broad code search across a repo.
- Investigating a bug where the affected subsystem is not already known.

Skip `query` for:

- Trivial local commands.
- Exact narrow edits where the file and requested change are already known.
- Follow-up work in the same area when knowledge was queried recently and nothing material changed.
- Pure formatting or mechanical edits.

Default read flow:

1. Read `docs/project-knowledge/index.md`.
2. Select the smallest useful set of owner files, normally 1-3.
3. Read source references only when the answer needs confirmation or the knowledge file points to a source document.
4. Answer from project knowledge first, then identify likely source files if source inspection is still needed.

Default output shape:

```markdown
Answer:
[Direct answer grounded in project knowledge.]

Sources read:
- docs/project-knowledge/index.md
- docs/project-knowledge/<owner>.md

Confidence:
[High | Medium | Low] - [short reason]

Next:
[Optional next source files or actions.]

Memory candidate:
[Optional one-paragraph candidate only when query found a durable missing fact, stale fact, or contradiction.]
```

`query` must be read-only. A Memory candidate is only a proposal; it is written later by `ingest`.

## Ingest Behavior

`ingest` replaces the mental model of "infer from recent git history" with "sync from stable source facts".

Primary ingest inputs, in order of authority:

1. `docs/superpowers/specs/*.md`
2. `docs/superpowers/plans/*.md`
3. ADRs and project decision documents
4. README and user-facing documentation
5. Explicit Memory candidates from `query`
6. Code/diff inspection for validation, paths, names, and implementation status
7. Commit messages as weak hints only

Default ingest flow:

1. Identify changed or requested source documents.
2. Extract durable facts: capabilities, boundaries, decisions, terms, conventions, dependencies, and lifecycle changes.
3. Route facts to owner files.
4. Validate factual anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
5. Update only affected owner files.
6. Regenerate `index.md` key points and routing if the changed facts affect routing.
7. Optionally append a compact maintenance entry to `docs/project-knowledge/log.md` if the project has enabled a log.

`ingest` should not perform a full repository scan unless:

- No source documents exist for the requested update.
- The source documents are clearly stale or contradictory.
- The user explicitly asks for a broader ingest.

Commit messages are not reliable enough to be a primary source. They can reveal where to look, but they cannot prove product intent, architecture rationale, or durable behavior.

## Memory Candidates

`query` may emit a Memory candidate when it discovers a knowledge gap in the act of answering a real task question.

Candidate format:

```markdown
Memory candidate:
Owner: docs/project-knowledge/<owner>.md
Reason: [missing | stale | contradiction]
Fact: [one durable fact to ingest]
Source: [knowledge file, spec, plan, or source path that supports it]
```

Candidates are intentionally small. They should not become a parallel note system.

`ingest` can accept candidates as input, but must still route, deduplicate, and validate them before writing.

## Health Checks Without A New Skill

Do not add a separate `doctor` skill in the first version.

Health-check behavior can be expressed through `query`:

- "Query project knowledge health."
- "Query stale or contradictory knowledge around hooks."
- "Query whether features.md covers marketplace behavior."

For this mode, `query` reads relevant owner files and reports:

- missing owner coverage
- stale source references
- contradictions across owner files
- likely ingest targets

It still does not write.

Structural validation remains in the existing verify/runtime path where deterministic checks already belong.

## Hook And Runtime Guidance

The runtime should encourage frequent `query` use with a small primer, not with aggressive prompt interception.

SessionStart guidance:

```text
Before broad code search, planning, architecture judgment, or unfamiliar repo work, run superpowers-memory:query against project knowledge first.
```

Keep this primer short. It should not enumerate every exception.

UserPromptSubmit behavior:

- Continue honoring explicit skill mentions.
- Avoid natural-language triggers that try to infer every prompt requiring memory.
- Do not inject long knowledge text into prompts.

PreToolUse behavior:

- Keep deterministic lock and structural checks.
- Do not use PreToolUse to force `query` before every `rg`, `sed`, or file read. That would make the tool noisy and easy to ignore.

Skill descriptions carry the main adoption pressure. `query` should say it is used before exploring the codebase, brainstorming, planning, architectural decisions, and broad search.

## Skill Documentation Changes

`query/SKILL.md`:

- State that it is read-only.
- State that no-question mode is equivalent to the current orientation behavior.
- State that question mode answers from knowledge and may emit Memory candidates.
- Include skip conditions.
- Include the output shape.

`ingest/SKILL.md`:

- State that spec/plan files are primary.
- State that code/diff validation is secondary.
- State that commit messages are weak hints.
- Include owner routing rules.
- Include index regeneration rules.
- Accept Memory candidates as one input form.

`load/SKILL.md`:

- Keep as compatibility alias.
- Point to `query` wording.
- Do not duplicate long instructions once migration is complete.
- Keep this as a real minimal skill directory, not a symlink, for marketplace portability.

`update/SKILL.md`:

- Keep as compatibility alias.
- Point to `ingest` wording.
- Keep existing update behavior only as fallback while migration is in progress.
- Keep this as a real minimal skill directory, not a symlink, for marketplace portability.

`rebuild/SKILL.md`:

- No rename.
- Clarify that rebuild is for high drift, initialization, or explicit owner-file regeneration.

## Content Rule Changes

Update content rules and templates with the following principles:

- `index.md` is a router, not the knowledge payload.
- Owner files should be query-grade, not maximally compressed.
- Source references are part of the answerability contract.
- Split large owner files into owner-category shards instead of deleting durable facts.
- Preserve feature capability fields for implemented capabilities.
- Preserve decision trade-offs because agents otherwise re-propose rejected alternatives.
- Preserve glossary terms that affect naming, product language, or architecture discussions.

The soft size warning should distinguish:

- hot-path file growth (`index.md`): warn early
- owner-file density growth: warn later and suggest sharding
- source detail bloat: warn and suggest moving detail back to source references

## Optional Log

Borrow the LLM Wiki idea of an append-only maintenance log only as a low-priority optional feature.

If enabled, `docs/project-knowledge/log.md` records:

- date
- actor/skill
- source inputs
- owner files touched
- one-line reason

The log is not an owner file and should not be part of normal `query` reads.

Phase 1 may skip the log entirely if it would add implementation complexity.

Default: keep `log.md` opt-in through Phase 2. Revisit it only after `query` and `ingest` behavior has proven useful.

## Verification

Implementation should include focused fixture coverage rather than broad integration complexity.

Recommended checks:

1. `query` skill documentation is read-only and contains the output contract.
2. `ingest` skill documentation prioritizes spec/plan sources over commit messages.
3. Compatibility aliases exist for `load` and `update`.
4. Content rules describe query-grade density and owner-file sharding.
5. Verify runtime still treats `index.md` as hot path.
6. Existing structural KB checks continue passing.

Manual acceptance scenarios:

1. Given a question about a known feature, `query` reads `index.md` and the relevant owner file, then answers without source search.
2. Given a question that exposes stale knowledge, `query` emits a Memory candidate without writing.
3. Given a completed plan, `ingest` updates `features.md`, `decisions.md`, or `architecture.md` from the plan/spec first, then validates names and paths from code.
4. Given only commit messages and no source document, `ingest` treats them as hints and reports lower confidence.
5. Given an oversized owner file, validation suggests sharding instead of deleting durable content.

## Rollout

### Phase 1: Add Names And Docs

- Add `query` and `ingest` skill directories or aliases.
- Update existing `load` and `update` docs to point to the new names.
- Update README and marketplace/plugin descriptions to prefer `query` and `ingest`.
- Update SessionStart primer.
- Update templates/content rules for query-grade density.

### Phase 2: Update Behavior

- Make `query` support question mode and Memory candidates.
- Make `ingest` select spec/plan files as primary sources.
- Keep old update-from-git behavior as fallback.
- Add focused tests.

### Phase 3: Tighten Defaults

- Reduce reliance on commit message inference.
- Add optional `log.md` only if the first two phases show it is useful.
- Revisit whether `load`/`update` should stay visible or become legacy-only.

## Risks And Mitigations

Risk: `query` becomes too expensive.

Mitigation: default to `index.md` plus 1-3 owner files; read source references only when needed.

Risk: owner files grow without bound.

Mitigation: shard by owner category and keep `index.md` as router.

Risk: Memory candidates become a shadow backlog.

Mitigation: candidates are one-fact proposals and are only written through `ingest`.

Risk: "wiki" terminology conflicts with projects that have product-level wiki features.

Mitigation: internal terminology remains Project Knowledge Base and project knowledge.

Risk: agents still skip `query`.

Mitigation: skill descriptions, SessionStart primer, and workflow docs make `query` the expected first step before broad reasoning. Runtime hooks should not over-enforce this.

## Resolved Defaults

- `log.md` remains opt-in through Phase 2.
- Health checks use plain-language `query` requests; no explicit `--health` mode in the first implementation.
- `load` and `update` remain real minimal skill directories for marketplace portability, not symlinks.

## Acceptance Criteria

- The primary user-facing memory vocabulary is `query`, `ingest`, and `rebuild`.
- Existing `load` and `update` usage continues working.
- Project knowledge documentation consistently says "Project Knowledge Base" or "project knowledge", not "wiki".
- `query` is read-only and cheap by default.
- `ingest` uses spec/plan files as primary facts and commit messages only as weak hints.
- Owner files are dense enough to answer useful project questions, while `index.md` remains compact.
- No new primary skill is introduced beyond `query` and `ingest`.
