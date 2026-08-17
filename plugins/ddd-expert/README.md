# ddd-expert

EventStorming-led DDD/backend workflow skills for Claude Code.

Use EventStorming as the single modeling path from backend evidence to a user-confirmed Strategic Model:

```text
/ddd-expert:event-storming
-> ready EventStorming minutes + canonical Models
/ddd-expert:tactical-design (only for a real Design Delta)
-> ready collaboration design + stable claims + optional BC Architecture projection
/ddd-expert:codify
-> verified implementation checkpoint
/ddd-expert:guard (iteration closure or merge/release)
-> implemented
```

This plugin is hookless. Skill frontmatter enables normal discovery, modeling, implementation, and review selection without binding to another workflow plugin.

## How it works

- `/ddd-expert:event-storming` facilitates the ten EventStorming steps one frontier question at a time, normalizes Commands by initiating intent, then projects them into stable Aggregate Capabilities and only business-required Reactions in canonical Models.
- `/ddd-expert:tactical-design` runs only for a real Design Delta, confirms complete critical collaboration sequences and a small stable claim set, and projects only durable BC-specific decisions into optional `context/<context-slug>/architecture.md`. No Design Delta produces no Tactical Design artifact.
- `/ddd-expert:codify` realizes ready EventStorming authority plus any required ready Tactical Design in working backend code, runs producer conformance, and either stops at a verified implementation checkpoint or hands a stable snapshot to Guard.
- `/ddd-expert:guard` uses one fresh read-only reviewer to judge whether a stable backend change expresses the accepted Model, Tactical Design claims, and house style, then jointly closes the reviewed ready records when its producer checkpoint is complete.
- `maintain-artifacts` is the internal read/validation/write protocol, not a user entry point.

EventStorming owns Strategic Model meaning, Aggregate Capabilities, and Required Reactions. Tactical Design owns material collaboration deltas; optional BC Architecture owns only their surviving context-specific decisions. Generic House Style, full sequences, code structure, and history are not copied there. Codify is read-only over DDD artifacts; Guard may perform only the final joint `ready -> implemented` closure after a clear verdict over the matching complete producer checkpoint.

## Activation guidance

Choose by requested outcome:

- `/ddd-expert:event-storming` when a story, scenario, Spec, PRD, or existing Model needs domain discovery, Aggregate/context boundaries, collaboration, and a confirmed Strategic Model.
- `/ddd-expert:tactical-design` when confirmed business meaning still leaves material Aggregate collaboration, transaction, state, concurrency, event, failure/recovery, or durable Interface ownership to decide.
- `/ddd-expert:codify` when ready EventStorming authority and every required Tactical Design must be implemented in the house style.
- `/ddd-expert:guard` when a concrete backend change must be reviewed before merge or release.

EventStorming finishes at `ready`: its meeting record carries the complete iteration solution and affected canonical Models carry current business meaning plus Aggregate Capabilities. Work goes directly to Codify when established seams already cover the realization; Tactical Design is inserted only for a real Design Delta. Routine implementation may remain at a verified Codify checkpoint; Guard finishes the scoped records at `implemented` only after independently clearing the final stable snapshot and consuming its complete producer checkpoint.

## EventStorming contract

The modeling path follows this order:

1. clarify the modeling scope;
2. place past-tense Workshop Events first;
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

- the exact Mermaid EventStorming view with timeline, normalized Commands outside Aggregate boxes, Root-owned capabilities and rules inside their Aggregates, actors/external systems, past-tense Workshop Events, Hotspots, Bounded Context boundaries, and every supported Aggregate boundary—or the explicit evidence-based `No supported Aggregate` conclusion at Bounded Context scope;
- proposed language, authority, lifecycle, supported Aggregates/core objects, contexts, and collaboration;
- each normalized Command's target Aggregate Capability or explicit coordination, with one stable Root operation rather than separate capabilities for scenario or pre-state branches;
- only business-required `Domain Event or Published Fact Contract -> Reaction Policy -> Command -> Aggregate Capability or coordination` mappings;
- keep the Context Map focused on semantic Model Dependency (`U -> D`) contracts while complete scenario interactions stay in the EventStorming minutes; and
- key design decisions, assumptions, and non-blocking Hotspots.

The minutes retain only a compact Command-to-Capability mapping alongside the complete scenario threads. Each affected `model.md` is the sole current authority for the full capability contracts that Codify consumes.

`Workshop Event` is this workflow's label for an analytical past-tense fact; it does not automatically become a selected Domain Event or Published Fact Contract. The connected scenario threads are the iteration's single Workshop Event inventory; EventStorming does not generate a parallel manual Event Index. During integrated review, the canonical collaboration rules select any Domain Event semantics for the affected Model, while cross-context published meaning remains in its named dependency contract.

Before confirmation, the facilitator challenges the model from participant/authority, scenario-variation, and model-pressure perspectives. It selects only cases capable of changing a material conclusion and stops when the strongest known alternative was considered and further cases have diminishing decision value. Blocking Hotspots must be resolved or removed by narrowing scope; non-blocking Hotspots remain visible.

EventStorming summarizes the draft minutes path, validation, decisions, assumptions, affected Models, and Hotspots in the console. Only explicit confirmation of those exact minutes authorizes the `ready` transition and documentation synchronization. A local “yes,” confirmation of one Aggregate, or acceptance of source facts does not confirm the whole model. A correction returns to the earliest affected step and rewrites the same draft minutes.

When Tactical Design exposes several related Model contradictions, it first consolidates them as one temporary Model Review Batch. EventStorming resolves that batch one frontier question at a time and creates at most one correction draft, rewriting the same draft until confirmation. A confirmed correction still receives one new minutes record and supersedes replaced unimplemented authority; confirmed history is never rewritten merely to reduce file count.

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
- `templates/architecture.md` defines an optional sparse current Architecture for one Bounded Context.
- `templates/tactical-design.md` defines one material Design Delta and its confirmed collaboration claims.

EventStorming writes only draft minutes and the README TODO before confirmation. After approval, it applies the ready minutes, affected Models, Context Map, and relevant project-owned documents through one transaction. Tactical Design independently drafts and confirms only a material Design Delta, applying any exact BC Architecture projection with its ready transition. If newer Model authority invalidates an unimplemented ready Tactical Design, Tactical Design replaces or retires that record and its Architecture sources before Codify. Codify reads current authority; Guard jointly closes governed ready records while leaving BC Architecture current.

## Scope

Use this plugin for domain modeling, confirmed-Model realization, and backend DDD review across Domain/Application/Interface/Infrastructure/Runtime ownership, generated protocol boundaries, Go/Python/TypeScript backends, messages/tasks/runtime behavior, and database-backed persistence when those concerns are in scope. `Interface` is the language-neutral responsibility; Go names its physical package `transport`.

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
