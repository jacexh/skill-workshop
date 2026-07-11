---
name: explore
description: Use when domain discovery must turn backend user stories or equivalent business scenarios into accepted facts before Tactical Design, or clarify business language, authority, lifecycle, rules, or bounded-context boundaries.
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

Read feature descriptions, ADRs, tickets, acceptance criteria, project architecture, implementation status, and code as evidence. Keep their narrative and inventories outside the model. Tactical classifications and implementation decisions belong to `shape` and `codify`.

## Workflow

1. **Inspect evidence**: run the read-only artifact operation, then read the request, root README, accepted Context Map, and the smallest relevant Model sections. Treat `uninitialized` as a valid bootstrap state. Look up recorded facts before asking the user to restate them.
2. **Triangulate the topology**: shallow-scan every material story or scenario in the current discovery scope before descending into one branch. Extract its intent, business decisions, past-tense facts, changed rights or obligations, and reactions. Ask whether the accepted Context Map can assign each material decision or fact to one coherent language and business authority and can name every cross-context reaction. If not, build a candidate topology tree and resolve one split-or-merge hypothesis at a time. A merged candidate must sustain one coherent language and authority; a split candidate must give each context a meaningful local responsibility and name the business intent or fact crossing the boundary and its contract authority. Story grouping and technical or organizational topology are evidence, never boundary proof. Once the affected topology slice is explicitly accepted, run the checkpoint step immediately so `docs/ddd-expert/context-map.md` and every semantically affected Model become the accepted traversal authority. Do not enter a context-local discovery tree until that checkpoint succeeds.
3. **Project the stories**: use each user story or equivalent business scenario as a traversal root, not as business authority or a context boundary. Project each material intent, decision, past-tense fact, and reaction onto the accepted Context Map and combine the affected context subgraphs. One story may cross contexts and many stories may remain inside one. When a direct language, authority, or boundary question has no story, enter the relevant context or relationship without inventing one.
4. **Walk the Context Map**: use each accepted relationship's direction and power. For a directed relationship, walk the upstream context, the relationship, and then each affected downstream context. For a non-directional relationship, follow the unresolved business authority and reconcile both sides. Calls, storage, and event timing remain evidence rather than relationship direction.
5. **Close one context at a time**: build one depth-first discovery tree per affected context, rooted in that context's local business responsibility for the story set. Resolve question dependencies one at a time across local language, authority, lifecycle subjects, invariants or policies, accepted external facts, and outbound facts. Model each lifecycle as `inbound intent or accepted fact -> local decision -> past-tense fact -> rights or obligations changed -> local or outbound reaction`. A context branch is closed only when every material lifecycle branch reaches an accounted business condition: a terminal condition when one exists, an explicit continuing or recoverable local state, or a named Context Map handoff.
6. **Reconcile each boundary**: after the upstream branch closes, build the relationship tree from the authoritative fact or intent, contract owner, downstream accepted fact, local translation, and material failure meaning. Complete boundary reconciliation before entering the downstream discovery tree. Reopen the topology tree when language, authority, lifecycle, or policy evidence no longer fits the accepted boundary.
7. **Checkpoint accepted closures**: when a topology, context-local, or relationship slice is internally consistent and independent of unresolved branches, present one integrated delta for that checkpoint and wait for explicit acceptance. After acceptance, run `apply-model` through `maintain-artifacts` as one accepted semantic checkpoint and return `checkpointed`. Keep unresolved branches in the discovery frontier and write only current accepted facts.
8. **Replay the stories**: after every affected context and relationship tree closes, replay every story's normal path and material alternate paths through the accepted local facts and handoffs. Explore is `shape_ready` only when the replay needs no invented business fact, the Context Map agrees with every affected Model, and every affected Model has an exact current revision.

## Clarification discipline

Ask for a business decision, not a tactical label. State the evidence and recommendation briefly, ask exactly one focused question, and end the turn. Resolve the deepest unanswered dependency in the active discovery tree before moving sideways.

When a branch reaches lifecycle closure, present its integrated checkpoint delta; acceptance of that delta is the one active question. Apply only accepted terminal content and explicit removals.

## Completion

Finish with one of:

- `checkpointed`: an accepted semantic checkpoint was written while discovery remains; name every changed path and resulting Model revision, then ask the next focused question.
- `changed`: all accepted changes are represented at exact revisions and story replay passed; name every affected context and revision, then route them to `shape`.
- `no_change`: existing sections already make the full story `shape_ready`; cite those sections and route the affected contexts to `shape`.
- `needs_clarification`: ask the single active question and stop without writing unaccepted facts.
- `blocked`: an external constraint prevents reading or writing the artifact; state the constraint and intended path.

Only a `shape_ready` result routes affected contexts to `shape`. Keep the final response short. Do not paste the model unless asked.

## References

- Load references after topology triangulation or story projection exposes a material hotspot.
- Use only the relevant section of [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for language, authority, lifecycle, invariant, failure tolerance, subdomain, bounded-context, Aggregate, or coordination analysis.
- Do not load implementation, language, runtime, database, or `ddd-core.md` references during `explore`.
