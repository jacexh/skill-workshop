# Superpowers DDD Architect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a dedicated `superpowers-ddd-architect` plugin and make the existing `superpowers-architect` explicit-only.

**Architecture:** Create parallel Claude and Codex plugin tracks by following the existing `superpowers-architect` layout, but keep only DDD/backend patterns in the new plugin and make its hot path a DDD Risk Router. Remove automatic hook injection from the old architect plugin so one workflow cannot receive both old and new architecture guidance.

**Tech Stack:** Markdown skills/patterns, Bash Claude hook, Node.js Codex hook runtime, JSON manifests, release shell tests.

---

## File Map

- Create `plugins/superpowers-ddd-architect/` with `.claude-plugin/plugin.json`, `README.md`, `skills/design/SKILL.md`, `skills/implement/SKILL.md`, `skills/review/SKILL.md`, shared `references/`, `hooks/hooks.json`, `hooks/pre-tool-use`, and `hooks/run-hook.cmd`.
- Create `codex-plugins/superpowers-ddd-architect/` with `.codex-plugin/plugin.json`, `README.md`, `skills/design/SKILL.md`, `skills/implement/SKILL.md`, `skills/review/SKILL.md`, shared `references/`, `hooks/hooks.json`, `hooks/codex-runtime.js`, `codex-hooks-snippet.json`, and `scripts/install-codex-hooks.js`.
- Modify `plugins/superpowers-architect/hooks/hooks.json`, `codex-plugins/superpowers-architect/.codex-plugin/plugin.json`, `codex-plugins/superpowers-architect/hooks/hooks.json`, and `codex-plugins/superpowers-architect/codex-hooks-snippet.json` to make old architect explicit-only.
- Modify old architect READMEs to document explicit-only behavior and DDD migration.
- Modify `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and `README.md` to list the new plugin.
- Modify release tests: replace old architect runtime assumptions with explicit-only checks and add DDD architect runtime checks.

## Task 1: Scaffold DDD Architect Plugin Tracks

**Files:**
- Create: `plugins/superpowers-ddd-architect/**`
- Create: `codex-plugins/superpowers-ddd-architect/**`

- [x] **Step 1: Copy the existing architect tracks as scaffolds**

Run:

```bash
cp -R plugins/superpowers-architect plugins/superpowers-ddd-architect
cp -R codex-plugins/superpowers-architect codex-plugins/superpowers-ddd-architect
```

Expected: both new directories exist.

- [x] **Step 2: Move DDD/backend references into shared plugin references**

Run:

```bash
mkdir -p plugins/superpowers-ddd-architect/references
mkdir -p codex-plugins/superpowers-ddd-architect/references
cp plugins/superpowers-architect/design-patterns/database.md plugins/superpowers-architect/design-patterns/ddd-*.md plugins/superpowers-ddd-architect/references/
cp codex-plugins/superpowers-architect/design-patterns/database.md codex-plugins/superpowers-architect/design-patterns/ddd-*.md codex-plugins/superpowers-ddd-architect/references/
rmdir plugins/superpowers-ddd-architect/design-patterns codex-plugins/superpowers-ddd-architect/design-patterns
```

Expected: new plugin references contain `database.md` plus Go DDD files only under plugin-root `references/`; root `design-patterns/` does not exist in the DDD plugin.

- [x] **Step 3: Add compact Risk Router pattern to both tracks**

Create `references/ddd-risk-router.md` in both new tracks with this content:

```markdown
---
name: DDD Risk Router
description: Compact DDD/backend architecture risk cards. Read first for DDD, Go backend, database-backed service, event/message, taskqueue, or runtime-boundary work.
---

# DDD Risk Router

Read this file first for DDD/backend architecture work. Use it to decide which deeper standards to load.

## Calibration Before Probes

Risk cards are portable; probe examples are not. Before treating any probe hit as evidence, identify the repository's local shape: bounded-context roots, layer names, generated code paths, RPC framework, runtime wiring, and local architecture tests/docs. Rewrite probe examples to match that shape. A probe hit is a review signal, not proof of a violation.

## Cards

### Cross-Context Direct Imports

- **Smell:** one bounded context imports another context's `domain/` or `application/`.
- **Probe examples:** for Go repos with `internal/<context>/<layer>` layout, start from `rg -n 'internal/.*/(domain|application)' internal` and then narrow by actual bounded-context roots.
- **Decision:** use Integration Messages, published read facades, ACL, or protocol contracts.
- **Allowed exception:** only with a written compatibility bridge and migration target.
- **Reference:** `ddd-core.md`, `ddd-golang.md`, `ddd-golang-events-messages.md`.

### Generated Protocol Types in Semantic Ports

- **Smell:** command-side or Domain-facing ports mention `pkg/gen`, `gen/go`, `proto.Message`, or ConnectRPC request/response types.
- **Probe examples:** in Go/protobuf repos, search semantic inward layers for generated-code imports, e.g. `rg -n 'pkg/gen|gen/go|proto\\.Message|connect\\.Request|connect\\.Response' <domain-or-application-paths>`.
- **Decision:** map generated DTOs at Interface/Application/Infrastructure boundaries.
- **Allowed exception:** query/read DTOs may use generated types only when the project explicitly treats them as read contracts.
- **Reference:** `ddd-core.md`, `ddd-golang.md`.

### Fat Go RPC Shortcut

- **Smell:** `application.go` generated RPC methods contain repository calls, saves, dispatch, enqueueing, transactions, or multi-port coordination.
- **Probe examples:** in Go repos that use generated RPC stubs on `application.go`, search those methods for persistence, dispatch, enqueueing, or transaction calls, e.g. `rg -n 'Save\\(|Dispatch|Enqueue|Transaction|Session|repo\\.|repository|Publisher|Handler' <application-entrypoint-files>`.
- **Decision:** keep RPC methods as map -> delegate once -> map response/error.
- **Allowed exception:** small actor/auth extraction needed to build the command/query.
- **Reference:** `ddd-golang.md`.

### Shared Umbrella Processor

- **Smell:** many one-kind message handlers delegate to one large `Processor` with unrelated message families or dependencies.
- **Probe examples:** search async handler packages for shared processors or multi-kind dispatchers, e.g. `rg -n 'type Processor|NewProcessor|processor\\.|switch .*Kind|Listening\\(\\)' <message-or-task-handler-paths>`.
- **Decision:** prefer one concrete handler/processor per inbound fact or task type.
- **Allowed exception:** same role, source family, side effect, transaction boundary, failure policy, and dependency set.
- **Reference:** `ddd-golang-events-messages.md`, `ddd-golang-taskqueue.md`.

### Business State Classification Outside Domain

- **Smell:** Application, message handlers, or task processors define helpers like `isTerminal`, `hasLiveRuntime`, `countsAsActive`, or branch directly on business `State`/`Status`.
- **Probe examples:** search Application/handler/processor layers for state classification helpers or direct business-state branches, e.g. `rg -n 'isTerminal|hasLiveRuntime|countsAsActive|requiresCleanup|\\.State|\\.Status' <application-paths>`.
- **Decision:** put stable state classification behind Aggregate methods or Domain policies.
- **Allowed exception:** mechanical DTO/read-model/proto mapping without business decision semantics.
- **Reference:** `ddd-agent-contract.md`, `ddd-core.md`, `ddd-golang.md`.

### Command-Side Application Port Reflex

- **Smell:** a command handler gets a new interface only because it needs to call an external mechanism.
- **Probe examples:** review new command-side interfaces and names ending in `Client`, `Publisher`, `Router`, `Directory`, `Writer`, `Sender`, or `Fetcher`.
- **Decision:** classify capability first; prefer Aggregate method, Repository, Domain Service, Domain Event, Integration Message, ACL, or Infrastructure adapter.
- **Allowed exception:** written gate proves a stable use-case semantic lifecycle that is not mechanism plumbing.
- **Reference:** `ddd-agent-contract.md`, `ddd-modeling.md`, `ddd-core.md`.

### Runtime/Cmd Provider Pollution

- **Smell:** `cmd/<service>/main.go` constructs repositories, query repositories, ACL clients, handler wrappers, or generated route handlers.
- **Probe examples:** in Go/fx repos, search entrypoints for business-layer imports, generated route registration, and provider-heavy wiring, e.g. `rg -n 'internal/.*/(infrastructure|application/(command|query|eventhandler|messagehandler|messagepublisher))|fx\\.Provide\\(|pkg/gen/.*(connect|grpc)' <cmd-paths>`.
- **Decision:** `cmd` loads config, selects modules, supplies aggregate options, and runs the app.
- **Allowed exception:** process-owned provider with runtime impact note.
- **Reference:** `ddd-golang-runtime.md`.

### Technical Bounded Context

- **Smell:** a context uses infrastructure-shaped terms such as pod, namespace, mount, supervisor, lease, or worker.
- **Probe examples:** inspect whether those terms appear in product/operator language and own stable lifecycle rules; do not classify by keyword alone.
- **Decision:** technical terms may be Domain language only when the bounded context is itself a runtime substrate.
- **Allowed exception:** record the stable lifecycle/invariant and keep deployment adapter details out of Domain.
- **Reference:** `ddd-modeling.md`, `ddd-core.md`, `ddd-golang-runtime.md`.
```

- [x] **Step 4: Verify scaffold file set**

Run:

```bash
find plugins/superpowers-ddd-architect codex-plugins/superpowers-ddd-architect -maxdepth 3 -type f | sort
```

Expected: new plugin files are present, references live under plugin-root `references/`, and non-DDD/frontend/REST patterns are absent.

## Task 2: Update DDD Architect Metadata, Skills, and Hooks

**Files:**
- Modify: `plugins/superpowers-ddd-architect/.claude-plugin/plugin.json`
- Modify: `codex-plugins/superpowers-ddd-architect/.codex-plugin/plugin.json`
- Create: `plugins/superpowers-ddd-architect/skills/design/SKILL.md`
- Create: `plugins/superpowers-ddd-architect/skills/implement/SKILL.md`
- Create: `plugins/superpowers-ddd-architect/skills/review/SKILL.md`
- Create: `codex-plugins/superpowers-ddd-architect/skills/design/SKILL.md`
- Create: `codex-plugins/superpowers-ddd-architect/skills/implement/SKILL.md`
- Create: `codex-plugins/superpowers-ddd-architect/skills/review/SKILL.md`
- Modify: `plugins/superpowers-ddd-architect/hooks/pre-tool-use`
- Modify: `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js`
- Modify: `codex-plugins/superpowers-ddd-architect/hooks/hooks.json`
- Modify: `codex-plugins/superpowers-ddd-architect/codex-hooks-snippet.json`

- [x] **Step 1: Update manifests**

Set both manifests to name `superpowers-ddd-architect`, description `DDD-first backend architecture guardrails for code agents`, and display name `Superpowers DDD Architect` on Codex.

- [x] **Step 2: Create phase-specific DDD skills**

Create `design`, `implement`, and `review` skills. All three read `ddd-risk-router.md` first, then load `ddd-agent-contract.md` and deeper references only when the phase, risk card, task, or gate requires them.

- [x] **Step 3: Narrow Claude hook wording**

Update `plugins/superpowers-ddd-architect/hooks/pre-tool-use` so planning workflows inject `DDD Design Guidance`, execution workflows inject `DDD Implementation Guardrails`, review workflows inject `DDD Boundary Review`, and all modes prioritize `ddd-risk-router.md`.

- [x] **Step 4: Narrow Codex runtime wording**

Update `codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js` so SessionStart is lightweight and points to `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, and `$superpowers-ddd-architect:review`; UserPromptSubmit still triggers only on explicit upstream `$superpowers:*` workflow mentions and natural-language DDD prompts return `{}`.

- [x] **Step 5: Verify syntax**

Run:

```bash
bash -n plugins/superpowers-ddd-architect/hooks/pre-tool-use
node --check codex-plugins/superpowers-ddd-architect/hooks/codex-runtime.js
```

Expected: both commands pass with no output.

## Task 3: Make Old Architect Explicit-Only

**Files:**
- Modify: `plugins/superpowers-architect/hooks/hooks.json`
- Modify: `codex-plugins/superpowers-architect/.codex-plugin/plugin.json`
- Modify: `codex-plugins/superpowers-architect/hooks/hooks.json`
- Modify: `codex-plugins/superpowers-architect/codex-hooks-snippet.json`
- Modify: `plugins/superpowers-architect/README.md`
- Modify: `codex-plugins/superpowers-architect/README.md`

- [x] **Step 1: Remove automatic Claude architect hook registration**

Set `plugins/superpowers-architect/hooks/hooks.json` to:

```json
{
  "hooks": {}
}
```

- [x] **Step 2: Remove automatic Codex architect hook registration**

Set both `codex-plugins/superpowers-architect/hooks/hooks.json` and `codex-plugins/superpowers-architect/codex-hooks-snippet.json` to a `hooks` object with no lifecycle entries. Keep `.codex-plugin/plugin.json` pointing at `./hooks/hooks.json` so manifest schema tests still pass.

- [x] **Step 3: Update old architect READMEs**

Document that `superpowers-architect` is explicit-only and that DDD/backend guidance has moved to `superpowers-ddd-architect`.

- [x] **Step 4: Verify old explicit skill still exists**

Run:

```bash
test -f plugins/superpowers-architect/skills/standards/SKILL.md
test -f codex-plugins/superpowers-architect/skills/standards/SKILL.md
```

Expected: both tests pass.

## Task 4: Update Marketplace, Root README, and Tests

**Files:**
- Modify: `.claude-plugin/marketplace.json`
- Modify: `.agents/plugins/marketplace.json`
- Modify: `README.md`
- Modify: `scripts/release/test/test_codex_architect_runtime.sh`
- Create: `scripts/release/test/test_codex_ddd_architect_runtime.sh`

- [x] **Step 1: Add marketplace entries**

Add `superpowers-ddd-architect` after `superpowers-architect` in both marketplace files. Use category `Productivity`, policy `AVAILABLE` / `ON_INSTALL` for Codex.

- [x] **Step 2: Update root README**

Add install commands and plugin listing for `superpowers-ddd-architect`, update repository structure, and describe `superpowers-architect` as explicit-only.

- [x] **Step 3: Update old architect runtime test**

Change `test_codex_architect_runtime.sh` so it verifies old architect has no automatic SessionStart/UserPromptSubmit/Stop hooks and still exposes standards skills.

- [x] **Step 4: Add DDD architect runtime test**

Create a test that verifies:

```text
SessionStart points to $superpowers-ddd-architect:design, :implement, and :review and does not inject pattern index.
UserPromptSubmit triggers only on explicit upstream $superpowers:* workflow mentions.
Planning prompts include DDD Design Guidance; execution prompts include DDD Implementation Guardrails; review prompts include DDD Boundary Review; all include ddd-risk-router.md.
Natural-language DDD prompt returns {}.
No Stop hook is registered.
Native hooks and fallback snippet match.
```

- [x] **Step 5: Run targeted tests**

Run:

```bash
bash scripts/release/test/test_codex_manifest_schema.sh
bash scripts/release/test/test_codex_architect_runtime.sh
bash scripts/release/test/test_codex_ddd_architect_runtime.sh
```

Expected: all pass.

## Task 5: Final Verification and Commit

**Files:**
- All changed files.

- [x] **Step 1: Run full release test suite**

Run:

```bash
bash scripts/release/test/run-tests.sh
```

Expected: all release tests pass.

- [x] **Step 2: Check important parity**

Run:

```bash
diff -qr plugins/superpowers-ddd-architect/references codex-plugins/superpowers-ddd-architect/references
diff -u plugins/superpowers-ddd-architect/skills/design/SKILL.md codex-plugins/superpowers-ddd-architect/skills/design/SKILL.md
diff -u plugins/superpowers-ddd-architect/skills/implement/SKILL.md codex-plugins/superpowers-ddd-architect/skills/implement/SKILL.md
diff -u plugins/superpowers-ddd-architect/skills/review/SKILL.md codex-plugins/superpowers-ddd-architect/skills/review/SKILL.md
```

Expected: design patterns match exactly; skills may differ only if host-specific paths are intentional.

- [x] **Step 3: Review git status**

Run:

```bash
git status --short
```

Expected: only planned plugin, docs, marketplace, README, and release-test files are changed.

- [x] **Step 4: Commit**

Run:

```bash
git add .claude-plugin/marketplace.json .agents/plugins/marketplace.json README.md plugins/superpowers-ddd-architect codex-plugins/superpowers-ddd-architect plugins/superpowers-architect codex-plugins/superpowers-architect scripts/release/test docs/superpowers/plans/2026-07-02-superpowers-ddd-architect.md
git commit -m "feat: add ddd architect plugin"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: plan creates the new DDD plugin, makes old architect explicit-only, updates marketplaces/READMEs, prevents duplicate injections, preserves Codex lightweight/natural-language quietness, and adds tests.
- Placeholder scan: no TODO/TBD placeholders are present.
- Type/path consistency: plugin name is consistently `superpowers-ddd-architect`.
