---
name: explore
description: Use when domain discovery must clarify a backend request before Tactical Design, either through scenario/lifecycle/rule analysis or language/authority/context-boundary analysis.
---

# Explore

Turn product evidence into accepted business facts that `shape` can design from.

## DDD model artifact

Explore is the exclusive semantic authorizer of root README, Context Map, and Model changes. It never writes DDD artifacts directly and never authorizes a Design change. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute its `inspect` or `apply-model` operation in the same run with authority `explore`.

The model describes the current accepted state, not a change log. It contains only material DDD facts:

- ubiquitous language;
- bounded contexts, business authority, and context relationships;
- scenarios, past-tense business facts, and lifecycle;
- invariants, policies, and decision ownership;
- business semantics for duplication, failure, cancellation, compensation, and recovery.

Do not copy feature descriptions, ADRs, tickets, acceptance criteria, project architecture, implementation status, or code inventories into this artifact. Read them as evidence when relevant. Tactical classifications and implementation decisions belong to `shape` and `codify`, not the model artifact.

## Workflow

1. **Inspect evidence**: run the read-only artifact operation, then read the request and the smallest relevant project evidence, starting with existing DDD model sections. Treat `uninitialized` as a valid bootstrap state. Look up recorded facts before asking the user to restate them.
2. **Check phase fit**: identify the material business facts this change needs. If the existing model already supplies them and no business meaning changes, return `no_change` with the exact model sections that make `shape` safe.
3. **Choose the discovery path**: for scenario, lifecycle, or rule uncertainty, reconstruct `business intent -> past-tense fact -> policy or decision -> reaction`. For terminology, authority, or context-boundary uncertainty, investigate that evidence directly; do not force every request through an event timeline.
4. **Build one Model proposal**: resolve the smallest material delta across the model categories above, the accepted context set, the Context Map, and every affected context model.
5. **Pass the write gate**: when any material fact is unknown, contradictory, or guessed, follow the clarification discipline below. Write nothing until that gate is complete.
6. **Apply once**: after acceptance, author exact terminal content for every changed section and explicit removals, then run `apply-model` through `maintain-artifacts` with context names/slugs, each Explore-owned path's observed pre-state, and write-gate evidence. Explore chooses the wording; artifact mechanics only validate and apply it. Accept only its validated `changed` or `no_change` result. Correct an invalid operation input internally. On `revision_conflict`, re-inspect and rebuild the transaction once; if the pre-state changes again, return `blocked` with the concurrent-change evidence. Never bypass the protocol with a direct write.

## Clarification discipline

Ask for a business decision, not a tactical label. State the evidence and recommendation briefly, ask exactly one focused question, and end the turn. Do not modify project files while clarification is active. Continue one question per turn until the whole material hotspot is understood; do not turn each answer into a partial document update.

After all material questions are resolved, present one integrated proposed model delta and wait for explicit user acceptance. This completes the write gate.

Useful questions distinguish authority, lifecycle, admissible transitions, durable facts, failure tolerance, language, or context ownership.

## Completion

Explore is `shape_ready` only when every material business fact needed by this change is accepted, root navigation and Context Map agree with the accepted context set, and each affected model is represented at an exact revision. A changed model always requires Shape to create or revalidate its design before Codify. Finish with one of:

- `changed`: the accepted artifact transaction was written once; name every changed path and affected model revision, then route the affected contexts to `shape`.
- `no_change`: existing sections already express the required facts.
- `needs_clarification`: ask the single active question and stop without writing.
- `blocked`: an external constraint prevents reading or writing the artifact; state the constraint and intended path.

Keep the final response short. Do not paste the model unless asked.

## References

- Load references only after project evidence exposes a material hotspot.
- Use only the relevant section of [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for language, authority, lifecycle, invariant, failure tolerance, subdomain, bounded-context, Aggregate, or coordination analysis.
- Do not load implementation, language, runtime, database, or `ddd-core.md` references during `explore`.
