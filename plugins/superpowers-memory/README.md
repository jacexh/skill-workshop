# superpowers-memory

A Claude Code plugin that adds project knowledge persistence and plan checkpoint tracking to [superpowers](https://github.com/obra/superpowers) workflows.

## Problem

Superpowers' workflow (brainstorming → writing-plans → executing-plans → finishing) lacks cross-iteration memory. Each new session starts from scratch. Additionally, plan file checkboxes are never updated during execution, preventing session recovery.

## What This Plugin Does

1. **Project Knowledge Base** — Maintains 5 knowledge files (`docs/project-knowledge/`) covering architecture, tech stack, features, conventions, and decisions. Updated incrementally after each iteration.

2. **Plan Live Documents** — Hooks remind the agent to update plan checkboxes (`- [ ]` → `- [x]`) as tasks complete, enabling mid-session recovery.

3. **Zero Modification** — Does not modify superpowers. Influences agent behavior through hook context injection and independent skills.

## Installation

Install as a Claude Code plugin:

```bash
claude plugin add <path-or-url-to-superpowers-memory>
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
| SessionStart | startup, clear, compact | KB not initialized prompt — injects rebuild instruction when `docs/project-knowledge/` does not exist; outputs `{}` otherwise |
| Stop | Session end | Session-end KB staleness safety net — injects mandatory `:update` reminder when KB SHA is behind HEAD |
| PreToolUse | superpowers skill invocations | Precise KB context injection — intercepts `superpowers:brainstorming`, `superpowers:writing-plans`, and `superpowers:finishing-a-development-branch`; injects KB-state-aware context (load instruction, stale warning, or update/rebuild mandate) |

## Knowledge Base Structure

After running `superpowers-memory:rebuild`, your project will have:

```
docs/project-knowledge/
├── architecture.md   # System structure, modules, data flow
├── tech-stack.md     # Languages, frameworks, dependencies
├── features.md       # Implemented and in-progress features
├── conventions.md    # Coding standards, architecture rules
└── decisions.md      # Architecture Decision Records
```

## License

MIT
