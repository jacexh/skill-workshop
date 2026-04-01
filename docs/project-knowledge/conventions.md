---
last_updated: 2026-04-01
updated_by: superpowers-memory:rebuild
triggered_by_plan: null
---

# Conventions

## Coding Standards

- **Hook scripts:** Written in bash with `set -euo pipefail`. All JSON output is produced with `printf` (not `echo`) to avoid platform differences. JSON special characters are escaped via a shared `escape_for_json()` function defined at the top of each hook script.
- **Markdown files:** Skills use YAML frontmatter with `name` and `description` fields. Knowledge base files use frontmatter with `last_updated` (YYYY-MM-DD), `updated_by`, and `triggered_by_plan` fields.
- **`triggered_by_plan` rule:** Only update this field when a concrete plan filename can be identified as the trigger. If no plan triggered the update, preserve the existing value — never overwrite with `null`.
- **JSON manifests:** `plugin.json` and `hooks.json` use 2-space indentation. Verified valid via `python3 -m json.tool` during development.
- **No linter configs present** — the repo has no `.eslintrc`, `.shellcheckrc`, or equivalent. Conventions are followed by practice.

## Architecture Rules

- **Zero-modification principle:** Never modify superpowers core files. The plugin may only influence agent behavior through hook context injection and its own skills.
- **Project-local knowledge base:** Knowledge files (`docs/project-knowledge/`) belong in the target user's project repo, not in this plugin repo. The plugin only ships templates.
- **No external dependencies:** Hook scripts may only use tools universally present in a dev environment (bash, git). No npm, pip, or other package managers.
- **Cross-platform hooks:** Any new hook script must work on both Unix (bash) and Windows (via Git for Windows bash). The `run-hook.cmd` polyglot wrapper handles dispatch.

## Testing Conventions

- No automated test suite exists. Verification is done manually per the steps in each plan task (e.g., run `| python3 -m json.tool` to validate JSON, check file permissions with `ls -la`, test hooks with `bash hooks/session-start`).
- Each plan task includes explicit verification steps that serve as the acceptance criteria.

## Git & Workflow

- **Commit message format:** `<type>: <description>` (e.g., `feat:`, `fix:`, `docs:`, `chore:`). Observed from git log.
- **Branch:** All work committed directly to `main`.
- **Versioning:** Plugin version in `plugin.json` is bumped manually with a `chore: bump superpowers-memory to vX.Y.Z` commit.
- **Specs before plans:** Design specs are written first (`docs/superpowers/specs/`), then implementation plans (`docs/superpowers/plans/`). Plans reference specs.
- **Plan checkboxes:** Implementation plan steps use `- [x]` / `- [ ]` syntax. All steps should be checked when work is complete.
