# superpowers-memory (Codex)

Project knowledge persistence + KB write-lock for Codex superpowers workflows.

## Installation

Codex hooks require this feature flag in `~/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin install superpowers-memory
```

Restart Codex. Current Codex versions load this plugin's lifecycle config from `hooks/hooks.json` via `.codex-plugin/plugin.json`.

If hooks do not appear after restart, confirm `codex_hooks` is enabled and upgrade Codex. If you previously used fallback hooks in `~/.codex/hooks.json`, run `$superpowers-memory:cleanup` once to remove the old entries.

## Upgrade

```bash
codex plugin marketplace upgrade jacexh/skill-workshop
```

Restart Codex. Current Codex versions do not require any setup step after upgrade.

Manual hook config is not recommended. Native lifecycle config lives in `hooks/hooks.json`. If stale fallback entries point at an old deleted cache version and cause `SessionStart hook (failed)`, run `$superpowers-memory:cleanup` and restart Codex.

## Capabilities

- **SessionStart hook** — injects KB index from `docs/project-knowledge/index.md`, lightweight KB freshness status, plus standing primer for KB workflow
- **UserPromptSubmit hook** — when user types `$superpowers:brainstorming` or `$superpowers:finishing-a-development-branch`, JIT-injects relevant context (load advisory or finishing-readiness rich injection)
- **PreToolUse hook** — blocks `apply_patch` and `mcp__filesystem__.*` writes to `docs/project-knowledge/` unless write-lock is held by `$superpowers-memory:update` or `$superpowers-memory:rebuild`
- **Skills:** `load`, `update`, `rebuild`, `cleanup`

## KB Quality Evaluation

`superpowers-memory` evaluates project knowledge by **Code Agent outcome**, not by document shape. A KB is valuable when it lets an agent answer real project questions more accurately, use fewer tokens, avoid wrong edits, and detect stale or uncertain facts. Markdown slots, ADR files, frontmatter, indexes, or playbooks are implementation mechanisms; they are not quality signals by themselves.

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

- `index.md` and lazy ADR/playbook detail files target retrieval and token efficiency.
- `content-rules.md` defines fact ownership, exclusion rules, ADR gates, playbook gates, and per-file content boundaries.
- `$superpowers-memory:load` gives agents a lightweight entry point before planning or architectural work.
- `$superpowers-memory:update` and `$superpowers-memory:rebuild` force source review, owner routing, exclusion checks, index regeneration, and verification before commit.
- The KB write lock prevents ad-hoc edits under `docs/project-knowledge/`; updates must go through the memory skills.
- `codex-runtime.js status` reports `covers_branch` versus current HEAD so Codex has stale-KB evidence even on prompt paths that cannot fire JIT hooks.
- `codex-runtime.js verify` checks stale path references, file size thresholds, shape violations, ADR/playbook integrity, readiness warnings, SSOT duplication, token budget, and commit readiness.
- For this plugin, Maintainability & Drift Control maps to `covers_branch`, stale references, size warnings, shape violations, SSOT violations, readiness warnings, token budget, and KB write-lock status.

## Known Codex protocol gaps

The following coverage exists on Claude Code but **cannot be implemented on Codex** due to protocol limitations:

1. **Agent-self-decided invocation of `$superpowers:finishing-a-development-branch`** does not fire any hook in Codex. The agent only receives the standing primer from SessionStart, not the JIT diff evidence (commits since `covers_branch`, files changed). User-typed slash invocation IS covered via UserPromptSubmit.

2. **Auto-triggered planning skills** (`writing-plans`, `executing-plans`, `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`) cannot receive a per-skill JIT advisory in Codex (matcher does not support skill names). Coverage falls back to SessionStart standing primer.
