---
last_updated: 2026-05-10
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---


# Conventions

## Coding Standards

- **Hook runtime (Claude memory):** All hook logic lives in `plugins/superpowers-memory/hooks/hook-runtime.js`. Bash scripts (`pre-tool-use`, `session-start`, `user-prompt-expansion`) are 2-5 line wrappers that `exec node hook-runtime.js <mode>`. JSON output: `hookSpecificOutput` wrapper in plugin env, flat `additional_context` otherwise.
- **Hook runtime (Codex memory):** `codex-plugins/superpowers-memory/hooks/codex-runtime.js` — same modes minus `user-prompt-expansion`, plus `user-prompt-submit`. Plugin-root resolution uses `path.dirname(__filename)` instead of `${CLAUDE_PLUGIN_ROOT}` (Codex provides no equivalent env var). Output always uses `hookSpecificOutput.additionalContext` form.
- **Hook scripts (architect Claude):** Bash with `set -euo pipefail`. Inline `node -e` for JSON parsing. Reads YAML frontmatter for pattern name/description.
- **Hook scripts (architect Codex):** Direct Node.js (`codex-runtime.js`) with active `session-start` and `user-prompt-submit` modes. Pattern dirs resolve bundled defaults, Claude/global dirs, then project dirs; later dirs override earlier dirs by filename. Runtime emits a generic Architecture Gate for any dynamic pattern set and only emits DDD-specific addenda when `ddd-modeling.md` is present. Legacy `stop` mode returns `{}` only for older installed configs; new native/fallback configs do not register Stop.
- **Hook scripts (designing-tests Codex):** Direct Node.js (`codex-runtime.js`), single `session-start` mode. Same YAML frontmatter parsing as Claude side.
- **Markdown files:** Skills use YAML frontmatter with `name` and `description`. Knowledge base files use `last_updated` (YYYY-MM-DD), `updated_by`, `triggered_by_plan`.
- **`triggered_by_plan` rule:** Only update this field when a concrete plan filename can be identified as the trigger. If no plan triggered the update, **preserve the existing value — never overwrite with `null`**.
- **Content rules (KB):** `content-rules.md` is the shared SSOT for `rebuild` and `update` skills. Defines language, inclusion/exclusion criteria, ownership matrix, quality standards, size guards.
- **JSON manifests:** `plugin.json`, native Codex hook files such as `codex-plugins/superpowers-memory/hooks/hooks.json`, Claude `hooks.json`, `marketplace.json`, and `codex-hooks-snippet.json` use 2-space indentation. Arrays/objects expand multi-line (one element per line) — both Claude and Codex tracks aligned. `~/.codex/hooks.json` must remain strict JSON; never write JSON comments into it.
- **No linter configs present** — conventions followed by practice.

## Architecture Rules

- **Zero-modification principle:** Never modify upstream `superpowers` core files. Influence agent behavior through hook context injection and independent skills only (ADR-002).
- **Project-local knowledge base:** `docs/project-knowledge/` lives in target project repos, not in this plugin repo. Plugins ship templates only.
- **No external dependencies beyond Node.js and git:** Hook scripts may only use tools present in standard Claude Code / Codex environments.
- **Cross-platform hooks:** Any new hook must work on Unix and Windows. The `run-hook.cmd` polyglot wrapper handles dispatch on Claude side. Codex side uses direct Node.js (no shell wrapper needed).
- **Strategy A for Codex track (ADR-013):** `codex-plugins/` is a parallel tree; never modify `plugins/` from Codex-side work. The only allowed cross-tree addition is shared test fixtures under `plugins/superpowers-memory/hooks/fixtures/`.
- **Design-pattern track parity:** Shared standards in `plugins/superpowers-architect/design-patterns/` and `codex-plugins/superpowers-architect/design-patterns/` should stay semantically aligned unless a change is intentionally host-specific. Claude and Codex architect tracks both expose a `standards` skill for explicit use.
- **DDD pattern ownership:** `ddd-modeling.md` owns strategic modeling, architecture gates, technical-capability classification, port granularity, and vendor-wrapper ACL triage; `ddd-core.md` owns language-neutral tactical rules, Domain Event vs Integration Message boundaries, generated protocol DTO boundaries, and review checklist; `ddd-<language>.md` files only add implementation-specific placement, validation, testing, observability, and wiring guidance. Go guidance standardizes Integration Message ports on `github.com/go-jimu/components/ddd/message` and the default Kafka adapter on `github.com/go-jimu/contrib/message/kafka`.
- **DDD port placement rule:** Port/interface ownership is decided by semantic capability, not by implementation technology or by where request/response types are defined. Generated proto structs are protocol DTOs/contracts, not Domain entities; Domain-facing ports use Domain types and map `Proto ↔ Domain` at Application/Interface/Infrastructure boundaries.
- **DDD technology-leak rule:** Do not create Application/Domain ports solely for MySQL transactions, outbox rows, broker publishing, retry counters, or Unit of Work plumbing. Hide those consistency mechanics behind Repository, transaction-aware event bus, or Infrastructure adapters unless the use case names and observes that capability.
- **DDD event boundary rule:** Domain Events are bounded-context-internal facts; cross-context state propagation uses Integration Messages with stable payload contracts. The Go guide's current `ddd/event` implementation is in-memory/same-process, while cross-context Go examples use `ddd/message` plus a broker adapter such as `contrib/message/kafka`.
- **DDD event collection drain ownership:** Each aggregate's event collection is drained exactly once by Application after a successful `Save()`. Repository never drains. Drain is one-shot; a second drain returns an empty slice, so callers must reload before further mutations instead of retrying `Save()` on a drained aggregate instance.
- **DDD Go logging rule:** Execution boundaries in generated Go guidance log one completion record for every success, failure, skip, or retry. Runtime logging uses `github.com/go-jimu/components/sloghelper`, with `sloghelper.Error(err)` for wrapped errors and request/job loggers passed through context or constructors.

## Testing Conventions

- No automated test suite. Verification is done manually per plan task acceptance criteria.
- The `verify` command in `hook-runtime.js` / `codex-runtime.js` provides automated checks for KB files (size thresholds, stale path references, content-shape lint, total token budget). Codex variant runs the same `verify` logic.
- Fixture-based runtime testing: `plugins/superpowers-memory/hooks/fixtures/<scenario>/` (clean, shape-violation, ssot-violation, codex-apply-patch). Run via `cd <fixture> && node ../../<runtime>.js <mode>`. Both `hook-runtime.js` (Claude) and `codex-runtime.js` (Codex) share the same fixture set.

## Git & Workflow

- **Commit message format:** `<type>: <description>` or `<type>(<scope>): <description>` (e.g., `feat(codex):`, `fix:`, `docs:`, `chore:`, `refactor:`, `style(codex):`).
- **Branch:** Feature work on `hotfix/<topic>` branches; merged to `main` via PR.
- **Versioning:** Bumped by `.github/workflows/auto-release.yml` after PR merge. `scripts/release/bump-versions.sh` always bumps `.claude-plugin/marketplace.json` metadata; changed Claude plugin paths bump Claude marketplace entries + `.claude-plugin/plugin.json`; changed Codex plugin paths bump `.codex-plugin/plugin.json`, native Codex hook files, and fallback `codex-hooks-snippet.json`.
- **Specs before plans:** Design specs (`docs/superpowers/specs/`), then implementation plans (`docs/superpowers/plans/`). Plans reference specs.
- **Plan checkboxes:** Implementation plan steps use `- [x]` / `- [ ]` syntax.

## Knowledge Base Content Rules (plugin-enforced)

- **Ownership matrix** — see `plugins/superpowers-memory/content-rules.md`. Each fact has ONE owner file; others reference by pointer (≤1 line).
- **ADR granularity gate** — new ADRs only when a future reader without this record would re-propose the opposite (NORMAL 3-line default; CRITICAL only when ≥2 rejected alts with substantive analysis).
- **`features.md` is current capability map** — use `##` lifecycle states, `###` capability groups, and `####` capability entries with `Enables`, `Actors / Entry Points`, `Capability Boundary`, and `References`. No dense single-paragraph entries, commit SHAs, test counts, timestamps, or changelog narrative.
- **`glossary.md` entries ≤2 lines** — one-line business definition + 1 path.
- **Exclusion Gate** in `update` / `rebuild` skills checks every new entry against content-shape rules before write.
- **`verify` surfaces** `ssotViolations`, `shapeViolations`, `tokenBudgetViolation` (20K default), `sizeWarnings`. All warn-only — commits not blocked. `committable` reflects git state only.
- **KB writes go through `superpowers-memory:update` / `superpowers-memory:rebuild` only** (ADR-010). PreToolUse hook blocks Write/Edit on `docs/project-knowledge/` paths unless write-lock (`.git/superpowers-memory.lock`, 60-min TTL) is held. No escape hatch — manual typo fixes also go through `superpowers-memory:update`.

## Codex-track-specific conventions (ADR-013)

- **Native Codex hook contract:** Each Codex plugin manifest declares its plugin-local native hook file. Native hook files use `{ "version": "<semver>", "hooks": { ... } }` and commands use `node "${PLUGIN_ROOT}/hooks/codex-runtime.js" ...`. Users need `[features] hooks = true` and `plugin_hooks = true`, then a Codex restart after install/upgrade.
- **Fallback hook snippet contract:** `codex-hooks-snippet.json` mirrors the native hook file for legacy fallback installer compatibility. Tests guard version/schema drift between manifest, native hook file, and fallback snippet while the legacy installer remains in tree.
- **Legacy hook installer protocol:** Each Codex plugin ships an installer; representative path: `codex-plugins/superpowers-memory/scripts/install-codex-hooks.js`. The public setup skill has been removed; the script remains for cleanup and legacy migration tests. The installer supports `install` (legacy/private) and `remove`, prefers the native hook file, falls back to `codex-hooks-snippet.json`, infers the plugin name from source-tree and versioned cache layouts, removes stale entries for that plugin by runtime command path, writes strict JSON, and backs up `~/.codex/hooks.json`.
- **Fallback cleanup protocol:** Each Codex plugin ships `$<plugin>:cleanup`, which runs the same installer in `remove` mode. Cleanup removes only matching skill-workshop fallback commands from `~/.codex/hooks.json`, preserves unrelated hooks, deletes empty event arrays, and is the migration path after enabling native hooks.
- **Marketplace upgrade flow:** Codex `plugin marketplace upgrade` updates plugin files; native hooks take effect after restart. Current Codex users do not run setup after install or upgrade. Users with stale fallback entries run `$<plugin>:cleanup` once and restart. README of each Codex plugin documents this.
- **Skill mention syntax:** Codex uses `$plugin:skill-name` (not `/`); UserPromptSubmit hook regex matches accordingly.
- **Architect prompt router:** Codex architect UserPromptSubmit must stay non-blocking and trigger only on explicit upstream `superpowers` workflow skill mentions; natural-language architecture discussion returns `{}`. Injected content stays a dynamic pattern index + Architecture Gate; DDD-specific guidance is conditional on the active pattern set, not assumed globally.
- **Architect Stop policy:** Codex architect does not register Stop hooks. Stop fires per assistant turn in Codex and is too intrusive; standards guidance relies on SessionStart, explicit superpowers skill mentions, and `$superpowers-architect:standards`.
