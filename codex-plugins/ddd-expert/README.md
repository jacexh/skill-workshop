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

EventStorming keeps its complete ten-step discussion method. It derives candidate Bounded Contexts and Aggregate Roots from the timeline, stresses each with probe questions whose every answer maps to a modeling action, asks one question at a time, and writes only accepted current strategic knowledge.

Tactical Design works one Aggregate Root at a time. It derives essential business pressures, attacks behavior ownership and external authority with ownership probes whose every answer maps to a design action, compares credible object compositions in one pressure-by-candidate table, and records confirmed current descriptions. Its skill and templates own the detailed process and field contract.

Codify treats the accepted strategic model and current domain objects as read-only semantic constraints, then fills the required software structure through project and active-language House Style; a business-shaped gap is implemented under a stated conservative assumption, and only a genuine contradiction is raised to the user after the rest of the slice is complete. Guard independently checks whether the implementation preserves their ownership and behavior, whether Codify's stated assumptions hold, and whether changed non-Domain abstractions reduce overall complexity under House Style.

Start at the skill that owns the current request and reuse existing confirmations. Design-only and review-only requests end with their requested result. The [workflow contract](references/workflow.md) defines authorization, project-convention precedence, and proportionate verification. House Style supplies defaults for choices the project leaves open.

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
- `domain-objects.md`: confirmed current Roots and Entities grouped by Aggregate Root, with an optional context-level Domain Services section.

Only the accepted current-model files described above are workflow artifacts; workshop conversation and implementation history remain transient.

## Skill boundaries

- `$ddd-expert:event-storming`: discover or challenge strategic business boundaries.
- `$ddd-expert:tactical-design`: decide Aggregate internals and confirm one Root at a time.
- `$ddd-expert:codify`: implement accepted object slices and verify them.
- `$ddd-expert:guard`: perform a fresh, read-only review of model realization and abstraction quality.

Unspecified software design is Codify implementation latitude, resolved directly through project constraints and the active-language House Style.

Upgrade with `codex plugin marketplace upgrade skill-workshop-codex`.

Changed artifacts follow the [artifact write checks](templates/artifact-layout.md), including the Context Map validator. These check representation; accepted business meaning still requires review.

## Templates

- `templates/artifact-layout.md`
- `templates/context-map.md`
- `templates/model.md`
- `templates/domain-objects.md`

## References

Canonical references live under `references/`:

- `workflow.md` — shared scope, authorization, project conventions, and verification contract
- `event-storming-example.md` — worked board, probe turn, and integrated proposal for EventStorming
- `tactical-design-example.md` — worked pressure list, probe turn, comparison table, and confirmed description for Tactical Design
- `ddd-core.md` — language-neutral realization of accepted DDD objects and layers
- `ddd-collaboration.md` — realization of accepted APIs, Domain Events, and Integration Messages
- `database.md` — MySQL schema, SQL, migration, and persistence realization
- `ddd-golang.md` — Go/go-jimu router and adopted-stack baseline
- `ddd-golang-{scaffold,domain,application,transport,cqrs,infrastructure}.md` — Go structure and layer leaves
- `ddd-golang-persistence.md` — ordinary xorm mapping and one-Root Repository example
- `ddd-golang-transactions.md` — conditional multi-Root local transaction scope and participation
- `ddd-golang-server.md` — conditional shared ConnectRPC/Chi server lifecycle
- `ddd-golang-{events,messages,taskqueue}.md` — Go provider-neutral flow leaves
- `ddd-golang-{fsm,kafka,asynq,observability,runtime}.md` — Go conditional mechanism and Runtime leaves
- `ddd-python.md` — Python router and adopted-stack baseline
- `ddd-python-{domain,application,transport,infrastructure}.md` — Python layer leaves
- `ddd-python-{events-messages,taskqueue,fsm,runtime}.md` — Python conditional flow and Runtime leaves
- `ddd-typescript.md` — TypeScript router and adopted-stack baseline
- `ddd-typescript-{domain,application,transport,infrastructure}.md` — TypeScript layer leaves
- `ddd-typescript-{events-messages,taskqueue,fsm,runtime}.md` — TypeScript conditional flow and Runtime leaves

The workflow contract governs task execution. Realization references provide
House Style for accepted objects and mechanisms. EventStorming and Tactical
Design remain the authorities for DDD design; project facts stay in project documents.
