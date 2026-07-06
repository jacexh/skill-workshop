# superpowers-memory (Codex)

Project knowledge persistence + KB write-lock for Codex superpowers workflows.

## Primary Memory Skills

- `superpowers-memory:query` — read Project Knowledge Base, traverse owner files/source references, answer with confidence, and emit structured Memory candidates when coverage is missing.
- `superpowers-memory:ingest` — write Project Knowledge Base from stable source facts; supports incremental, bootstrap, full-refresh, and targeted Core Query Coverage.
- `superpowers-memory:lint` — read-only health check over stale refs, shape violations, SSOT duplication, retrieval cost, split candidates, coverage gaps, and suggested ingest targets.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
hooks = true
plugin_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add superpowers-memory@skill-workshop-codex
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

If hooks do not appear after restart, confirm both `hooks = true` and `plugin_hooks = true` are enabled, open `/hooks` to review and trust plugin hooks, and upgrade Codex. If old fallback hooks in `~/.codex/hooks.json` still point at deleted plugin cache paths, remove those stale entries manually or run the plugin's `scripts/install-codex-hooks.js remove` helper from the installed plugin directory.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex. Current Codex versions do not require any setup step after upgrade.

Manual hook config is not recommended. Native lifecycle config lives in `hooks/hooks.json`. If stale fallback entries point at an old deleted cache version and cause `SessionStart hook (failed)`, remove the stale fallback entries from `~/.codex/hooks.json` and restart Codex.

## Capabilities

- **SessionStart hook** — reports KB availability, lightweight KB freshness status, plus standing primer for using `$superpowers-memory:query`; `index.md` is read on demand by the query skill. Stale status is informational and is not an automatic ingest trigger.
- **Storage path** — uses `docs/superpowers/memory/`.
- **UserPromptSubmit hook** — when user types `$superpowers:brainstorming` or `$superpowers:finishing-a-development-branch`, JIT-injects relevant context (query advisory or finishing-readiness review). For stale branches, it treats finishing as a maintenance checkpoint and asks the agent to inspect changed files before deciding whether `$superpowers-memory:ingest` is needed.
- **PreToolUse hook** — blocks `apply_patch` and `mcp__filesystem__.*` writes to `docs/superpowers/memory/` unless write-lock is held by `$superpowers-memory:ingest`.
- **Skills:** `$superpowers-memory:query`, `$superpowers-memory:ingest`, and `$superpowers-memory:lint`.

## KB Quality Evaluation

`superpowers-memory` evaluates project knowledge by **Code Agent outcome**, not by document shape. A KB is valuable when it lets an agent answer real project questions more accurately, use fewer tokens, avoid wrong edits, and detect stale or uncertain facts. Markdown slots, ADR files, frontmatter, indexes, or shards are implementation mechanisms; they are not quality signals by themselves.

For high-value project objects such as bounded contexts, services, major modules, product capabilities, or cross-service flows, the KB should support direct query answers about responsibility, internal layers, interactions, key state/flow rules, and source references. For complex engineering repositories, architecture coverage should include a query-grade system topology, module/service architecture shards or compact cards, named scenario sequences, lifecycle/FSM coverage, and source refs without becoming a full code tour. Module shards should capture stable architecture models from design docs, such as planes, subsystems, workflows, policies, processors, or projections, instead of stopping at generic code-layer labels when richer source material exists. Named scenario shards should carry complete cross-service chains, authority boundaries, ordering/idempotency/failure rules, module refs, and local source refs. `ingest` applies this as Core Query Coverage during bootstrap/full-refresh and targeted incremental updates, while `lint` reports advisory wiki health and coverage gaps.

Large legacy `decisions.md` and `glossary.md` files are upgraded through `$superpowers-memory:ingest`, not by manual edits. A targeted full-refresh can rebuild `decisions.md` into a decision router plus `decisions-<domain>.md` family shards, and rebuild `glossary.md` into an alias router plus `glossary-<domain>.md` term shards while preserving ADR details, aliases, owner refs, and tombstones.

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
- `$superpowers-memory:query` gives agents a lightweight, read-only entry point before planning or architectural work, and produces structured Memory candidates when a durable answer is missing or a reusable durable synthesis should be preserved.
- `$superpowers-memory:ingest` writes stable project facts by forcing source review, owner routing, targeted Core Query Coverage, architecture answerability self-checks, exclusion checks, index routing updates, and verification before commit. Default behavior is no ingest; it runs only at a maintenance checkpoint and skips deployment-only, image/tag/version-only, formatting-only, or comment-only changes that do not alter durable project knowledge.
- `$superpowers-memory:lint` checks KB health without writing and reports suggested ingest targets, including advisory wiki health and answerability gaps.
- The KB write lock prevents ad-hoc edits under `docs/superpowers/memory/`; KB writes must go through `$superpowers-memory:ingest`.
- `codex-runtime.js status` reports `covers_branch` versus current HEAD so Codex has stale-KB evidence even on prompt paths that cannot fire JIT hooks.
- `codex-runtime.js verify` checks stale path references, shape violations including forbidden conversation/chat/transcript KB slots and `noncanonical_memory_infrastructure_slot`, ADR integrity, readiness warnings, SSOT duplication, retrieval cost, split candidates, unrouted shards, architecture coverage gaps including missing module/scenario shards, shallow service cards, missing scenario refs, legacy architecture view shards, missing module/scenario cross-refs, scenario field gaps, and commit readiness.
- For this plugin, Maintainability & Drift Control maps to `covers_branch`, stale references, query-router index size, shape violations, SSOT violations, readiness warnings, retrieval cost, split candidates, advisory `coverageGaps`, and KB write-lock status.

## Known Codex protocol gaps

The following coverage exists on Claude Code but **cannot be implemented on Codex** due to protocol limitations:

1. **Agent-self-decided invocation of `$superpowers:finishing-a-development-branch`** does not fire any hook in Codex. The agent only receives the standing primer from SessionStart, not the JIT diff evidence (commits since `covers_branch`, files changed). User-typed `$superpowers:...` skill mention IS covered via UserPromptSubmit.

2. **Auto-triggered planning skills** (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`) cannot receive a per-skill JIT advisory in Codex because native skill invocation is not exposed as a hookable tool or event. Coverage falls back to SessionStart standing primer.
