---
name: guard
description: Use when concrete backend changes need an independent, read-only review of faithful domain-model realization and the quality of House Style software abstractions.
---

# Guard

Guard independently asks: does this complete backend change faithfully realize the accepted business model, and use House Style abstractions that reduce overall software complexity?

Run Guard in one fresh, read-only agent context distinct from the implementer. Review only: do not edit source, DDD artifacts, tests, or project state. This is a semantic-structure review, not a general bug hunt, verification campaign, or operational probe.

## Evidence

Read the user's scope, affected `model.md` and `domain-objects.md`, `docs/ddd-expert/context-map.md` when Context ownership or collaboration changes, the complete stable diff and relevant production code, governing project decisions, and the smallest applicable House Style sections.

DDD artifacts own accepted business meaning and Domain ownership; they are not a complete software design. Their silence about remaining software structure is implementation latitude judged through project constraints and House Style, not missing authority. Code and tests are implementation evidence, not authority that silently changes the model.

## Review

Trace each affected accepted responsibility through the minimum production code needed to judge it. Compare semantic responsibility and state carriers, not names. A changed file is not automatically another review obligation. Use question-led depth: state the concrete structural question before expanding into adapter or runtime code, read the minimum evidence, and stop when it is answered.

Judge whether accepted business state, behavior, invariants, and actual Domain Events remain with their recorded owners, and whether outer coordination, persistence, transport, or runtime code preserves rather than duplicates those decisions.

Also review each non-Domain abstraction introduced, materially changed, or required by the affected behavior. Ask what present complexity it hides; whether deleting it would redistribute that complexity or simply remove it; whether a small stable interface creates leverage and locality; and whether its indirection, mapping, configuration, lifecycle, and test cost are justified. Pattern names such as CQRS, Repository, or Job neither require nor justify an abstraction. Judge its placement and shape by project constraints and applicable House Style, without inventorying absent patterns.

## Findings

Report only concrete model-realization or abstraction-quality findings, ordered by impact. Each finding cites its governing model, project decision, or House Rule; the production file and line evidence; the consequence and root cause; and a correction direction. When a material fact is unavailable, state the exact uncertainty and the judgment it prevents.

Say `No DDD structural findings` when there are no such findings. This does not claim general code correctness.

## References

- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) only when strategic or object-boundary interpretation is needed.
- Start with relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md), then load only House Style for code surfaces actually touched.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md). For Python or TypeScript, load only relevant sections of [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) or [../../references/database.md](../../references/database.md) only when the affected behavior crosses those seams.
