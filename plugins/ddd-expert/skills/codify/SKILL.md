---
name: codify
description: Use when accepted strategic and domain-object design must be realized as working backend code in the repository's project and active-language House Style.
---

# Codify

Faithfully realize the accepted Domain model as working backend code. Complete the requested behavior using the repository's project and active-language House Style.

## Contract

Read the user's current scope, affected `model.md` and `domain-objects.md`, relevant project decisions and instructions, and the implementation and tests. Read `context-map.md` when cross-context meaning is affected.

The DDD artifacts define accepted business meaning, Aggregate boundaries, and Domain-object state and behavior ownership. They are semantic constraints, not a complete software design. Their silence about remaining software structure is implementation latitude, not a missing modeling step.

That latitude does not include inventing the business relationship between an established fact and a material next intent. Before introducing or preserving a direct call, callback, hook, sink, dispatcher, or mailbox for such a continuation, verify that accepted authority or the user's current decision already establishes whether later failure invalidates the producing behavior's success and who owns the next intent. If either answer is missing, state that exact semantic gap and leave the path unchanged; a software mechanism cannot supply the decision.

When an independent local reaction is accepted, realize the recorded Domain Event as its causal handoff and initiate the next intent from event handling. Do not keep a direct producer-to-reaction invocation as a primary or parallel path; that would turn the event into an observational duplicate and restore the coupling the accepted reaction removed.

Resolve unspecified realization choices through accepted project constraints and applicable House Style, using repository code and tests as integration evidence.

DDD artifacts are read-only during Codify. Preserve their accepted semantic ownership while changing the implementation around it.

## Implement

Implement the complete requested slice across the code surfaces it actually needs. Keep the accepted Domain model authoritative and derive the affected software structure from its ownership and behavior: preserve outer structures that support them, reshape those that obscure or duplicate them, and remove obsolete parallel responsibility exposed by the change.

Load only House Style guidance for the active language and code surfaces actually touched. Apply its relevant rules to the remaining realization choices that preserve the accepted semantics.

## Verify

Run repository tests and checks proportionate to the changed behavior and risk. Inspect the final diff and verification evidence to confirm the accepted Domain model is coherently realized across the affected code, obsolete parallel responsibility is gone, and no unintended files are included.

## Completion

End with the implemented behavior, changed files, verification results, and residual risk. Completion requires the accepted Domain model to be faithfully realized, with the requested behavior, relevant House Style, and verification agreeing in the final code.

## References

- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the branches for code actually touched.
- For Python or TypeScript, load only the touched surfaces from [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when Domain ownership or a layer boundary is being realized.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, material continuation, or cross-context work, and [../../references/database.md](../../references/database.md) for actual persistence or schema work.
