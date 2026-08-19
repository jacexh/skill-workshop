---
name: codify
description: Use when accepted strategic and domain-object design must be realized as working backend code in the repository's project and active-language House Style.
---

# Codify

Implement the accepted domain model as working backend code. Complete the requested behavior using the repository's project and active-language House Style.

## Contract

Read the user's current scope, affected `model.md` and `domain-objects.md`, relevant project instructions, and the implementation and tests. Read `context-map.md` when cross-context meaning is affected.

The DDD artifacts define accepted business meaning, Aggregate boundaries, and Domain-object state and behavior ownership. They are semantic constraints, not a complete software design. Their silence about remaining software structure is implementation latitude, not a missing modeling step.

Fill unspecified realization choices directly using accepted project constraints and applicable House Style, with repository code and tests as evidence for local integration. Introduce the software structure the requested behavior needs and apply House Style to that actual surface.

DDD artifacts are read-only during Codify. Preserve their accepted semantic ownership while changing the implementation around it.

## Implement

Implement the complete requested slice across the code surfaces it actually needs. Leave one coherent realization of each accepted responsibility and remove obsolete parallel responsibility exposed by the change.

Load only House Style guidance for the active language and code surfaces actually touched. Apply its relevant rules and make the remaining engineering choices directly.

## Verify

Run repository tests and checks proportionate to the changed behavior and risk. Inspect the final diff to confirm the accepted behavior is realized, obsolete parallel responsibility is gone, and no unintended files are included.

## Completion

End with the implemented behavior, changed files, verification results, and residual risk. Completion requires the requested behavior, relevant House Style, and verification to agree in the final code.

## References

- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the branches for code actually touched.
- For Python or TypeScript, load only the touched surfaces from [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when Domain ownership or a layer boundary is being realized.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for accepted event or cross-context work, and [../../references/database.md](../../references/database.md) for actual persistence or schema work.
