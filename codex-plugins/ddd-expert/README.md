# ddd-expert (Codex)

EventStorming-led DDD/backend workflow skills for Codex.

Use EventStorming as the single modeling path from backend evidence to a user-confirmed Strategic Model. This plugin is hookless.

```text
$ddd-expert:event-storming
-> confirmed business facts + current falsifiable Models
$ddd-expert:tactical-design (only for a real Design Delta)
-> domain-object thesis + draft collaboration candidate
$ddd-expert:codify (reversible exploration)
-> implementation evidence
$ddd-expert:tactical-design
-> reconciled ready design
$ddd-expert:codify (final realization)
-> verified implementation checkpoint
$ddd-expert:guard (iteration closure or merge/release)
-> implemented
```

## Installation

```bash
codex plugin marketplace add jacexh/skill-workshop
codex plugin add ddd-expert@skill-workshop-codex
```

Restart Codex after installation.

## Upgrade

```bash
codex plugin marketplace upgrade skill-workshop-codex
codex plugin add ddd-expert@skill-workshop-codex
```

Restart Codex after upgrade.

## Capabilities

- `$ddd-expert:event-storming` starts from discovery or an existing thesis, separates confirmed business facts from falsifiable structural hypotheses, and asks only questions capable of changing the model.
- `$ddd-expert:tactical-design` runs only for a real Design Delta. It establishes a domain-object UML, responsibility and state authority, semantic flow, and necessity proof before deriving the fewest critical sequences. The first persisted draft appears only after adversarial conversation.
- `$ddd-expert:codify` may reversibly explore a Tactical Design draft, records what implementation confirmed or falsified, and returns for reconciliation. Only a reconciled ready design can produce the final Guard handoff.
- `$ddd-expert:guard` reviews final code against confirmed business facts and reconciled design; an unreconciled tactical difference that preserves strategic structure routes to Tactical Design, while a strategic contradiction routes to EventStorming.
- `maintain-artifacts` is the internal read/validation/write protocol, not a user entry point.

The plugin does not auto-inject context. EventStorming owns confirmed business meaning and the current falsifiable strategic model. Tactical Design owns material collaboration candidates and their reconciliation; optional BC Architecture owns only surviving context-specific decisions. House Style supplies conditional realization rules and never selects state lifecycle, business sequencing, or domain concepts. Codify is read-only over DDD artifacts and uses code as falsification and realization evidence; Guard closes only reconciled ready records.

## Activation guidance

Choose by requested outcome:

- `$ddd-expert:event-storming` when a story, scenario, Spec, PRD, or existing Model needs domain discovery, Aggregate/context boundaries, collaboration, and a confirmed Strategic Model.
- `$ddd-expert:tactical-design` when confirmed business meaning still leaves material Aggregate collaboration, transaction, state, concurrency, event, failure/recovery, or durable Interface ownership to decide.
- `$ddd-expert:codify` when ready EventStorming authority must be implemented, or an authorized reversible exploration should test a Tactical Design draft.
- `$ddd-expert:guard` when a concrete backend change must be reviewed before merge or release.

EventStorming finishes at `ready`: its minutes preserve confirmed facts and its Models carry the current structural hypothesis. Work goes directly to Codify when established seams cover realization. A real Design Delta stays `draft` through reversible Codify exploration, is reconciled and confirmed as `ready`, and only then enters final verification and Guard.

Later implementation evidence may invalidate that tactical candidate without changing the EventStorming Model. Tactical Design discards an unconfirmed draft when the delta disappears, replaces an unimplemented ready record when a material delta remains, or retires it against the surviving ready EventStorming authority when no extra design authority remains. It never edits implemented provenance or lets stale claims continue to constrain Codify.

## EventStorming contract

Discovery considers these lenses in causal order:

1. clarify the modeling scope;
2. place past-tense Workshop Events first;
3. arrange events on the timeline;
4. find Commands;
5. add Roles and external authorities;
6. capture constraints and event-triggered Commands;
7. mark problems and ambiguities;
8. identify Aggregates and core business objects;
9. identify Bounded Contexts; and
10. establish context collaboration.

A thesis review may acknowledge already-supported lenses and move directly to the first conclusion that could be falsified. A simple change inside an accepted context does not force a new repository-wide Big Picture; depth is proportionate while the integrated confirmation boundary remains explicit.

Exploration stays on a temporary EventStorming Board, separate from any Aggregate, Bounded Context, or Context Map. Supplied authority and local answers can support board facts or working decisions, but neither authorizes a file write. After the relevant lenses and adversarial review, EventStorming validates the current candidate and writes one `draft` meeting record plus its unchecked README entry. Canonical Models remain unchanged until confirmation.

The facilitator investigates facts available in project evidence, then asks the user only for domain facts or decisions the evidence cannot supply. It presents discovered information in useful groups while putting one frontier question to the user per turn. Fact probes remain open; design proposals include a recommendation, reasons, and the strongest credible alternative. Local answers are working confirmations that later evidence may reopen.

When the scope is coherent, EventStorming shows:

- the exact low-resolution Mermaid EventStorming view with Bounded Context-local Roles, Command-labeled arrows, Root-owned Capabilities, material past-tense Workshop Events, Bounded Context boundaries, and every supported Aggregate boundary—or the explicit evidence-based `No supported Aggregate` conclusion at Bounded Context scope;
- proposed language, authority, lifecycle, supported Aggregates/core objects, contexts, and collaboration;
- each permitted source-to-target Command relationship, expressed by one arrow and target rather than duplicate nodes or a mapping table;
- only business-required `Domain Event or Published Fact Contract -- Command --> Aggregate Capability or coordination` mappings, with a selected local Domain Event kept distinct from its producer-owned cross-context contract;
- the semantic Context Map, focused on Model Dependency (`U -> D`) contracts while complete scenario interactions stay in the EventStorming minutes; and
- key design decisions, assumptions, and non-blocking Hotspots.

The connected diagram edges are the minutes' only Command-to-Capability and event-to-Command traceability. Each affected `model.md` is the sole current authority for the full capability contracts and event-triggered Commands that Codify consumes.

`Workshop Event` is this workflow's label for an analytical past-tense fact; it does not automatically become a selected Domain Event or Published Fact Contract. The connected business-success threads are the iteration's single Workshop Event inventory; EventStorming does not generate a parallel manual Event Index or Command mapping table. Generic preconditions, Policy nodes, permission failures, rejections, unchanged results, and Hotspots stay outside the main diagram; an adverse fact remains only when it changes business rights, obligations, value, or a required next action. During integrated review, the canonical collaboration rules select any Domain Event semantics for the affected Model, while cross-context published meaning remains in its named producer-owned contract.

Before confirmation, the facilitator challenges the model from participant/authority, scenario-variation, and model-pressure perspectives. It selects only cases capable of changing a material conclusion and stops when the strongest known alternative was considered and further cases have diminishing decision value. Blocking Hotspots must be resolved or removed by narrowing scope; non-blocking Hotspots remain visible.

EventStorming summarizes the draft minutes path, validation, decisions, assumptions, affected Models, and Hotspots in the console. Only explicit confirmation of those exact minutes authorizes the `ready` transition and documentation synchronization. A local “yes,” confirmation of one Aggregate, or acceptance of source facts does not confirm the whole model. A correction returns to the earliest affected step and rewrites the same draft minutes.

When Tactical Design exposes several related Model contradictions, it first consolidates them as one temporary Model Review Batch. EventStorming resolves that batch one frontier question at a time and creates at most one correction draft, rewriting the same draft until confirmation. A confirmed correction still receives one new minutes record and supersedes replaced unimplemented authority; confirmed history is never rewritten merely to reduce file count.

After confirmation, EventStorming derives the minimal documentation closure and synchronizes the `ready` minutes, affected canonical Models, Context Map, README, and relevant living Spec, PRD, ADR, and Glossary documents. Models integrate durable context-owned conclusions and link the minutes through `last_changed_by`; historical ADR handling follows repository policy.

## Boundary quality

Aggregate and Bounded Context conclusions come after events, Commands, Roles, constraints, and Hotspots are understood. Package, service, table, runtime component, team, or call direction is never enough to establish a context.

When a mechanism appears repeatedly, EventStorming applies DRY to knowledge rather than syntax and balances cohesion, information hiding, coupling, and YAGNI before comparing a shared domain mechanism, a shared technical Module, and distinct local semantics with translations. Common business language, lifecycle, rules, and ownership may establish one reusable domain capability; similar code shape alone may justify only technical reuse or deliberate local duplication.

The Context Map records semantic model dependency only. Global `U -> D` edges form a DAG and express model/published-contract influence; each named contract is documented once. Runtime call direction does not determine ownership, and cross-context scenario interactions stay in the iteration minutes.

## Artifact templates

- `templates/artifact-layout.md` defines the canonical DDD root and write boundaries.
- `templates/README.md` defines project DDD navigation.
- `templates/context-map.md` defines the global semantic-dependency projection, per-context inventory, optional Local Views, and named dependency contracts.
- `templates/event-storming.md` defines one complete iteration record and its lifecycle.
- `templates/model.md` defines one current Bounded Context Model.
- `templates/architecture.md` defines an optional sparse current Architecture for one Bounded Context.
- `templates/tactical-design.md` defines one material Design Delta, its typed Model-to-design collaboration sequences, and its confirmed claims.

EventStorming writes only draft minutes before confirmation. Tactical Design writes a draft only after its object/state thesis survives conversational challenge; Codify may test that draft reversibly, after which Tactical Design reconciles evidence and applies the ready transition plus any durable BC Architecture projection. Guard jointly closes only final reconciled records.

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
