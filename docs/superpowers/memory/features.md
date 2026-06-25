---
last_updated: 2026-06-25
updated_by: superpowers-memory:ingest
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

**Actors / Entry Points** — `superpowers-memory:load`, `superpowers-memory:query`, SessionStart hooks, and `docs/superpowers/memory/index.md`.

**Capability Boundary** — The index is the default context; `query` reports question classification, retrieval route, skipped oversized/irrelevant files, and code search seeds. Full KB files are loaded on demand, with `glossary.md` used for alias expansion and `decisions.md` routed through ADR details or decision-family shards instead of eagerly loading large root files.

**References** — `plugins/superpowers-memory/skills/load/`, `plugins/superpowers-memory/skills/query/`, `codex-plugins/superpowers-memory/skills/load/`, `codex-plugins/superpowers-memory/skills/query/`, ADR-005, ADR-006.

#### Project Knowledge Update And Rebuild

**Enables** — Agents can incrementally update or fully/scoped rebuild `docs/superpowers/memory/` from code, plans, specs, and ADRs.

**Actors / Entry Points** — `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/templates/`, and `plugins/superpowers-memory/content-rules.md`.

**Capability Boundary** — `plugins/superpowers-memory/content-rules.md` is the SSOT for ownership, exclusion rules, per-file structure, progressive shard layout, retrieval-cost guidance, query routing output, and `features.md` readability. Full/scoped rebuild can upgrade legacy large `decisions.md` and `glossary.md` files into root routers plus `decisions-<domain>.md` and `glossary-<domain>.md` shards while preserving ADR details, aliases, source refs, and tombstones.

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

**Capability Boundary** — Verify treats only `index.md` as a strict hot-path size constraint. `coverageGaps`, `retrievalCost`, and `splitCandidates` are advisory for non-index files; legacy `playbooks.md` files are ignored because the playbook slot is no longer part of the schema. Large root decision inventories can surface `decisions_family_shards_recommended`; large root glossaries can surface `glossary_alias_router_recommended`.

**References** — `plugins/superpowers-memory/hooks/fixtures/`; see `content-rules.md` for shape rules.

#### Progressive Knowledge Layout

**Enables** — Large project knowledge bases can split any non-index entry file by stable domain or submodule without treating size as information loss pressure.

**Actors / Entry Points** — `superpowers-memory:load`, `superpowers-memory:update`, `superpowers-memory:rebuild`, `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/index.md`, and both verify runtimes.

**Capability Boundary** — `index.md` stays ≤50 lines and routes to detailed files. Other recognized entry files may split into `<slot>-<domain>.md` shards; agents update index routing and load relevant shards on demand. `decisions.md` and `glossary.md` are special router roots when they grow large: stable decision families move to `decisions-<domain>.md`, and domain-local term clusters move to `glossary-<domain>.md`. The old playbook slot is removed rather than converted into another shard family. Codex host behavior remains experimental per ADR-013, but this layout contract is implemented in both runtimes.

**References** — `plugins/superpowers-memory/content-rules.md`, `plugins/superpowers-memory/templates/index.md`, `plugins/superpowers-memory/hooks/hook-runtime.js`, ADR-016.

#### DDD Design Pattern Guidance

**Enables** — Agents can apply DDD guidance from strategic modeling through tactical implementation across language-neutral and Go/Python/TypeScript guides.

**Actors / Entry Points** — `superpowers-architect:standards`, architect hooks, and design-pattern files under both `plugins/superpowers-architect/design-patterns/` and `codex-plugins/superpowers-architect/design-patterns/`.

**Capability Boundary** — `ddd-modeling.md` owns architecture gates, model discovery, mandatory technical-capability-before-port classification, port granularity (including the capability-lifecycle unit, inward-port extension default, and QueryRepository default merge rule in §0.2.1-§0.2.2), async handler cards, generalized routing/ownership examples covering Dispatcher-style systems, and vendor-wrapper ACL triage; `ddd-core.md` owns language-neutral DDD/Clean Architecture rules, CQRS product-read port boundaries, Domain Event vs Integration Message boundaries, and async reaction roles; `ddd-golang.md` covers Go layers/aggregates/repositories/CQRS/file layout/module assembly and treats named Go component libraries as the project-default stack, including transaction-shape guardrails, field-vs-method aggregate behavior guidance, QueryRepository-per-read-model-family examples, and thin RPC shortcut rules; `ddd-golang-events-messages.md` carries Go events/messages concerns (event.Collection, Domain Event Handlers, Boundary Publishers, Integration Messages, message handlers, message.Subscriber registration, message.Runner runtime loops, Kafka FailurePolicy, adapter wiring, idempotency, failure semantics); `ddd-golang-runtime.md` carries Go runtime concerns (config, fx module assembly guardrails, thin `cmd`, named service module variables, fx.Lifecycle, graceful shutdown, Kubernetes); `ddd-golang-taskqueue.md` carries Go taskqueue/polling/periodic concerns (TaskType, PeriodicTask, Schedule, schema registry, processors, asynq worker/scheduler wiring, middleware, polling policy, periodic schedule/policy validation, disabled-task registration, duplicate-name scope, business-visible scheduling placement); Python/TypeScript guides carry the same shared gates, placement rules, CQRS product-read boundaries, routing/topology port prohibitions, event-drain lifecycle, and cross-context message boundary in language-specific form.

**References** — `plugins/superpowers-architect/design-patterns/ddd-modeling.md`, `plugins/superpowers-architect/design-patterns/ddd-core.md`, `plugins/superpowers-architect/design-patterns/ddd-golang-events-messages.md`, `plugins/superpowers-architect/design-patterns/ddd-golang-taskqueue.md`, `plugins/superpowers-architect/design-patterns/ddd-python.md`, `plugins/superpowers-architect/design-patterns/ddd-typescript.md`; see `conventions.md` for design-pattern maintenance rules, ADR-015 for the agent-contract/runtime split, ADR-017 for the taskqueue split, and ADR-018 for the events/messages split.

#### DDD Code Agent Execution Contract

**Enables** — Code agents (Claude Code, Codex) follow a deterministic execution protocol when doing DDD, Go events/messages, Go runtime, or Go taskqueue work: trigger conditions, mandatory read order, stop-and-ask protocol, prohibited actions, matching self-checks, and a compact output template.

**Actors / Entry Points** — `plugins/superpowers-architect/design-patterns/ddd-agent-contract.md` (and its Codex mirror); referenced from the top of `ddd-modeling.md`, `ddd-core.md`, `ddd-golang.md`; loaded via the architect `standards` skill's directory scan.

**Capability Boundary** — The contract is a behavior layer, not architecture content. It classifies tasks into DDD-business / Go events/messages / Go taskqueue/polling/periodic / Go runtime-only / mixed, maps each to which specs must be read, and carries the 26-rule must-not list including the dependency-inversion-only Application-port ban, the routing/topology Application-port ban, the mechanism-operation-granular Port ban, the capability-fragmented Port ban, umbrella async/task handler rejection, mixed Domain Event / Integration Message handler rejection, periodic scheduler callback rejection, bloated Go RPC shortcut rejection, bloated Go fx entrypoint rejection, aggregate-field-as-business-decision-API rejection, and the ban on local substitutes for the adopted Go component stack including message runner/subscriber and Kafka failure-policy substitutes; it does not duplicate modeling/core/language rules. Promotion to a standalone skill is deferred until observed need (see ADR-015).

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

**Enables** — Agents can design tests from intent, architecture docs, ADRs, message flows, and sequence diagrams before implementation or hand-off.

**Actors / Entry Points** — `designing-tests` skill, Claude `PreToolUse` guidance, Codex SessionStart/UserPromptSubmit guidance, and references for architecture-test design, integration quality, hand-off gates, layer selection, risk catalog, test-case patterns, and test-quality review.

**Capability Boundary** — The skill turns architecture goals into reviewable test evidence through goal coverage matrices, state-ownership gates, quality-threshold assumptions, real/shallow/fake labels, and skipped/unrun residual-risk reporting. Claude uses tiered PreToolUse injection for planning/execution/TDD/hand-off skills; Codex uses SessionStart plus explicit `$superpowers:*` UserPromptSubmit routing and the full skill on demand.

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

**Capability Boundary** — Tests exercise real shell scripts and Node runtimes; Codex manifest tests guard canonical hook feature-flag docs and command hook metadata, designing-tests runtime tests guard hand-off/architecture guidance injection, while memory verify covers canonical PreToolUse deny behavior, legacy playbook ignore behavior, architecture coverage advisories, shard split advisories, decision/glossary router advisories, and strict index size. Memory skill surface tests also guard query-routing output fields and rebuild compatibility text. They do not replace full host-runtime acceptance testing.

**References** — `scripts/release/test/`; `plugins/superpowers-memory/hooks/fixtures/README.md`.

## In Progress

No capabilities currently in progress.

## Planned

No planned capabilities are tracked in this file.
