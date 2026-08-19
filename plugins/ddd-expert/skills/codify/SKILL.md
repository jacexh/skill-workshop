---
name: codify
description: Use when accepted strategic and domain-object design must be implemented, tested, or mechanically repaired in the repository's backend house style.
---

# Codify

Implement the accepted domain model. Optimize for semantic completion of the requested slice, not the smallest local edit that leaves obsolete responsibilities alive.

## Authority

Use this order when inputs disagree:

1. the user's current scope and explicit accepted decisions;
2. affected `context-map.md`, `model.md`, and `domain-objects.md` content;
3. accepted project Specs, PRDs, ADRs, and constraints;
4. applicable conditional House Style;
5. existing code and tests as evidence of current behavior.

Code and tests do not silently override accepted object ownership. A new user request that changes business meaning or object design is a modeling input, not permission for Codify to improvise the model.

Within each affected context, read `model.md` and `domain-objects.md` together: the first fixes the strategic boundary and the second fixes object ownership.

DDD artifacts are read-only during Codify. Never edit `context-map.md`, `model.md`, or `domain-objects.md` to make implementation easier. When implementation evidence contradicts accepted authority, stop and route the contradiction:

- changed business meaning, Bounded Context, Aggregate Root, or strategic rule -> EventStorming;
- changed object definition, state, behavior, or actual Domain Event -> Tactical Design;
- hard-to-reverse project decision -> the project's decision mechanism.

Resume implementation only after the relevant authority is confirmed.

## Workflow

### 1. **Preflight before edits**

- Read the complete affected strategic and tactical sections.
- Inspect repository instructions and the actual implementation path.
- Pin the requested scope, comparison base, language, generated-code boundaries, and verification commands.
- Map each accepted Root, Entity, behavior, state carrier, and Domain Event in scope to its intended production owner.
- Identify objects and mechanisms whose responsibility is removed, not merely renamed.

If a required `domain-objects.md` Root slice is absent or ambiguous, route to Tactical Design before coding.

### 2. Implement the semantic slice

Work from Domain outward:

1. establish the accepted object structure end to end;
2. implement state and behavior on the owning Root or Entity;
3. implement actual Domain Event creation or consumption where selected;
4. connect Application orchestration and required semantic ports;
5. adapt Infrastructure, Interface, and Runtime only where the slice needs them.

A Behavior listed under a Root or Entity is realized as a method on that object. A free function is appropriate only for construction, a pure calculation with no natural Domain owner, or a private algorithm behind an owning method. When a free function primarily accepts one Domain object to read or change its state, treat it as receiver-shaped evidence that the behavior belongs on that object's method surface; keep it free only with a concrete ownership reason.

For object deletion or ownership migration, compare responsibilities and state carriers, not only identifiers. Remove obsolete fields, methods, types, compatibility projections, parallel paths, and tests that preserve the old responsibility. A renamed substitute is not deletion.

Tests support the accepted design. A narrow green test does not justify retaining a forbidden object or duplicating its decision elsewhere. When a structural migration spans several files, make the complete accepted structure the next stable checkpoint, then return to small behavior cycles.

Apply transaction, concurrency, recovery, messaging, or lifecycle House Rules only when the accepted design or project authority establishes their condition. Do not introduce them as generic completeness.

### 3. Verify implementation evidence

- Add or update high-signal tests at the behavior boundary changed by the slice.
- Run the smallest focused check after each coherent edit.
- Run the relevant package or module suite after the slice is connected.
- Run the repository's broader required checks before handoff.
- Inspect the final diff for semantic leftovers, generated artifacts, and unintended files.

Record commands, exit status, concise results, and checks not run with the reason. Verification proves the implementation snapshot; it never modifies design authority.

### 4. Handoff

Provide Guard with a compact navigation note when independent review is requested:

- immutable base and target or complete working-tree snapshot;
- governing artifact paths and headings;
- changed production symbols grouped by accepted Root behavior;
- verification receipts;
- known uncertainty that affects semantic review.

Keep the handoff outside `docs/ddd-expert`. Do not predeclare Guard findings.

## Completion

Finish with one result:

- `completed`: summarize the implemented behaviors, structural deletions, changed files, and verification;
- `event_storming_required`: cite the strategic contradiction and stop before further edits;
- `tactical_design_required`: cite the object-design contradiction and stop before further edits;
- `blocked`: identify the exact implementation or verification failure and current repository state.

## References

- After surface classification, load the smallest relevant sections.
- Infer the active language from the repository and accepted project choice.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the router leaves for touched Domain, Application, Transport, CQRS, Infrastructure, events/messages, taskqueue, Runtime, scaffold, or generated-code surfaces.
- For Python or TypeScript, load only the sections for touched surfaces from [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
- Load relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) when domain ownership or realization shape must be checked.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for actual Domain Event, message, or cross-context work.
- Load [../../references/database.md](../../references/database.md) for schema, migration, index, SQL, or persistence work.
