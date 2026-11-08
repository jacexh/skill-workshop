---
name: codify
description: Use when accepted strategic and domain-object design must be realized as working backend code in the repository's project and active-language House Style.
---

# Codify

Faithfully realize the accepted Domain model as working backend code. Complete the requested behavior using the repository's project and active-language House Style.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, project conventions, and verification.

## Contract

Read the user's current scope, any delivery constraints confirmed by the EventStorming assumption sweep, open decisions handed on by earlier steps, affected `model.md` and `domain-objects.md`, the affected `architecture.md` when it exists, relevant project decisions and instructions, and the implementation and tests. Read `context-map.md` when cross-context meaning is affected.

`context-map.md`, `model.md`, and `domain-objects.md` define accepted business meaning, Aggregate boundaries, Policies, and Domain-object state and behavior ownership; they are semantic constraints. `architecture.md`, when it exists, is the context's **closed contract catalog**: its Query Repositories, Application Ports, Inbound Sources, tasks, and mechanisms. Software structure that none of them records is implementation latitude, not a missing modeling step.

Resolve unspecified realization choices through accepted project constraints and applicable House Style, using repository code and tests as integration evidence.

Classify each gap the implementation exposes:

- A software-shape choice, such as naming, layering, error types, persistence, transaction scope, or a technical mechanism for a delivery constraint that no listed mechanism serves, that changes no business right, obligation, authority, decision, outcome, or required next action: resolve it through project constraints and House Style.
- A business-shaped gap with a conservative reading that contradicts no accepted statement and can later be reversed in one place: implement it under that stated assumption and continue. Prefer rejection over admission, the narrowest permission, and failing closed.
- A contradiction between accepted statements, or a gap where every implementation would change an accepted Business Rule, Policy, consistency boundary, Domain-owned Port, or Domain Event: complete the rest of the slice, then raise it once as a ⚠️ **Conflict** under the workflow contract's presentation markers. The code realizes only the accepted statements. The user resolves the Conflict as a [correction](../../references/workflow.md#progressive-refinement) through the step that owns the contradicted artifact: EventStorming for `context-map.md` or `model.md`, Tactical Design for `domain-objects.md`, Architecture Design for `architecture.md`. Codify then resumes from the corrected artifact.

DDD artifacts are read-only during Codify. Preserve their accepted semantic ownership while changing the implementation around it.

When `architecture.md` exists, read [Architecture writing](../../templates/artifact-layout.md#architecture-writing) and realize each listed row and mechanism on its seam. Map every read and outbound call onto a listed row, and name each method after the modeled facts it returns. A need that falls **outside the catalog** is a ⚠️ **Conflict** under the gap classification above: leave that part unimplemented, with every listed row exactly as the catalog states it, until Architecture Design answers. The Conflict states the missing read need or external dependency, the listed row it was checked against and why that row does not cover it, and the proposed row with its Reason from an accepted source, or the unmodeled fact and the step that owns it. Add a mechanism only for a delivery constraint that no listed mechanism serves, and report it at completion.

The accepted Ubiquitous Language names the Domain code: each accepted Aggregate Root, Entity, Value Object, Lifecycle State, Behavior, Domain-owned Port, and Domain Event keeps its accepted name and meaning in exactly one Domain carrier, and Domain code uses the Essential Language term for each concept it names. A supporting Value Object or Entity that only realizes accepted meaning, such as `Money`, is implementation latitude; a concept that adds business meaning follows the gap classification above.

## Implement

Implement the complete requested slice across the code surfaces it actually needs. Keep the accepted Domain model authoritative and the contract catalog closed. Derive the remaining affected software structure from the model's ownership, behavior, and Domain-owned Ports: preserve outer structures that support them, reshape those that obscure or duplicate them, and remove obsolete parallel responsibility exposed by the change.

Realize each affected Policy from its trigger to its reaction and its stated failure outcome. When `architecture.md` lists a mechanism or task for the Policy, realize it. Otherwise the outcome selects the delivery mechanism: an in-process handler loses a reaction when the process stops, so an outcome that must survive a stop or a failed dependency needs a durable House Style mechanism.

Use the active-language router to load the smallest complete House Style leaf set whose applicability covers every code surface actually touched. Apply those rules to the remaining realization choices that preserve the accepted semantics.

## Verify

Run repository tests and checks proportionate to the changed behavior and risk. Inspect the final diff and verification evidence to confirm the accepted Domain model is coherently realized across the affected code, obsolete parallel responsibility is gone, and no unintended files are included.

## Completion

End with the implemented behavior, changed files, verification results, stated assumptions, including each open decision realized under its default, Domain concepts introduced beyond the accepted artifacts, mechanisms added beyond `architecture.md`, and residual risk. Completion requires the accepted Domain model and any contract catalog to be faithfully realized, with the requested behavior, every delivery constraint, relevant House Style, and verification agreeing in the final code.

## References

- Start with the active-language router: [Go](../../references/ddd-golang.md), [Python](../../references/ddd-python.md), or [TypeScript](../../references/ddd-typescript.md). Follow its exact mapping for every touched code surface.
- Load [../../references/ddd-core.md](../../references/ddd-core.md) when an accepted Domain object, Domain-owned Port, cross-language layer boundary, or technical mechanism is being realized.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for an accepted published API, Domain Event, or Integration Message, and [../../references/database.md](../../references/database.md) for actual MySQL persistence, SQL, or schema work.
