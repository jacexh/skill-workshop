---
name: codify
description: Use when house-style backend coding must realize a confirmed EventStorming Model, make an unambiguous mechanical change, or repair a Guard finding already covered by accepted authority.
---

# Codify

Realize a confirmed EventStorming Model as working, verified backend code in the `ddd-expert` house style. Codify preserves accepted business meaning, makes the engineering decisions needed to implement it, and produces implementation evidence for an independent Guard review.

## Authority

Every DDD artifact is read-only in Codify. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute only its `inspect` operation in the same run with authority `codify`; never request or perform an apply operation. For an EventStorming iteration, require one or more scoped EventStorming minutes with `status: ready` plus their affected canonical Models. Route only missing or contradictory business meaning, authority, Aggregate, Bounded Context, or Context Map decisions to `event-storming`.

Use this order when inputs disagree:

1. Affected canonical Models own current business meaning; a `legacy_model_ready` remains accepted current authority until a later iteration migrates it.
2. Scoped `ready` EventStorming minutes own this iteration's complete solution and implementation scope without overriding the Models.
3. Relevant accepted PRDs, Specs, ADRs, Glossaries, and project documentation own their recorded product and architectural constraints.
4. The `ddd-expert` references own implementation defaults and house-style shape.
5. Existing code, tests, generated artifacts, adopted libraries, and local conventions are compatibility and realization evidence.

An explicit accepted constraint controls its exact scope. Vague waiver language, current transaction shape, package names, or local convention do not override higher authority.

DDD artifacts may be absent for a purely mechanical change whose behavior, semantic owner, and layer are already unambiguous. Do not create DDD documents from Codify. If implementation requires a material business choice or would change the confirmed Model, return to `event-storming` before editing. Repository/CQRS shape, ports, layers, package placement, persistence, adapters, runtime wiring, migrations, and verification strategy are Codify decisions. Derive them from the authority order, house style, and repository evidence instead of introducing another readiness gate.

Codify may make those engineering decisions when they stay within accepted project constraints and do not create a new irreversible or external commitment. Do not autonomously choose destructive data/schema change, retention or deletion policy, security/compliance posture, incompatible deployment or public-contract migration, or first adoption of an external platform, paid service, or uncovered technology. When the request and accepted project documents do not authorize such a commitment, stop and name the exact project-authority or ADR decision required. This is not a standalone design phase and routes to EventStorming only when the missing decision changes business meaning.

## Workflow

1. **Preflight before edits**: run artifact inspection, then read the scoped request, every scoped EventStorming minutes file, affected canonical Models, relevant accepted project documents, touched code, generated artifacts, migrations, runtime entrypoints, and verification surface. Resolve every material authority conflict before changing files.
2. **Check readiness**: each scoped EventStorming file is `ready`, every linked Model is canonical or `legacy_model_ready`, and the README item is unchecked. Route `draft` minutes, missing Models, contradictory business authority, or semantic Context Map repair to `event-storming`; treat `implemented` minutes as closed history rather than a current handoff. Proceed without minutes and Models only for a purely mechanical change whose behavior, semantic owner, and layer are already unambiguous. Derive reversible Repository/CQRS shape, ports, layers, Process Managers, package placement, adopted libraries, adapters, database/message mechanics, and runtime containment from accepted constraints, house style, and repository evidence.
3. **Build one multi-label realization map**: for every confirmed Model or request obligation and required production path, account for its semantic owner, execution owner when applicable, layer/package, abstraction or adapter, adopted library, runtime mechanics, and verification evidence. Labels accumulate rather than compete. For Go, a Runtime/platform label never suppresses an applicable flow label: periodic, polling, and deferred-recovery work also follows the router's taskqueue branch. Load every mapped reference branch and keep the map internal.
4. **Reconcile the implementation**: after each edit, map every actual changed file and required path back to the realization map. Add newly exposed labels, load their reference branches, and resolve any responsibility or authority conflict before continuing.
5. **Implement the house style**: preserve business decisions in the semantic owner, keep dependencies inward, use the adopted abstractions and libraries, isolate generated/storage/runtime types at adapters, and wire every production path required by the Model and request. Cross-context contracts and imports must preserve the Context Map's acyclic `U -> D` Model Dependency View; runtime request/response direction is not permission for a reverse model import. If realization appears to need a reciprocal or longer cyclic model dependency, return to `event-storming` for semantic ownership analysis. When semantic direction is clear, choose the placement from project constraints, references, and repository evidence. Do not broaden the change to unrelated legacy conformance.
6. **Verify implementation evidence**: run the smallest sufficient combination of tests, build/static checks, import inspection, migration dry run, runtime wiring evidence, or smoke checks appropriate to the realization map. Record what passed, what remains unverified, and the complete source snapshot Guard must review.

## Independent Guard handoff

Codify does not self-certify Model Realization or House-Style Conformance. After a non-mechanical `changed` implementation has local verification evidence, send the scoped request plus either immutable base/target identifiers or an immutable base plus a complete worktree snapshot to a fresh read-only Guard coordinator in a distinct agent context in the same task. A worktree snapshot must enumerate staged, unstaged, and untracked paths, fingerprint their contents, and provide replayable inspection commands. That coordinator freezes its own Review Envelope. A route to a future Guard is not a substitute for completing this independent review.

The task is complete only when Guard returns clear over the final source snapshot and transitions every reviewed `ready` minutes file to `implemented`. A Guard violation with accepted authority returns to Codify for repair, local verification, and a fresh Guard run. An `event-storming` route stops implementation only for an exact Model or business-authority gap. Resolve reported verification gaps and rerun Guard when they are locally closable; otherwise follow the owning route or block. An incomplete Guard execution or failed iteration closure blocks completion.

Only a purely mechanical change that alters no behavior, responsibility, dependency, contract, persistence, runtime, or verification obligation may skip Guard, and the completion report cites that evidence.

## Guard remediation

A Guard finding is evidence, not implementation authority. Before fixing it, compare the current worktree with the confirmed Model, accepted project constraints, and house style:

- if the finding is stale or already fixed, return `no_change` with evidence;
- if accepted authority already defines the correct shape, fix the implementation, verify locally, and rerun Guard in the same task;
- if the correction changes business meaning, return to `event-storming`;
- if the correction changes only engineering realization, Codify chooses and applies the house-style correction;
- if proof is missing, gather evidence rather than guessing or editing.

## Completion

Codify implementation is ready for review only when every material handoff obligation is implemented or shown not applicable, required migrations/generated artifacts/runtime registrations are present, and local verification evidence is recorded. The task is complete only after the independent Guard run is clear or the change satisfies the narrow purely mechanical exception. `no_change` is valid only when the requested behavior already exists and the touched scope already conforms.

Codify reports upstream artifact problems only through a `returned` route with concrete evidence. Review conclusions and `violation` / `evidence_gap` verdicts belong to Guard and are not Codify output.

Finish with one of:

- `changed`: summarize code behavior and local verification plus either the clear final-snapshot Guard evidence or the explicit purely mechanical exception.
- `no_change`: cite the evidence that made editing unnecessary.
- `returned`: identify either `event-storming` for an exact confirmed-Model/business-authority gap or the exact missing project-authority/ADR commitment, with the evidence exposing it.
- `blocked`: identify the external execution constraint, unrun verification, or incomplete Guard execution.

Keep the final response focused on changed files, verification, and residual risk.

## References

- After surface classification, load the smallest relevant sections.
- Infer the active language from the accepted choice and touched files. Use Go House Style only when the backend language remains open.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the router leaves for touched Domain, Application, Transport, CQRS, Infrastructure, events/messages, taskqueue, Runtime, scaffold, or generated-code surfaces.
- For Python or TypeScript, load only the sections for touched surfaces from the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load the relevant section of [../../references/ddd-core.md](../../references/ddd-core.md) when domain ownership or realization shape must be checked.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event, message, or cross-context work.
- Load [../../references/database.md](../../references/database.md) for schema, migration, index, SQL, or persistence work.
