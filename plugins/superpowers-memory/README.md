# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch with no context about existing architecture, conventions, or past decisions.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains 6 knowledge files (`docs/project-knowledge/`) covering architecture, tech stack, features, conventions, decisions, and domain glossary. Updated incrementally after each development iteration.

2. **index.md** — A lightweight index file injected into every session via the `SessionStart` hook, giving the agent passive KB awareness without loading all 6 files.

3. **Lightweight Context Injection** — `PreToolUse` hook intercepts 5 superpowers skills; reminds the agent to run `:load` before planning/execution, and to run `:update` after execution completes or when finishing a development branch.

4. **Zero Modification** — Does not modify superpowers. Influences agent behavior through hook context injection and independent skills.

## Installation

Install via the Skill Workshop marketplace:

```bash
/plugin marketplace add jacexh/skill-workshop
/plugin install superpowers-memory@skill-workshop
```

## Skills

| Skill | Purpose | When to Use |
|-------|---------|------------|
| `superpowers-memory:load` | Read and present project knowledge | Before brainstorming |
| `superpowers-memory:update` | Incremental knowledge update | After completing a development branch |
| `superpowers-memory:rebuild` | Full knowledge regeneration | First setup, or when knowledge has drifted |

## Hooks

| Hook | Event | Behavior |
|------|-------|----------|
| SessionStart | startup, clear, compact | Injects the KB index when it exists, or prompts the user to run `:rebuild` when the KB is missing |
| PreToolUse (Skill) | superpowers skill invocations | Intercepts `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`; advises `:load` before work and `:update` before finishing a branch; blocks when the KB does not exist, or when finishing a branch whose `covers_branch` (branch name + HEAD SHA) does not match current `HEAD` |
| PreToolUse (Write/Edit/MultiEdit/NotebookEdit) | any file write under `docs/project-knowledge/` | Blocks the write unless a write-lock is held. The lock is acquired/released only by `:update` and `:rebuild`, so KB content can never drift from the canonical update flow (no ad-hoc ADR commits, no manual edits). Lock has a 60-min TTL to prevent permanent lockout if a skill aborts midway. |

### KB Write Lock

`docs/project-knowledge/` is owned by `:update` (incremental) and `:rebuild` (full). Direct edits via Write/Edit/MultiEdit/NotebookEdit are blocked unless a lock file (`.git/superpowers-memory.lock`) is present. Both skills acquire the lock at the start of their `Process` and release it at the end:

```bash
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" lock <skill-name>
# … skill does its work …
node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-runtime.js" unlock
```

The lock auto-expires after 60 minutes, so an aborted run can't leave the KB permanently writable. To inspect lock state: `node hook-runtime.js lock-status`.

There is **no escape hatch** — even one-line typo fixes go through `:update`. This is intentional: `:update` re-applies the Exclusion Gate and Single-Owner Principle, so manual edits would just be silently re-shaped (or overwritten) on the next run.

## Knowledge Base Structure

After running `superpowers-memory:rebuild`, your project will have:

```
docs/project-knowledge/
├── index.md          # Lightweight index — injected at every session start
├── architecture.md   # System structure, modules, data flow
├── tech-stack.md     # Languages, frameworks, dependencies
├── features.md       # Implemented and in-progress features
├── conventions.md    # Coding standards, architecture rules
├── decisions.md      # Architecture Decision Records
└── glossary.md       # Domain terminology (Ubiquitous Language)
```

## License

MIT
