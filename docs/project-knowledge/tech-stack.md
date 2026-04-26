---
last_updated: 2026-04-26
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-26-codex-marketplace-compat-plan.md"
---

# Tech Stack

## Languages & Frameworks

| Technology | Role | Notes |
|-----------|------|-------|
| Node.js | Hook runtime — `hook-runtime.js` (Claude) and `codex-runtime.js` (Codex); inline `node -e` for architect bash hook | Primary runtime for all hook logic on both tracks; replaced earlier bash+python3 approach |
| Bash | Thin hook wrapper scripts (`pre-tool-use`, `session-start`, `user-prompt-expansion`, `run-hook.cmd`) on Claude side | 2-5 line scripts delegating to `hook-runtime.js`; Codex side uses Node.js directly without shell wrappers |
| Markdown | Skills (`SKILL.md`), templates, documentation, design patterns, references, knowledge base files | CommonMark; YAML frontmatter for metadata |
| JSON | Plugin manifests (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`), hook configs (`hooks.json`, `codex-hooks-snippet.json`), marketplace catalogs (`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`) | 2-space indent; expanded multi-line array/object style across both tracks |

## Key Dependencies

| Dependency | Purpose | Why Chosen |
|-----------|---------|------------|
| Claude Code plugin runtime | Executes hooks, loads skills, manages Claude marketplace | Primary deployment target for `plugins/` track |
| Codex CLI plugin runtime | Executes hooks (from `~/.codex/hooks.json`), loads skills, manages Codex marketplace | Experimental deployment target for `codex-plugins/` track (ADR-013) |
| Node.js | JSON parsing, file operations, git command execution in hooks | Available in both Claude Code and Codex environments |
| git | KB staleness detection (`git diff`, `git log`), stale ref verification, branch identification in `classifyFinishingState()` | Present in any development environment |

## Build & Dev Tools

| Tool | Purpose |
|------|---------|
| git | Version control; also used at runtime by hooks |
| GitHub Actions | Release workflow — automated version bumping, tag creation, GitHub Release per plugin |
| Claude Code `/plugin` command | Install / update / manage Claude-track plugins |
| Codex CLI `plugin marketplace` command | Install / upgrade / remove Codex-track plugins (manual upgrade only — no auto-sync for user-added marketplaces) |

## Infrastructure

- **Distribution:** GitHub repository (`jacexh/skill-workshop`) acts as the marketplace source for both tracks. No build step — files served directly.
- **Release:** GitHub Actions `workflow_dispatch` triggers version bump + tag + GitHub Release per plugin.
- **Versioning:** Plugin versions tracked in both `plugins/<name>/.claude-plugin/plugin.json` and `codex-plugins/<name>/.codex-plugin/plugin.json` (Codex side mirrors Claude version per plugin). Marketplace catalogs at `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`.
- **No databases, no external services, no hosted infrastructure.**
