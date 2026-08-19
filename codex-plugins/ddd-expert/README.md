# ddd-expert

A sparse DDD/backend workflow for Codex.

## Install

```bash
codex plugin add ddd-expert@skill-workshop-codex
```

```text
$ddd-expert:event-storming
EventStorming -> current strategic model
$ddd-expert:tactical-design
Tactical Design -> current domain objects
$ddd-expert:codify
-> verified implementation checkpoint
$ddd-expert:guard
-> independent model and abstraction review
```

## Workflow

EventStorming keeps its complete ten-step discussion method. It identifies Bounded Contexts and Aggregate Roots, asks one question at a time, and writes only accepted current strategic knowledge.

Tactical Design uses the same relentless interview style. It works one Aggregate Root at a time, derives essential business pressures from confirmed Business Rules, uses behavior statements to expose candidate owners and concepts, and compares object compositions by pressure coverage and introduced design burden. As soon as the user confirms one Root, it writes that Root's slice to `domain-objects.md`.

Codify treats the accepted strategic model and current domain objects as read-only semantic constraints, then fills the required software structure through project and active-language House Style. Guard independently checks whether the implementation preserves their ownership and behavior, and whether changed non-Domain abstractions reduce overall complexity under House Style.

House Style owns realization choices left open by the model and applies only to code the requested behavior needs. It does not extend accepted business meaning into a software-structure checklist.

## Artifacts

```text
docs/ddd-expert/
|-- context-map.md
`-- context/<context-slug>/
    |-- model.md
    `-- domain-objects.md
```

- `context-map.md`: Bounded Contexts and semantic dependencies.
- `model.md`: context purpose, essential language, Aggregate Roots, and strategic business rules.
- `domain-objects.md`: confirmed Root slices containing object definition, Facts, Lifecycle State, behavior, and actual Domain Events.

Only the accepted current-model files described above are workflow artifacts; workshop conversation and implementation history remain transient.

## Skill boundaries

- `$ddd-expert:event-storming`: discover or challenge strategic business boundaries.
- `$ddd-expert:tactical-design`: decide Aggregate internals and confirm one Root at a time.
- `$ddd-expert:codify`: implement accepted object slices and verify them.
- `$ddd-expert:guard`: perform a fresh, read-only review of model realization and abstraction quality.

Unspecified software design is Codify implementation latitude, resolved directly through project constraints and the active-language House Style.

Upgrade with `codex plugin marketplace upgrade skill-workshop-codex`.

## Templates

- `templates/artifact-layout.md`
- `templates/context-map.md`
- `templates/model.md`
- `templates/domain-objects.md`

## References

Canonical references live under `references/`:

- `ddd-modeling.md` — EventStorming, language, Aggregate, Bounded Context, and Context Map reasoning
- `ddd-core.md` — language-neutral tactical DDD and Clean Architecture
- `ddd-collaboration.md` — published APIs, actual Domain Events, messages, and conditional reliable delivery
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

Project-specific facts remain in project documents. Generic references never encode one repository's expected model.
