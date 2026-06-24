---
date: 2026-06-24
status: proposed
---

# Project Knowledge Query, Ingest, And Lint Design

## Context

`superpowers-memory` currently exposes project knowledge through `load`, `update`, and `rebuild`. This works as a compact memory layer, but it does not line up with the three useful operational verbs from the LLM Wiki pattern:

1. A `query` operation is not just a search. It is a deliberate knowledge-reading action that answers a task question from the maintained knowledge base, identifies confidence, and can surface missing knowledge.
2. An `ingest` operation should fold durable source material into the maintained knowledge base. It should not depend primarily on commit messages or broad code archaeology.
3. A `lint` operation should report knowledge-base defects and maintenance targets without writing content.

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
2. Add `ingest` as the preferred write/sync/bootstrap path for project knowledge.
3. Add `lint` as the preferred read-only health and quality path for project knowledge.
4. Keep compatibility with existing `load`, `update`, and `rebuild` users.
5. Make spec and plan files the primary durable source for ingest.
6. Use code/diff inspection as validation and enrichment, not as the primary narrative source.
7. Raise knowledge density and traversability enough that `query` is useful without turning the hot path into a token sink.
8. Keep the primary skill surface aligned with LLM Wiki: `query`, `ingest`, and `lint`.
9. Keep internal wording consistent: Project Knowledge Base, project knowledge, knowledge query, knowledge ingest, knowledge lint.
10. Keep same-name Claude Code and Codex plugin versions synchronized when either track changes.

## Non-Goals

- Do not build a generic wiki, note-taking system, or vector database.
- Do not add a large command surface such as separate `doctor`, `capture`, `source`, or `compact` skills.
- Do not make `query` write files by default.
- Do not make `lint` write files.
- Do not make `ingest` perform a full repository scan except in explicit bootstrap or full-refresh mode.
- Do not rely on natural-language hook triggers to force every user prompt through memory.
- Do not rename the stored knowledge base to "wiki". "Wiki" remains the name of the external pattern being borrowed from, or a product feature in projects that explicitly have one.

## Core Decision

Rename the primary mental model from:

- `load`: read knowledge before work
- `update`: update knowledge after work

to the three primary skills:

- `query`: ask project knowledge before work or before broad investigation
- `ingest`: fold durable source material into project knowledge, including bootstrap and full-refresh modes
- `lint`: check project knowledge quality, freshness, routing, and source integrity without writing

The implementation should preserve old skill names as compatibility aliases:

| Primary skill | Compatibility alias or mode | Role |
| --- | --- | --- |
| `superpowers-memory:query` | `superpowers-memory:load` | Read project knowledge and answer/orient from it |
| `superpowers-memory:ingest` | `superpowers-memory:update` | Incrementally sync project knowledge from source facts |
| `superpowers-memory:ingest` | `superpowers-memory:rebuild` | Bootstrap or full-refresh project knowledge |
| `superpowers-memory:lint` | runtime `verify` behavior | Report structural, semantic, and retrieval defects |

`cleanup` remains a maintenance-only hook cleanup skill where a platform still needs it. It is not part of the primary memory vocabulary.

The user-facing documentation should gradually prefer `query`, `ingest`, and `lint`. Existing automation may continue to call `load`, `update`, and `rebuild` until migrated.

## Terminology

- Project Knowledge Base: the maintained Markdown knowledge directory, normally `docs/project-knowledge/`.
- Knowledge query: a read-only operation that answers a repo question from the Project Knowledge Base and points to likely next files.
- Knowledge ingest: a write operation that folds durable source facts into owner files.
- Knowledge lint: a read-only operation that reports Project Knowledge Base defects, stale references, routing gaps, and suggested ingest targets.
- Owner file: the knowledge file responsible for a fact category.
- Source document: a spec, plan, ADR, README, roadmap, or other stable file that declares intent or durable behavior.
- Memory candidate: a small proposed knowledge update emitted by `query` when it finds a gap or contradiction.
- Query-grade density: enough content in owner files for an agent to answer useful repo questions before opening source code.
- Traversal link: a Markdown link or named pointer that lets `query` move from an index entry to an owner entry, source document, ADR detail, shard, or source path.

Avoid using "wiki" in generated project knowledge text unless the project domain itself uses that term.

## Knowledge Model

Keep the existing owner-file model. The change is density and routing, not a new storage architecture.

`index.md` remains the hot path:

- Lists owner files and optional shards.
- Lists useful aliases when user-facing vocabulary differs from implementation vocabulary.
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
- If an owner file becomes too large, split by stable domain or subsystem, for example `features-runtime.md`, `features-marketplace.md`, or `conventions-testing.md`.
- Shards must still have one owner category. A feature shard remains feature-owned; it should not mix decisions and glossary definitions.
- Do not duplicate facts across owner files. Cross-reference the owner instead.

Architecture has an additional shard rule for complex engineering repositories:

- `architecture.md` is the overview/router: system topology, context map, shard links, and compact cards/scenarios only when they fit.
- `architecture-<module>.md` owns one high-value service, bounded context, or main module, such as `architecture-orchestrator.md`, and should follow `templates/architecture-module.md`.
- `architecture-<scenario>.md` owns one named cross-service scenario or flow family, such as `architecture-runtime-message-chain.md`, and should follow `templates/architecture-scenario.md`.
- `architecture-contexts.md` and `architecture-flows.md` are legacy view shards. They may remain readable in old knowledge bases, but full-refresh ingest should migrate durable facts into module shards and named scenario shards.
- Cross-service features such as "Portal to Executor complete message chain" are not split across each participating service page. The complete end-to-end sequence belongs in one named scenario shard, and each module shard links back to it. Module shards use `Scenario refs`; scenario shards use `Module refs`.

Traversal rules:

- Each owner entry that claims durable behavior should include a source reference: spec, plan, ADR, README, source file, or another owner entry.
- Cross-owner relationships should be explicit `See:` or `Related:` pointers, not duplicated prose.
- Shards must be reachable from `index.md` and from their parent owner file when one exists.
- Optional aliases are plain Markdown, for example `Aliases: native hooks, Codex hooks, prompt router`. Do not add a separate alias database.
- `query` may use text search over the Project Knowledge Base as a routing helper, but it answers from read owner/source entries, not from match snippets alone.
- Source references should be stable enough for follow-up reads. Prefer docs, ADRs, plans, public entry points, and canonical source files over transient commit hashes.

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
2. Normalize the question into likely project terms and aliases.
3. Select the smallest useful set of owner files or shards, normally 1-3.
4. If the index is insufficient, search the Project Knowledge Base for the terms and aliases to find candidate owner entries.
5. Read candidate owner entries.
6. Follow `See:`, `Related:`, ADR, spec, plan, or source references only when the answer is not yet sufficiently supported.
7. Stop when the answer has enough evidence for the task, or when the bounded read budget is exhausted.
8. Answer from project knowledge first, then identify likely source files if source inspection is still needed.

Evidence is sufficient when:

- at least one owner entry directly answers the question, and
- linked source references do not contradict it, and
- the answer can name the relevant owner file or source document.

If evidence is not sufficient, `query` should say so and either point to source files to inspect or emit a Memory candidate.

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

`ingest` has three modes:

1. Incremental ingest: default mode after a spec, plan, PR, or implementation branch. Reads source documents first and updates affected owner files.
2. Bootstrap ingest: used when `docs/project-knowledge/` does not exist. Performs a full project read and creates the initial Project Knowledge Base.
3. Full-refresh ingest: used when `lint` reports high drift, owner-file structure is obsolete, or the user explicitly asks to regenerate a target file or the whole knowledge base.

The old `update` name maps to incremental ingest. The old `rebuild` name maps to bootstrap ingest when no knowledge base exists, or full-refresh ingest when one already exists.

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
4. For architecture facts, run a coverage inventory: topology, module/service candidates, named cross-service scenarios, lifecycle objects, and source refs.
5. Validate factual anchors against code or docs when the fact names files, commands, dependencies, or implemented behavior.
6. Update only affected owner files.
7. Regenerate `index.md` key points and routing if the changed facts affect routing.
8. Optionally append a compact maintenance entry to `docs/project-knowledge/log.md` if the project has enabled a log.

Architecture ingest should not stop at generic service cards or isolated diagrams when the source material names richer structure. Module shards should preserve design-doc planes, subsystems, workflows, processors, policies, projections, scenario refs, and invariants when they exist. Named scenario shards should preserve participants, phases, authority boundaries, module refs, ordering/idempotency/failure rules, and source refs.

`ingest` should not perform a full repository scan unless:

- It is running bootstrap ingest.
- It is running full-refresh ingest.
- No source documents exist for the requested update and the user still wants ingest to proceed.
- The source documents are clearly stale or contradictory and targeted validation is not enough.
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

## Lint Behavior

`lint` is the read-only health and quality surface for the Project Knowledge Base.

It should reuse the deterministic checks already present in the hook runtime where possible, then add skill-level interpretation around the current task or requested scope.

Default lint checks:

- stale path and source references
- content-shape violations
- ADR summary/detail integrity
- single-owner fact duplication
- missing or weak source references
- missing traversal links for shards or related owner entries
- readiness warnings
- retrieval cost and split candidates
- architecture coverage gaps: missing module/scenario shards, shallow service cards, too few named scenarios, legacy view shards, missing module/scenario cross-refs, scenario semantic field gaps, scenario source-ref gaps, lifecycle gaps
- likely ingest targets

`lint` can run at three scopes:

1. Whole KB: inspect all project knowledge files.
2. Owner scope: inspect one owner file or owner-file shard.
3. Topic scope: inspect the owner files and source references related to a named subsystem or capability.

Default output shape:

```markdown
Issues:
- [Critical | Important | Minor] [owner/source] [finding]

Suggested ingest targets:
- Owner: docs/project-knowledge/<owner>.md
  Source: <spec/plan/ADR/source>
  Reason: <missing | stale | contradiction | weak source | routing gap>

Advisory:
- [retrieval cost, split candidates, or non-blocking notes]
```

`lint` does not write. If it finds fixable defects, it reports suggested ingest targets. `ingest` is the only knowledge-writing path.

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

Skill descriptions carry the main adoption pressure. `query` should say it is used before exploring the codebase, brainstorming, planning, architectural decisions, and broad search. `lint` should say it is used when checking whether project knowledge is stale, contradictory, hard to retrieve, or ready for ingest.

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
- Define incremental, bootstrap, and full-refresh modes.
- Include owner routing rules.
- Include index regeneration rules.
- Accept Memory candidates as one input form.

`lint/SKILL.md`:

- State that it is read-only.
- Reuse the runtime `verify` checks as the deterministic base.
- Report issues by severity.
- Report suggested ingest targets instead of editing files.
- Support whole-KB, owner, and topic scopes.

`load/SKILL.md`:

- Keep as compatibility alias.
- Point to `query` wording.
- Do not duplicate long instructions once migration is complete.
- Keep this as a real minimal skill directory, not a symlink, for marketplace portability.

`update/SKILL.md`:

- Keep as compatibility alias.
- Point to `ingest` wording.
- Make it a thin alias for incremental ingest.
- Keep this as a real minimal skill directory, not a symlink, for marketplace portability.

`rebuild/SKILL.md`:

- Keep as compatibility alias.
- Point to `ingest` bootstrap/full-refresh wording.
- Make it a thin alias, not a separate long procedure.
- Keep this as a real minimal skill directory, not a symlink, for marketplace portability.

`cleanup/SKILL.md`:

- Keep only where the platform needs hook cleanup.
- Do not describe it as a primary memory skill.

## Content Rule Changes

Update content rules and templates with the following principles:

- `index.md` is a router, not the knowledge payload.
- Owner files should be query-grade, not maximally compressed.
- Source references are part of the answerability contract.
- Traversal links are part of the answerability contract.
- Split large owner files into owner-category shards instead of deleting durable facts.
- Preserve feature capability fields for implemented capabilities.
- Preserve decision trade-offs because agents otherwise re-propose rejected alternatives.
- Preserve glossary terms that affect naming, product language, or architecture discussions.
- Allow optional plain-Markdown aliases/tags only when they improve query routing.

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

## Claude Code And Codex Synchronization

`superpowers-memory` is a dual-track plugin. The Claude Code implementation lives under `plugins/superpowers-memory/`; the Codex implementation lives under `codex-plugins/superpowers-memory/`.

This design changes the release invariant for same-name dual-track plugins:

- A change to either track of `superpowers-memory` should update both track manifests to the same version.
- Shared conceptual changes, skill names, content rules, and docs must land in both tracks in the same implementation plan unless a platform-specific limitation is explicitly documented.
- Compatibility aliases should exist in both tracks.
- Runtime command names can differ by platform (`hook-runtime.js` vs `codex-runtime.js`), but `query`, `ingest`, and `lint` semantics should match.
- Marketplace/plugin metadata should describe the same primary memory surface for both tracks.

Implementation should update release detection and bump scripts so a same-name dual-track plugin change keeps these versions synchronized automatically. This supersedes the earlier release policy that allowed Claude Code and Codex same-name plugin versions to drift independently.

## Verification

Implementation should include focused fixture coverage rather than broad integration complexity.

Recommended checks:

1. `query` skill documentation is read-only and contains the output contract.
2. `ingest` skill documentation prioritizes spec/plan sources over commit messages.
3. `ingest` defines incremental, bootstrap, and full-refresh modes.
4. `lint` skill documentation is read-only and reports suggested ingest targets.
5. Compatibility aliases exist for `load`, `update`, and `rebuild`.
6. Content rules describe query-grade density, traversal links, aliases, and owner-file sharding.
7. Verify runtime still treats `index.md` as hot path.
8. Existing structural KB checks continue passing.
9. Claude Code and Codex same-name plugin version metadata stays synchronized when either track changes.

Manual acceptance scenarios:

1. Given a question about a known feature, `query` reads `index.md` and the relevant owner file, then answers without source search.
2. Given a question that exposes stale knowledge, `query` emits a Memory candidate without writing.
3. Given a completed plan, `ingest` updates `features.md`, `decisions.md`, or `architecture.md` from the plan/spec first, then validates names and paths from code.
4. Given a project without `docs/project-knowledge/`, `ingest` bootstrap creates the initial owner files and compact index.
5. Given a stale existing knowledge base, `ingest` full-refresh regenerates the requested owner files or whole KB.
6. Given only commit messages and no source document, `ingest` treats them as hints and reports lower confidence.
7. Given an oversized owner file, `lint` suggests sharding instead of deleting durable content.
8. Given stale references or SSOT duplication, `lint` reports issues and suggested ingest targets without writing.

## Rollout

### Phase 1: Add Names And Docs

- Add `query`, `ingest`, and `lint` skill directories.
- Update existing `load`, `update`, and `rebuild` docs to point to the new names/modes.
- Update README and marketplace/plugin descriptions to prefer `query`, `ingest`, and `lint`.
- Update SessionStart primer.
- Update templates/content rules for query-grade density.
- Update Claude Code and Codex plugin docs in the same change.
- Update release scripts so same-name Claude Code and Codex plugin versions bump together when either track changes.

### Phase 2: Update Behavior

- Make `query` support question mode, traversal, sufficiency checks, and Memory candidates.
- Make `ingest` select spec/plan files as primary sources.
- Make `ingest` support incremental, bootstrap, and full-refresh modes.
- Make `lint` wrap deterministic verify checks and produce suggested ingest targets.
- Remove the old long update-from-git procedure from the primary path; keep `update` as a thin alias.
- Add focused tests.

### Phase 3: Tighten Defaults

- Reduce reliance on commit message inference.
- Add optional `log.md` only if the first two phases show it is useful.
- Revisit whether `load`/`update`/`rebuild` should stay visible or become legacy-only.

## Risks And Mitigations

Risk: `query` becomes too expensive.

Mitigation: default to `index.md` plus 1-3 owner files; read source references only when needed.

Risk: owner files grow without bound.

Mitigation: shard by owner category and keep `index.md` as router.

Risk: Memory candidates become a shadow backlog.

Mitigation: candidates are one-fact proposals and are only written through `ingest`.

Risk: `lint` becomes a disguised write workflow.

Mitigation: `lint` reports issues and suggested ingest targets only. `ingest` remains the only knowledge-writing path.

Risk: "wiki" terminology conflicts with projects that have product-level wiki features.

Mitigation: internal terminology remains Project Knowledge Base and project knowledge.

Risk: agents still skip `query`.

Mitigation: skill descriptions, SessionStart primer, and workflow docs make `query` the expected first step before broad reasoning. Runtime hooks should not over-enforce this.

## Resolved Defaults

- `log.md` remains opt-in through Phase 2.
- Health checks use `lint`, not `query`.
- No explicit `query --health` mode in the first implementation.
- `load`, `update`, and `rebuild` remain real minimal skill directories for marketplace portability, not symlinks.
- `cleanup` remains maintenance-only and is not part of the primary memory skill surface.
- Same-name Claude Code and Codex plugin tracks should share the same version after this rollout; changing either track bumps both.

## Acceptance Criteria

- The primary user-facing memory vocabulary is exactly `query`, `ingest`, and `lint`.
- Existing `load`, `update`, and `rebuild` usage continues working through compatibility aliases.
- `rebuild` behavior is represented as `ingest` bootstrap/full-refresh, not as a separate primary workflow.
- Project knowledge documentation consistently says "Project Knowledge Base" or "project knowledge", not "wiki".
- `query` is read-only and cheap by default.
- `query` can traverse index entries, owner files, shards, aliases, and source references until evidence is sufficient or bounded reads are exhausted.
- `ingest` uses spec/plan files as primary facts and commit messages only as weak hints.
- `ingest` supports incremental, bootstrap, and full-refresh modes.
- `update` is a thin alias for incremental ingest, not the old long commit/diff-driven procedure.
- `lint` is read-only and reports issues plus suggested ingest targets.
- Owner files are dense enough to answer useful project questions, while `index.md` remains compact.
- Claude Code and Codex versions for `superpowers-memory` are synchronized after implementation.
- Release automation preserves same-name Claude Code/Codex plugin version synchronization for future changes.
- No new primary skill is introduced beyond `query`, `ingest`, and `lint`.
