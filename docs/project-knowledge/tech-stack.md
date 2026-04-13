---
last_updated: 2026-04-13
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Notes |
|-----------|------|-------|
| Node.js | Hook runtime (`hook-runtime.js` for superpowers-memory; inline `node -e` for superpowers-architect) | Primary runtime for all hook logic; replaced earlier bash+python3 approach |
| Bash | Thin hook wrapper scripts (`pre-tool-use`, `session-start`, `stop`, `run-hook.cmd`) | Each script is 2-5 lines delegating to `hook-runtime.js` or running inline node; cross-platform via polyglot `run-hook.cmd` |
| Markdown | Skills (`SKILL.md`), templates, documentation, design patterns, knowledge base files | CommonMark format |
| JSON | Plugin manifests (`plugin.json`), hook config (`hooks.json`), hook output | Hook scripts output JSON for Claude Code context injection |

## Key Dependencies

| Dependency | Purpose | Why Chosen |
|-----------|---------|------------|
| Claude Code plugin runtime | Executes hooks, loads skills, manages marketplace | Deployment target; no other runtime is used |
| Node.js | Used in hooks for JSON parsing, file operations, git command execution | Available via Claude Code's own runtime; replaced python3 for consistency |
| git | Used in hooks for KB staleness detection (`git diff`, `git log`), stale ref verification | Present in any development environment; no additional install required |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| git | Version control; also used at runtime by hooks |
| GitHub Actions | Release workflow — automated version bumping in `plugin.json` + `marketplace.json`, tag creation, GitHub Release |
| Claude Code `/plugin` command | Install, update, and manage plugins from the marketplace |

## Infrastructure

- **Distribution:** GitHub repository (`jacexh/skill-workshop`) acts as the marketplace source. No build step — files are served directly from the repo.
- **Release:** GitHub Actions `workflow_dispatch` triggers version bump + tag + GitHub Release per plugin.
- **Versioning:** Plugin version tracked in both `plugins/<name>/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`. Bumped via release workflow or manual commit.
- **No databases, no external services, no hosted infrastructure.**
