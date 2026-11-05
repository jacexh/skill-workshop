---
name: architecture-design
description: Use when a Bounded Context needs its software architecture designed, reviewed, or recorded as components by layer, dependencies, and technical mechanisms on seams, including components that Codify reported.
---

# Architecture Design

Draw one Bounded Context's software architecture as a reviewed wireframe: its components by layer, their dependencies, and each technical mechanism on its seam. This is a design review, not an interview. The facilitator derives the complete design from accepted artifacts and House Style. The user challenges it, and the facilitator revises it until the user confirms. The confirmed drawing is core design that Codify follows.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts. Read [Architecture writing](../../templates/artifact-layout.md#architecture-writing) for the drawing's content, kinds, dependency directions, and core design.

```text
accepted model, domain objects, and delivery constraints
-> complete derived design
-> missing facts, one per turn
-> self-check
-> design review until confirmed
-> architecture.html
```

## Entry

Work on one Bounded Context at a time. Read:

- `context-map.md`;
- the context's `model.md`, and its `domain-objects.md` when it exists;
- any existing `architecture.html`;
- confirmed delivery constraints and relevant project decisions;
- the context's existing code.

For House Style, read [ddd-core.md](../../references/ddd-core.md) and the active-language router: [Go](../../references/ddd-golang.md), [Python](../../references/ddd-python.md), or [TypeScript](../../references/ddd-typescript.md).

For **recording**, the components and dependencies come from a Codify completion report or an already confirmed design. Show the additions on the rendered drawing, obtain confirmation under the workflow contract unless it already covers them, and proceed to [Write](#write). An existing drawing changes only where the report or confirmation reaches.

## Derive the complete design

Derive every component from its source:

| Component | Source |
|---|---|
| `aggregate-root`, `domain-service`, `domain-port`, `domain-event` | `domain-objects.md`; without it, the Aggregate Roots in `model.md` and the existing code |
| `repository` and its `adapter` | one per Aggregate Root (ddd-core Repository) |
| `inbound-adapter` | each subscriber of a consumed Integration Message and each task processor; synchronous request and response APIs are part of the `application` entry |
| `application` | one entry per Bounded Context (ddd-core Application and Transport Shape) |
| `event-handler` | each Policy in `model.md` that reacts to a same-context Domain Event, and each translation of a Domain Event into a Published Fact Contract ([ddd-collaboration.md](../../references/ddd-collaboration.md)) |
| `integration-message` | each Integration Message in `context-map.md` this context consumes or sends, with its contract type and counterpart ([ddd-collaboration.md](../../references/ddd-collaboration.md)): the `inbound-adapter` that consumes it, or the `adapter` of the `application-port` that sends it |
| `task`, with one task enqueue `application-port` and its `adapter` per context | each deferred, polling, or periodic Internal Task Contract, per the active-language task queue leaf |
| `query-repository` and its `adapter` | lists, pages, histories, reports, and projections that a delivery constraint or existing code needs |
| `application-port` and its `adapter` | one publisher for every Published Fact Contract this context sends, one per Asynchronous Intent sender role (its adapter is the ACL), and each other Application Port |
| mechanism | each delivery constraint on volume, latency, or availability, on its seam per ddd-core Technical Mechanisms; each Policy failure outcome that needs durable delivery, per ddd-collaboration.md |

A Policy that a Published Fact Contract triggers enters through its subscriber, and one that business time triggers enters through the processor of a periodic `task`. An entry mechanism sits on the `application` entry for synchronous APIs or on its `inbound-adapter`; every other mechanism sits on an `adapter`.

Draw each dependency in a direction that Architecture writing allows.

Some facts are missing from the repository and have no House Style or code default. When such a fact would change a component, dependency, or mechanism, ask the user before presenting. Ask one question per turn. Decide design choices yourself and show them in the review. When a fact has a default you are not sure of, use the default and list it as an assumption.

## Self-check

Present the design only when all of these hold:

- every component traces to an accepted artifact, a House Style rule, a delivery constraint, or existing code;
- every delivery constraint on volume, latency, or availability has a mechanism on a seam, or is listed as needing none;
- every same-context Policy has an `event-handler` that depends on its Domain Event, and every other Policy has an `inbound-adapter`;
- every Integration Message in `context-map.md` that this context consumes or sends is drawn with its counterpart;
- the [Architecture validator](../../scripts/validate-architecture.mjs) passes on the draft.

## Design review

Render the draft from the [architecture template](../../templates/architecture.html) to a temporary file outside the repository, and give the user its path. When the user cannot open local files, serve the draft over HTTP and give its URL. Beside it, list:

- each component, dependency, or mechanism that is not derived directly from an accepted artifact, with its reason;
- each assumption.

Treat each user question or challenge as review input. Answer it from the sources above, revise the draft when the challenge holds, and render again. Review ends when the user confirms the design.

## Write

Before writing, read the [artifact layout and write checks](../../templates/artifact-layout.md). Write `docs/ddd-expert/context/<context-slug>/architecture.html` from the template, and change only its JSON data block. Run the Architecture validator. If it fails, correct the representation and run it again.

## Completion

Report the written file, the validator result, the stated assumptions, and any decision that remains open. Continue to Codify when implementation is in scope. A design-only request ends with the confirmed drawing.
