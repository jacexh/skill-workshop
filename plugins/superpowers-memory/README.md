# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Primary Memory Skills

- `superpowers-memory:query` — read Project Knowledge Base, traverse owner files/source references, answer with confidence, and emit structured Memory candidates when coverage is missing.
- `superpowers-memory:ingest` — write Project Knowledge Base from stable source facts; supports incremental, bootstrap, full-refresh, and targeted Core Query Coverage.
- `superpowers-memory:lint` — read-only health check over stale refs, shape violations, SSOT duplication, retrieval cost, split candidates, coverage gaps, and suggested ingest targets.

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch with no context about existing architecture, conventions, or past decisions.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains core knowledge files (`docs/superpowers/memory/`) covering architecture, tech stack, features, conventions, decisions, and domain glossary. Large projects can split any non-index entry file into focused shard files. Architecture uses a stricter module-first + named scenario layout, such as `architecture-orchestrator.md` and `architecture-runtime-message-chain.md`; other slots use stable domain shards such as `features-admin.md`. Updates happen through explicit `superpowers-memory:ingest` maintenance checkpoints, not continuous session sync.

2. **index.md** — A lightweight router read on demand by `superpowers-memory:query`, giving the agent a way to find the smallest useful owner files without loading the whole KB.

3. **Lightweight Context Injection** — `PreToolUse` hook intercepts 5 superpowers skills; reminds the agent to run `superpowers-memory:query` before planning/execution, and to inspect stale branch changes before finishing. Default behavior is no ingest; `superpowers-memory:ingest` is used only at a maintenance checkpoint with stable durable project knowledge to preserve.

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
| `superpowers-memory:ingest` | Create, incrementally update, or full-refresh Project Knowledge Base facts | Only at a maintenance checkpoint: explicit user request, finishing/commit/PR/merge/switching tasks with stable durable knowledge, or bootstrap/full-refresh |
| `superpowers-memory:lint` | Check Project Knowledge Base health without writing | When stale refs, shape violations, SSOT issues, retrieval cost, or suggested ingest targets need review |

## Hooks

| Hook | Event | Behavior |
|------|-------|----------|
| SessionStart | startup, clear, compact | Reports that the KB is available and points the agent to `superpowers-memory:query`, or prompts the user to run `superpowers-memory:ingest` bootstrap mode when the KB is missing. It does not inject freshness status or inline `index.md`; `query` reads the index on demand. |
| PreToolUse (Skill) | superpowers skill invocations | Intercepts `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`; advises `superpowers-memory:query` before work and asks the agent to inspect stale branch changes before finishing. It recommends `superpowers-memory:ingest` only when the finishing point is a maintenance checkpoint and durable changes affect capabilities, architecture, conventions, dependency choices, decisions, glossary terms, lifecycle rules, or query answerability. |
| PreToolUse (Write/Edit/MultiEdit/NotebookEdit) | any file write under `docs/superpowers/memory/` | Blocks the write unless a write-lock is held. The lock is acquired/released only by `superpowers-memory:ingest`, so KB content can never drift from the canonical maintenance flow (no ad-hoc ADR commits, no manual edits). Lock has a 60-min TTL to prevent permanent lockout if a skill aborts midway. |

### KB Write Lock

`docs/superpowers/memory/` is owned by `superpowers-memory:ingest`. Direct edits via Write/Edit/MultiEdit/NotebookEdit are blocked unless a lock file (`.git/superpowers-memory.lock`) is present. `ingest` acquires the lock at the start of its `Process` and releases it at the end:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" lock <skill-name>
# … skill does its work …
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" unlock
```

The lock auto-expires after 60 minutes, so an aborted run can't leave the KB permanently writable. To inspect lock state: `node hook-runtime.js lock-status`.

There is **no escape hatch** — even one-line typo fixes go through `superpowers-memory:ingest`. This is intentional: the ingest skill re-applies the Exclusion Gate and Single-Owner Principle, so manual edits would just be silently re-shaped (or overwritten) on the next run.

## Knowledge Base Structure

After running `superpowers-memory:ingest` in bootstrap mode, your project will have:

```
docs/superpowers/memory/
├── index.md          # Lightweight query router, read on demand
├── architecture.md   # System structure, modules, data flow
├── tech-stack.md     # Languages, frameworks, dependencies
├── features.md       # Implemented and in-progress features
├── conventions.md    # Coding standards, architecture rules
├── decisions.md      # Decision index / ADR summaries
├── adr/              # Per-ADR rationale details (on-demand load)
├── glossary.md       # Domain terminology (Ubiquitous Language)
└── <slot>-<domain>.md # Optional focused shards, e.g. architecture-orchestrator.md
```

`adr/` appears only when ADR details exist. Split shard files are optional and should be created by stable domain, submodule, bounded context, platform capability, practice area, decision family, deploy unit, or workflow boundary — never by arbitrary pagination. Shards must be reachable from `index.md` or the parent owner file. Architecture shards should be module-first (`architecture-<module>.md`) or named scenario shards (`architecture-<scenario>.md`), not legacy view shards like `architecture-contexts.md` or `architecture-flows.md`. `decisions.md` is a decision index, not a fact owner for current capability or architecture details.

## KB Quality Evaluation

`superpowers-memory` evaluates project knowledge by **Code Agent outcome**, not by document shape. A KB is valuable when it lets an agent answer real project questions more accurately, use fewer tokens, avoid wrong edits, and detect stale or uncertain facts. Markdown slots, ADR files, frontmatter, indexes, or shards are implementation mechanisms; they are not quality signals by themselves.

For high-value project objects such as bounded contexts, services, major modules, product capabilities, or cross-service flows, the KB should support direct query answers about responsibility, internal layers, interactions, key state/flow rules, and source references. For complex engineering repositories, architecture coverage should include a query-grade system topology, module/service architecture shards or compact cards, named scenario sequences, lifecycle/FSM coverage, and source refs without becoming a full code tour. Module shards should capture stable architecture models from design docs, such as planes, subsystems, workflows, policies, processors, or projections, instead of stopping at generic code-layer labels when richer source material exists. Named scenario shards should carry complete cross-service chains, authority boundaries, ordering/idempotency/failure rules, module refs, and local source refs. `ingest` applies this as Core Query Coverage during bootstrap/full-refresh and targeted incremental updates, while `lint` reports advisory wiki health and coverage gaps.

Large legacy `decisions.md` and `glossary.md` files are upgraded through `superpowers-memory:ingest`, not by manual edits. A targeted full-refresh can rebuild `decisions.md` into a decision router plus `decisions-<domain>.md` family shards, and rebuild `glossary.md` into an alias router plus `glossary-<domain>.md` term shards while preserving ADR details, aliases, owner refs, and tombstones.

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
- `superpowers-memory:query` gives agents a lightweight, read-only entry point before planning or architectural work, and produces structured Memory candidates when a durable answer is missing or a reusable durable synthesis should be preserved.
- `superpowers-memory:ingest` forces source review, owner routing, targeted Core Query Coverage, architecture answerability self-checks, exclusion checks, index routing updates, and verification before commit. Default behavior is no ingest; it runs only at a maintenance checkpoint and skips deployment-only, image/tag/version-only, formatting-only, or comment-only changes that do not alter durable project knowledge.
- `superpowers-memory:lint` checks KB health without writing and reports suggested ingest targets, including advisory wiki health and answerability gaps.
- The KB write lock prevents ad-hoc edits under `docs/superpowers/memory/`; KB writes must go through `superpowers-memory:ingest`.
- `hook-runtime.js verify` checks stale path references, shape violations including forbidden conversation/chat/transcript KB slots and `noncanonical_memory_infrastructure_slot`, ADR integrity, readiness warnings, SSOT duplication, retrieval cost, split candidates, unrouted shards, architecture coverage gaps including missing module/scenario shards, shallow service cards, missing scenario refs, legacy architecture view shards, missing module/scenario cross-refs, scenario field gaps, and commit readiness.
- For this plugin, Maintainability & Drift Control maps to `covers_branch`, stale references, query-router index size, shape violations, SSOT violations, readiness warnings, retrieval cost, split candidates, advisory `coverageGaps`, and KB write-lock status.

## License

MIT
