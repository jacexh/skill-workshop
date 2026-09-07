---
name: tactical-design
description: Refine accepted Aggregate Roots into object ownership and behavior, or record already-confirmed domain-object descriptions.
---

# Tactical Design

Refine or record a sparse current domain-object design from confirmed Aggregate
Roots and Business Rules. The user owns Domain decisions; reuse accepted
descriptions and apply the interview method when decisions remain.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts.

## Entry boundary

Read the affected `context-map.md`, `model.md`, relevant project decisions, and existing `domain-objects.md`. For the current Root, treat the context purpose, Root definition and consistency boundary, and Business Rules as business authority. Start with the Root and affected slice identified by the request; ask only when that choice is materially ambiguous.

If tactical refinement exposes a needed correction to business meaning, a Bounded Context boundary, Aggregate Root identity, or a strategic Business Rule, resolve it with the user in the current conversation and carry the accepted change into the Root-level artifact review. Do not force a workflow switch or leave the tactical model built on a known contradiction.

## Choose the current work

- **Refine or challenge:** when object ownership, behavior, composition, or
  external authority is unresolved, read the
  [interview method](../../references/tactical-design-interview.md). It owns
  essential pressures, behavior probes, the Capability Probe, and comparison
  of object compositions. Work one Root and its smallest affected slice at a time.
- **Record confirmed design:** when the request already supplies a complete
  confirmed Entity or Root description, go directly to the template and write
  steps below. Reuse its decisions without reopening the interview. If a
  missing or contradictory business fact prevents recording, resolve that fact;
  load the interview method only when a new design decision is needed.

## Complete the Root slice

Before presenting any Entity or Root description, read the [domain-object template](../../templates/domain-objects.md), including its field definitions. Use it for every object, whether or not it has Ports or Events. Record only the accepted objects and fields that carry this slice's business meaning.

## Entity and Root confirmation

When one retained Entity's definition, Facts, Lifecycle State, behavior, any Domain-owned Ports, and Root composition are coherent, show its complete compact description with any directly affected Root or owned-object wording. Use existing confirmation when it covers the proposed description; otherwise obtain confirmation under the workflow contract. Then update those descriptions in `docs/ddd-expert/context/<context-slug>/domain-objects.md` and continue the current Root. An Entity confirmation gathers the decisions that close its responsibility; individual answers remain conversational working state.

For a newly designed Root, complete the interview method's Root checks before
presenting its integrated slice for confirmation. For an already-confirmed Root,
check the supplied description against the template and accepted authority.
Resolve only material gaps that prevent a faithful write.

Use the workflow contract's confirmation rule for the integrated Root. Before any Entity or Root write, read the [artifact layout and write checks](../../templates/artifact-layout.md). Write or replace accepted descriptions while preserving unrelated content. At that Root confirmation, revisit the affected `ddd-expert` current artifacts and relevant project decisions as a whole, updating only accepted content changed by the completed design. Run the write checks for changed artifacts, then continue with the next affected Root within the requested scope. `domain-objects.md` contains only current accepted object descriptions grouped by Root. Essential-pressure sets, candidate assignments, rejected alternatives, and design-burden comparisons remain conversational working state.

## Completion

Ask the decisive question only while material business meaning remains unresolved;
request confirmation only for proposed content not already covered by confirmation
or delegated choices under the workflow contract. Otherwise write the accepted
Entity or Root, run its affected write checks, and continue authorized work.

After an Entity write, continue the current Root; after a Root write, continue
with the next affected Root in scope. Once all requested slices are complete,
continue to Codify when implementation is already in scope and the accepted
slices cover it. A design-only request ends with the accepted result.

Report confirmed or updated descriptions, any accepted strategic correction,
write-check results, and remaining decisions or blockers with current filesystem
state. Cite the required slices when implementation can begin.
