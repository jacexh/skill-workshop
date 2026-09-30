---
name: codify
description: Use when accepted strategic and domain-object design must be realized as working backend code in the repository's project and active-language House Style.
---

# Codify

Faithfully realize the accepted Domain model as working backend code. Complete the requested behavior using the repository's project and active-language House Style.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, project conventions, and verification.

## Contract

Read the user's current scope, affected `model.md` and `domain-objects.md`, relevant project decisions and instructions, and the implementation and tests. Read `context-map.md` when cross-context meaning is affected.

The DDD artifacts define accepted business meaning, Aggregate boundaries, and Domain-object state and behavior ownership. They are semantic constraints, not a complete software design. Their silence about remaining software structure is implementation latitude, not a missing modeling step.

Resolve unspecified realization choices through accepted project constraints and applicable House Style, using repository code and tests as integration evidence.

Classify each gap the implementation exposes:

- A software-shape choice, such as naming, layering, error types, persistence, or transaction scope, that changes no business right, obligation, authority, decision, outcome, or required next action: resolve it through project constraints and House Style.
- A business-shaped gap with a conservative reading that contradicts no accepted statement and can later be reversed in one place: implement it under that stated assumption and continue. Prefer rejection over admission, the narrowest permission, and failing closed.
- A contradiction between accepted statements, or a gap where every implementation would change an accepted Business Rule, consistency boundary, Domain-owned Port, or Domain Event: complete the rest of the slice, then raise it once as a ⚠️ **Conflict** under the workflow contract's presentation markers. The code realizes only the accepted statements.

DDD artifacts are read-only during Codify. Preserve their accepted semantic ownership while changing the implementation around it.

## Implement

Implement the complete requested slice across the code surfaces it actually needs. Keep the accepted Domain model authoritative and derive the affected software structure from its ownership, behavior, and Domain-owned Ports: preserve outer structures that support them, reshape those that obscure or duplicate them, and remove obsolete parallel responsibility exposed by the change.

Use the active-language router to load the smallest complete House Style leaf set whose applicability covers every code surface actually touched. Apply those rules to the remaining realization choices that preserve the accepted semantics.

## Verify

Run repository tests and checks proportionate to the changed behavior and risk. Inspect the final diff and verification evidence to confirm the accepted Domain model is coherently realized across the affected code, obsolete parallel responsibility is gone, and no unintended files are included.

## Completion

End with the implemented behavior, changed files, verification results, stated assumptions, and residual risk. Completion requires the accepted Domain model to be faithfully realized, with the requested behavior, relevant House Style, and verification agreeing in the final code.

## References

- Start with the active-language router: [Go](../../references/ddd-golang.md), [Python](../../references/ddd-python.md), or [TypeScript](../../references/ddd-typescript.md). Follow its exact mapping for every touched code surface.
- Load [../../references/ddd-core.md](../../references/ddd-core.md) when an accepted Domain object, Domain-owned Port, or cross-language layer boundary is being realized.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for an accepted published API, Domain Event, or Integration Message, and [../../references/database.md](../../references/database.md) for actual MySQL persistence, SQL, or schema work.
