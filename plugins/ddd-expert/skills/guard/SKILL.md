---
name: guard
description: Use when concrete backend changes need an independent, read-only review for faithful realization of the accepted strategic and domain-object design.
---

# Guard

Guard answers one bounded question: does this implementation realize the accepted domain model without moving or duplicating its responsibilities?

Run Guard in one fresh, read-only agent context distinct from the implementer, keep it read-only, and avoid recursive review fan-out. Guard is a semantic-structure review, not a general bug hunt, test campaign, or operational probe.

## Governing evidence

Read the actual scoped content of:

- `docs/ddd-expert/context-map.md`, affected `model.md`, and `domain-objects.md` as one current authority set;
- the user's request and accepted Specs, PRDs, ADRs, or constraints that govern the slice;
- the complete implementation diff and production symbols that realize the affected behavior;
- the producer's verification receipts and snapshot identity, when supplied;
- the smallest applicable House Style sections.

The current artifacts own accepted meaning. Project decisions own only what they explicitly decide. House Style applies only when its stated condition is established. Code and tests are implementation evidence, not a source that silently changes the model.

A missing strategic fact blocks only that strategic judgment. A missing or contradictory object definition blocks only the affected tactical judgment. Continue reviewing independent responsibilities.

## Review focus

Start with the accepted domain behavior, then read outward only as needed:

1. **Strategic boundary**: Bounded Context ownership, Aggregate Root identity, semantic context dependencies, and published contracts remain intact.
2. **Domain objects**: accepted Roots and Entities own their recorded state and behavior; each listed Behavior appears on its owner's method surface; a receiver-shaped free function needs a concrete no-natural-owner reason; removed objects have no renamed responsibility carrier; actual Domain Events are produced or consumed by the recorded objects.
3. **Application**: use-case context, authorization, transaction setup, and technical coordination do not take over Domain decisions.
4. **Infrastructure and Interface**: adapters preserve inward semantic contracts and isolate database, provider, transport, and generated types.
5. **Runtime**: composition connects the accepted owners when runtime wiring changed.

A changed file is not automatically another review obligation. Group production symbols that implement one falsifiable semantic responsibility and judge that responsibility once.

## Workflow

1. Pin the immutable comparison base and complete target snapshot before trusting a handoff.
2. Derive a finite set of review units from affected strategic clauses, domain-object descriptions, actual Domain Events, project decisions, and changed structural declarations.
3. Give each independently falsifiable responsibility its own stable unit. Preserve its governing source and exact implementation evidence.
4. Inspect each unit from Domain outward. Compare semantic responsibility and state carriers, not names alone.
5. **Use question-led implementation depth**: before opening an adapter or runtime body, state the concrete semantic question it must answer. Read the minimum evidence and stop once answered.
6. Consume producer verification receipts; do not rerun tests, builds, migrations, containers, databases, networks, or deployments.
7. Recheck the pinned snapshot and governing sources, then assign every unit exactly one terminal state: `clear`, `violation`, or `evidence_gap`.

Guard never edits DDD artifacts, source code, tests, or iteration state. A source drift makes execution incomplete; it does not authorize an update.

## Judgment and routing

- `clear`: implementation preserves the accepted responsibility.
- `violation`: accepted meaning is clear and implementation is missing, misplaced, duplicated, or contradicted.
- `evidence_gap`: required authority or implementation evidence is absent or contradictory.

Route strategic contradictions to EventStorming. Route object-definition, state, behavior, or Domain Event contradictions to Tactical Design. Route implementation drift to Codify. A hard-to-reverse project-decision gap goes to the project's decision mechanism.

Passing tests, matching package names, a Repository method, or absence of an old identifier cannot clear a unit by itself. Conversely, an ordinary SQL, provider, performance, UI, or edge-case suspicion is not a Guard finding unless it disproves a named semantic responsibility.

Report non-clear findings in impact order. Each finding names:

- terminal state and affected review unit;
- governing artifact path and clause;
- concrete production file and line evidence;
- semantic impact and root cause;
- correction route and direction.

Say `No DDD structural findings` only when every unit is clear. This does not claim general code correctness.

## Completion

Finish with one result:

- `clear`: all scoped review units are clear;
- `violations`: report findings and route implementation drift;
- `evidence_gaps`: report only judgments that unavailable authority or evidence prevents;
- `incomplete`: identify source drift or execution failure and the last stable snapshot.

## References

- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for strategic and object-boundary interpretation.
- Start with relevant sections of [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Repository boundaries, and realization shape.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) only when actual Domain Events or cross-context collaboration are affected.
- For Go, use [../../references/ddd-golang.md](../../references/ddd-golang.md) to route each architecture unit to only the layer or flow sections that own its seam.
- For Python or TypeScript, load only the sections owning each architecture unit from [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md).
