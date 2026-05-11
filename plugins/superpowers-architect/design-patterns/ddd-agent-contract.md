---
name: ddd-agent-contract
description: Mandatory agent execution contract for DDD and Go runtime work. Use BEFORE reading ddd-modeling / ddd-core / ddd-golang / ddd-golang-runtime or editing any file under internal/business/**, domain/, application/, infrastructure/, cmd/**/main.go, internal/pkg/**, configs/**, or fx lifecycle / shutdown wiring. Defines trigger conditions, execution order, stop protocol, prohibited actions, and completion self-check for code agents.
---

# DDD Code Agent Usage Contract

**Version**: v1.1
**Date**: 2026-05-11
**Audience**: Claude Code, Codex, and any other code agent expected to follow this repository's DDD standards.
**Scope**: This is a behavior contract, not an architecture spec. It tells an agent **when** to read which DDD pattern, in **what order**, when to **stop and ask**, what **never** to do, and what to **self-check** before reporting work as complete.

> If you are a human reading this, you may skim and go directly to [`ddd-modeling.md`](ddd-modeling.md) / [`ddd-core.md`](ddd-core.md) / [`ddd-golang.md`](ddd-golang.md). The rules below exist because LLM agents tend to skip preconditions and copy snippets out of context — this page defends against that.

---

## 1. Trigger Conditions (when this contract applies)

Apply this contract whenever **any** of the following is true:

- The task touches files under `internal/business/<context>/**` or paths named `domain/`, `application/`, `interfaces/`, `infrastructure/`.
- The task mentions any of: bounded context, aggregate, value object, repository, domain event, integration message, CQRS, anti-corruption layer, clean architecture, domain-driven design, DDD.
- The task is a backend implementation plan, refactor, code review, or architecture decision affecting one of the above.
- The task involves a new use case (command / query / event handler) inside an existing bounded context.
- The task is a cross-context change (publishing a new integration message, exposing a new read port, adding an ACL).
- The task touches Go runtime wiring: `cmd/**/main.go`, `internal/pkg/**`, `configs/**`, `fx.Module`, `fx.Lifecycle`, `OnStart` / `OnStop`, config loading, middleware client ownership, graceful shutdown, or Kubernetes `preStop`.

If unsure whether the contract applies: **assume it does** and read the contract once. The cost is small; the cost of skipping the gate is large.

---

## 2. Mandatory Execution Order

Agents must follow this sequence. Do not jump to planning, editing, or reviewing before classifying the task and reading the required specs.

```
1. Read this contract               (§1–§6 of this file)
2. Classify the task path           (DDD/business, Go runtime-only, or mixed)
3. Read the required specs          (see the matrix below)
4. Plan / edit / review code        (cite sections for non-trivial architecture decisions in plans, reviews, PR descriptions, or architecture notes; ordinary final summaries do not need section-by-section citations)
5. Run the matching self-check      (§5 below) before claiming the work is done
```

Required spec matrix:

- For **new bounded context or new aggregate** → read `ddd-modeling.md`, `ddd-core.md`, and the active language guide; emit the Architecture Gate block from modeling §0.
- For **new use case inside an existing context** → read modeling §7.2, all of core, and the relevant language sections (file org, event/message wiring, error/logging); emit the Architecture Gate block from modeling §0.
- For **local change inside an existing business layer** → read modeling §7.1, the affected core section, and the affected language sections; emit the Architecture Gate block from modeling §0 with true `n/a` values only for untouched fields.
- For **cross-context change** → read modeling §7.4 and core §5 in addition to the language guide; emit one Architecture Gate block per affected side when the change spans producer and consumer contexts.
- For **Go runtime-only work** (`cmd/**/main.go`, `internal/pkg/**`, `configs/**`, `fx.Lifecycle`, shutdown, Kubernetes) that does not change a bounded context, aggregate, repository, command/query handler, event/message contract, or domain rule → read `ddd-golang-runtime.md` and the relevant Go layout section in `ddd-golang.md`; do **not** emit the DDD Architecture Gate. Instead, state the runtime component, ownership, lifecycle hook, config, and shutdown impact.
- For **mixed business + runtime work** → read both the DDD path above and `ddd-golang-runtime.md`; emit the DDD Architecture Gate for the business change and include runtime impact in the plan.

If `ddd-modeling.md` defines a richer Architecture Gate block, emit that block, not the generic `standards` skill block. Never emit both.

---

## 3. Stop Protocol (when the agent must ask, not guess)

Before stopping, inspect the existing repository context first: current package paths, neighboring code, tests, docs, project knowledge, and existing module names. If the answer is still unknown or ambiguous after that inspection, the agent must **stop and ask the user** — not invent answers, not fill `n/a` to bypass — when any of the following is unknown or ambiguous:

| Unknown | Why stopping matters | What to ask |
|---|---|---|
| Bounded context the change belongs to | Wrong context → wrong package path, wrong language, wrong owner | "Which bounded context owns this change? <list candidates from current modules>" |
| Aggregate root affected | Wrong aggregate → wrong invariant scope, wrong transaction boundary | "Which aggregate's invariants does this touch?" |
| Business invariant being protected | No named invariant → cannot justify aggregate grouping or transaction boundary | "What rule must always be true after this change?" |
| Layer ownership (Domain / Application / Infra) | Wrong layer → import-boundary violations, leaked rules | "Is this a domain rule, an orchestration concern, or an external-system adapter?" |
| Technical-capability classification (registry / dispatcher / scheduler / connector) | Misclassified → ends up in Infrastructure with hidden rules | "Does this capability own stable language / states / policies, or only adapt an external system?" |
| Multi-aggregate write justification | Skipping the exception gate produces broken consistency boundaries | "Why does this need to write multiple aggregates in one transaction? Can it be split via Domain Events / Integration Messages / Saga?" |
| Integration Message contract & payload | Guessing breaks downstream consumers | "Is this a new Integration Message? Which consumers depend on it? What is the minimum required payload?" |
| Port semantic name (when tempted to use `Cacher`, `RedisStore`, etc.) | Technology-shaped port leaks Infrastructure inward | "What is the use-case semantic this port serves? (rate-limit / lease / cache-invalidation / repository / …)" |

**Hard rule**: if any field in the Architecture Gate block would have to be `n/a — <reason>` only because the agent does not know the answer, that is a Stop condition. `n/a` is reserved for cases where the change genuinely does not touch that field (per modeling §0).

---

## 4. Agent Must Not Do (prohibited actions)

These are the most common DDD failure patterns an LLM produces when it shortcuts the spec. Each one is rejected on review; do not commit any of them.

1. **Create technology-shaped ports.** Do not add `Cacher`, `RedisStore`, `RedisClient`, `MysqlReader`, `LockClient`, `OutboxWriter`, `TransactionalEventPublisher`, or `BrokerPublisher` as Domain / Application interfaces. Compose those clients inside Infrastructure behind an existing `Repository` / `QueryRepository` / semantic port. (core §3.4, modeling §0.2)
2. **Put generated proto / `pb.Message` into Domain.** Domain methods, value objects, repository interfaces, and domain events must use Domain-owned types. Convert `Proto ↔ Domain` at the Application or Infrastructure boundary. (core §5.7, golang §2.3)
3. **Implement business validation in Application / Handler.** Application constructs Domain inputs and calls Domain `Validate()` / domain methods. It must not run `validator.Struct(req)` against Domain fields or reproduce field rules in handlers. (core §3.1, §3.2)
4. **Load a full Aggregate to serve a UI read.** Use the read path — Application-owned `QueryRepository` returning DTOs. Aggregates are write-side. (core §3.2, §3.4)
5. **Import another context's `domain/` package.** Cross-context interaction uses one of: Integration Messages, cross-context query ports (`<ctx>/api/queries.go`), ACL, protocol contracts. Direct `import` of a neighbor's Domain is prohibited. (core §5, golang §5.1)
6. **Write multiple aggregates in one transaction "because the ORM makes it easy".** The default is one aggregate per transaction. Multi-aggregate transactions require the exception gate in core §3.2. `xorm.Session` / `gorm.Tx` convenience is not a justification.
7. **Drain Domain Events inside the Repository.** Only the Application layer calls `aggregate.Events.Drain()` / `collect_events()`, and only once, after a successful `Save()`. (core §3.1, golang §3.1)
8. **Treat Domain Events and Integration Messages as the same thing.** Domain Events are bounded-context-internal facts (publisher's ubiquitous language, refactorable freely). Integration Messages are the cross-context contract (additive evolution, consumer-visible). Same struct ≠ same concept. (core §5.3)
9. **Mutate Aggregate state by exported-field assignment.** All state changes go through Aggregate Root methods that enforce invariants. Anemic aggregates (only getters/setters with rules in handlers) are rejected. (core §3.1, golang §3.1)
10. **Generate aggregate IDs from database auto-increment.** Domain generates IDs (UUID / ULID / Snowflake) inside the factory method. Database auto-increment couples Domain to Infrastructure. (core §3.1, §1.3)
11. **Dispatch events before the persist succeeds.** Order is: call domain method → persist → drain → dispatch. Dispatching before persist creates events for state the system may later disown. (core §6.1)
12. **Define a Domain-facing port in Infrastructure and import it inward.** Inward layers define their ports; outer layers implement them. Never the reverse, even when the port "looks technical". (core §1.3, §3.1)
13. **Invent local substitutes for canonical Go component libraries.** In Go DDD code, do not define project-local `DomainEvent`, `EventBus`, `EventDispatcher`, `MessagePublisher`, `StateMachine`, `LoggerHelper`, `ConfigLoader`, or similar equivalents for concerns already covered by `ddd-golang.md`'s required library table. Use the named library interfaces directly (`github.com/go-jimu/components/ddd/event`, `github.com/go-jimu/components/ddd/message`, `github.com/go-jimu/contrib/message/kafka`, `github.com/go-jimu/components/fsm`, `github.com/go-jimu/components/sloghelper`, `github.com/go-jimu/components/config`, etc.) unless existing repository code or explicit user direction establishes an exception. (golang §3.1, §7)

> When uncertain whether a pattern is on this list, search this file for the keyword (`Cacher`, `proto`, `validation`, `drain`, …) before committing.

---

## 5. Completion Self-Check

Before claiming a task is done, run the matching checklist. Treat any applicable "no" as work remaining.

### 5.1 DDD / Business-Code Self-Check

- [ ] **Gate emitted**: the Architecture Gate block from modeling §0 (or the richer block when active) appears in the plan / PR description with concrete values, not `n/a` substituted for unknowns.
- [ ] **Layer imports clean**: `domain/` has no imports of frameworks, generated proto, storage drivers, queue clients, HTTP/gRPC packages, `internal/pkg/*` adapters, `internal/.../infrastructure`, or another context's `domain/`. (Grep before claiming done.)
- [ ] **Port granularity**: every new interface is named for a use-case semantic capability, not for a technology. No item from §4(1) was introduced.
- [ ] **Transaction boundary**: each Command Handler writes one aggregate per transaction, or the multi-aggregate exception in core §3.2 is satisfied in writing.
- [ ] **Event lifecycle**: events are collected inside domain methods, persisted before dispatch, drained once by Application after `Save()`, never by Repository.
- [ ] **Cross-context paths**: any cross-context communication uses one of Integration Messages / cross-context query port / ACL / protocol contracts; no new direct import of a neighbor's `domain/`.
- [ ] **Validation contract**: Domain types expose `Validate()` (or the language's equivalent); external layers call it rather than re-validating Domain fields.
- [ ] **If code changed, tests on the changed layer**: Domain rules covered by pure unit tests; Application orchestration covered with Repository/QueryRepository mocks; Infrastructure covered by integration tests against real dependencies (test containers or equivalent).
- [ ] **If docs / plans only changed**: references, section links, duplicated plugin copies (`plugins/` and `codex-plugins/`), and examples were checked for consistency.
- [ ] **Naming**: aggregate / event / command / handler / repository naming matches the language guide's convention table.
- [ ] **No `Must Not` violations**: each item in §4 above was reviewed against the diff.

### 5.2 Go Runtime Self-Check

Use this checklist when editing `cmd/**/main.go`, `internal/pkg/**`, `configs/**`, fx wiring, lifecycle hooks, or shutdown behavior:

- [ ] **Runtime guide read**: `ddd-golang-runtime.md` was read for config, fx, lifecycle, shutdown, and Kubernetes concerns.
- [ ] **Component owns its `Option`**: each runtime component declares its own `Option` in its own package; `cmd/server/main.go` only aggregates and supplies options.
- [ ] **Middleware ownership clean**: shared middleware clients are initialized in `internal/pkg/<middleware>`; bounded-context Infrastructure receives initialized clients and does not read config or open shared connections.
- [ ] **No technology-shaped business ports**: runtime clients such as Redis, MySQL, Kafka, or HTTP clients are not exposed inward as Domain/Application interfaces unless they represent a named semantic capability.
- [ ] **Lifecycle hooks fit in-flight work**: servers, dispatchers, consumers, and workers with in-flight work have `OnStop` drain behavior; pure clients only close resources when the library exposes cleanup.
- [ ] **Startup failure is observable**: listeners bind synchronously in `OnStart` before serving in a goroutine, so port conflicts fail startup instead of disappearing into background logs.
- [ ] **Shutdown ordering considered**: fx dependency order leaves dependencies available while servers, consumers, workers, and event dispatchers drain.
- [ ] **Config resolution documented**: new config keys are added to `configs/default.yml` (or documented profile files) and use the placeholder convention when env overrides are required.
- [ ] **Kubernetes impact checked**: high-traffic services that may receive traffic during termination have `preStop` / termination-grace-period considerations documented.
- [ ] **Runtime verification run**: build/tests or the relevant runtime test script were run; for docs-only changes, links and duplicated plugin copies were checked.

---

## 6. Notes on Example Code

Code blocks in the language-specific guides (e.g., `ddd-golang.md`) are **illustrative**, not copy-paste templates:

- Imports may be elided for readability.
- Identifiers may reference types not defined in the snippet.
- They show *shape and idiom*, not a compilable file.

When implementing, the agent must:

1. Open the actual surrounding package and follow its conventions.
2. Add the imports its target package needs (not necessarily the ones shown).
3. Run `go build ./...` / equivalent before claiming the change compiles.
4. Run the package's tests, or add new ones, before claiming behavior works.

If a snippet contradicts what compiles in the real repository, **the real repository wins** and the contradiction is a bug in the docs — flag it, do not silently rewrite the docs to match a stale snippet.

---

## 7. Minimal Output Format

Use this compact shape when reporting a DDD / runtime plan, review, or implementation result. Omit fields that genuinely do not apply; do not omit unknowns to avoid asking.

```text
Standards read:
- <ddd-agent-contract + modeling/core/language/runtime files actually read>

Task classification:
- <DDD/business | Go runtime-only | mixed>

Architecture Gate:
- <modeling §0 block for DDD/business changes, or "n/a — runtime-only; runtime component is ...">

Stop questions:
- <none, or the exact unresolved questions>

Planned / changed files:
- <paths>

Self-check result:
- <DDD checklist / runtime checklist / docs-only checks completed>
```

For final summaries after straightforward implementation, keep this brief: mention the files changed, verification run, and any remaining risk. Section-by-section citations are required for plans, reviews, PR descriptions, and architecture-affecting decisions, not for every final response.

---

## 8. Quick Index

| Need | Read |
|---|---|
| Identify bounded context / aggregate boundary | [`ddd-modeling.md`](ddd-modeling.md) §2, §3 |
| Architecture Gate block format | [`ddd-modeling.md`](ddd-modeling.md) §0 |
| Planning gates by change size | [`ddd-modeling.md`](ddd-modeling.md) §7 |
| Layer responsibilities & dependency rule | [`ddd-core.md`](ddd-core.md) §1, §3 |
| Repository / `Save()` collection semantics | [`ddd-core.md`](ddd-core.md) §3.4 |
| Multi-aggregate transaction exception gate | [`ddd-core.md`](ddd-core.md) §3.2 |
| Cross-context mechanisms (4 legitimate ways) | [`ddd-core.md`](ddd-core.md) §5 |
| Integration Message payload rules | [`ddd-core.md`](ddd-core.md) §5.4 |
| Architecture review checklist | [`ddd-core.md`](ddd-core.md) §10 |
| Go file layout / module assembly / event & message ports | [`ddd-golang.md`](ddd-golang.md) §2, §5, §10 |
| Go boundary checklist | [`ddd-golang.md`](ddd-golang.md) §2.4 |
| Go logging & error handling | [`ddd-golang.md`](ddd-golang.md) §8 |
| Go configuration, fx.Lifecycle, graceful shutdown, k8s preStop | [`ddd-golang-runtime.md`](ddd-golang-runtime.md) §1, §2 |
