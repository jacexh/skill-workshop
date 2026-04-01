---
last_updated: 2026-04-01
updated_by: superpowers-memory:update
triggered_by_plan: 2026-04-01-memory-index.md
---

# Architecture

## System Overview

Skill Workshop is a Claude Code plugin marketplace — a curated collection of plugins that extend Claude Code's capabilities for software development workflows. The repository serves two purposes: (1) it is a marketplace catalog that Claude Code can install plugins from, and (2) it contains the source for each plugin. Each plugin is self-contained under `plugins/<name>/` with its own hooks, skills, and templates. The marketplace definition in `.claude-plugin/marketplace.json` makes the repo discoverable via `/plugin marketplace add`.

## Module Structure

| Module | Responsibility | Key Interfaces | Dependencies |
|--------|---------------|----------------|--------------|
| `.claude-plugin/` | Marketplace catalog definition | `marketplace.json` — lists available plugins and their locations | None |
| `plugins/superpowers-memory/` | Plugin: cross-session project knowledge persistence and plan checkpoint tracking | Skills (`load`, `update`, `rebuild`), Hooks (`session-start`, `task-completed`, `stop`) | Claude Code plugin runtime |
| `plugins/superpowers-memory/.claude-plugin/plugin.json` | Plugin manifest (name, version, author, license) | Parsed by Claude Code plugin manager | None |
| `plugins/superpowers-memory/hooks/` | Hook scripts that inject behavior context into agent sessions | `hooks.json` declares event bindings; `run-hook.cmd` is the cross-platform dispatcher; `pre-tool-use` intercepts skill calls | bash, git, python3 |
| `plugins/superpowers-memory/skills/` | Three skills for managing the project knowledge base | `load/SKILL.md`, `update/SKILL.md`, `rebuild/SKILL.md` | Read by Claude Code skill system |
| `plugins/superpowers-memory/templates/` | Structural templates for the 5 knowledge base file types | Used by `rebuild` and `update` skills as fill-in-the-blank scaffolds | None |
| `docs/superpowers/` | Design specs and implementation plans for plugins in this repo | `specs/`, `plans/` — consumed by developers and agents during implementation | None |

## Data Flow

1. **Install:** User runs `/plugin marketplace add jacexh/skill-workshop` → Claude Code reads `.claude-plugin/marketplace.json` → user installs desired plugin
2. **Session start:** Claude Code fires `SessionStart` hook → `run-hook.cmd session-start` executes → (a) if KB missing: "not initialized" prompt; (b) if `docs/project-knowledge/MEMORY.md` exists: reads and injects index content; (c) otherwise `{}`
3. **Knowledge management:** User or agent invokes `superpowers-memory:rebuild` / `:update` / `:load` → agent reads codebase / existing knowledge files → agent writes/updates `docs/project-knowledge/*.md` in the target project
4. **Skill interception:** Claude Code fires `PreToolUse` on `Skill` tool calls → `run-hook.cmd pre-tool-use` → stdin JSON parsed with `python3` to extract `tool_input.skill` → if skill is `brainstorming`, `writing-plans`, or `finishing-a-development-branch`, determines KB state (not_initialized / stale / fresh) and injects targeted context
5. **Session end:** Claude Code fires `Stop` → `run-hook.cmd stop` → script compares `git log -1 -- docs/project-knowledge/` SHA against `HEAD` → if KB is behind, injects `:update` reminder

## Key Design Decisions

- **Zero-modification principle:** The plugin never modifies superpowers core files. All behavior influence is through hook context injection and independent skills.
- **Project-local knowledge base:** `docs/project-knowledge/` lives inside the target project repo, versioned alongside code.
- **5-file split:** Knowledge is split into distinct files (architecture, tech-stack, features, conventions, decisions) to enable surgical incremental updates rather than full rewrites.
- **Cross-platform hook dispatcher:** `run-hook.cmd` is a polyglot bash/batch script that works on both Windows and Unix.
