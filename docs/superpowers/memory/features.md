---
last_updated: 2026-07-06
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-07-06-designing-tests-evidence-choice-slimming.md"
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

**Capability Boundary** — Codex entries use object-form `source`, `policy`, and `category`; native plugin hooks require restart, `[features] hooks = true`, `plugin_hooks = true`, and `/hooks` review/trust when hooks do not appear.

**References** — ADR-013, ADR-014; see `conventions.md` for Codex hook and fallback removal rules.

#### Product-First Capability Maps

**Enables** — `features.md` records current product/system capabilities from PRDs, roadmaps, specs, plans, and entry points without collapsing them into runtime component inventories.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/content-rules.md`, and `plugins/superpowers-memory/templates/features.md`.

**Capability Boundary** — Implemented entries follow fixed fields and the group order `Product Capabilities`, `User / Operator Workflows`, `Platform Capabilities`, `Operations`; valid large capability maps use retrieval-cost guidance and shard splitting instead of deleting or compressing correct knowledge.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/features.md`, `docs/superpowers/specs/2026-05-13-features-capability-reconciliation-design.md`.

### User / Operator Workflows

#### Project Knowledge Loading

**Enables** — Agents can classify project questions, route to the smallest relevant KB owners/shards, and then use targeted code search before broad project exploration.

**Actors / Entry Points** — `superpowers-memory:query`, SessionStart hooks, and `docs/superpowers/memory/index.md`.

**Capability Boundary** — `query` reads `index.md` on demand as the first router; SessionStart only reports KB availability/freshness and query guidance. Stale freshness is a review signal, not an automatic ingest trigger; agents run ingest only when changed source facts introduce or materially change durable project knowledge. `query` reports question classification, retrieval route, skipped oversized/irrelevant files, and code search seeds. Full KB files are loaded on demand, with `glossary.md` used for alias expansion and `decisions.md` routed through ADR details or decision-family shards instead of eagerly loading large root files.

**References** — `plugins/superpowers-memory/skills/query/`, `codex-plugins/superpowers-memory/skills/query/`, ADR-005, ADR-006.

#### Project Knowledge Update And Rebuild

**Enables** — Agents can incrementally update or fully/scoped rebuild `docs/superpowers/memory/` from code, plans, specs, and ADRs.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/templates/`, and `plugins/superpowers-memory/content-rules.md`.

**Capability Boundary** — `plugins/superpowers-memory/content-rules.md` is the SSOT for ownership, exclusion rules, KB Slot Contracts, progressive shard layout, retrieval-cost guidance, query routing output, and `features.md` readability. Ingest self-checks candidate updates against the matching slot contract before writing, and first skips deployment-only, image/tag/version-only, formatting-only, or comment-only changes that do not alter durable project knowledge. Full/scoped rebuild can upgrade legacy large `decisions.md` and `glossary.md` files into root routers plus `decisions-<domain>.md` and `glossary-<domain>.md` shards while preserving ADR details, aliases, source refs, and tombstones.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/`, ADR-003.

### Platform Capabilities

#### Knowledge Base Write Lock

**Enables** — KB edits are gated so agents update project knowledge through memory skills instead of ad hoc file writes.

**Actors / Entry Points** — Claude `PreToolUse` intercepts Write/Edit tools; Codex `PreToolUse` intercepts `apply_patch` and filesystem tool writes.

**Capability Boundary** — The lock is stored at `.git/superpowers-memory.lock` with a 60-minute TTL; manual fixes also go through update/rebuild.

**References** — ADR-010; see `conventions.md` for hook runtime rules.

#### Knowledge Verification

**Enables** — Operators can check KB shape, stale path references, architecture coverage gaps, retrieval cost, split candidates, index size, and commit readiness before committing.

**Actors / Entry Points** — `node plugins/superpowers-memory/hooks/hook-runtime.js verify` and the Codex equivalent.

**Capability Boundary** — Verify treats only `index.md` as a strict query-router size constraint. `coverageGaps`, `retrievalCost`, and `splitCandidates` are advisory for non-index files; legacy `playbooks.md` files are ignored because the playbook slot is no longer part of the schema. Large root decision inventories can surface `decisions_family_shards_recommended`; large root glossaries can surface `glossary_alias_router_recommended`. The `qualityGate` summary mirrors current `ok` semantics while splitting blocking findings from advisory findings.

**References** — `plugins/superpowers-memory/hooks/fixtures/`; see `content-rules.md` for shape rules.

#### Memory Slot Contracts And Quality Gate Summary

**Enables** — Agents can tell which elements are required for each Project Knowledge slot before writing or reviewing KB updates.

**Actors / Entry Points** — `superpowers-memory:ingest`, `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/`, and both memory verify runtimes.

**Capability Boundary** — KB Slot Contracts cover owner intent, required shape, conditional shape, shard rules, excluded content, and verify coverage for `index`, `architecture`, `features`, `decisions`, `conventions`, `tech-stack`, and `glossary`. Template `SLOT CONTRACT` blocks make the same contract visible at file creation time. Runtime references are calibrated as implemented paths; any future/readiness terms in those files belong to generic lint rules, not this capability. `qualityGate` reports `blockingFindings`, `advisoryFindings`, and `coverageAdvisoryOnly` without making architecture coverage gaps fail `verify.ok`.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/`, `plugins/superpowers-memory/hooks/hook-runtime.js`, `codex-plugins/superpowers-memory/hooks/codex-runtime.js`, `docs/superpowers/specs/2026-07-03-memory-slot-contracts-quality-gates-design.md`.

#### Progressive Knowledge Layout

**Enables** — Large project knowledge bases can split any non-index entry file by stable domain or submodule without treating size as information loss pressure.

**Actors / Entry Points** — `superpowers-memory:load`, `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/index.md`, and both verify runtimes.

**Capability Boundary** — `index.md` stays ≤50 lines and routes to detailed files. Other recognized entry files may split into `<slot>-<domain>.md` shards; agents update index routing and load relevant shards on demand. `decisions.md` and `glossary.md` are special router roots when they grow large: stable decision families move to `decisions-<domain>.md`, and domain-local term clusters move to `glossary-<domain>.md`. The old playbook slot is removed rather than converted into another shard family. Codex host behavior remains experimental per ADR-013, but this layout contract is implemented in both runtimes.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/index.md`, `plugins/superpowers-memory/hooks/hook-runtime.js`, ADR-016.

#### DDD Expert Guidance

**Enables** — Agents can apply focused DDD/backend guidance from product-semantic design through model-to-code implementation, evidence-based review, risk routing, strategic modeling, Go events/messages, taskqueue/runtime, and on-demand database-backed persistence.

**Actors / Entry Points** — `$ddd-expert:design`, `$ddd-expert:implement`, `$ddd-expert:review`, and shared reference files under both `plugins/ddd-expert/references/` and `codex-plugins/ddd-expert/references/`.

**Capability Boundary** — The three phase skills own entry timing, detailed thinking frameworks, and output contracts. `$ddd-expert:design` owns product-semantics-to-DDD modeling through Product semantics intake, Existing model inventory, Spec trace, Strategic Model Gate, Tactical Model Gate, stop/proceed gates, and a Minimum Output Contract that distinguishes small changes, full design, and stop-only output. `$ddd-expert:implement` owns accepted-model-to-code placement through Design input check, Accepted model source, Preflight Rule Gate, Placement Translation Gates, boundary mappings, mechanism containment, Implementation trace from model decisions to files/tests, and a Minimum Output Contract for small layer-local changes vs full implementation. Its Preflight Rule Gate classifies touched surfaces from user requirements, planned files, imports, generated artifacts, migrations, runtime entrypoints, tests, and local conventions; the built-in table is a router with high-risk examples, not an exhaustive inventory. `$ddd-expert:review` owns Evidence-to-judgment review through an Evidence Gate, Evidence Preconditions, Evidence map, Expected model vs observed code, risk-card mapping, Finding triage, Severity Calibration, and a Minimum Output Contract for small review vs full review vs no-finding review. Its Evidence Gate classifies touched surfaces from concrete evidence and reports missing proof as evidence gaps instead of findings. `ddd-risk-router.md` routes to deeper references through portable risk cards, a Routing Matrix (risk card -> required references -> required evidence -> allowed exception), and calibrated probe examples. `ddd-modeling.md`, `ddd-core.md`, `ddd-agent-contract.md`, language guides, Go support guides, and `database.md` are on-demand rule sources only. The plugin is explicit and hookless so it can be used by non-Superpowers skill systems.

**References** — `plugins/ddd-expert/skills/design/SKILL.md`, `plugins/ddd-expert/skills/implement/SKILL.md`, `plugins/ddd-expert/skills/review/SKILL.md`, `plugins/ddd-expert/references/ddd-risk-router.md`, `plugins/ddd-expert/references/ddd-modeling.md`, `plugins/ddd-expert/references/ddd-core.md`, `plugins/ddd-expert/references/ddd-golang.md`, `plugins/ddd-expert/references/ddd-python.md`, `plugins/ddd-expert/references/ddd-typescript.md`, `plugins/ddd-expert/references/ddd-golang-events-messages.md`, `plugins/ddd-expert/references/ddd-golang-runtime.md`, `plugins/ddd-expert/references/ddd-golang-taskqueue.md`, `plugins/ddd-expert/references/database.md`; see `conventions.md` for reference parity rules, ADR-025 for the standalone plugin decision, ADR-022 for phase-specific skills, ADR-015 for the agent-contract/runtime split, ADR-017 for the taskqueue split, and ADR-018 for the events/messages split.

#### DDD Code Agent Execution Contract

**Enables** — Code agents (Claude Code, Codex) can load a deterministic self-check contract when DDD, Go events/messages, Go runtime, or Go taskqueue work needs task classification, stop-and-ask protocol, prohibited actions, matching self-checks, or a compact output template.

**Actors / Entry Points** — `plugins/ddd-expert/references/ddd-agent-contract.md` (and its Codex mirror); referenced from DDD phase skills/risk cards and loaded only when task classification, prohibited actions, stop protocol, or self-checks are needed.

**Capability Boundary** — The contract is a behavior layer, not architecture content. It classifies tasks into DDD-business / Go events/messages / Go taskqueue/polling/periodic / Go runtime-only / mixed, maps each to which specs must be read, and carries the 26-rule must-not list including the dependency-inversion-only Application-port ban, the routing/topology Application-port ban, the mechanism-operation-granular Port ban, the capability-fragmented Port ban, umbrella async/task handler rejection, mixed Domain Event / Integration Message handler rejection, periodic scheduler callback rejection, bloated Go RPC shortcut rejection, bloated Go fx entrypoint rejection, aggregate-field-as-business-decision-API rejection, and the ban on local substitutes for the adopted Go component stack including message runner/subscriber and Kafka failure-policy substitutes; it does not duplicate modeling/core/language rules. Promotion to a standalone skill is deferred until observed need (see ADR-015).

**References** — `plugins/ddd-expert/references/ddd-agent-contract.md`, ADR-015, ADR-022, ADR-025.

#### Architectural Design Pattern Standards

**Enables** — Agents receive architectural design-pattern standards as constraints during Superpowers planning, execution, subagent, and review workflows, and can request the same standards explicitly on demand.

**Actors / Entry Points** — Claude `superpowers-architect` PreToolUse hook, Codex SessionStart/UserPromptSubmit hooks, `$superpowers-architect:standards`, `plugins/superpowers-architect/design-patterns/`, and `codex-plugins/superpowers-architect/design-patterns/`.

**Capability Boundary** — `superpowers-architect` is restored to its v1.13.10 content. Claude injects a compact pattern index through PreToolUse for upstream Superpowers workflow skills. Codex injects a lightweight SessionStart reminder and uses UserPromptSubmit only when the prompt explicitly names upstream `$superpowers:*` workflow skills; natural-language architecture/DDD prompts stay quiet. Bundled defaults include database, REST, frontend, and legacy DDD/backend patterns. Standalone `ddd-expert` remains the hookless phase-skill path for explicit DDD/backend design, implementation, and review, especially outside Superpowers-style hook routing.

**References** — `plugins/superpowers-architect/`, `codex-plugins/superpowers-architect/`, `scripts/release/test/test_codex_architect_runtime.sh`, ADR-006, ADR-026.

#### Test Design Skill

**Enables** — Agents can choose verification evidence from intent and observable risk, then design tests only when tests are the narrowest reliable evidence.

**Actors / Entry Points** — `designing-tests` skill, Claude `PreToolUse` guidance, Codex UserPromptSubmit guidance, and consolidated references for architecture-test design, integration quality, and evidence hand-off gates.

**Capability Boundary** — The skill uses Intent / Risk / Evidence gates: agents name the requirement source, state the observable regression, then choose `test`, `check`, `dry-run`, `smoke`, `manual`, or `residual` evidence. "No new test" is a valid outcome for low-risk glue when checked evidence is enough; high-risk security, data, contract, async, migration/config, or historical incident changes still require real tests or explicit residual-risk justification. Claude hooks inject restrained planning/execution/TDD/hand-off reminders; Codex intentionally does not register SessionStart and uses explicit `$superpowers:*` UserPromptSubmit routing, including `finishing-a-development-branch`.

**References** — `plugins/designing-tests/`, `codex-plugins/designing-tests/`, `scripts/release/test/test_designing_tests_runtime.sh`, ADR-013, ADR-014.

#### Native Codex Hooks

**Enables** — Codex plugins can declare plugin-local lifecycle hooks in native manifests.

**Actors / Entry Points** — `.codex-plugin/plugin.json`, `codex-plugins/superpowers-memory/hooks/hooks.json`, and `codex-plugins/superpowers-memory/hooks/codex-runtime.js` represent the per-plugin pattern.

**Capability Boundary** — Native hooks are primary when supported; users enable `hooks` + `plugin_hooks`, review/trust hooks via `/hooks`, and restart Codex after install or upgrade. Command hooks declare bounded timeout/status text; KB write protection uses Codex `permissionDecision = deny`. Some runtime branches remain deferred or no-op where Codex does not expose native skill invocation as a hookable event.

**References** — ADR-014; see `conventions.md` for native hook contract.

#### Codex Fallback Hook Removal Helper

**Enables** — Users who previously installed fallback hooks can remove stale cache-path entries that break after plugin upgrades while native Codex hooks remain the public install/upgrade path.

**Actors / Entry Points** — Advanced users or tests run `codex-plugins/<name>/scripts/install-codex-hooks.js remove` from the installed plugin directory; README also allows manual removal from `~/.codex/hooks.json`.

**Capability Boundary** — The removal helper is script-only and no longer exposed as a public skill. It removes only matching skill-workshop fallback hook commands from `~/.codex/hooks.json`, deletes empty hook-event arrays, preserves unrelated user hooks, and requires a Codex restart.

**References** — `codex-plugins/superpowers-memory/scripts/install-codex-hooks.js`; see `conventions.md` for installer `remove` mode.

### Operations

#### Auto Release

**Enables** — PR merges can publish versioned plugin releases without hand-editing manifests.

**Actors / Entry Points** — `.github/workflows/auto-release.yml` calls release scripts under `scripts/release/`.

**Capability Boundary** — Release detection is path-scoped so Claude and Codex plugin version bumps stay aligned with changed files.

**References** — See `conventions.md` for versioning workflow and release script rules.

#### Release And Runtime Test Fixtures

**Enables** — Maintainers can verify release scripts, Codex manifest shape, hook setup, architect runtime routing, and memory verify behavior before shipping.

**Actors / Entry Points** — `scripts/release/test/run-tests.sh` and fixture directories under `plugins/superpowers-memory/hooks/fixtures/`.

**Capability Boundary** — Tests exercise real shell scripts and Node runtimes; Codex manifest tests guard canonical hook feature-flag docs and command hook metadata, designing-tests runtime tests guard hand-off/architecture guidance injection, while memory verify covers canonical PreToolUse deny behavior, legacy playbook ignore behavior, architecture coverage advisories, `qualityGate` summaries, shard split advisories, decision/glossary router advisories, and strict index size. Memory skill surface tests also guard query-routing output fields and rebuild compatibility text. They do not replace full host-runtime acceptance testing.

**References** — `scripts/release/test/`; `plugins/superpowers-memory/hooks/fixtures/README.md`.

## In Progress

No in-progress capabilities are tracked in this file.

## Planned

No planned capabilities are tracked in this file.
