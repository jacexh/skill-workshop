---
name: codify
description: Use when house-style backend coding must implement accepted Tactical Design, make an unambiguous mechanical change, or repair a Guard finding already covered by accepted authority.
---

# Codify

Realize an accepted Tactical Design as working, verified backend code in the `ddd-expert` house style. Codify implements decisions and produces implementation evidence; Guard independently reviews the result. Codify does not invent business facts or semantic design.

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
3. **Build one multi-label realization map**: for every accepted design obligation and required production path, account for its semantic owner, execution owner when applicable, layer/package, abstraction or adapter, adopted library, runtime mechanics, and verification evidence. Labels accumulate rather than compete. For Go, a Runtime/platform label never suppresses an applicable flow label: periodic, polling, and deferred-recovery work also follows the router's taskqueue branch. Load every mapped reference branch and keep the map internal.
4. **Reconcile the implementation**: after each edit, map every actual changed file and required path back to the realization map. Add newly exposed labels, load their reference branches, and resolve any responsibility or authority conflict before continuing.
5. **Implement the house style**: preserve business decisions in the semantic owner, keep dependencies inward, use the adopted abstractions and libraries, isolate generated/storage/runtime types at adapters, and wire every production path required by the design. Cross-context contracts and imports must preserve the Context Map's acyclic `U -> D` model dependency; a request and response through one owned contract is not permission for a reverse model import. If realization appears to need a reciprocal or longer cyclic dependency, return to `explore` for graph ownership or `shape` for tactical placement instead of implementing the cycle. Do not broaden the change to unrelated legacy conformance.
6. **Verify implementation evidence**: run the smallest sufficient combination of tests, build/static checks, import inspection, migration dry run, runtime wiring evidence, or smoke checks appropriate to the realization map. Record what passed, what remains unverified, and the complete source snapshot Guard must review.

## Independent Guard handoff

Codify does not self-certify Design Realization or House-Style Conformance. After a non-mechanical `changed` implementation has local verification evidence, send the scoped request plus either immutable base/target identifiers or an immutable base plus a complete worktree snapshot to a fresh read-only Guard coordinator in a distinct agent context in the same task. A worktree snapshot must enumerate staged, unstaged, and untracked paths, fingerprint their contents, and provide replayable inspection commands. That coordinator freezes its own Review Envelope. A route to a future Guard is not a substitute for completing this independent review.

The task is complete only when Guard returns clear over the final source snapshot. A Guard violation with accepted authority returns to Codify for repair, local verification, and a fresh Guard run. An `explore` or `shape` route stops implementation at the owning phase. Resolve reported verification gaps and rerun Guard when they are locally closable; otherwise follow the owning route or block. An incomplete Guard execution blocks completion.

Only a purely mechanical change that alters no behavior, responsibility, dependency, contract, persistence, runtime, or verification obligation may skip Guard, and the completion report cites that evidence.

## Guard remediation

A Guard finding is evidence, not implementation authority. Before fixing it, compare the current worktree with the accepted model, revision-matched Tactical Design, and house style:

- if the finding is stale or already fixed, return `no_change` with evidence;
- if accepted authority already defines the correct shape, fix the implementation, verify locally, and rerun Guard in the same task;
- if the correction changes business meaning, return to `explore`;
- if it changes tactical design, return to `shape`;
- if proof is missing, gather evidence rather than guessing or editing.

## Completion

Codify implementation is ready for review only when every material handoff obligation is implemented or shown not applicable, required migrations/generated artifacts/runtime registrations are present, and local verification evidence is recorded. The task is complete only after the independent Guard run is clear or the change satisfies the narrow purely mechanical exception. `no_change` is valid only when the requested behavior already exists and the touched scope already conforms.

Codify reports upstream artifact problems only through a `returned` route with concrete evidence. Review conclusions and `violation` / `evidence_gap` verdicts belong to Guard and are not Codify output.

Finish with one of:

- `changed`: summarize code behavior and local verification plus either the clear final-snapshot Guard evidence or the explicit purely mechanical exception.
- `no_change`: cite the evidence that made editing unnecessary.
- `returned`: identify `explore` or `shape`, the exact unresolved decision, and the evidence exposing it.
- `blocked`: identify the external execution constraint, unrun verification, or incomplete Guard execution.

Keep the final response focused on changed files, verification, and residual risk.

## References

- After surface classification, load the smallest relevant sections.
- Infer the active language from the accepted choice and touched files. Use Go House Style only when the backend language remains open.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the router leaves for touched Domain, Application, Transport, CQRS, Infrastructure, events/messages, taskqueue, Runtime, scaffold, or generated-code surfaces.
- For Python or TypeScript, load only the sections for touched surfaces from the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load the relevant section of [../../references/ddd-core.md](../../references/ddd-core.md) when tactical ownership must be checked.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, message, or cross-context work.
- Load [../../references/database.md](../../references/database.md) for schema, migration, index, SQL, or persistence work.
