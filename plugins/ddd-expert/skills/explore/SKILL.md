---
name: explore
description: Use when domain discovery must clarify a backend request before Tactical Design, either through scenario/lifecycle/rule analysis or language/authority/context-boundary analysis.
---

# Explore

Turn product evidence into accepted business facts that `shape` can design from.

## DDD model artifact

The project-owned artifact is `docs/ddd/model.md`. Create it lazily and cover only the context touched by the request; never backfill the whole system speculatively. For multiple bounded contexts, keep explicit context sections and their relationships in this one artifact.

The model describes the current accepted state, not a change log. It contains only material DDD facts:

- ubiquitous language;
- bounded contexts, business authority, and context relationships;
- scenarios, past-tense business facts, and lifecycle;
- invariants, policies, and decision ownership;
- business semantics for duplication, failure, cancellation, compensation, and recovery.

Do not copy feature descriptions, ADRs, tickets, acceptance criteria, project architecture, implementation status, or code inventories into this artifact. Read them as evidence when relevant. Tactical classifications and implementation decisions belong to `shape` and `codify`, not the model artifact.

## Workflow

1. **Inspect evidence**: read the request and the smallest relevant project evidence, starting with existing DDD model sections. Look up recorded facts before asking the user to restate them.
2. **Check phase fit**: identify the material business facts this change needs. If the existing model already supplies them and no business meaning changes, return `no_change` with the exact model sections that make `shape` safe.
3. **Choose the discovery path**: for scenario, lifecycle, or rule uncertainty, reconstruct `business intent -> past-tense fact -> policy or decision -> reaction`. For terminology, authority, or context-boundary uncertainty, investigate that evidence directly; do not force every request through an event timeline.
4. **Build a model delta**: resolve the smallest material delta across the model categories above.
5. **Pass the write gate**: when any material fact is unknown, contradictory, or guessed, follow the clarification discipline below. Write nothing until that gate is complete.
6. **Write once**: after acceptance, merge the confirmed delta into the terminal-state model artifact. Update only affected sections and avoid restating project knowledge owned elsewhere.

## Clarification discipline

Ask for a business decision, not a tactical label. State the evidence and recommendation briefly, ask exactly one focused question, and end the turn. Do not modify project files while clarification is active. Continue one question per turn until the whole material hotspot is understood; do not turn each answer into a partial document update.

After all material questions are resolved, present one integrated proposed model delta and wait for explicit user acceptance. This completes the write gate.

Useful questions distinguish authority, lifecycle, admissible transitions, durable facts, failure tolerance, language, or context ownership.

## Completion

Explore is `shape_ready` only when every material business fact needed by this change is accepted and represented in an exact DDD model section. Finish with one of:

- `changed`: the model artifact was updated once; name the exact sections.
- `no_change`: existing sections already express the required facts.
- `needs_clarification`: ask the single active question and stop without writing.
- `blocked`: an external constraint prevents reading or writing the artifact; state the constraint and intended path.

Keep the final response short. Do not paste the model unless asked.

## References

After project evidence exposes a material hotspot, load only the guidance needed to resolve it: [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md) for authority, lifecycle, invariant, failure-tolerance, language, or coordination gates; and the relevant section of [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for bounded-context or strategic-modeling depth. Do not load implementation, language, runtime, database, or `ddd-core.md` references during `explore`.
