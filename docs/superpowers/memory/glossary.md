---
last_updated: 2026-07-05
updated_by: superpowers-memory:ingest
triggered_by_plan: "2026-04-27-auto-release-versioning-plan.md"
---

# Glossary

**Knowledge Base (KB)** — The set of Markdown files in `docs/superpowers/memory/` of a target project that persist cross-session understanding of architecture, conventions, and decisions. Not the plugin's own templates or retired memory directories. → `docs/superpowers/memory/`, ADR-019, ADR-024

**Progressive Loading** — Pattern used by both plugins: inject a lightweight index (names + descriptions + paths) at injection time; the agent loads full content on demand via `Read`. Avoids token bloat from dumping all content into every prompt. → ADR-005, ADR-006

**Knowledge Shard** — Focused `<slot>-<domain>.md` KB file split by stable domain/submodule; loaded on demand through index routing. → `plugins/superpowers-memory/content-rules.md`

**Retrieval Cost** — Advisory verify estimate of KB bytes/tokens; guides routing and splitting but never justifies deleting valid knowledge. → `plugins/superpowers-memory/hooks/hook-runtime.js`

**Hook Runtime** — Node.js entry point for superpowers-memory hooks. Claude `hook-runtime.js`; Codex `codex-runtime.js` (drops `user-prompt-expansion` mode, adds `user-prompt-submit`). → `plugins/superpowers-memory/hooks/hook-runtime.js`

**Trigger Skills** — Upstream `superpowers` skills that plugin hooks intercept. Claude memory hooks 5 skills via PreToolUse:Skill; Codex memory hooks only 2 manually-typed (brainstorming, finishing-a-development-branch) via UserPromptSubmit (ADR-013). → `plugins/*/hooks/`

**Domain Event** — DDD fact recorded inside one bounded context; cross-context contracts must be Integration Messages. → `plugins/ddd-expert/references/ddd-core.md`

**Integration Message** — Stable cross-context semantic contract for state propagation; Go guidance uses protobuf-first `ddd/message` envelopes. → `plugins/ddd-expert/references/ddd-core.md`

**Boundary Publisher** — Same-BC Domain Event consumer that maps selected Domain Events to Integration Messages; it does not consume Integration Messages or mutate aggregates. → `plugins/ddd-expert/references/ddd-core.md`

**Project-Default Go Component Stack** — Go libraries named by `ddd-golang.md` for DDD concerns in projects adopting this guide; agents should use their public interfaces instead of local substitutes unless the repo/user establishes an exception. → `plugins/ddd-expert/references/ddd-golang.md`

**Message Runner** — Optional `ddd/message` runtime-loop contract; `message.Subscriber` only registers handlers and does not start broker polling. → `plugins/ddd-expert/references/ddd-golang-events-messages.md`

**Kafka FailurePolicy** — Kafka adapter decision contract for message-level failures; consumers choose it explicitly instead of relying on retry/DLQ defaults. → `plugins/ddd-expert/references/ddd-golang-events-messages.md`

**TaskType** — Semantic task contract identifier for Go taskqueue payload schemas; processors are one TaskType each under Application, with asynq runtime wiring in `internal/pkg/taskqueue`. → `plugins/ddd-expert/references/ddd-golang-taskqueue.md`

**PeriodicTask** — Provider-neutral scheduled enqueue contract with narrow name + Schedule + static Task + EnqueuePolicy semantics; the normal `taskqueue.Processor` handles execution. → `plugins/ddd-expert/references/ddd-golang-taskqueue.md`

**Task Schema Registry** — Service-owned registry mapping `TaskType` values to Go payload structs for task serialization/deserialization; not a global singleton. → `plugins/ddd-expert/references/ddd-golang-taskqueue.md`

**KB Write Lock** — File `.git/superpowers-memory.lock` (60-min TTL) granting write access to `docs/superpowers/memory/`; acquired/released only by `superpowers-memory:ingest` or compatibility aliases. The lock also prevents manual legacy-path edits during migration. Same lock file used by both tracks. → ADR-010, ADR-019

**Rich Injection** — Hook output pattern: a multi-section `additionalContext` block (diff scope + imperative MUST language + numbered checklist) used in place of `decision: "block"`; designed to make compliance the path of least resistance without forcing a halt. → ADR-011

**Codex Native Hooks** — Manifest-declared lifecycle hooks loaded from each Codex plugin root when `hooks` and `plugin_hooks` are enabled. → `codex-plugins/superpowers-memory/hooks/hooks.json`, ADR-014

**Codex Fallback Hook Removal Helper** — Script-only migration path for deleting stale skill-workshop fallback hook entries from `~/.codex/hooks.json` after native Codex hooks are enabled. → `codex-plugins/superpowers-memory/scripts/install-codex-hooks.js`, ADR-014

**Auto Release Pipeline** — GitHub Actions flow that runs after PR merge, bumps path-affected plugin manifests/snippets, pushes a bump commit, tags it, and publishes a release. → `.github/workflows/auto-release.yml`

**Standing Primer** — Always-present text injected at SessionStart by Codex-side hooks to compensate for Codex's lack of per-skill JIT injection. Carries decay-tolerant standing rules ("before X, do Y") instead of just-in-time advisories. → ADR-013

**Prompt Router** — Codex UserPromptSubmit hook path that inspects raw user text and injects focused context for explicit workflow signals; used by memory and architect where skill-call hooks are unavailable. → `codex-plugins/*/hooks/codex-runtime.js`

**DDD Agent Contract** — Agent-behavior layer for DDD work: trigger conditions, task classification, stop protocol, hot-path Application-port decision card, P1-P7 self-checks, 26 must-not rules. → `plugins/ddd-expert/references/ddd-agent-contract.md`, ADR-015

**Application Command-Side Port** — Exceptional Application-owned command dependency allowed only after the gate rejects Domain Repository, Aggregate, Domain Service, Domain Event, Integration Message, named Application coordination service, ACL, and Infrastructure homes. → `plugins/ddd-expert/references/ddd-modeling.md`

**Capability-Lifecycle Port** — Application/Domain Port whose boundary encloses one stable semantic capability's full lifecycle (observe / mutate / publish / transfer / retire / release); inward-defined Ports default to extension over forking. → `plugins/ddd-expert/references/ddd-modeling.md` §0.2.1-§0.2.2

**Architecture Test Design** — Designing-tests reference workflow that turns architecture docs, ADRs, message flows, and sequence diagrams into goal coverage, state ownership, quality-threshold, and residual-risk test evidence. → `plugins/designing-tests/skills/designing-tests/references/architecture-test-design.md`

**Test Hand-off Gate** — Designing-tests verification record for real/shallow/fake labels, skipped/unrun risk, residual risk, and architecture claim evidence before completion or review claims. → `plugins/designing-tests/skills/designing-tests/references/handoff-gate.md`
