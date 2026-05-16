---
last_updated: 2026-05-16
updated_by: superpowers-memory:update
triggered_by_plan: "2026-05-13-features-capability-reconciliation.md"
---

# Features

## Implemented

### Product Capabilities

#### Claude Marketplace

**Enables** — Claude Code users can install the workshop plugins from `.claude-plugin/marketplace.json`.

**Actors / Entry Points** — Users install via `/plugin marketplace add jacexh/skill-workshop`; Claude plugin code lives under `plugins/`.

**Capability Boundary** — The Claude track remains the primary supported marketplace track.

**References** — See `architecture.md` for dual-track layout and ADR-013 for Codex compatibility.

#### Codex Marketplace

**Enables** — Codex users can install the experimental Codex plugin track from `.agents/plugins/marketplace.json`.

**Actors / Entry Points** — Users install via `codex plugin marketplace add jacexh/skill-workshop`; Codex plugin code lives under `codex-plugins/`.

**Capability Boundary** — Codex entries use object-form `source`, `policy`, and `category`; native plugin hooks require restart and both `hooks` and `plugin_hooks` feature flags.

**References** — ADR-013, ADR-014; see `conventions.md` for Codex hook and fallback cleanup rules.

#### Product-First Capability Maps

**Enables** — `features.md` records current product/system capabilities from PRDs, roadmaps, specs, plans, and entry points without collapsing them into runtime component inventories.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/content-rules.md`, and `plugins/superpowers-memory/templates/features.md`.

**Capability Boundary** — Implemented entries follow fixed fields and the group order `Product Capabilities`, `User / Operator Workflows`, `Platform Capabilities`, `Operations`; size guards allow larger `features.md` and `architecture.md` files while remaining warn-only.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/features.md`, `docs/superpowers/specs/2026-05-13-features-capability-reconciliation-design.md`.

### User / Operator Workflows

#### Project Knowledge Loading

**Enables** — Agents can load a lightweight project knowledge index before code exploration, planning, or architectural work.

**Actors / Entry Points** — `superpowers-memory:load`, SessionStart hooks, and `docs/project-knowledge/index.md`.

**Capability Boundary** — The index is the default context; full KB files are loaded on demand to avoid unnecessary token use.

**References** — `plugins/superpowers-memory/skills/load/`, `codex-plugins/superpowers-memory/skills/load/`, ADR-005, ADR-006.

#### Project Knowledge Update And Rebuild

**Enables** — Agents can incrementally update or fully/scoped rebuild `docs/project-knowledge/` from code, plans, specs, and ADRs.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/templates/`, and `plugins/superpowers-memory/content-rules.md`.

**Capability Boundary** — `plugins/superpowers-memory/content-rules.md` is the SSOT for ownership, exclusion rules, per-file structure, size guards, and `features.md` readability.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/`, ADR-003.

### Platform Capabilities

#### Knowledge Base Write Lock

**Enables** — KB edits are gated so agents update project knowledge through memory skills instead of ad hoc file writes.

**Actors / Entry Points** — Claude `PreToolUse` intercepts Write/Edit tools; Codex `PreToolUse` intercepts `apply_patch` and filesystem tool writes.

**Capability Boundary** — The lock is stored at `.git/superpowers-memory.lock` with a 60-minute TTL; manual fixes also go through update/rebuild.

**References** — ADR-010; see `conventions.md` for hook runtime rules.

#### Knowledge Verification

**Enables** — Operators can check KB shape, stale path references, size thresholds, token budget, and commit readiness before committing.

**Actors / Entry Points** — `node plugins/superpowers-memory/hooks/hook-runtime.js verify` and the Codex equivalent.

**Capability Boundary** — Verify is advisory except for git commit readiness; it now flags dense single-paragraph `features.md` entries so capability maps stay readable, and includes `playbooks.md` (≤200 lines) in size and token-budget aggregation when present.

**References** — `plugins/superpowers-memory/hooks/fixtures/`; see `content-rules.md` for shape rules.

#### Code-change Playbook Recipes

**Enables** — Project knowledge bases can carry reusable code-change recipes — a `playbooks.md` index of "to do X, follow steps A→B→C" entries plus per-recipe `playbooks/<slug>.md` details — so contributors and agents reproduce recurring class-of-change work without re-deriving the sequence.

**Actors / Entry Points** — `superpowers-memory:rebuild` (scope routing for `playbooks.md`); `superpowers-memory:update` (3-prime playbook candidate detection); `plugins/superpowers-memory/content-rules.md` defines the 3-gate creation rule and routing; `plugins/superpowers-memory/templates/playbooks.md` + `plugins/superpowers-memory/templates/playbook-detail.md` carry the shape.

**Capability Boundary** — Lazy slot — omitted entirely when no recipes pass the 3-gate rule (recurrence ≥2 concrete instances OR explicit spec/plan directive; ≥3 cross-file actions; non-obvious from code). Index is bounded; detail files load on demand via `Read`, not injected at SessionStart.

**References** — `plugins/superpowers-memory/content-rules.md` §playbooks.md / §playbooks/<slug>.md; `plugins/superpowers-memory/templates/playbooks.md`; `plugins/superpowers-memory/templates/playbook-detail.md`.

#### DDD Design Pattern Guidance

**Enables** — Agents can apply DDD guidance from strategic modeling through tactical implementation across language-neutral and Go/Python/TypeScript guides.

**Actors / Entry Points** — `superpowers-architect:standards`, architect hooks, and design-pattern files under both `plugins/superpowers-architect/design-patterns/` and `codex-plugins/superpowers-architect/design-patterns/`.

**Capability Boundary** — `ddd-modeling.md` owns architecture gates, model discovery, technical-capability classification, port granularity, and vendor-wrapper ACL triage; `ddd-core.md` owns language-neutral DDD/Clean Architecture rules and the Domain Event vs Integration Message boundary; `ddd-golang.md` covers Go layers/aggregates/events/integration messages and treats its named Go component libraries as required standards; `ddd-golang-runtime.md` carries Go runtime concerns (config, fx.Lifecycle, graceful shutdown, Kubernetes); Python/TypeScript guides now carry the same shared gates, placement rules, event-drain lifecycle, and cross-context message boundary in language-specific form.

**References** — `plugins/superpowers-architect/design-patterns/ddd-modeling.md`, `plugins/superpowers-architect/design-patterns/ddd-core.md`, `plugins/superpowers-architect/design-patterns/ddd-python.md`, `plugins/superpowers-architect/design-patterns/ddd-typescript.md`; see `conventions.md` for design-pattern maintenance rules and ADR-015 for the agent-contract/runtime split.

#### DDD Code Agent Execution Contract

**Enables** — Code agents (Claude Code, Codex) follow a deterministic execution protocol when doing DDD or Go-runtime work: trigger conditions, mandatory read order, stop-and-ask protocol, prohibited actions, dual-track self-check, and a compact output template.

**Actors / Entry Points** — `plugins/superpowers-architect/design-patterns/ddd-agent-contract.md` (and its Codex mirror); referenced from the top of `ddd-modeling.md`, `ddd-core.md`, `ddd-golang.md`; loaded via the architect `standards` skill's directory scan.

**Capability Boundary** — The contract is a behavior layer, not architecture content. It classifies tasks into DDD / Go-runtime-only / mixed, maps each to which specs must be read, and carries the must-not list including the ban on local substitutes for canonical Go component libraries; it does not duplicate modeling/core/language rules. Promotion to a standalone skill is deferred until observed need (see ADR-015).

**References** — `plugins/superpowers-architect/design-patterns/ddd-agent-contract.md`, ADR-015.

#### Claude Architecture Standards Injection

**Enables** — Claude agents receive project architecture pattern guidance when invoking planning, implementation, or review skills, and can explicitly invoke the same standards workflow.

**Actors / Entry Points** — `plugins/superpowers-architect/hooks/pre-tool-use`, `$superpowers-architect:standards`, and bundled design-pattern files.

**Capability Boundary** — Hooks inject pattern indexes only; full pattern content is read on demand. The explicit standards skill applies dynamic pattern-set gates without assuming bundled DDD files exist.

**References** — `plugins/superpowers-architect/`, ADR-002.

#### Codex Architecture Standards Guidance

**Enables** — Codex agents receive standing architecture pattern context plus explicit standards workflow support.

**Actors / Entry Points** — Codex SessionStart, UserPromptSubmit router, and `$superpowers-architect:standards`.

**Capability Boundary** — The Codex architect plugin intentionally does not register Stop hooks; legacy stop mode is a no-op for older installed configs. Runtime guidance emits a generic Architecture Gate and adds DDD-specific instructions only when `ddd-modeling.md` is present.

**References** — `codex-plugins/superpowers-architect/`, ADR-013, ADR-014.

#### Test Design Skill

**Enables** — Agents can design tests from intent before implementation, including test lists, intent comments, boundary selection, and quality labels.

**Actors / Entry Points** — `designing-tests` skill and reference files for layer selection, risk catalog, test-case patterns, and test-quality review.

**Capability Boundary** — Claude has tiered PreToolUse injection; Codex uses SessionStart guidance and the full skill on demand.

**References** — `plugins/designing-tests/`, `codex-plugins/designing-tests/`, ADR-013.

#### Native Codex Hooks

**Enables** — Codex plugins can declare plugin-local lifecycle hooks in native manifests.

**Actors / Entry Points** — `.codex-plugin/plugin.json`, `codex-plugins/superpowers-memory/hooks/hooks.json`, and `codex-plugins/superpowers-memory/hooks/codex-runtime.js` represent the per-plugin pattern.

**Capability Boundary** — Native hooks are primary when supported; users restart Codex after install or upgrade.

**References** — ADR-014; see `conventions.md` for native hook contract.

#### Codex Fallback Cleanup

**Enables** — Users who previously installed fallback hooks can migrate back to native Codex hooks and remove stale cache-path entries that break after plugin upgrades.

**Actors / Entry Points** — `$<plugin>:cleanup` calls `codex-plugins/<name>/scripts/install-codex-hooks.js remove` for that plugin.

**Capability Boundary** — Cleanup removes only matching skill-workshop fallback hook commands from `~/.codex/hooks.json`, deletes empty hook-event arrays, preserves unrelated user hooks, and requires a Codex restart.

**References** — `codex-plugins/*/skills/cleanup/SKILL.md`; see `conventions.md` for installer `remove` mode.

### Operations

#### Auto Release

**Enables** — PR merges can publish versioned plugin releases without hand-editing manifests.

**Actors / Entry Points** — `.github/workflows/auto-release.yml` calls release scripts under `scripts/release/`.

**Capability Boundary** — Release detection is path-scoped so Claude and Codex plugin version bumps stay aligned with changed files.

**References** — See `conventions.md` for versioning workflow and release script rules.

#### Release And Runtime Test Fixtures

**Enables** — Maintainers can verify release scripts, Codex manifest shape, hook setup, architect runtime routing, and memory verify behavior before shipping.

**Actors / Entry Points** — `scripts/release/test/run-tests.sh` and fixture directories under `plugins/superpowers-memory/hooks/fixtures/`.

**Capability Boundary** — Tests exercise real shell scripts and Node runtimes; they do not replace full host-runtime acceptance testing.

**References** — `scripts/release/test/`; `plugins/superpowers-memory/hooks/fixtures/README.md`.

## In Progress

No capabilities currently in progress.

## Planned

No planned capabilities are tracked in this file.
