---
name: shape
description: Use when Tactical Design must be created from accepted backend domain facts or an existing Tactical Design needs pre-code evaluation.
---

# Shape

Turn the accepted DDD model into the smallest `codify_ready` Tactical Design. Shape owns tactical choices; it does not rediscover business facts or choose routine physical implementation mechanics.

## Tactical Design artifact

The project-owned artifact is `docs/ddd/design.md`. Create it lazily for the touched responsibility. For multiple bounded contexts, keep their tactical designs in explicit context sections and resolve the relationships recorded in `model.md` before shaping cross-context collaboration.

The design describes the current accepted target state, not a feature narrative, change log, ADR summary, task plan, or implementation report. Include only material DDD design:

- Aggregate boundaries and invariant ownership;
- Application responsibilities, commands, and queries;
- Domain Events, Integration Messages, and collaboration mechanisms;
- Repository, CQRS, consistency, transaction, and idempotency boundaries;
- semantic ports, adapters, protocol boundaries, and runtime ownership;
- verification seams that prove the accepted model and design.

Do not prescribe schemas, DTO fields, file lists, package inventories, event payloads, or implementation steps unless that detail is itself a material design decision. A non-default choice is written as the chosen design in its normal section; do not maintain a separate exception ledger.

## Workflow

1. **Read accepted inputs**: start from the exact model sections for this responsibility, the context-relationship sections when contexts collaborate, the existing Tactical Design, and the scoped request. Treat code and tests as current-state evidence, not as authority over accepted model facts. When bootstrapping the DDD design artifact, inspect existing accepted project design evidence to avoid contradiction, but do not copy its history or general project knowledge into `design.md`.
2. **Check phase fit**: if a material scenario, authority, lifecycle, invariant, failure-tolerance, business language, or bounded-context fact is missing or contradictory, return to `explore` with the single highest-leverage missing fact. Aggregate and collaboration choices based on complete facts belong to `shape`; aggregate uncertainty alone is not a reason to return upstream.
3. **Shape the target state**: resolve every applicable handoff obligation listed under Tactical Design artifact.
4. **Review the design internally**: check story before objects, authority before ownership, lifecycle before type, invariant before Aggregate, failure tolerance before transaction, language before integration, and coordination before mechanism. Implementation transaction shape and storage convenience are evidence, not model proof.
5. **Pass the write gate**: if a material tactical decision cannot be resolved from accepted facts and project evidence, follow the clarification gate below. Write nothing until that gate is complete.
6. **Write once**: after acceptance, merge the design delta into the terminal-state Tactical Design. Update only affected sections and remove superseded design statements instead of appending history.

## Clarification gate

Ask exactly one focused design question and end the turn. Do not modify project files while clarification is active. Once every material tactical question is resolved, present one integrated proposed design delta and wait for explicit user acceptance.

## Decision boundary

The applicable handoff obligations under Tactical Design artifact are Shape's complete decision boundary. Shape must leave Codify no semantic design work.

Codify decides routine scaffold and file placement, adopted house-style libraries, concrete adapter mechanics, MySQL mapping details, message/runtime wiring mechanics, and the smallest sufficient verification implementation when those choices do not alter the accepted tactical design.

## Completion

The Tactical Design is the Implementation handoff. It is `codify_ready` only when every applicable handoff obligation above is resolved and Codify can implement without choosing business facts or semantic design.

Finish with one of:

- `changed`: the design artifact was updated once; name the exact sections.
- `no_change`: the existing design already makes the scoped work codify-ready.
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
