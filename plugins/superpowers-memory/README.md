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
| PreToolUse | superpowers skill invocations | Intercepts `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `finishing-a-development-branch`; advises `:load` before work and `:update` before finishing a branch; blocks when the KB does not exist, or when finishing a branch whose `covers_branch` (branch name + HEAD SHA) does not match current `HEAD` |

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
