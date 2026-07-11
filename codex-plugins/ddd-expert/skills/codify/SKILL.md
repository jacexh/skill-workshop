---
name: codify
description: Use when house-style backend coding must implement accepted Tactical Design, make an unambiguous mechanical change, or repair a Guard finding already covered by accepted authority.
---

# Codify

Realize an accepted Tactical Design as working, verified backend code in the `ddd-expert` house style. Codify implements decisions; it does not invent business facts or semantic design.

## Authority

Every DDD artifact is read-only in Codify. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute only its `inspect` operation in the same run with authority `codify`; never request or perform an apply operation. Report artifact evidence and route it to its owning phase without persisting implementation status or feedback under `docs/ddd-expert`.

Use this order when inputs disagree:

1. Each affected context's Explore-owned model artifact owns its business meaning and view of its relationships.
2. Each affected context's Shape-owned design artifact owns its tactical choices and collaboration responsibilities.
3. The `ddd-expert` references own implementation defaults and house-style shape.
4. The request or ticket owns the current change scope.
5. Existing code, tests, and local conventions are compatibility evidence.

An explicit accepted design choice controls its exact scope. Vague waiver language, current transaction shape, package names, or local convention do not override higher authority.

DDD artifacts may be absent for a purely mechanical change whose behavior, semantic owner, and layer are already unambiguous. Do not create DDD documents from Codify. If implementation requires a material business or tactical choice, return upstream before editing.

## Workflow

1. **Preflight before edits**: run artifact inspection, then read the scoped request, accepted authority, touched code, generated artifacts, migrations, runtime entrypoints, and verification surface. Resolve every material authority conflict before changing files.
2. **Check readiness**: treat `uninitialized`, `missing_model`, and `missing_design` as structural observations, not automatic blockers. Proceed without artifacts only for a purely mechanical change whose behavior, semantic owner, and layer are unambiguous. Route missing material business authority or Explore-owned layout to `explore`; route missing material Tactical Design, `stale_design`, `pending_design_reconciliation`, or Shape-owned layout to `shape`. Also return for unresolved Aggregate, semantic-owner, consistency, collaboration, Repository/CQRS, port, layer, runtime-containment, or verification-intent decisions. Routine scaffold, package placement, adopted library, adapter, database, message, and runtime mechanics belong to Codify.
3. **Map obligations internally**: account for every accepted design obligation across its semantic owner, layer/package, abstraction or adapter, adopted library, MySQL/message/runtime mechanics, and verification evidence. Do not print this ledger by default.
4. **Classify touched surfaces**: identify Domain, Application, Infrastructure, Interface, Runtime, database, generated protocol, events/messages, taskqueue, and verification surfaces. Then load only the corresponding reference sections.
5. **Implement the house style**: preserve business decisions in the semantic owner, keep dependencies inward, use the adopted abstractions and libraries, isolate generated/storage/runtime types at adapters, and wire every production path required by the design. Do not broaden the change to unrelated legacy conformance.
6. **Verify both gates**: prove Design Realization and House-Style Conformance with the smallest sufficient combination of tests, build/static checks, import inspection, migration dry run, runtime wiring evidence, or smoke checks appropriate to the touched surfaces.

## Guard remediation

A Guard finding is evidence, not implementation authority. Before fixing it, compare the current worktree with the accepted model, revision-matched Tactical Design, and house style:

- if the finding is stale or already fixed, return `no_change` with evidence;
- if accepted authority already defines the correct shape, fix the implementation and finish `changed` with route `guard`;
- if the correction changes business meaning, return to `explore`;
- if it changes tactical design, return to `shape`;
- if proof is missing, gather evidence rather than guessing or editing.

## Completion

Codify is complete only when every material handoff obligation is implemented or shown not applicable, touched code conforms to the house style or an explicit accepted design choice, required migrations/generated artifacts/runtime registrations are present, and verification evidence is recorded. `no_change` is valid only when the requested behavior already exists and the touched scope already conforms.

Codify reports upstream artifact problems only through a `returned` route with concrete evidence. Review conclusions and `violation` / `evidence_gap` verdicts belong to Guard and are not Codify output.

Finish with one of:

- `changed`: summarize code behavior and verification; set route `guard` after Guard remediation.
- `no_change`: cite the evidence that made editing unnecessary.
- `returned`: identify `explore` or `shape`, the exact unresolved decision, and the evidence exposing it.
- `blocked`: identify only the external execution constraint and the unrun verification.

Keep the final response focused on changed files, verification, and residual risk.

## References

- After surface classification, load the smallest relevant sections.
- Infer the active language from the accepted choice and touched files. Use Go House Style only when the backend language remains open.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the router leaves for touched Domain, Application, Transport, CQRS, Infrastructure, events/messages, taskqueue, Runtime, scaffold, or generated-code surfaces.
- For Python or TypeScript, load only the sections for touched surfaces from the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load the relevant section of [../../references/ddd-core.md](../../references/ddd-core.md) when tactical ownership must be checked.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, message, or cross-context work.
- Load [../../references/database.md](../../references/database.md) for schema, migration, index, SQL, or persistence work.
