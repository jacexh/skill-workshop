---
name: guard
description: Use when concrete backend changes need an independent, read-only review of faithful domain-model realization and the quality of House Style software abstractions.
---

# Guard

Guard independently asks: does this complete backend change faithfully realize the accepted business model, and use House Style abstractions that reduce overall software complexity?

Read the [workflow contract](../../references/workflow.md) for scope, instruction conflicts, and review-only use of realization guidance.

Run Guard in one fresh, read-only agent context distinct from the implementer. Review only: do not edit source, DDD artifacts, tests, or project state. This is a semantic-structure review, not a general bug hunt, verification campaign, or operational probe.

If already in that independent context, review here. Otherwise delegate once through the host's isolated-agent mechanism: the delegation names this skill file to read first, the user's scope, the affected artifact paths, the diff base, and the assumptions, introduced Domain concepts, and added architecture components Codify stated, and carries no conclusions. If an independent context is unavailable, report that limitation; provide an in-context review only when the user accepts its reduced independence.

## Evidence

Read the user's scope, affected `model.md` and `domain-objects.md`, the affected `architecture.html` when it exists, `docs/ddd-expert/context-map.md` when Context ownership or collaboration changes, the complete stable diff and relevant production code, the assumptions, introduced Domain concepts, and added architecture components Codify stated at completion, governing project decisions, and the smallest complete House Style leaf set whose applicability covers the affected code surfaces.

The Markdown DDD artifacts own accepted business meaning and Domain ownership. `architecture.html`, when it exists, owns the core design of the outer structure. Software structure that neither records is implementation latitude judged through project constraints and House Style, not missing authority. Code and tests are implementation evidence, not authority that silently changes the model.

## Review

Trace each affected accepted responsibility through the minimum production code needed to judge it. Compare semantic responsibility and state carriers; a matching name alone does not prove realization. A changed file is not automatically another review obligation. Use question-led depth: state the concrete structural question before expanding into adapter or runtime code, read the minimum evidence, and stop when it is answered.

Judge whether accepted business state, behavior, invariants, actual Domain Events, Policies, and Domain-owned Port contracts remain with their recorded owners, whether Port fulfillment stays behind Infrastructure adapters, and whether outer coordination, persistence, transport, or runtime code preserves rather than duplicates those decisions. Treat technical fulfillment policy or provider failure handling that shapes Domain code as evidence of a missing or violated Domain-owned Port boundary. A technical mechanism that changes a contract or the Application coordination order, instead of sitting behind its seam, is a finding.

When `architecture.html` exists, code that removes, moves, or rewires a drawn component, dependency, or mechanism seam of its core design ([Architecture writing](../../templates/artifact-layout.md#architecture-writing)) is a finding. Judge a component Codify added beyond the drawing by House Style; an added component missing from Codify's report is a finding. For each affected Policy, check that the realized delivery keeps its stated failure outcome when the process stops or the reacting dependency fails. Check each stated assumption: it contradicts no accepted statement and can be reversed in one place; otherwise it is a finding.

Each affected accepted Aggregate Root, Entity, Value Object, Lifecycle State, Behavior, Domain-owned Port, and Domain Event keeps its Ubiquitous Language name and meaning in exactly one Domain carrier, and Domain code uses the Essential Language term for each concept it names; a synonym, renamed Lifecycle State, or parallel carrier is a finding. A Domain concept Codify introduced is a finding only when it duplicates or redefines accepted meaning, or adds business meaning not stated as an assumption.

Also review each non-Domain abstraction introduced, materially changed, or required by the affected behavior. Ask what present complexity it hides; whether deleting it would redistribute that complexity or simply remove it; whether a small stable interface creates leverage and locality; and whether its indirection, mapping, configuration, lifecycle, and test cost are justified. Pattern names such as CQRS, Repository, or Task Queue neither require nor justify an abstraction. For a component drawn in `architecture.html`, review its inner shape; the confirmed drawing settles its existence. Judge its placement and shape by project constraints and applicable House Style, without inventorying absent patterns.

## Findings

Report only concrete model-realization or abstraction-quality findings, ordered by impact. Each finding cites its governing model, project decision, or House Rule; the production file and line evidence; the consequence and root cause; and a correction direction. When a material fact is unavailable, state the exact uncertainty and the judgment it prevents.

Say `No DDD structural findings` only after every Behavior, Lifecycle State transition, Domain-owned Port Method, and Domain Event of the affected objects in `domain-objects.md`, and each affected Business Rule and Policy, has been located in production code or reported as missing, each located object, Lifecycle State, Behavior, Port Method, and Domain Event carries its accepted name, each drawn component, dependency, and mechanism seam the change touches has been located in production code or reported as missing, and no finding resulted. This does not claim general code correctness.

## References

- Use [../../references/ddd-core.md](../../references/ddd-core.md) for affected Domain-object realization, Domain-owned Ports, cross-language layer boundaries, or technical mechanisms.
- Start with the active-language router: [Go](../../references/ddd-golang.md), [Python](../../references/ddd-python.md), or [TypeScript](../../references/ddd-typescript.md). Follow its exact mapping for the affected code surfaces.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for affected published APIs, Domain Events, or Integration Messages, and [../../references/database.md](../../references/database.md) for affected MySQL persistence, SQL, or schema.
