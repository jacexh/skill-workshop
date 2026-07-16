# ddd-expert

EventStorming-led DDD/backend workflow skills for Claude Code.

Use EventStorming as the single modeling path from backend evidence to a user-confirmed Strategic Model:

```text
/ddd-expert:event-storming
-> ready EventStorming minutes + canonical Models
/ddd-expert:codify
/ddd-expert:guard
-> implemented
```

This plugin is hookless. Skill frontmatter enables normal discovery, modeling, implementation, and review selection without binding to another workflow plugin.

## How it works

- `event-storming` facilitates the ten EventStorming steps one frontier question at a time, adversarially reviews the complete integrated model, writes one `draft` meeting record, waits for explicit confirmation, and then synchronizes `ready` minutes, canonical Models, and relevant documentation.
- `codify` realizes one or more `ready` EventStorming iterations and their affected canonical Models in working backend code, makes the required engineering decisions from project authority and house style, and obtains a clear independent Guard in the same task for material changes.
- `guard` independently reviews concrete implementation evidence for Model Realization and House-Style Conformance, then marks every cleared `ready` iteration `implemented`.
- `maintain-artifacts` is the internal read/validation/write protocol, not a user entry point.

EventStorming owns Strategic Model meaning and post-confirmation document rendering. The internal protocol preserves exact meeting records, validates the complete rendered transaction, and applies supplied bytes without deciding semantics. Codify is read-only over DDD artifacts; Guard review is read-only and may perform only the final `ready -> implemented` closure after a clear verdict.

## Activation guidance

Choose by requested outcome:

- `/ddd-expert:event-storming` when a story, scenario, Spec, PRD, or existing Model needs domain discovery, Aggregate/context boundaries, collaboration, and a confirmed Strategic Model.
- `/ddd-expert:codify` when one or more `ready` EventStorming iterations and their canonical Models must be implemented in the house style.
- `/ddd-expert:guard` when a concrete backend change must be reviewed before merge or release.

EventStorming finishes at `ready`: its meeting record carries the complete iteration solution and affected canonical Models carry current business meaning. No separate design phase sits between EventStorming and Codify. Guard finishes the iteration at `implemented` after independently clearing the implementation.

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

Exploration stays on a temporary EventStorming Board, separate from any Aggregate, Bounded Context, or Context Map. Supplied authority and local answers can support board facts or working decisions, but neither authorizes a file write. After all ten steps and adversarial review, EventStorming validates the complete candidate and writes one `draft` meeting record plus its unchecked README entry. Canonical Models remain unchanged until confirmation.

The facilitator investigates facts available in project evidence, then asks the user only for domain facts or decisions the evidence cannot supply. It presents discovered information in useful groups while putting one frontier question to the user per turn. Fact probes remain open; design proposals include a recommendation, reasons, and the strongest credible alternative. Local answers are working confirmations that later evidence may reopen.

When the scope is coherent, EventStorming shows:

- the exact Mermaid EventStorming view with timeline, Commands, actors/external systems, policies, past-tense Events, Hotspots, Bounded Context boundaries, and every supported Aggregate boundary—or the explicit evidence-based `No supported Aggregate` conclusion at Bounded Context scope;
- proposed language, authority, lifecycle, supported Aggregates/core objects, contexts, and collaboration;
- keep the Context Map focused on semantic Model Dependency (`U -> D`) contracts while complete scenario interactions stay in the EventStorming minutes; and
- key design decisions, assumptions, and non-blocking Hotspots.

Before confirmation, the facilitator challenges the model from participant/authority, scenario-variation, and model-pressure perspectives. It selects only cases capable of changing a material conclusion and stops when the strongest known alternative was considered and further cases have diminishing decision value. Blocking Hotspots must be resolved or removed by narrowing scope; non-blocking Hotspots remain visible.

EventStorming summarizes the draft minutes path, validation, decisions, assumptions, affected Models, and Hotspots in the console. Only explicit confirmation of those exact minutes authorizes the `ready` transition and documentation synchronization. A local “yes,” confirmation of one Aggregate, or acceptance of source facts does not confirm the whole model. A correction returns to the earliest affected step and rewrites the same draft minutes.

After confirmation, EventStorming derives the minimal documentation closure and synchronizes the `ready` minutes, affected canonical Models, Context Map, README, and relevant living Spec, PRD, ADR, and Glossary documents. Models integrate durable context-owned conclusions and link the minutes through `last_changed_by`; historical ADR handling follows repository policy.

## Boundary quality

Aggregate and Bounded Context conclusions come after events, Commands, actors, rules, and Hotspots are understood. Package, service, table, runtime component, team, or call direction is never enough to establish a context.

When a mechanism appears repeatedly, EventStorming applies DRY to knowledge rather than syntax and balances cohesion, information hiding, coupling, and YAGNI before comparing a shared domain mechanism, a shared technical Module, and distinct local semantics with translations. Common business language, lifecycle, rules, and ownership may establish one reusable domain capability; similar code shape alone may justify only technical reuse or deliberate local duplication.

The Context Map records semantic model dependency only. Global `U -> D` edges form a DAG and express model/published-contract influence; each named contract is documented once. Runtime call direction does not determine ownership, and cross-context scenario interactions stay in the iteration minutes.

## Artifact templates

- `templates/artifact-layout.md` defines the canonical DDD root and write boundaries.
- `templates/README.md` defines project DDD navigation.
- `templates/context-map.md` defines the global semantic-dependency projection, per-context inventory, optional Local Views, and named dependency contracts.
- `templates/event-storming.md` defines one complete iteration record and its lifecycle.
- `templates/model.md` defines one current Bounded Context Model.

EventStorming writes only draft minutes and the README TODO before confirmation. After approval, it applies the ready minutes, affected Models, Context Map, and relevant project-owned documents through one transaction. Codify reads ready minutes and Models; Guard closes a clear iteration as implemented.

## Scope

Use this plugin for domain modeling, confirmed-Model realization, and backend DDD review across Domain/Application/Transport/Infrastructure ownership, generated protocol boundaries, Go/Python/TypeScript backends, messages/tasks/runtime behavior, and database-backed persistence when those concerns are in scope.

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
