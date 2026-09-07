# Tactical Design Interview

Read when object ownership, behavior, composition, or external authority still
needs a decision. Apply the skill entry and shared workflow contract; return to
the entry for Entity/Root confirmation, artifact writes, and completion.

```text
confirmed Aggregate Root and Business Rules
-> essential business pressures
-> behavior probes and candidate concepts
-> alternative object compositions
-> confirmed Entity descriptions as they close
-> integrated Root confirmation and current artifacts
-> next Root
```

## Relentless interview contract

- If a fact can be found in the repository, look it up instead of asking the user.
- Ask one material unresolved question at a time and resolve its dependent branch before moving sideways.
- Every decision question includes a recommended answer, concise reasoning, and the strongest credible alternative or deletion case.
- Challenge both user proposals and agent proposals. An existing class or table proves current implementation, not the correct object boundary.
- Stop asking when another answer would not change this Aggregate Root's business pressures, responsibility ownership, object composition, or descriptions.

Work one Aggregate Root at a time. Within it, follow the smallest affected business-pressure slice; when a Root has no accepted slice, cover every Business Rule that shapes it. Account for every retained or changed object, but do not interview through an entity checklist or reopen unaffected objects without evidence.

## Derive essential business pressures

For the current slice, derive the smallest complete set of **essential business pressures** from `model.md`. A pressure is a business decision, Lifecycle State transition, invariant, material external-authority need, or actual Domain Event that the object model must realize. Together, the pressures are the working expression of the Root's essential complexity, not a score or a claim that only one phrasing is possible. Group interacting rules when their difficulty comes from being true together; one Business Rule need not produce one pressure.

Every pressure names the governing Business Rules in the working conversation. Stories, specifications, and code may challenge whether those rules are complete, but they add no confirmed business meaning until the user accepts it. When a material pressure cannot be traced to the Model or the rules contradict it, resolve the smallest strategic correction with the user before continuing and include it in the Root-level review. Keep the pressure set transient; it is reasoning input, not another artifact.

## Probe behavior ownership

Whenever proposing a candidate Root or Entity, explain together what it represents and how it operates, then introduce its candidate Behaviors immediately in the owning Bounded Context's Domain language. If no precise Domain verb follows from that account, keep clarifying the proposal instead of assigning a technical placeholder name.

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

During exploration, vary the Subject when different owners are credible. Resolve every material Subject and Object as the current Root, an owned Entity, a Value Object, a Fact owned by one of those objects, an identity reference to another Root, or an external role or authority, and name each Lifecycle State transition explicitly. Explicit resolution does not promote every noun into a Domain object.

In the accepted design, the object whose behavior is described becomes the grammatical Subject and behavior owner. The sentence describes Domain meaning, not a method signature or call graph.

When a Root exposes a capability by composing an owned Entity's behavior, connect the accepted Behavior entries with this optional Root form:

```text
<Root Behavior> — <Root> <domain verb> <Object> by composing <Entity>.<Entity Behavior>.
```

`<Entity>.<Entity Behavior>` references the Entity-owned Domain behavior; it does not prescribe a method call. Keep the Root entry about aggregate capability and composition, and the Entity entry authoritative for its owned decision instead of repeating that decision under the Root. Use the ordinary Subject form when no owned behavior is composed.

### Capability Probe

For each candidate Behavior, surface every piece of externally owned Domain data or authoritative answer it needs, then choose:

- **Supplied Fact** — the caller supplies a Domain Fact or Value Object while preserving the Behavior's decision ownership, timing, and authority.
- **Domain-owned Port** — the Behavior owns invocation timing, Domain input, and result use; it invokes a sparse Method on a narrow Domain-language data contract whose implementation outer composition supplies.

For a Domain-owned Port, establish its direct Behavior owner, Domain-role name ending in `Port`, and sparse Methods with their business decision point and Domain result. Exact signatures, source topology, and technical fulfillment policy remain realization choices.

If concern about obtaining external data or handling its technical failure starts shaping a candidate Root or Entity, surface the hidden Domain-owned Port and continue the object design from its fulfilled Domain result.

For each candidate Behavior, follow any resulting fact that requires or enables a later Domain intent and establish whether the producing Behavior succeeds independently of that intent. Select an actual Domain Event only when the accepted model needs a named local reaction to the occurrence or needs the occurrence itself, rather than merely the resulting state, as Domain evidence. Establish its recording Behavior and accepted local reactions. Analytical Workshop Events remain conversational evidence.

## Compare object compositions

Construct the smallest credible candidate set, including no new split and the strongest relevant split, merge, move, or deletion alternative. Do not enumerate combinations that no confirmed pressure distinguishes.

For each candidate, map every pressure to a behavior owner and compare the design burden it introduces: knowledge exposed to callers or the Root, cross-object coordination and ordering, duplicated state or decisions, additional identity and lifecycle, and extra mapping or test surface. Treat this burden as accidental complexity introduced by the candidate composition, not as an invitation to prescribe implementation techniques. A candidate remains viable only when it realizes every pressure and keeps the Root able to protect cross-object invariants.

Prefer the viable candidate that localizes each decision with the state it needs while exposing less knowledge and coordination. Keep a child Entity when it has Domain identity or lifecycle plus cohesive state, rules, or transitions, and merging it would concretely spread or duplicate decision knowledge. Otherwise use the simpler supported representation. The Root composes owned-object behavior; callers do not inspect internal state to reproduce its decisions. Follow a retained Entity's behavior through any material Domain result that the Root or another owned object composes next. When the Root exposes the same capability, describe the Root's composition and the Entity's owned decision without duplicating that decision.

Use a Value Object when Domain meaning, validity, and equality come from its attributes rather than identity. Use a Domain Service only for an accepted named Domain operation with no natural Entity or Value Object owner; it owns that Domain decision while Application retains loading, persistence, and transaction coordination.

Carry a realization concern into the design only when a confirmed Business Rule changes the required ownership or Domain result. Express that constraint through the affected object's Facts, Lifecycle State, behavior, Domain-owned Port Method, or actual Domain Event, or through the project's decision mechanism when it is a hard-to-reverse project choice.

## Root Completion Checks

When the Root's composition is complete, show its integrated compact slice. Before confirmation, verify that every pressure is traceable and assigned; every external-authority need has a Capability Probe classification; every material behavior owner, target, and Lifecycle State transition is resolved; every retained or changed object has a reason to exist; and the strongest credible alternative was compared under the same pressures. Check every description against the template, including Port Methods, recording Behaviors, and accepted local reactions. Complete when no material decision remains that would change composition or ownership.
