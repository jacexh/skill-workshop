---
last_updated: 2026-05-07
updated_by: superpowers-memory:update
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Features

## Implemented

### Marketplace Capabilities

#### Claude Marketplace

**Enables** — Claude Code users can install the workshop plugins from `.claude-plugin/marketplace.json`.

**Actors / Entry Points** — Users install via `/plugin marketplace add jacexh/skill-workshop`; Claude plugin code lives under `plugins/`.

**Capability Boundary** — The Claude track remains the primary supported marketplace track.

**References** — See `architecture.md` for dual-track layout and ADR-013 for Codex compatibility.

#### Codex Marketplace

**Enables** — Codex users can install the experimental Codex plugin track from `.agents/plugins/marketplace.json`.

**Actors / Entry Points** — Users install via `codex plugin marketplace add jacexh/skill-workshop`; Codex plugin code lives under `codex-plugins/`.

**Capability Boundary** — Codex entries use object-form `source`, `policy`, and `category`; native hooks require restart and `codex_hooks`.

**References** — ADR-013, ADR-014; see `conventions.md` for Codex hook and setup fallback rules.

#### Auto Release

**Enables** — PR merges can publish versioned plugin releases without hand-editing manifests.

**Actors / Entry Points** — `.github/workflows/auto-release.yml` calls release scripts under `scripts/release/`.

**Capability Boundary** — Release detection is path-scoped so Claude and Codex plugin version bumps stay aligned with changed files.

**References** — See `conventions.md` for versioning workflow and release script rules.

### Knowledge Memory Capabilities

#### Project Knowledge Loading

**Enables** — Agents can load a lightweight project knowledge index before code exploration, planning, or architectural work.

**Actors / Entry Points** — `superpowers-memory:load`, SessionStart hooks, and `docs/project-knowledge/index.md`.

**Capability Boundary** — The index is the default context; full KB files are loaded on demand to avoid unnecessary token use.

**References** — `plugins/superpowers-memory/skills/load/`, `codex-plugins/superpowers-memory/skills/load/`, ADR-005, ADR-006.

#### Project Knowledge Update And Rebuild

**Enables** — Agents can incrementally update or fully/scoped rebuild `docs/project-knowledge/` from code, plans, specs, and ADRs.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, templates, and `content-rules.md`.

**Capability Boundary** — `content-rules.md` is the SSOT for ownership, exclusion rules, per-file structure, size guards, and `features.md` readability.

**References** — `plugins/superpowers-memory/content-rules.md`, `templates/`, ADR-003.

#### Knowledge Base Write Lock

**Enables** — KB edits are gated so agents update project knowledge through memory skills instead of ad hoc file writes.

**Actors / Entry Points** — Claude `PreToolUse` intercepts Write/Edit tools; Codex `PreToolUse` intercepts `apply_patch` and filesystem tool writes.

**Capability Boundary** — The lock is stored at `.git/superpowers-memory.lock` with a 60-minute TTL; manual fixes also go through update/rebuild.

**References** — ADR-010; see `conventions.md` for hook runtime rules.

#### Knowledge Verification

**Enables** — Operators can check KB shape, stale path references, size thresholds, token budget, and commit readiness before committing.

**Actors / Entry Points** — `node plugins/superpowers-memory/hooks/hook-runtime.js verify` and the Codex equivalent.

**Capability Boundary** — Verify is advisory except for git commit readiness; it now flags dense single-paragraph `features.md` entries so capability maps stay readable.

**References** — `plugins/superpowers-memory/hooks/fixtures/`; see `content-rules.md` for shape rules.

### Architecture Guidance Capabilities

#### Claude Architecture Standards Injection

**Enables** — Claude agents receive project architecture pattern guidance when invoking planning, implementation, or review skills.

**Actors / Entry Points** — `plugins/superpowers-architect/hooks/pre-tool-use` and bundled design-pattern files.

**Capability Boundary** — Hooks inject pattern indexes only; full pattern content is read on demand.

**References** — `plugins/superpowers-architect/`, ADR-002.

#### Codex Architecture Standards Guidance

**Enables** — Codex agents receive standing architecture pattern context plus explicit standards workflow support.

**Actors / Entry Points** — Codex SessionStart, UserPromptSubmit router, Stop continuation gate, and `$superpowers-architect:standards`.

**Capability Boundary** — The Stop gate stays narrow and only requests a missing standards judgment for obvious plan/review/implementation answers.

**References** — `codex-plugins/superpowers-architect/`, ADR-013, ADR-014.

### Test Design Capabilities

#### Test Design Skill

**Enables** — Agents can design tests from intent before implementation, including test lists, intent comments, boundary selection, and quality labels.

**Actors / Entry Points** — `designing-tests` skill and reference files for layer selection, risk catalog, test-case patterns, and test-quality review.

**Capability Boundary** — Claude has tiered PreToolUse injection; Codex uses SessionStart guidance and the full skill on demand.

**References** — `plugins/designing-tests/`, `codex-plugins/designing-tests/`, ADR-013.

### Codex Compatibility Capabilities

#### Native Codex Hooks

**Enables** — Codex plugins can declare plugin-local lifecycle hooks in native manifests.

**Actors / Entry Points** — `.codex-plugin/plugin.json`, `codex-plugins/superpowers-memory/hooks/hooks.json`, and `codex-plugins/superpowers-memory/hooks/codex-runtime.js` represent the per-plugin pattern.

**Capability Boundary** — Native hooks are primary when supported; users restart Codex after install or upgrade.

**References** — ADR-014; see `conventions.md` for native hook contract.

#### Codex Setup Fallback

**Enables** — Older Codex builds or failed native hook loading can still install compatibility hooks.

**Actors / Entry Points** — `$<plugin>:setup`, `codex-plugins/superpowers-memory/scripts/install-codex-hooks.js`, and `codex-hooks-snippet.json` represent the fallback pattern.

**Capability Boundary** — The setup skill writes strict `~/.codex/hooks.json`, removes stale runtime paths for the same plugin, and preserves unrelated hooks.

**References** — ADR-014; see `conventions.md` for setup installer protocol.

## In Progress

No capabilities currently in progress.

## Planned

No planned capabilities are tracked in this file.
