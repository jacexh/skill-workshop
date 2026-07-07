# ddd-expert Modeling Gates Design

- **Status**: Draft
- **Date**: 2026-07-07
- **Author**: xuhao + Codex

## Context

`ddd-expert` already has useful DDD/backend guidance:

- phase skills for `domain-modeling`, `design`, `implement`, and `review`;
- `ddd-risk-router.md` for implementation/review risk routing;
- `ddd-modeling.md` and `ddd-core.md` for strategic/tactical DDD rules;
- Go references for Domain, Application, Infrastructure, CQRS, events/messages, taskqueue, runtime, and database-backed persistence.

The recent `sanhe` TaskAgreement review showed a structural weakness in how the plugin guides agents. The agent produced a DDD-shaped Go model where `TaskAgreement` looked like the lifecycle owner, while `Payment`, `Delivery`, `RefundCase`, `Refund`, and `Settlement` were also treated as independent aggregate roots. Repository/store methods then synchronously updated several domain objects in one transaction-like operation.

The important failure was not that a repository name was imperfect. The important failure was that the agent improved the expression of a multi-object transaction before challenging why the transaction existed.

This case is a symptom, not the whole scope. The same failure shape can occur with bounded contexts, entities, value objects, domain services, application services, domain events, integration messages, CQRS read models, ACLs, process managers, and persistence mechanisms.

## Problem

The current plugin is strong near code and technology surfaces, but weaker at the earlier modeling moment.

`ddd-risk-router.md` is currently named broadly, but its cards mostly classify code shapes and implementation/review risks: cross-context imports, generated protocol leakage, fat RPC adapters, umbrella processors, command-side port reflexes, runtime provider pollution, and similar surfaces.

That is valuable, but it is not the domain-modeling spine. A modeling spine should help the LLM ask:

- What business story is unfolding?
- Who has authority over this state?
- Which lifecycle is independent?
- Which invariant must never be broken?
- What failure or temporary inconsistency can the business tolerate?
- Which language is internal, and which language is published across a boundary?
- Is this a domain decision, application coordination, or infrastructure mechanism?

Without that spine, the agent can jump from product nouns into tactical DDD objects. The result can look clean while still carrying a wrong model.

## Goals

1. Add a small, high-leverage modeling thought framework that guides LLM reasoning before tactical DDD choices.
2. Keep `ddd-risk-router.md` focused on implementation/review risk routing instead of making it a general DDD rule catalog.
3. Strengthen phase behavior without turning the plugin into a large rule-based checklist.
4. Make `domain-modeling` and `design` feel like an architecture coach, while `implement` and `review` act like a senior reviewer requiring evidence.
5. Add behavior-oriented forward tests that verify agents stop, question, or revisit the model when faced with ambiguous DDD structures.

## Non-Goals

- Do not rewrite all DDD references in this phase.
- Do not replace existing Go implementation guidance for Domain/Application/Infrastructure/CQRS/events/runtime.
- Do not add a large concept encyclopedia.
- Do not turn every DDD concept into a hard `if/then` rule.
- Do not make natural-language prompt hooks noisy.

## Decision

Add a new shared reference:

```text
references/ddd-modeling-gates.md
```

This file is not a rule catalog. It is a compact set of thinking moves used by `domain-modeling` and `design` before tactical objects are accepted.

Keep `ddd-risk-router.md` as the implementation/review risk router. It should explicitly point modeling questions back to `ddd-modeling-gates.md` and `ddd-modeling.md`.

## Modeling Gates

`ddd-modeling-gates.md` should contain a small number of gates. Each gate is a thinking prompt with a purpose, not a mechanical checklist.

### 1. Story Before Nouns

Do not start from objects. Start from a business story:

- actor or system trigger;
- command or decision;
- state change or outcome;
- exception path;
- business-visible consequence.

This prevents CRUD nouns, UI shapes, and table names from becoming DDD objects by default.

### 2. Authority Before Ownership

Before assigning an owner, ask who has the authority:

- Who confirms this state?
- Who can reverse or override it?
- Which system is the source of truth?
- Which team or external party owns the language?

This is the entry point for bounded context, data authority, ACL, and published-language decisions.

### 3. Lifecycle Before Type

Before choosing Entity, Value Object, Aggregate Root, read model, or external adapter, ask:

- Does this thing have identity across change?
- Can it exist independently?
- Can it fail independently?
- Does the business refer to its lifecycle, or is it an attribute/snapshot?

This prevents noun-list DDD and helps the LLM distinguish Entity vs Value Object vs child Entity vs Aggregate Root.

### 4. Invariant Before Aggregate

An aggregate is a consistency boundary around business invariants, not a synonym for an important noun.

Ask:

- What rule must always be true after a command?
- If A changes without B, is the business state invalid or merely temporarily incomplete?
- Is the invalidity repairable by retry, event handling, compensation, or reconciliation?
- If several objects always change together, why are they separate aggregate roots?

This gate covers the sanhe symptom without making the whole plugin about multi-aggregate transactions.

### 5. Failure Tolerance Before Transaction

Before accepting a synchronous transaction, ask what failure means:

- Is temporary inconsistency acceptable?
- Is the business outcome observable before all side effects finish?
- Is retry idempotent?
- Is compensation needed?
- Is a reconciler/process manager the real owner of the long-running coordination?

Only after this can the design discuss a same-transaction write, Domain Event, Integration Message, task, compensation, or reconciler.

### 6. Language Before Integration

Before choosing Domain Event, Integration Message, ACL, protocol contract, or read facade, ask:

- Is this fact internal to one bounded context?
- Is this a stable published language for consumers?
- Is the downstream adopting upstream language, translating it, or querying a published read facade?
- Is the event a past-tense fact or a disguised command?

This keeps Domain Events internal and Integration Messages contractual.

### 7. Coordination Before Abstraction

Before creating a Repository, Domain Service, Application Service, port, task, or process manager, ask what kind of work this is:

- domain decision;
- application orchestration;
- long-running process coordination;
- read model composition;
- external-system translation;
- infrastructure mechanism.

This prevents ports, repositories, and services from becoming nicer wrappers around unresolved modeling questions.

## Phase Behavior

### Domain Modeling

`domain-modeling/SKILL.md` should load `ddd-modeling-gates.md` after inspecting existing evidence.

Its output should remain conversational and brief, but when the topic likely affects DDD boundaries, the final Domain Modeling Brief should include a compact `Model Decisions` section:

```text
Model Decisions:
- Story / command:
- Authority / data owner:
- Lifecycle owner:
- Invariant owner:
- Failure tolerance:
- Collaboration style:
- Explicit non-aggregate nouns:
```

This is not a mandatory template for tiny tasks. It is required when the user story introduces or changes lifecycle, ownership, consistency, integration, or model boundaries.

### Design

`design/SKILL.md` should use `ddd-modeling-gates.md` before tactical choices.

Design should not name aggregate roots, repositories, handlers, ports, schemas, or transactions until the relevant gates are answered. For substantial designs, the output should include:

- strategic model;
- modeling gate summary;
- tactical decisions;
- testing seams;
- implementation handoff.

The handoff must identify which source the implement phase should trust, and which modeling gates justified the tactical objects.

### Implement

`implement/SKILL.md` should not redo modeling by default. It should verify that the handoff contains enough modeling evidence.

If implementation sees a contradiction, such as a handoff that asks for synchronous writes across several candidate aggregate roots without an invariant/failure explanation, it should stop and return to design.

Implementation should behave like a reviewer near code: evidence first, then edit.

### Review

`review/SKILL.md` should reconstruct the expected model from the Domain Modeling Brief, design, handoff, code, and tests.

Review should distinguish:

- modeling ambiguity;
- design violation;
- implementation placement error;
- allowed exception;
- evidence gap.

It should not redesign in place, but it should report when code looks DDD-shaped while the model evidence is missing.

## Concept Matrix

| Concept | Current strength | Missing thinking prompt | Gate |
|---|---|---|---|
| Bounded Context | Existing authority/language guidance | Who owns language and confirmation authority? | Authority Before Ownership |
| Aggregate | Good tactical rules | What invariant requires one consistency boundary? | Invariant Before Aggregate |
| Entity / Value Object | Good Go shape guidance | Does it have identity/lifecycle or just replaceable attributes? | Lifecycle Before Type |
| Repository | Strong implementation guidance | Which aggregate root collection does it represent? | Coordination Before Abstraction |
| Domain Service / Policy | Good definition | Is this a named domain decision or transaction orchestration? | Coordination Before Abstraction |
| Application Service | Good Go placement rules | Is it orchestrating or deciding? | Coordination Before Abstraction |
| Domain Event | Strong event/message rules | Is this an internal past-tense fact? | Language Before Integration |
| Integration Message | Strong Go message guidance | Is this stable published language? | Language Before Integration |
| CQRS / Read Model | Good implementation guidance | Which product view, freshness, authority, and consistency window? | Story Before Nouns |
| ACL | Present but not prominent | Is external language being translated or leaked? | Authority Before Ownership |
| Process Manager / Reconciler | Scattered in language/taskqueue references | Is this long-running coordination rather than a transaction? | Failure Tolerance Before Transaction |
| Database Transaction | Strong technical standards | Does the transaction follow the consistency boundary, or define it accidentally? | Failure Tolerance Before Transaction |

## Forward Tests

Add behavior-oriented tests. They should avoid exact long-output assertions and instead check for required reasoning outcomes.

### TaskAgreement Boundary Scenario

Input: a TaskAgreement lifecycle spec where `TaskAgreement` owns lifecycle, but `Payment`, `Delivery`, `RefundCase`, `Refund`, and `Settlement` are proposed as independent aggregate roots while commands synchronously update several of them.

Expected behavior:

- design stops or raises an aggregate boundary contradiction;
- output asks what invariant requires synchronous commit;
- output does not generate `LifecycleRepository` or prettier multi-aggregate repository methods as the first fix.

### Noun-List Scenario

Input: a spec listing many nouns such as `Order`, `OrderLine`, `Invoice`, `PaymentAttempt`, `Shipment`, `Address`, `Coupon`, with no lifecycle or invariant evidence.

Expected behavior:

- domain-modeling asks for story/authority/lifecycle before aggregate roots;
- design does not directly promote every noun to Aggregate Root.

### Event-as-Command Scenario

Input: a design that emits `UserShouldBeSuspended` or `StartPayment` as an event consumed by another context.

Expected behavior:

- modeling/design distinguishes past-tense facts from commands;
- review asks whether this is a Domain Event, Integration Message, command, or process step.

### External-Language Leakage Scenario

Input: an external payment provider's status names are used directly in Domain state.

Expected behavior:

- design routes through Authority Before Ownership and ACL;
- implementation/review expects translation at the boundary.

### Read-Model Backflow Scenario

Input: a dashboard query shape is used to define the write aggregate.

Expected behavior:

- design separates product read model from write-side aggregate;
- CQRS guidance loads only after the model boundary is clear.

### Long-Running Coordination Scenario

Input: a command needs payment authorization, delivery acceptance, refund, and settlement over time.

Expected behavior:

- design considers process manager/reconciler/task/event flow before synchronous transaction;
- implementation stops if handoff lacks failure/idempotency/compensation evidence.

## Implementation Plan Outline

1. Add `ddd-modeling-gates.md` to both `plugins/ddd-expert/references/` and `codex-plugins/ddd-expert/references/`.
2. Update `domain-modeling/SKILL.md` in both tracks to load the modeling gates and emit `Model Decisions` when boundary decisions are material.
3. Update `design/SKILL.md` in both tracks to use modeling gates before tactical objects.
4. Update `implement/SKILL.md` and `review/SKILL.md` with concise handoff/evidence behavior for model contradictions.
5. Update `ddd-risk-router.md` to clarify its implementation/review risk-routing role and route modeling ambiguity to `ddd-modeling-gates.md`.
6. Add release tests that verify new references exist, both plugin tracks are aligned, and behavior-oriented fixtures contain the expected reasoning outcomes.
7. Update README capability text only if necessary.

## Acceptance Criteria

1. `ddd-modeling-gates.md` exists in both plugin tracks and stays compact.
2. `domain-modeling` and `design` reference modeling gates before tactical DDD objects.
3. `implement` and `review` stop or report evidence gaps when handoff/code contradicts modeling gates.
4. `ddd-risk-router.md` remains a risk router and does not grow into a modeling rule catalog.
5. Forward tests cover TaskAgreement, noun-list modeling, event-as-command, external-language leakage, read-model backflow, and long-running coordination.
6. Existing Go implementation references remain semantically intact.
7. Claude and Codex plugin tracks stay semantically aligned.

## Risks

| Risk | Mitigation |
|---|---|
| Modeling gates become another checklist | Keep each gate as a thinking prompt with examples, not a long rule table |
| Agents over-stop on small tasks | Skills say gates are required only when lifecycle, ownership, consistency, integration, or boundary decisions are material |
| Existing references duplicate the new gates | New gates link to existing references instead of copying their implementation detail |
| Forward tests become brittle exact-output tests | Assert reasoning outcomes and key stop behavior, not full prose |
| `ddd-risk-router` role becomes confusing | Rename its description and add a short boundary statement |

## Self-Review

- This design does not propose a broad rewrite.
- The new reference is intentionally small and reasoning-oriented.
- The sanhe case is used as a symptom, not as the whole design scope.
- Implement/review remain evidence-driven while domain-modeling/design remain exploratory.
- The approach trusts LLM reasoning but gives it a stable order of thought.
