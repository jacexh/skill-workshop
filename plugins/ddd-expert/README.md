# ddd-expert

A sparse DDD/backend workflow for Claude Code.

## Install

```text
/plugin install ddd-expert@skill-workshop
```

```text
/ddd-expert:event-storming
EventStorming -> current strategic model
/ddd-expert:tactical-design
Tactical Design -> current domain objects
/ddd-expert:codify
-> verified implementation checkpoint
/ddd-expert:guard
-> independent model and abstraction review
```

## Workflow

EventStorming keeps its complete ten-step discussion method. It identifies Bounded Contexts and Aggregate Roots, asks one question at a time, and writes only accepted current strategic knowledge.

Tactical Design uses the same relentless interview style. It works one Aggregate Root at a time, derives essential business pressures from confirmed Business Rules, probes behavior ownership, and applies the Capability Probe to external-authority needs. The Capability Probe selects a Supplied Fact that preserves ownership and timing, or a Domain-owned Port when the Behavior owns invocation. Each Port groups sparse Methods that name their invoking Behavior, business decision point, and Domain result. Every candidate Entity proposal explains what the object is and how it operates, then introduces its Behaviors in Domain language at that first proposal rather than renaming technical placeholders during artifact writing. Simple operation stays concise, while an essential operating characteristic may become part of Definition. It records coherent Entity descriptions, including Domain-owned Ports where present, in `domain-objects.md` as the Root develops, then confirms the integrated Root and updates accepted changes across affected current DDD artifacts and project decisions.

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
- `domain-objects.md`: confirmed current Root and Entity descriptions, grouped by Aggregate Root.

Only the accepted current-model files described above are workflow artifacts; workshop conversation and implementation history remain transient.

## Skill boundaries

- `/ddd-expert:event-storming`: discover or challenge strategic business boundaries.
- `/ddd-expert:tactical-design`: decide Aggregate internals and confirm one Root at a time.
- `/ddd-expert:codify`: implement accepted object slices and verify them.
- `/ddd-expert:guard`: perform a fresh, read-only review of model realization and abstraction quality.

Unspecified software design is Codify implementation latitude, resolved directly through project constraints and the active-language House Style.

## Templates

- `templates/artifact-layout.md`
- `templates/context-map.md`
- `templates/model.md`
- `templates/domain-objects.md`

## References

Canonical references live under `references/`:

- `ddd-core.md` — language-neutral realization of accepted DDD objects and layers
- `ddd-collaboration.md` — realization of accepted APIs, Domain Events, and Integration Messages
- `database.md` — MySQL schema, SQL, migration, and persistence realization
- `ddd-golang.md` — Go/go-jimu router and adopted-stack baseline
- `ddd-golang-{scaffold,domain,application,transport,cqrs,infrastructure}.md` — Go structure and layer leaves
- `ddd-golang-{events,messages,taskqueue}.md` — Go provider-neutral flow leaves
- `ddd-golang-{fsm,kafka,asynq,observability,runtime}.md` — Go conditional mechanism and Runtime leaves
- `ddd-python.md` — Python router and adopted-stack baseline
- `ddd-python-{domain,application,transport,infrastructure}.md` — Python layer leaves
- `ddd-python-{events-messages,taskqueue,fsm,runtime}.md` — Python conditional flow and Runtime leaves
- `ddd-typescript.md` — TypeScript router and adopted-stack baseline
- `ddd-typescript-{domain,application,transport,infrastructure}.md` — TypeScript layer leaves
- `ddd-typescript-{events-messages,taskqueue,fsm,runtime}.md` — TypeScript conditional flow and Runtime leaves

References are House Style only: they show how an already accepted object or
mechanism is written. EventStorming and Tactical Design remain the authorities
for DDD design. Project-specific facts remain in project documents.
