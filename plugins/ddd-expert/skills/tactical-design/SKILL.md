---
name: tactical-design
description: Use when accepted Aggregate Roots and business rules need tactical design or recording of object ownership, Domain Services, behavior, or external-authority boundaries.
---

# Tactical Design

Turn confirmed Aggregate Roots and Business Rules into a sparse current domain-object design. The conversation is a relentless comparison of responsibility candidates, not an entity inventory. The user decides; the facilitator investigates facts, recommends answers, and attacks weak object boundaries with ownership probes.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts.

```text
confirmed Aggregate Root and Business Rules
-> essential business pressures
-> ownership probes and candidate concepts
-> compared object compositions
-> confirmed Entity descriptions as they close
-> integrated Root confirmation and current artifacts
-> next Root
```

## Entry boundary

Read the affected `context-map.md`, `model.md`, relevant project decisions, and existing `domain-objects.md`. For the current Root, treat the context purpose, Root definition and consistency boundary, and Business Rules as business authority. Start with the Root and affected slice identified by the request; ask only when that choice is materially ambiguous.

If tactical refinement exposes a needed correction to business meaning, a Bounded Context boundary, Aggregate Root identity, or a strategic Business Rule, resolve it with the user in the current conversation and carry the accepted change into the Root-level artifact review. Do not force a workflow switch or leave the tactical model built on a known contradiction.

## Choose the current work

For refinement or challenge, use the interview below to resolve ownership,
behavior, composition, and external authority for the smallest affected Root or Domain Service slice.
For recording a complete already-confirmed Entity, Root, or Domain Service, proceed directly to
"Complete the current slice" and the write steps. Reuse its decisions; resolve only
missing or contradictory business meaning that prevents a faithful write.

## Relentless interview contract

Use the shared [design interview presentation](../../references/workflow.md#design-interview-presentation) for questions, recommendations, changes, and conflicts.

- If a fact can be found in the repository, look it up instead of asking the user.
- Ask one material unresolved question at a time and resolve its dependent branch before moving sideways.
- Every decision question includes a recommended answer, concise reasoning, and the strongest credible alternative or deletion case.
- Challenge both user proposals and agent proposals. An existing class or table proves current implementation, not the correct object boundary.
- Stop asking when another answer would not change this Aggregate Root's business pressures, responsibility ownership, object composition, or descriptions.

Work one Aggregate Root at a time. Within it, follow the smallest affected business-pressure slice; when a Root has no accepted slice, cover every Business Rule that shapes it. Account for every retained or changed object, but do not interview through an entity checklist or reopen unaffected objects without evidence.

Before the first pressure list or comparison of a refinement, read the [worked example](../../references/tactical-design-example.md) for the shape of a pressure list, a probe turn, a comparison table, and a confirmed description.

## Derive essential business pressures

For the current slice, derive the smallest complete set of **essential business pressures** from `model.md`. A pressure is a business decision, Lifecycle State transition, invariant, material external-authority need, or actual Domain Event that the object model must realize. Group interacting rules when their difficulty comes from being true together; one Business Rule need not produce one pressure.

Every pressure names the governing Business Rules in the working conversation. Stories, specifications, and code may challenge whether those rules are complete, but they add no confirmed business meaning until the user accepts it. When a material pressure cannot be traced to the Model or the rules contradict it, resolve the smallest strategic correction with the user before continuing and include it in the Root-level review. Keep the pressure set transient; it is reasoning input, not another artifact.

## Probe behavior ownership

Whenever proposing a candidate Root, Entity, or Domain Service, explain together what it represents and how it operates, then introduce its candidate Behaviors immediately in the owning Bounded Context's Domain language. If no precise Domain verb follows from that account, keep clarifying the proposal instead of assigning a technical placeholder name.

A straightforward object may need only one sentence. Where operation is material, follow how it makes Domain progress or produces a result, including any autonomous progress, external-decision boundary, or owned-object result flow. Use that account to discover and connect Behaviors rather than waiting for scenario-by-scenario probing to stall. Keep the How as conversational working reasoning, carrying only an operating characteristic essential to what the object is into its Definition.

For each pressure, explore candidate responsibility with short behavior statements:

```text
<Subject> <domain verb> <Object>.
```

The Subject is the candidate behavior owner and the Object is its Domain target.

When a behavior transitions the object's Lifecycle State, name the transition:

```text
<Subject> <domain verb> <Object>, transitioning <Lifecycle State name> from <before> to <after>.
```

Do not force this clause onto behavior that has no Lifecycle State transition. There is no universal result slot.

During exploration, vary the Subject when different owners are credible. Resolve every material Subject and Object as the current Root, an owned Entity, a Value Object, a Domain Service, a Fact owned by one of those objects, an identity reference to another Root, or an external role or authority, and name each Lifecycle State transition explicitly. Explicit resolution does not promote every noun into a Domain object.

In the accepted design, the object whose behavior is described becomes the grammatical Subject and behavior owner. The sentence describes Domain meaning, not a method signature or call graph.

When a Root exposes a capability by composing an owned Entity's behavior, connect the accepted Behavior entries with this optional Root form:

```text
<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.
```

`<Entity>.<Entity Behavior>` references the Entity-owned Domain behavior; it does not prescribe a method call. Keep the Root entry about aggregate capability and composition, and the Entity entry authoritative for its owned decision instead of repeating that decision under the Root. Use the ordinary Subject form when no owned behavior is composed.

### Ownership probes

A probe is a question whose every answer maps to a design action. Ask it against one candidate Behavior with a concrete scenario, and answer it from repository evidence first. Every candidate Behavior passes the Knowledge and External authority probes before it enters a comparison.

| Probe | Ask | Answer -> action |
|---|---|---|
| Knowledge | Which Facts must be known at the moment `<behavior>` decides? | All owned by one object: that object is the Subject. Spread across objects: the object holding the decisive Facts owns it, and the Root composes it when a cross-object invariant is involved. |
| Caller inspection | Would a caller have to read `<object>` state to reproduce this decision? | Yes: the decision is a Behavior of `<object>`. No: the caller may keep it. |
| Concurrent change | Two callers change `<Entity A>` and `<Entity B>` under the same Root at once; must one fail? | Must fail: both stay under the Root. Both may succeed: the split is a credible candidate; raise it as a strategic correction when it moves Root identity. |
| Deletion | If `<Entity>` merges into `<Root>`, which decision becomes unclear or duplicated? | A named decision: keep the Entity. None: merge it. |
| External authority | Does `<behavior>` need a Fact or answer another authority owns? | The caller can supply it at command time without changing decision ownership or timing: **Supplied Fact**, the default. The Behavior itself must choose when to ask and use the answer mid-decision: **Domain-owned Port**. |
| Occurrence | Does the accepted model need a named local reaction to `<occurrence>`, or the occurrence itself as Domain evidence beyond the resulting state? | Yes: select an actual Domain Event, name its recording Behavior and accepted local reactions. No: the Workshop Event stays conversational. |

For a Domain-owned Port, establish its direct Behavior owner, Domain-role name ending in `Port`, and sparse Methods with their business decision point and Domain result. Exact signatures, source topology, and technical fulfillment policy remain realization choices. If concern about obtaining external data or handling its technical failure starts shaping a candidate Root or Entity, surface the hidden Domain-owned Port and continue the object design from its fulfilled Domain result.

For each candidate Behavior, follow any resulting fact that requires or enables a later Domain intent and establish whether the producing Behavior succeeds independently of that intent before applying the Occurrence probe.

## Compare object compositions

Construct the smallest credible candidate set: no new split, plus the strongest relevant split, merge, move, or deletion alternative that the probe answers make credible. Do not enumerate combinations that no confirmed pressure distinguishes.

Present the comparison as one table, one row per pressure and one column per candidate, each cell holding the behavior statement that realizes the pressure, with a final Burden row:

```text
| Pressure | No split | <Strongest alternative> |
|---|---|---|
| P1 <pressure> (<Rules>) | <Subject> <domain verb> <Object> | <Subject> <domain verb> <Object> |
| Burden | <knowledge exposed; coordination; duplicated state or decisions; identity and lifecycle; mapping and test surface> | <same dimensions> |
```

The Burden row names the accidental complexity each composition introduces, not implementation techniques. A candidate remains viable only when it realizes every pressure and keeps the Root able to protect cross-object invariants.

Prefer the viable candidate that localizes each decision with the state it needs while exposing less knowledge and coordination. Keep a child Entity when it has Domain identity or lifecycle plus cohesive state, rules, or transitions, and the Deletion probe names a decision that merging would spread or duplicate. Otherwise use the simpler supported representation. The Root composes owned-object behavior. Follow a retained Entity's behavior through any material Domain result that the Root or another owned object composes next. When the Root exposes the same capability, describe the Root's composition and the Entity's owned decision without duplicating that decision.

Use a Value Object when Domain meaning, validity, and equality come from its attributes rather than identity; name it within the Facts, Lifecycle State, or Behavior it explains.

Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or Domain result. Express that constraint through the affected object's Facts, Lifecycle State, behavior, Domain-owned Port Method, or actual Domain Event, or through the project's decision mechanism when it is a hard-to-reverse project choice.

## Domain Services

Use a Domain Service only for an accepted named Domain operation with no natural Entity or Value Object owner; it owns that Domain decision while Application retains loading, persistence, and transaction coordination.

A Domain Service slice uses the same interview: its governing Business Rules and affected Roots supply the pressures, its Behaviors pass the ownership probes, and its composition is compared against the strongest Entity or Root owner. Establish its Domain inputs, decision or result, and any collaboration through public Aggregate behavior. Review only the collaborating Root behaviors whose responsibilities change.

Record it once at Bounded Context scope using the template's Domain Service section; collaborating Root descriptions reference that responsibility where needed. Confirmation and write steps are the same as for an Entity, and completing its slice includes accepted changes to affected collaborator descriptions and strategic rules.

## Complete the current slice

Before presenting any object description, read the [domain-object template](../../templates/domain-objects.md), including its field definitions. Use it for every object, whether or not it has Ports or Events. Record only the accepted objects and fields that carry this slice's business meaning.

## Object and Root confirmation

When one retained Entity's definition, Facts, Lifecycle State, behavior, any Domain-owned Ports, and Root composition are coherent, show its complete compact description with any directly affected Root or owned-object wording. Use existing confirmation when it covers the proposed description; otherwise obtain confirmation under the workflow contract. Then update those descriptions in `docs/ddd-expert/context/<context-slug>/domain-objects.md` and continue the current Root. When the Entity is confirmed before its Root, write it under a Root heading that holds only the Root's accepted Definition, and complete the Root section at Root confirmation. An Entity confirmation gathers the decisions that close its responsibility; individual answers remain conversational working state.

For a Domain Service, present its complete template description with any affected collaborator wording once its decision ownership, inputs, result, and external-authority needs are resolved.

For a newly designed Root, show its integrated compact slice when its composition is complete. Before confirming any newly designed slice, verify that:

- every pressure is traceable to its Business Rules and assigned to one Behavior;
- every external-authority need is classified as Supplied Fact or Domain-owned Port;
- every material behavior owner, target, and Lifecycle State transition is resolved;
- every Lifecycle State is entered and left by a named Behavior, or is the initial or terminal state;
- every retained or changed object has a reason to exist;
- the strongest credible alternative was compared under the same pressures;
- every description matches the template, including Port Methods, recording Behaviors, and accepted local reactions.

Complete when no material decision remains that would change composition or ownership.

For an already-confirmed Root, check the supplied description against the template
and accepted authority. Resolve only material gaps that prevent a faithful write.

Use the workflow contract's confirmation rule for the integrated Root. Before any object write, read the [artifact layout and write checks](../../templates/artifact-layout.md). Write or replace accepted descriptions while preserving unrelated content. At completion of a Root or Domain Service slice, revisit the affected `ddd-expert` current artifacts and relevant project decisions as a whole, updating only accepted content changed by the completed design. Run the write checks for changed artifacts, then continue with the next affected slice within the requested scope. `domain-objects.md` contains only current accepted descriptions in the template's layout. Pressure sets, probe answers, comparison tables, and rejected alternatives remain conversational working state.

## Completion

Ask the decisive question only while material business meaning remains unresolved;
request confirmation only for proposed content not already covered by confirmation
or delegated choices under the workflow contract. Otherwise write the accepted
object, run its affected write checks, and continue authorized work.

After an object write, continue its current slice; after completing a slice, continue
with the next affected slice in scope. Once all requested slices are complete,
continue to Codify when implementation is already in scope and the accepted
slices cover it. A design-only request ends with the accepted result.

Report confirmed or updated descriptions, any accepted strategic correction,
write-check results, and remaining decisions or blockers with current filesystem
state. Cite the required slices when implementation can begin.
