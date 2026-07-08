---
name: review
description: Use when reviewing DDD/backend domain abstractions, specs, plans, or code diffs with concrete files, modules, generated artifacts, runtime wiring, persistence, logging, or boundary evidence to inspect.
---

# Review

Review concrete evidence against the expected model. A review finds evidence-backed issues, return-to-modeling triggers, or evidence gaps; it does not redesign.

Build/runtime blockers only block executable verification; independent static model review still runs. Compile blockers are never positive model signals, and absence of forbidden nouns is not model proof.

First read [../../references/ddd-core.md](../../references/ddd-core.md). This skill owns the workflow and layer baseline. Load strategic references such as [../../references/ddd-modeling.md](../../references/ddd-modeling.md) / [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md) only when model facts are unclear; load active language/layer references only for triggered code evidence.

## Expected model sources

Reconstruct the expected model before judging code:

- Domain Modeling Brief, user stories, strategic decisions, and out-of-scope rules;
- DDD design, testing seams, and **Implementation handoff**;
- model evidence for authority, lifecycle, invariant owner, failure tolerance, integration language, collaboration model, and coordination kind when those boundaries matter;
- spec/issue/ADR/glossary/CONTEXT;
- changed files, neighboring code, tests, generated artifacts, migrations, config, runtime wiring, logs, and documented deviations.

If the expected bounded context, data authority, invariant owner, model evidence, layer owner, or local convention cannot be reconstructed, report an evidence gap instead of inventing a model.

## Evidence gate

Before findings:

1. Confirm concrete evidence exists: files, paths, imports, tests, generated artifacts, schema/config/runtime/log evidence, or written deviation.
2. Start from business facts before code mechanics: command -> past-tense fact -> invariant owner -> reaction/process -> failure tolerance -> implementation mechanism.
3. Compare touched code against the layer baseline; missing required shape or present forbidden shape becomes a smell.
4. Use references only to explain triggered smells, not to enumerate findings.
5. Missing proof is an evidence gap unless concrete evidence proves a violation.
6. Accepted design and local convention are evidence to inspect, not waivers.
7. Implementation transaction shape is not model evidence and cannot satisfy Repository design.
8. Object splitting, package names, generated DTO mapping, and QueryRepository presence are not enough to clear a triggered smell family.
9. Scope narrows files to inspect; it does not remove required lifecycle/repository/event/CQRS family rows.

## Workflow

1. **Breadth scan**: compare touched code shape against the layer baseline. Output: Smell List rows with layer, trigger, baseline miss, and code evidence. Lifecycle/repository/event/CQRS scope must include rows for durable-fact command admission, terminal/execution split, repository/API candidate owner, collaboration mechanism, parent state vocabulary, accepted-design waiver, and CQRS inventory whenever the touched evidence reaches that family.
2. **Merge same-shape smells**: group rows by owner, lifecycle, boundary, state vocabulary, collaboration mechanism, runtime reachability, repository/API shape, or CQRS split. Output: merged smell families preserving every trigger and every required family row.
3. **Explain each family**: assume the smell is wrong until the relevant method, flow, state, event, port, or adapter shows the correct shape. Output: violation, return-to-domain-modeling, return-to-design, evidence-gap, or adjacent-smell.
4. **Follow related evidence**: for each adjacent smell, inspect the nearest sibling methods, flows, states, events, ports, adapters, or runtime registrations that share the same reason. Output: updated Smell List with any new family rows.
5. **Synthesize root cause**: combine family verdicts. Output: shared wrong model, boundary, lifecycle, state vocabulary, collaboration mechanism, repository/API shape, CQRS split, or recovery story.
6. **Report**: turn the synthesized verdicts into findings, evidence gaps / returns, non-required positive notes, verification, and residual risk. Output: final review judgment that places every triggered required family row under Findings or Evidence gaps / returns.

Smell explanation stays local by default. Use subagents only when the user explicitly asks.

Post-review calibration: when the user provides a known issue or scoring set after the initial conclusion, compare it to the original output, reflect why each issue was missed or shallowly found, and convert repeated misses into baseline rules, reference updates, or eval assertions.

## Layer Baseline

Detect smells by asking two questions for each touched layer: which required shapes are missing, and which forbidden shapes appear.

### Domain Layer

Required shape:

- Domain accepts Domain objects, Value Objects, Domain commands, or method arguments named in the ubiquitous language.
- Domain owns business facts, invariants, lifecycle states, transitions, policies, Domain errors, and Domain Events.
- Aggregate Roots are the sole write entrypoint for their invariant boundary.
- Value Objects validate on construction and are replaced, not mutated.
- Aggregate and Entity state changes go through behavior methods or Domain policies.
- Constructors and factories create valid objects and run business validation.
- Same-bounded-context Domain Events are recorded by aggregates after Domain state changes.
- Write Repository interfaces represent one Aggregate Root collection and normally expose only `Get` and `Save`.

Forbidden shape:

- Domain must not import generated protocol, transport, ORM/database, broker, cache, runtime, Infrastructure, or another bounded context's internal Domain packages.
- Domain must not persist, dispatch, publish, enqueue, start goroutines, read config, or log.
- Domain must not expose setters or public mutable state that outer layers use to perform business transitions.
- Domain Services must not need repositories, raw transactions, external clients, generated DTOs, schedulers, or runtime state.
- Domain must not treat storage ids, SQL constraints, `deleted_at`, JSON/proto tags, or persistence transactions as model proof.

### Application Layer

Required shape:

- Application accepts command/query DTOs and returns DTOs, read models, results, or mapped errors.
- Command flow loads one Aggregate Root through a Domain Repository, calls Aggregate or Domain Service behavior, saves it, then returns a result.
- Application drains and dispatches Domain Events exactly once after successful persistence when Domain Events exist.
- Application owns use-case orchestration, transaction boundary, authorization/session context, idempotency, retry admission, and error mapping.
- Application emits one completion log when it is the active execution boundary.
- Query flow calls a QueryRepository or read facade and returns Application read DTOs.
- Same-bounded-context reactions use Domain Event Handlers, boundary publication uses Boundary Publishers, and cross-context consumption uses Integration Message Handlers.
- Cross-context reads or reactions use published read facades, Integration Messages, ACLs, or protocol contracts.
- Generated RPC shortcut methods, when allowed, only map request, delegate once, and map response/error.

Forbidden shape:

- Application must not implement business rules by branching on Aggregate or Entity state.
- Application must not mutate Entity fields or perform Domain transitions through field assignment.
- Application must not pass raw transactions, ORM sessions, database clients, broker clients, Redis clients, or generated protocol DTOs into Domain.
- Application must not coordinate several Aggregate Root candidates through one Repository/API call as if transaction shape proved the model.
- Application must not rely on one transaction across several independent Aggregate Roots to make a business invariant true.
- Application must not define technology-shaped or topology-shaped ports without an accepted semantic capability.
- Application must not split one semantic capability lifecycle into many verb-shaped ports merely because an adapter has separate operations.
- Application must not dispatch Domain Events before successful persistence or let repositories drain events.
- Application must not serve product list/detail/history reads through write-side Repositories unless the read is a command-side Domain fact lookup.
- Application must not mix Domain Event Handler, Boundary Publisher, Integration Message Handler, and task processor roles in one concrete handler.
- Application must not import another bounded context's internal Domain or Application packages.
- Fat generated RPC methods must not call repositories, mutate aggregates, control transactions, dispatch events, enqueue tasks, or orchestrate multiple ports.

### Infrastructure Layer

Required shape:

- Infrastructure implements Domain Repositories, Application QueryRepositories/read facades, ACLs, external adapters, publishers, and runtime adapters.
- Infrastructure maps explicitly between Domain/DTO objects and storage, generated protocol, or external client objects.
- Infrastructure owns storage transactions, optimistic-lock version increments, soft-delete columns, retries, topology, routing, and SDK mechanics.
- Repository implementations persist one Aggregate Root plus owned children/value objects and rehydrate event collections.
- Shared technical clients and runtime resources live in shared Infrastructure/runtime packages, not in Domain or Application.

Forbidden shape:

- Infrastructure must not own business decisions, invariants, lifecycle admission, or state transition authority.
- Infrastructure must not call Domain transition methods as the business decision maker.
- Infrastructure must not disguise several independent Aggregate Roots or lifecycle owners as one Repository save because they share a transaction.
- Infrastructure must not make cross-aggregate correctness depend on one database transaction.
- Infrastructure must not drain or dispatch Domain Events from repositories.
- Infrastructure must not expose raw transactions, sessions, ORM objects, technical stores, broker clients, peer directories, or routing mechanisms inward without an accepted semantic port.
- Infrastructure must not make business deletion, recovery, or compensation exist only as technical columns, retries, or adapter behavior.
- Infrastructure must not import business packages into shared technical packages.

### Interface Layer

Required shape:

- Interface translates protocol requests, responses, format validation, actor/context extraction, and protocol error mapping.
- Interface delegates once to an Application command/query handler or thin read shortcut.
- Interface keeps generated/protocol DTOs at the boundary and maps them before Domain-facing APIs.

Forbidden shape:

- Interface must not contain business workflow, business state branching, transaction control, repository calls, aggregate mutation, event dispatch, task enqueueing, or multi-port orchestration.
- Interface must not expose Domain aggregates or Entities as product read responses.
- Interface must not convert protocol schema validation into Domain business validation.

### Runtime Layer

Required shape:

- Runtime loads configuration, supplies component options, assembles modules, registers routes/subscribers/processors/schedules, and runs the process.
- Shared runtime packages own client construction, lifecycle hooks, health checks, start/stop behavior, and shutdown order.
- Bounded-context modules provide Application services, adapters, handlers, processors, and registrations without exposing root wiring details.
- Production recovery, reconciliation, message, or task paths have a registered entrypoint and runtime ownership.

Forbidden shape:

- Runtime must not own business decisions, lifecycle admission, retries, compensation, or recovery semantics.
- Process entrypoints must not construct repositories, QueryRepositories, ACL clients, generated route handlers, workers, or business services directly.
- Application and Domain code must not own process loops, timers, provider lifecycle, shutdown policy, or runtime resource closure.
- Hidden manual loops, schedulers, or reconcilers without task/runtime ownership are smells even if the callable command exists.
- Environment branches in code must not replace configuration profiles or component options.

### Cross-Layer Sentinels

- Aggregate lifecycle: one Aggregate Root owns one lifecycle and invariant boundary; state words name parent lifecycle facts, not child process outcomes.
- Repository/API: one Repository normally exposes `Get` and `Save` for one Aggregate Root plus owned children/value objects; extra semantic methods, product reads, or cross-owner transaction methods start as smells.
- Cross-aggregate coordination: independent Aggregate Roots do not need the same transaction for business correctness; coordination is done by Domain Event, process manager, reconciler, task processor, Integration Message, or an explicit modeling return that changes the aggregate boundary.
- Durable fact precedence: succeeded/accepted/completed/executed facts outrank open workflow states; later commands check durable facts before retry/start, cancel, reopen, reversal/compensation, execution, or closure.
- Durable-fact command admission: when a durable child fact can precede parent state reflection, inspect retry/start/cancel/reopen commands against the durable fact; recovery reachability alone does not clear admission.
- Terminal closure: aggregate terminal facts and terminal events occur after required execution facts, idempotency/replay rules, and closure conditions are complete.
- Terminal/execution event vocabulary: child execution events and parent terminal events have distinct names and timing; parent terminal events are not emitted during partial child execution, and state closure alone does not clear this row.
- Collaboration: repeated external side effects, reversal/compensation, exception/dispute, settlement/closure, split execution/closure, or recovery reactions have one named collaboration mechanism and recovery behavior; payment recovery and terminal event vocabulary do not clear delivery/refund/dispute/settlement collaboration rows.
- CQRS: write repositories serve command-side aggregate facts; product reads use QueryRepository/read facades returning DTO/read models.
- Boundary isolation: Domain/Application semantic APIs use domain-owned language, not generated protocol, storage, runtime, or adapter concepts.
- Recovery reachability: reconciler, task, event, or message recovery has a production entrypoint, runtime registration, and failure behavior.
- Required family rows: payment/delivery/refund/dispute/settlement scope keeps durable-fact command admission, terminal/execution split, repository/API candidate-owner, collaboration mechanism, parent state vocabulary, accepted-design waiver, and CQRS inventory as separate rows when their evidence is present; one broader finding cannot clear another row.
- Repository/API inventory: inspect Domain Repository interfaces, Application repository calls, Infrastructure store methods, and every method outside `Get`/`Save`; classify each extra `List*`, read-shaped, semantic, or coordinated-object method as same Aggregate Root, owned child/value object, read model, or independent lifecycle owner.
- Accepted-design waiver inventory: when spec/design/local convention accepts semantic repository transactions, multi-object saves, or synchronous lifecycle-owner coordination, inspect whether the accepted text proves model ownership/failure tolerance or merely hides a boundary conflict; expected model sources are not waivers.
- CQRS inventory: inspect write repositories and shared adapters for list/detail/history/summary/read-shaped methods before clearing CQRS shape; QueryRepository/read-facade presence proves only the read side exists.
- Payment parent-state vocabulary: when Payment exists beside TaskAgreement payment states, inspect `payment_pending`, `payment_failed`, `payment_cancelled`, and succeeded/funded words as parent lifecycle facts; final verdict mentions `payment_pending` explicitly and does not omit this row because recovery or durable-fact command admission already has a finding.

## Output

Final answer is concise. Do not print the full working-evidence set by default.
For lifecycle/repository/event/CQRS scope, complete and merge smell verdicts before the final answer, then cite triggered required family rows only in Findings or Evidence gaps / returns.
Working evidence stays internal unless it is needed to understand a judgment. Required family-row verdicts are not working evidence and cannot stay internal. If a smell family cannot be explained from available evidence, report an evidence gap, not a positive claim.
Every triggered required family row and every explained smell-family verdict lands in Findings or Evidence gaps / returns. Positive, coverage, and residual notes are only for surfaces that were not smell rows. Do not suppress findings for template cost.
Do not collapse production wiring, durable-fact command admission, collaboration mechanism, candidate-owner, state vocabulary, or CQRS method-inventory decisions into a broader claim.
If a required row was inspected, name its verdict family in the final answer even when detailed evidence stays internal.
Each triggered required family label gets its own final verdict line; a broad repository/lifecycle evidence gap may summarize root cause only after candidate-owner, collaboration, accepted-design waiver, CQRS, and state-vocabulary rows are separately decided.

Report in this order when present: scope/model evidence, findings, evidence gaps / returns, positive notes for non-smell surfaces, verification, residual risk.

No DDD findings: say that directly only when no concrete violation/return was found; list any smell-family evidence gaps and residual test gaps. Do not fill a finding template with harmless local style.
No-finding, coverage, positive, and residual notes are only for surfaces outside required family rows that were not smell rows and have observed correct shape. Required family rows never go to No-Finding Notes or Coverage Notes. Repository/API smells need method inventory and candidate-owner classification; accepted-design waiver smells need explicit model ownership and failure-tolerance evidence; collaboration smells need named event/process/recovery mechanism; terminal/execution smells need separate execution and closure facts; parent-state vocabulary smells need parent lifecycle fact language; CQRS smells need write-repository and shared-adapter read/write method inventory. If the positive proof is only package names, object splitting, accepted design, DTO presence, QueryRepository presence, command-side fact lookup, or passing tests, report an evidence gap.

Severity is about architectural impact: Blocker for invariant/cross-context/generated/storage/runtime safety breaks; Major for likely boundary drift; Minor for localized maintainability or missing proof; Evidence gap when proof is missing.

Common mistakes: reviewing from grep hits; mixing domain/spec/code axes; treating local naming as a violation; treating modeling-return triggers as satisfied; saying "no issues" without residual test/evidence gaps.
