# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch with no context about existing architecture, conventions, or past decisions.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains 6 knowledge files (`docs/project-knowledge/`) covering architecture, tech stack, features, conventions, decisions, and domain glossary. Updated incrementally after each development iteration.

2. **index.md** — A lightweight index file injected into every session via the `SessionStart` hook, giving the agent passive KB awareness without loading all 6 files.

3. **Lightweight Context Injection** — `PreToolUse` hook intercepts `brainstorming`, `writing-plans`, and `finishing-a-development-branch`; reminds the agent to load KB files before planning and to run `:update` only when the finished branch actually changed project knowledge.

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
| Stop | Session end | Warning-only reminder when the workspace has project changes outside `docs/project-knowledge/`; it never blocks session end |
| PreToolUse | superpowers skill invocations | Intercepts `superpowers:brainstorming`, `superpowers:writing-plans`, and `superpowers:finishing-a-development-branch`; reminds the agent to use the KB, and blocks only when the KB does not exist |

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
