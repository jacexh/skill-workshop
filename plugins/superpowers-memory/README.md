# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Primary Memory Skills

- `superpowers-memory:query` — read Project Knowledge Base, traverse owner files/source references, answer with confidence, and emit structured Memory candidates when coverage is missing.
- `superpowers-memory:ingest` — write Project Knowledge Base from stable source facts; supports incremental, bootstrap, full-refresh, and targeted Core Query Coverage.
- `superpowers-memory:lint` — read-only health check over stale refs, shape violations, SSOT duplication, retrieval cost, split candidates, coverage gaps, and suggested ingest targets.

Compatibility aliases:

- `superpowers-memory:load` → `query`
- `superpowers-memory:update` → `ingest` incremental mode
- `superpowers-memory:rebuild` → `ingest` bootstrap/full-refresh mode

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch with no context about existing architecture, conventions, or past decisions.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains 6 core knowledge entry files (`docs/superpowers/memory/`) covering architecture, tech stack, features, conventions, decisions, and domain glossary. Large projects can split any non-index entry file into focused shard files. Architecture uses a stricter module-first + named scenario layout, such as `architecture-orchestrator.md` and `architecture-runtime-message-chain.md`; other slots use stable domain shards such as `features-admin.md`. Updated incrementally after each development iteration.

   Legacy `docs/project-knowledge/` installations are hard-migrated by memory skills with `git mv docs/project-knowledge docs/superpowers/memory` when the new directory does not already exist.

2. **index.md** — A lightweight index file injected into every session via the `SessionStart` hook, giving the agent passive KB awareness without loading the underlying files.

3. **Lightweight Context Injection** — `PreToolUse` hook intercepts 5 superpowers skills; reminds the agent to run `superpowers-memory:query` before planning/execution, and to run `superpowers-memory:ingest` after execution completes or when finishing a development branch. Compatibility aliases (`load`, `update`, `rebuild`) continue to route to those primary workflows.

4. **Zero Modification** — Does not modify superpowers. Influences agent behavior through hook context injection and independent skills.

## Installation

Install via the Skill Workshop marketplace:

```bash
/plugin marketplace add jacexh/skill-workshop
/plugin install superpowers-memory@skill-workshop
```

## Primary Skills

| Skill | Purpose | When to Use |
|-------|---------|------------|
| `superpowers-memory:query` | Read Project Knowledge Base owner files and answer from grounded sources | Before exploring, planning, architecture decisions, broad search, or answering project questions |
| `superpowers-memory:ingest` | Create, incrementally update, or full-refresh Project Knowledge Base facts | After a spec, plan, PR, or implementation branch; when bootstrap or full-refresh is needed |
| `superpowers-memory:lint` | Check Project Knowledge Base health without writing | When stale refs, shape violations, SSOT issues, retrieval cost, or suggested ingest targets need review |

Compatibility aliases:

| Alias | Primary workflow |
|-------|------------------|
| `superpowers-memory:load` | `query` |
| `superpowers-memory:update` | `ingest` incremental mode |
| `superpowers-memory:rebuild` | `ingest` bootstrap/full-refresh mode |

## Hooks

| Hook | Event | Behavior |
|------|-------|----------|
| SessionStart | startup, clear, compact | Injects the KB index when it exists, or prompts the user to run `superpowers-memory:ingest` bootstrap mode (or the `rebuild` compatibility alias) when the KB is missing |
| PreToolUse (Skill) | superpowers skill invocations | Intercepts `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`; advises `superpowers-memory:query` before work and `superpowers-memory:ingest` before finishing a branch; blocks when the KB does not exist, or when finishing a branch whose `covers_branch` (branch name + HEAD SHA) does not match current `HEAD` |
| PreToolUse (Write/Edit/MultiEdit/NotebookEdit) | any file write under `docs/superpowers/memory/` | Blocks the write unless a write-lock is held. The lock is acquired/released only by `superpowers-memory:ingest` or its `update`/`rebuild` compatibility aliases, so KB content can never drift from the canonical update flow (no ad-hoc ADR commits, no manual edits). Lock has a 60-min TTL to prevent permanent lockout if a skill aborts midway. |

### KB Write Lock

`docs/superpowers/memory/` is owned by `superpowers-memory:ingest`. Direct edits via Write/Edit/MultiEdit/NotebookEdit are blocked unless a lock file (`.git/superpowers-memory.lock`) is present. `ingest` and its `update`/`rebuild` compatibility aliases acquire the lock at the start of their `Process` and release it at the end:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" lock <skill-name>
# … skill does its work …
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" unlock
```

The lock auto-expires after 60 minutes, so an aborted run can't leave the KB permanently writable. To inspect lock state: `node hook-runtime.js lock-status`.

There is **no escape hatch** — even one-line typo fixes go through `superpowers-memory:ingest`. This is intentional: the ingest skill re-applies the Exclusion Gate and Single-Owner Principle, so manual edits would just be silently re-shaped (or overwritten) on the next run.

## Knowledge Base Structure

After running `superpowers-memory:ingest` in bootstrap mode (or the `rebuild` compatibility alias), your project will have:

```
docs/superpowers/memory/
├── index.md          # Lightweight index — injected at every session start
├── architecture.md   # System structure, modules, data flow
├── tech-stack.md     # Languages, frameworks, dependencies
├── features.md       # Implemented and in-progress features
├── conventions.md    # Coding standards, architecture rules
├── decisions.md      # Decision index / ADR summaries
├── adr/              # Per-ADR rationale details (on-demand load)
├── glossary.md       # Domain terminology (Ubiquitous Language)
└── <slot>-<domain>.md # Optional focused shards, e.g. architecture-orchestrator.md
```

`adr/` appears only when ADR details exist. Split shard files are optional and should be created by stable domain, submodule, bounded context, platform capability, practice area, decision family, deploy unit, or workflow boundary — never by arbitrary pagination. Shards must be reachable from `index.md` or the parent owner file. Architecture shards should be module-first (`architecture-<module>.md`) or named scenario shards (`architecture-<scenario>.md`), not legacy view shards like `architecture-contexts.md` or `architecture-flows.md`. `decisions.md` is a decision index; it is not LLM Wiki's operation `log.md`.

## KB Quality Evaluation

`superpowers-memory` evaluates project knowledge by **Code Agent outcome**, not by document shape. A KB is valuable when it lets an agent answer real project questions more accurately, use fewer tokens, avoid wrong edits, and detect stale or uncertain facts. Markdown slots, ADR files, frontmatter, indexes, or shards are implementation mechanisms; they are not quality signals by themselves.

For high-value project objects such as bounded contexts, services, major modules, product capabilities, or cross-service flows, the KB should support direct query answers about responsibility, internal layers, interactions, key state/flow rules, and source references. For complex engineering repositories, architecture coverage should include a query-grade system topology, module/service architecture shards or compact cards, named scenario sequences, lifecycle/FSM coverage, and source refs without becoming a full code tour. Module shards should capture stable architecture models from design docs, such as planes, subsystems, workflows, policies, processors, or projections, instead of stopping at generic code-layer labels when richer source material exists. Named scenario shards should carry complete cross-service chains, authority boundaries, ordering/idempotency/failure rules, module refs, and local source refs. `ingest` applies this as Core Query Coverage during bootstrap/full-refresh and targeted incremental updates, while `lint` reports advisory wiki health and coverage gaps.

If a sub-metric is not natural for a project's documentation shape, look for equivalent evidence. Mark it `N/A` only when the form is inapplicable and the underlying agent outcome is not harmed. Do not use `N/A` to hide missing capability.

### Scoring Anchor

Use the same 0-5 anchor for every dimension:

| Score | Meaning |
|-------|---------|
| 0 | Capability is absent; the agent cannot reliably complete related tasks. |
| 1 | Occasionally helpful, but depends on guessing, human correction, or large code reads. |
| 2 | Covers some common cases, but weak on boundaries, exceptions, or high-risk areas. |
| 3 | Supports most normal tasks; gaps are identifiable. |
| 4 | Supports common and high-risk tasks; errors are traceable and correctable. |
| 5 | Consistently improves agent accuracy, speed, and safety, with ongoing maintenance evidence. |

### Evaluation Dimensions

| Dimension | What to Evaluate | Evidence Method |
|-----------|------------------|-----------------|
| Task Answerability | Can the agent answer real understanding, change, debugging, decision, and deployment questions from the KB? Does it admit gaps instead of inventing answers? | Ask 10-20 real questions from recent PRs, issues, plans, incidents, or onboarding notes. Check whether KB-only answers are complete enough to act on. |
| Grounded Correctness | Do KB facts match current code, config, CI, dependencies, and runtime behavior? Are stale, environment-specific, inferred, or uncertain claims marked clearly? | Sample KB claims and compare them with current files, manifests, tests, CI, deployment config, or maintainer-confirmed facts. |
| Decision Context | Does the KB preserve why major choices were made, including rejected alternatives, trade-offs, constraints, and failure conditions? | Pick recent or high-impact decisions and ask why the project did not choose another path. Load ADR detail only when needed. |
| Operational Actionability | Does the KB change what the agent does: which files to touch, what not to do, which commands to run, how to verify, and when to stop? | Give the agent real tasks such as adding a capability, changing a contract, fixing a test, or preparing a release. Trace the plan back to KB rules or facts. |
| Retrieval & Token Efficiency | Can the agent find the right knowledge without loading the whole KB? Are details lazy-loaded and duplicate/conflicting facts minimized? | Record which files are loaded per question, irrelevant context volume, repeated facts, and whether index/detail routing gets the agent to the right source. |
| Maintainability & Drift Control | Does the KB stay trustworthy as the project changes? Are update triggers, ownership, drift checks, write protection, and stale-state warnings in place? | Inspect recent code changes versus KB updates, ownership/review hooks, drift signals, and stale or deprecated knowledge markers. |

### How This Plugin Supports the Standard

- `index.md`, optional shard files, and lazy ADR detail files target retrieval and token efficiency.
- `content-rules.md` defines fact ownership, exclusion rules, ADR gates, progressive knowledge layout, and per-file content boundaries.
- `superpowers-memory:query` gives agents a lightweight, read-only entry point before planning or architectural work, and produces structured Memory candidates when a durable answer is missing or a reusable durable synthesis should be preserved; `load` remains a compatibility alias.
- `superpowers-memory:ingest` forces source review, owner routing, targeted Core Query Coverage, architecture answerability self-checks, exclusion checks, index regeneration, and verification before commit; `update` and `rebuild` remain compatibility aliases for incremental and bootstrap/full-refresh modes.
- `superpowers-memory:lint` checks KB health without writing and reports suggested ingest targets, including advisory wiki health and answerability gaps.
- The KB write lock prevents ad-hoc edits under `docs/superpowers/memory/`; KB writes must go through `superpowers-memory:ingest` or its compatibility aliases.
- `hook-runtime.js verify` checks stale path references, shape violations including forbidden conversation/chat/transcript KB slots, ADR integrity, readiness warnings, SSOT duplication, retrieval cost, split candidates, unrouted shards, architecture coverage gaps including missing module/scenario shards, shallow service cards, missing scenario refs, legacy architecture view shards, missing module/scenario cross-refs, scenario field gaps, and commit readiness.
- For this plugin, Maintainability & Drift Control maps to `covers_branch`, stale references, hot-path index size, shape violations, SSOT violations, readiness warnings, retrieval cost, split candidates, advisory `coverageGaps`, and KB write-lock status.

## License

MIT
