---
last_updated: 2026-04-01
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Version | Notes |
|-----------|------|---------|-------|
| Bash | Hook scripts (`session-start`, `task-completed`, `stop`, `run-hook.cmd`) | Any POSIX bash | Cross-platform; Windows handled via polyglot wrapper |
| Markdown | Skills (`SKILL.md`), templates, documentation | CommonMark | All skill content and knowledge base files are Markdown |
| JSON | Plugin manifests (`plugin.json`), hook config (`hooks.json`), hook output | — | Hook scripts output JSON for Claude Code context injection |

## Key Dependencies

| Package | Purpose | Why Chosen |
|---------|---------|------------|
| Claude Code plugin runtime | Executes hooks, loads skills, manages marketplace | This is the deployment target; no other runtime is used |
| git | Used in `stop` hook to detect plan file changes via `git diff` | Present in any development environment; no additional install required |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| git | Version control; also used at runtime by the stop hook |
| Claude Code `/plugin` command | Install, update, and manage plugins from the marketplace |

## Infrastructure

- **Distribution:** GitHub repository (`jacexh/skill-workshop`) acts as the marketplace source. No build step, no CI/CD pipeline — files are served directly from the repo.
- **Versioning:** Plugin version is tracked manually in `plugins/superpowers-memory/.claude-plugin/plugin.json`. Bumped with commit + tag on release.
- **No databases, no external services, no hosted infrastructure.**
