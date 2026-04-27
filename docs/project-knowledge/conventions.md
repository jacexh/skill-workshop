---
last_updated: 2026-04-27
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Conventions

## Coding Standards

- **Hook runtime (Claude memory):** All hook logic lives in `plugins/superpowers-memory/hooks/hook-runtime.js`. Bash scripts (`pre-tool-use`, `session-start`, `user-prompt-expansion`) are 2-5 line wrappers that `exec node hook-runtime.js <mode>`. JSON output: `hookSpecificOutput` wrapper in plugin env, flat `additional_context` otherwise.
- **Hook runtime (Codex memory):** `codex-plugins/superpowers-memory/hooks/codex-runtime.js` — same modes minus `user-prompt-expansion`, plus `user-prompt-submit`. Plugin-root resolution uses `path.dirname(__filename)` instead of `${CLAUDE_PLUGIN_ROOT}` (Codex provides no equivalent env var). Output always uses `hookSpecificOutput.additionalContext` form.
- **Hook scripts (architect Claude):** Bash with `set -euo pipefail`. Inline `node -e` for JSON parsing. Reads YAML frontmatter for pattern name/description.
- **Hook scripts (architect Codex):** Direct Node.js (`codex-runtime.js`) with `session-start` and `user-prompt-submit` modes. Pattern dirs resolve bundled defaults, Claude/global dirs, then project dirs; later dirs override earlier dirs by filename.
- **Hook scripts (designing-tests Codex):** Direct Node.js (`codex-runtime.js`), single `session-start` mode. Same YAML frontmatter parsing as Claude side.
- **Markdown files:** Skills use YAML frontmatter with `name` and `description`. Knowledge base files use `last_updated` (YYYY-MM-DD), `updated_by`, `triggered_by_plan`.
- **`triggered_by_plan` rule:** Only update this field when a concrete plan filename can be identified as the trigger. If no plan triggered the update, **preserve the existing value — never overwrite with `null`**.
- **Content rules (KB):** `content-rules.md` is the shared SSOT for `rebuild` and `update` skills. Defines language, inclusion/exclusion criteria, ownership matrix, quality standards, size guards.
- **JSON manifests:** `plugin.json`, `hooks.json`, `marketplace.json`, `codex-hooks-snippet.json` use 2-space indentation. Arrays/objects expand multi-line (one element per line) — both Claude and Codex tracks aligned. `~/.codex/hooks.json` must remain strict JSON; never write JSON comments into it.
- **No linter configs present** — conventions followed by practice.

## Architecture Rules

- **Zero-modification principle:** Never modify upstream `superpowers` core files. Influence agent behavior through hook context injection and independent skills only (ADR-002).
- **Project-local knowledge base:** `docs/project-knowledge/` lives in target project repos, not in this plugin repo. Plugins ship templates only.
- **No external dependencies beyond Node.js and git:** Hook scripts may only use tools present in standard Claude Code / Codex environments.
- **Cross-platform hooks:** Any new hook must work on Unix and Windows. The `run-hook.cmd` polyglot wrapper handles dispatch on Claude side. Codex side uses direct Node.js (no shell wrapper needed).
- **Strategy A for Codex track (ADR-013):** `codex-plugins/` is a parallel tree; never modify `plugins/` from Codex-side work. The only allowed cross-tree addition is shared test fixtures under `plugins/superpowers-memory/hooks/fixtures/`.

## Testing Conventions

- No automated test suite. Verification is done manually per plan task acceptance criteria.
- The `verify` command in `hook-runtime.js` / `codex-runtime.js` provides automated checks for KB files (size thresholds, stale path references, content-shape lint, total token budget). Codex variant runs the same `verify` logic.
- Fixture-based runtime testing: `plugins/superpowers-memory/hooks/fixtures/<scenario>/` (clean, shape-violation, ssot-violation, codex-apply-patch). Run via `cd <fixture> && node ../../<runtime>.js <mode>`. Both `hook-runtime.js` (Claude) and `codex-runtime.js` (Codex) share the same fixture set.

## Git & Workflow

- **Commit message format:** `<type>: <description>` or `<type>(<scope>): <description>` (e.g., `feat(codex):`, `fix:`, `docs:`, `chore:`, `refactor:`, `style(codex):`).
- **Branch:** Feature work on `hotfix/<topic>` branches; merged to `main` via PR.
- **Versioning:** Bumped by `.github/workflows/auto-release.yml` after PR merge. `scripts/release/bump-versions.sh` always bumps `.claude-plugin/marketplace.json` metadata; changed Claude plugin paths bump Claude marketplace entries + `.claude-plugin/plugin.json`; changed Codex plugin paths bump `.codex-plugin/plugin.json` and `codex-hooks-snippet.json`.
- **Specs before plans:** Design specs (`docs/superpowers/specs/`), then implementation plans (`docs/superpowers/plans/`). Plans reference specs.
- **Plan checkboxes:** Implementation plan steps use `- [x]` / `- [ ]` syntax.

## Knowledge Base Content Rules (plugin-enforced)

- **Ownership matrix** — see `plugins/superpowers-memory/content-rules.md`. Each fact has ONE owner file; others reference by pointer (≤1 line).
- **ADR granularity gate** — new ADRs only when a future reader without this record would re-propose the opposite (NORMAL 3-line default; CRITICAL only when ≥2 rejected alts with substantive analysis).
- **`features.md` is capability view** — current state in 3-6 lines + ADR ref. No commit SHAs, test counts, timestamps, changelog narrative.
- **`glossary.md` entries ≤2 lines** — one-line business definition + 1 path.
- **Exclusion Gate** in `update` / `rebuild` skills checks every new entry against content-shape rules before write.
- **`verify` surfaces** `ssotViolations`, `shapeViolations`, `tokenBudgetViolation` (20K default), `sizeWarnings`. All warn-only — commits not blocked. `committable` reflects git state only.
- **KB writes go through `superpowers-memory:update` / `superpowers-memory:rebuild` only** (ADR-010). PreToolUse hook blocks Write/Edit on `docs/project-knowledge/` paths unless write-lock (`.git/superpowers-memory.lock`, 60-min TTL) is held. No escape hatch — manual typo fixes also go through `superpowers-memory:update`.

## Codex-track-specific conventions (ADR-013)

- **`codex-hooks-snippet.json` contract:** Each Codex plugin declares hook data as `{ "version": "<semver>", "hooks": { ... } }`. Hook commands use `node "${PLUGIN_ROOT}/hooks/codex-runtime.js" ...`; the setup installer replaces `${PLUGIN_ROOT}` with the actual installed path.
- **Setup installer protocol:** Each Codex plugin ships an installer; representative path: `codex-plugins/superpowers-memory/scripts/install-codex-hooks.js`. The setup skill runs it instead of manually editing JSON. The installer infers the plugin name from both source-tree and versioned cache layouts, removes stale entries for that plugin by runtime command path, writes strict JSON, and backs up `~/.codex/hooks.json`.
- **Marketplace upgrade flow:** Codex `plugin marketplace upgrade` updates plugin files but does NOT touch `~/.codex/hooks.json`. Users must rerun `$<plugin>:setup` after upgrade so the installer replaces stale cache paths. README of each Codex plugin documents this.
- **Skill mention syntax:** Codex uses `$plugin:skill-name` (not `/`); UserPromptSubmit hook regex matches accordingly.
- **Architect prompt router:** Codex architect UserPromptSubmit must stay heuristic and non-blocking: trigger on architecture/API/database/backend/frontend/review language, return `{}` for unrelated prompts, and keep injected content as an index + instruction to read relevant full patterns.
