---
last_updated: 2026-04-13
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Conventions

## Coding Standards

- **Hook runtime (superpowers-memory):** All hook logic lives in `hook-runtime.js` (Node.js). The bash scripts (`pre-tool-use`, `session-start`, `stop`) are thin 2-5 line wrappers that `exec node hook-runtime.js <mode>`. JSON output follows Claude Code hook protocol: `hookSpecificOutput` wrapper in plugin env, flat `additional_context` otherwise.
- **Hook scripts (superpowers-architect):** Written in bash with `set -euo pipefail`. Uses inline `node -e` for JSON parsing and output construction.
- **Markdown files:** Skills use YAML frontmatter with `name` and `description` fields. Knowledge base files use frontmatter with `last_updated` (YYYY-MM-DD), `updated_by`, and `triggered_by_plan` fields.
- **`triggered_by_plan` rule:** Only update this field when a concrete plan filename can be identified as the trigger. If no plan triggered the update, preserve the existing value — never overwrite with `null`.
- **Content rules:** `content-rules.md` is the shared SSOT for content generation guidelines used by `rebuild` and `update` skills. Defines language, inclusion/exclusion criteria, SSOT ownership, quality standards, and size guard thresholds.
- **JSON manifests:** `plugin.json` and `hooks.json` use 2-space indentation.
- **No linter configs present** — conventions followed by practice.

## Architecture Rules

- **Zero-modification principle:** Never modify superpowers core files. Only influence agent behavior through hook context injection and independent skills (ADR-002).
- **Project-local knowledge base:** Knowledge files (`docs/project-knowledge/`) belong in the target user's project repo, not in this plugin repo. The plugin only ships templates.
- **No external dependencies beyond Node.js and git:** Hook scripts may only use tools present in a standard Claude Code environment.
- **Cross-platform hooks:** Any new hook script must work on both Unix and Windows. The `run-hook.cmd` polyglot wrapper handles dispatch.

## Testing Conventions

- No automated test suite. Verification is done manually per plan task acceptance criteria.
- The `verify` command in `hook-runtime.js` provides automated checks for KB files (size thresholds, stale path references, git commit readiness).

## Git & Workflow

- **Commit message format:** `<type>: <description>` or `<type>(<scope>): <description>` (e.g., `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- **Branch:** All work committed directly to `main`.
- **Versioning:** Bumped via GitHub Actions release workflow (`workflow_dispatch`) or manual commit. Version tracked in both `plugin.json` and `marketplace.json`.
- **Specs before plans:** Design specs (`docs/superpowers/specs/`), then implementation plans (`docs/superpowers/plans/`). Plans reference specs.
- **Plan checkboxes:** Implementation plan steps use `- [x]` / `- [ ]` syntax.
