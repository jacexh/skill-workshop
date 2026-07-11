---
name: shape
description: Use when Tactical Design must be created from accepted backend domain facts or an existing Tactical Design needs pre-code evaluation.
---

# Shape

Turn the accepted DDD model into the smallest `codify_ready` Tactical Design. Shape owns tactical choices; it does not rediscover business facts or choose routine physical implementation mechanics.

## Tactical Design artifact

Shape is the exclusive semantic authorizer of Design changes. It never writes DDD artifacts directly and never authorizes a root README, Context Map, or Model change. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute its `inspect` or `apply-design` operation in the same run with authority `shape`.

The design describes the current accepted target state, not a feature narrative, change log, ADR summary, task plan, or implementation report. Include only material DDD design:

- Aggregate boundaries and invariant ownership;
- Application responsibilities, commands, and queries;
- Domain Events, Integration Messages, and collaboration mechanisms;
- Repository, CQRS, consistency, transaction, and idempotency boundaries;
- design-significant boundary contracts and runtime ownership;
- verification seams that prove the accepted model and design.

Do not prescribe schemas, DTO fields, file lists, package inventories, event payloads, or implementation steps unless that detail is itself a material design decision. A non-default choice is written as the chosen design in its normal section; do not maintain a separate exception ledger.

## Workflow

1. **Read accepted inputs**: run the read-only artifact operation, then start from the root README, Context Map, exact model sections and revisions for every affected context, their existing Tactical Designs, and the scoped request. A missing Design is a valid input for its first Shape; stale or topology-pending Designs require revalidation. Treat code and tests as current-state evidence, not as authority over accepted model facts.
2. **Check phase fit**: if a material scenario, authority, lifecycle, invariant, failure-tolerance, business language, or bounded-context fact is missing or contradictory, return to `explore` with the single highest-leverage missing fact. Aggregate and collaboration choices based on complete facts belong to `shape`; aggregate uncertainty alone is not a reason to return upstream.
3. **Shape the target state**: resolve every applicable handoff obligation listed under Tactical Design artifact.
4. **Review the design internally**: check story before objects, authority before ownership, lifecycle before type, invariant before Aggregate, failure tolerance before transaction, language before integration, and coordination before mechanism. Implementation transaction shape and storage convenience are evidence, not model proof.
5. **Pass the write gate**: if a material tactical decision cannot be resolved from accepted facts and project evidence, follow the clarification gate below. Write nothing until that gate is complete.
6. **Apply once**: after acceptance, run `apply-design` through `maintain-artifacts` with context names/slugs, exact current Model revisions, each Design's observed pre-state, exact terminal content for every changed section, explicit removals, and write-gate evidence. Shape chooses the wording; artifact mechanics only validate and apply it. Correct an invalid operation input internally. On `revision_conflict`, re-inspect and rebuild the transaction once; if the pre-state changes again, return `blocked` with the concurrent-change evidence. Never bypass the protocol with a direct write.

## Clarification gate

Ask exactly one focused design question and end the turn. Do not modify project files while clarification is active. Once every material tactical question is resolved, present one integrated proposed design delta and wait for explicit user acceptance.

## Decision boundary

The applicable handoff obligations under Tactical Design artifact are Shape's complete decision boundary. Shape must leave Codify no semantic design work.

Codify decides routine scaffold and file placement, adopted house-style libraries, concrete adapter mechanics, MySQL mapping details, message/runtime wiring mechanics, and the smallest sufficient verification implementation when those choices do not alter the accepted tactical design.

## Completion

The Tactical Design is the Implementation handoff. It is `codify_ready` only when every applicable handoff obligation above is resolved, every affected design references its exact current model revision, and Codify can implement without choosing business facts or semantic design.

Finish with one of:

- `changed`: the design artifact was updated once; name the exact sections.
- `no_change`: the existing design already makes the scoped work codify-ready and its model revision link already matches.
- `needs_clarification`: ask the single active tactical question and stop without writing.
- `returned`: identify `explore`, the missing business fact, and the evidence exposing the gap.
- `blocked`: an external constraint prevents reading or writing the artifact.

Keep the final response short. Do not produce a separate agent-to-agent handoff report.

## References

- Load references only after phase fit succeeds, and only for the touched design surface.
- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) to test fact sufficiency and strategic boundaries. Return to `explore` when accepted facts do not support the design.
- Use [../../references/ddd-core.md](../../references/ddd-core.md) for tactical ownership.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for event timing, recovery, cross-owner, or cross-context collaboration.
- Use a language House Style only when implementation placement or capability constrains a tactical decision.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the layer, flow, or platform leaf that owns the constraint.
- For Python or TypeScript, load only the relevant section of the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load [../../references/database.md](../../references/database.md) only when persistence capabilities constrain an accepted consistency or transaction boundary. Physical schema, migration, index, and SQL mechanics belong to `codify`.
