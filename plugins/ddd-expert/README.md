# ddd-expert

EventStorming-led DDD/backend workflow skills for Claude Code.

Use EventStorming as the single modeling path from backend evidence to a user-confirmed Strategic Model:

```text
/ddd-expert:event-storming
/ddd-expert:codify
/ddd-expert:guard
```

This plugin is hookless. Skill frontmatter enables normal discovery, modeling, implementation, and review selection without binding to another workflow plugin.

## How it works

- `event-storming` facilitates the ten EventStorming steps one frontier question at a time, adversarially reviews the complete integrated model, waits for explicit model confirmation, and then applies one synchronized `model_ready` documentation closure.
- `codify` realizes already accepted Tactical Design in working backend code and must obtain a clear independent Guard in the same task for material changes.
- `guard` independently reviews concrete implementation evidence for Design Realization and House-Style Conformance.
- `maintain-artifacts` is the internal read/validation/write protocol, not a user entry point.

EventStorming owns Strategic Model meaning and post-confirmation document rendering. The internal protocol preserves the exact confirmed views, validates the complete rendered transaction, and applies supplied bytes without deciding semantics. Codify and Guard inspect DDD artifacts read-only.

## Activation guidance

Choose by requested outcome:

- `/ddd-expert:event-storming` when a story, scenario, Spec, PRD, or existing Model needs domain discovery, Aggregate/context boundaries, collaboration, and a confirmed Strategic Model.
- `/ddd-expert:codify` when a separately accepted, revision-matched Tactical Design must be implemented in the house style.
- `/ddd-expert:guard` when a concrete backend change must be reviewed before merge or release.

EventStorming stops at `model_ready`. It does not generate Tactical Design or route automatically into Codify. A missing or stale Tactical Design is a separate authority gap, not permission for EventStorming to invent implementation decisions.

## EventStorming contract

The modeling path follows this order:

1. clarify the modeling scope;
2. place past-tense Domain Events first;
3. arrange events on the timeline;
4. find Commands;
5. add actors and external systems;
6. mark business rules and policies;
7. mark problems and ambiguities;
8. identify Aggregates and core business objects;
9. identify Bounded Contexts; and
10. establish context collaboration.

A simple change inside an accepted context does not force a new repository-wide Big Picture. The depth is proportionate, but the order and confirmation boundary do not change.

All exploration stays on a temporary EventStorming Board, separate from any Aggregate, Bounded Context, or Context Map. Supplied authority and local answers can support board facts or working decisions, but neither authorizes a file write. Before model confirmation, every workspace file remains unchanged.

The facilitator investigates facts available in project evidence, then asks the user only for domain facts or decisions the evidence cannot supply. It presents discovered information in useful groups while putting one frontier question to the user per turn. Fact probes remain open; design proposals include a recommendation, reasons, and the strongest credible alternative. Local answers are working confirmations that later evidence may reopen.

When the scope is coherent, EventStorming shows:

- the exact Mermaid EventStorming view with timeline, Commands, actors/external systems, policies, past-tense Events, Hotspots, Bounded Context boundaries, and every supported Aggregate boundary—or the explicit evidence-based `No supported Aggregate` conclusion at Bounded Context scope;
- proposed language, authority, lifecycle, supported Aggregates/core objects, contexts, and collaboration;
- separate Context Map Model Dependency (`U -> D`) and runtime/business Interaction (`initiator -> receiver`) views; and
- key design decisions, assumptions, and non-blocking Hotspots.

Before confirmation, the facilitator challenges the model from participant/authority, scenario-variation, and model-pressure perspectives. It selects only cases capable of changing a material conclusion and stops when the strongest known alternative was considered and further cases have diminishing decision value. Blocking Hotspots must be resolved or removed by narrowing scope; non-blocking Hotspots remain visible.

Only explicit confirmation of the current complete integrated model authorizes documentation synchronization. A local “yes,” confirmation of one Aggregate, or acceptance of source facts does not confirm the whole model. A correction returns to the earliest affected step and replaces the candidate as a whole.

After confirmation, EventStorming derives the minimal documentation closure and synchronizes relevant DDD artifacts and living Spec, PRD, ADR, and Glossary documents. The user does not approve a per-file impact inventory. If rendering exposes a new semantic decision, it returns to the EventStorming Board. The written Model contains the exact diagram source the user saw and uses `model_status: model_ready`; historical ADR handling follows repository policy and normally creates a superseding ADR instead of rewriting old rationale.

## Boundary quality

Aggregate and Bounded Context conclusions come after events, Commands, actors, rules, and Hotspots are understood. Package, service, table, runtime component, team, or call direction is never enough to establish a context.

When a mechanism appears repeatedly, EventStorming applies DRY to knowledge rather than syntax and balances cohesion, information hiding, coupling, and YAGNI before comparing a shared domain mechanism, a shared technical Module, and distinct local semantics with translations. Common business language, lifecycle, rules, and ownership may establish one reusable domain capability; similar code shape alone may justify only technical reuse or deliberate local duplication.

The Context Map keeps semantic dependency and interaction direction separate. Global `U -> D` edges form a DAG and express model/published-contract influence. Interaction edges express initiator-to-receiver flow, may point the other way or form cycles, and never create model ownership.

## Artifact templates

- `templates/artifact-layout.md` defines the canonical DDD root and write boundaries.
- `templates/README.md` defines project DDD navigation.
- `templates/context-map.md` defines separate semantic-dependency and interaction projections.
- `templates/model.md` defines one confirmed Model with its exact EventStorming view.
- `templates/design.md` defines separately accepted Tactical Design structure; EventStorming does not create or update it.

EventStorming may update the DDD README, Context Map, Models, and relevant project-owned companion documents through one post-confirmation `apply-confirmed-model` transaction. Codify and Guard may inspect only.

## Scope

Use this plugin for strategic domain modeling, accepted design realization, and backend DDD review across Domain/Application/Transport/Infrastructure ownership, generated protocol boundaries, Go/Python/TypeScript backends, messages/tasks/runtime behavior, and database-backed persistence when those concerns are in scope.

Do not use it for frontend architecture, browser QA, product UI design, or general dynamic standards lookup.

## References

Canonical references live under `references/`:

- `ddd-modeling.md` — EventStorming, language, authority, lifecycle, Aggregates, Bounded Contexts, abstraction pressure, and collaboration views
- `ddd-core.md` — language-neutral tactical DDD and Clean Architecture
- `ddd-collaboration.md` — published APIs, events/messages, coordination, and reliable delivery
- `ddd-golang.md` — Go/go-jimu house-style router and baseline
- `ddd-golang-scaffold.md` — Go module layout, generated code, and composition
- `ddd-golang-domain.md` — Go Domain objects, Repositories, events, and lifecycle
- `ddd-golang-application.md` — Go commands, queries, transactions, ports, and assemblers
- `ddd-golang-transport.md` — ConnectRPC/HTTP, subscriber, and task adapters
- `ddd-golang-cqrs.md` — conditional Go QueryRepository and read-model flow
- `ddd-golang-infrastructure.md` — Go persistence, conversion, ACL, and outbound adapters
- `ddd-golang-events-messages.md` — Go Domain Event and Integration Message flows
- `ddd-golang-taskqueue.md` — Go deferred work, scheduling, and Asynq runtime
- `ddd-golang-runtime.md` — Go configuration, composition, lifecycle, and shutdown
- `ddd-python.md` and `ddd-typescript.md` — compact language house styles
- `database.md` — persistence and schema house style

Project-specific architecture facts remain in explicit project documents; generic plugin references do not encode evaluation fixtures or one repository's known answer.
