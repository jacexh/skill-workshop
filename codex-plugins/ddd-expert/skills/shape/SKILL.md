---
name: shape
description: Use when Tactical Design must be created from accepted backend domain facts or an existing Tactical Design needs pre-code evaluation.
---

# Shape

Turn the accepted DDD model into the smallest `codify_ready` Tactical Design. Shape owns tactical choices; it does not rediscover business facts or choose routine physical implementation mechanics.

## Tactical Design artifact

Shape is the exclusive semantic authorizer of Design changes. It never writes DDD artifacts directly and never authorizes a root README, Context Map, or Model change. Before artifact work, load this plugin's internal `maintain-artifacts` skill and execute its `inspect` or `apply-design` operation in the same run with authority `shape`.

The design describes the current accepted target state, not a feature narrative, change log, ADR summary, task plan, or implementation report. Include only material DDD design:

- a compact `Model Realization` from each material accepted Model obligation to its tactical owner or mechanism and the section that defines it; this is a trial implementation trace, not a story inventory;
- Aggregate boundaries, invariant ownership, identity, ownership, external references, Domain objects, behavior, lifecycle, Domain Events, concurrency, failure, and the evidence for the boundary;
- Domain Policies or Domain Services and durable Process Managers only when the accepted behavior requires them;
- cross-Aggregate coordination and Context Dependencies and Contracts only where boundaries actually collaborate; and
- technical constraints and verification obligations only where they determine correctness, consistency, ordering, idempotency, durability, recovery, or contract semantics.

Omit an optional Design section when its tactical mechanism is not retained. Do not create an Entity, Domain Service, Process Manager, collaboration, technical-constraint, or verification section solely to say that none exists; record a material absence beside the Aggregate or contract decision it clarifies.

Define every retained Entity and Value Object in Domain language. For each Entity, state its identity, owner, and independent lifecycle; for each Value Object, state its domain meaning, accepted construction or validity rule (or that the Model defines no additional rule), and equality semantics without inventing a business constraint. A database or language House Style never authorizes a Domain identifier format, normalization, or validity rule; when the accepted Model defines none, say so and leave the physical representation to Codify. Classify retained event semantics as local Domain Events or cross-context Integration Messages. Execution observations remain execution mechanics; record their correctness guarantees beside the Aggregate, Process Manager, or contract they protect rather than creating a Runtime Event category.

Scheduled, asynchronous, and recovery work has two ownership roles. The semantic owner decides what work is due, interprets facts, and chooses business outcomes. When execution guarantees are design-significant, state the execution owner beside that responsibility for delivery, concurrency, retry, and lifecycle. One component may hold both roles when accepted authority permits it.

Record a technical mechanism only when replacing it would change an accepted design guarantee. Leave schemas, DTO fields, file lists, package inventories, payload layouts, routine Repository flow, framework wiring, and implementation steps to Codify unless the detail itself is a material accepted decision.

## Workflow

1. **Read accepted inputs**: run the read-only artifact operation, then start from the root README, Context Map, exact Model sections and revisions for every affected context, their existing Tactical Designs, and the scoped request. A missing Design is a valid input for its first Shape; stale or topology-pending Designs require revalidation. Shape may proceed only from a structurally valid acyclic Context Map. An `invalid_layout` caused by an Explore-owned Context Map or Model returns to `explore` and forbids `apply-design`. Treat code and tests as current-state evidence, not authority over accepted Model facts.
2. **Check phase fit**: when a material scenario, authority, business lifecycle, invariant, failure tolerance, business term, or bounded-context fact is missing or contradictory, return to `explore` with the single highest-leverage missing fact. Tactical alternatives supported by complete accepted facts remain in Shape.
3. **Replay with Software Design EventStorming**: for every material accepted scenario, walk `actor or trigger -> intent or command -> Aggregate decision -> Domain Event or established fact -> policy or Process Manager -> next intent -> business outcome`. Include failure, duplicate, concurrent, cancellation, and recovery paths when they change the design. Keep the board, sticky-note inventory, and hot-spot working notes temporary; persist only accepted stable design conclusions.
4. **Shape and challenge the target state**: assign decisions and invariants to the smallest sound Aggregate boundaries. For every new or materially changed non-trivial Aggregate, state the boundary thesis and test the closest credible split or merge alternative against a concrete invariant, concurrency, or failure scenario. Do not manufacture an alternative where none is credible. Treat a use case that appears to require atomic writes across Aggregate Roots as a boundary alarm that must be resolved through the consensus gate before writing.
5. **Resolve lifecycle and collaboration**: realize accepted Domain lifecycles without inventing business states, authority, or guards. Keep Domain and Process Manager lifecycles separate from execution mechanics. Use a transition table when the accepted lifecycle has material discrete transitions; use a fact timeline, lineage, derivation rule, or another clearer representation when it does not. Classify policies, Domain Services, Process Managers, Domain Events, Integration Messages, and context contracts from their semantics rather than their implementation mechanism.
6. **Reach design consensus**: expose every material tactical conclusion and its evidence before artifact writing. When a credible alternative remains, ask exactly one focused design question and end the turn; do not create section-by-section checkpoints. Do not collapse multiple unaccepted tactical choices into a first-turn integrated proposal: if the Aggregate boundary is the active decision, include only the Domain-object classification and invariant, concurrency, or failure evidence needed to choose that boundary, and defer lifecycle representation, event classification, collaboration, persistence, and verification conclusions until the boundary closes. Spell out the accepted invariant propositions and the relevant concurrent or failure path; labels such as "capacity invariant" or "lifecycle integrity" are not reviewable evidence. When the proposal classifies an owned Domain object or assigns an Aggregate boundary, include every accepted Model invariant whose owner or consistency boundary that decision would settle; do not use one invariant to leave another accepted rule silently unassigned. A request to generate the whole Design does not accept those choices. After local choices close through the conversation, replay the complete scenario set, present one integrated proposal, and wait for explicit user acceptance. A high-level direction is not integrated acceptance. Calling a proposal "complete" does not fill an omitted Aggregate, lifecycle, coordination, contract, or design-significant correctness choice; compare its actual content with every applicable design obligation before accepting the label. A proposal explicitly accepted earlier in the current conversation, or an unchanged existing Tactical Design already recorded as accepted authority, satisfies this gate only when that coverage is complete.
7. **Apply once**: after integrated acceptance, run `apply-design` through `maintain-artifacts` with context names/slugs, exact current Model revisions, each Design's observed pre-state, exact terminal content for every changed section, explicit removals, and consensus evidence. The terminal content may contain no tactical decision first introduced during writing. Apply every affected Design in one transaction. Correct an invalid operation input internally. On `revision_conflict`, re-inspect and rebuild the transaction once; if the pre-state changes again, return `blocked` with the concurrent-change evidence. Never bypass the protocol with a direct write.

## Consensus gate

Keep project files unchanged while a tactical choice or integrated proposal awaits acceptance. A question presents the accepted evidence, the recommended design, the closest credible alternative, their consequences, and the one user-owned decision. Acceptance applies to the integrated design, not to a draft document.

## Decision boundary

The applicable handoff obligations under Tactical Design artifact are Shape's complete decision boundary. Shape must leave Codify no business fact, Aggregate boundary, lifecycle, coordination, contract, or correctness mechanism to choose.

Codify decides routine scaffold and file placement, adopted house-style libraries, concrete adapter mechanics, physical MySQL mapping, message/runtime wiring mechanics, and the smallest sufficient verification implementation when those choices do not alter the accepted Tactical Design.

## Completion

The Tactical Design is the Implementation handoff. It is `codify_ready` only when every material Model obligation is accounted for, every applicable design obligation above is accepted, every affected Design references its exact current Model revision, and Codify can implement without choosing business facts or semantic design.

Finish with one of:

- `changed`: the design artifact was updated once; name the exact sections.
- `no_change`: the existing design already makes the scoped work codify-ready and its model revision link already matches.
- `needs_clarification`: ask the single active tactical question or request integrated acceptance and stop without writing.
- `returned`: identify `explore`, the missing business fact, and the evidence exposing the gap.
- `blocked`: an external constraint prevents reading or writing the artifact.

Keep the final response short. Do not produce a separate agent-to-agent handoff report.

## References

- Load references only after phase fit succeeds, and only for the touched design surface.
- Use [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for Software Design EventStorming, lifecycle evidence, fact sufficiency, and Aggregate-boundary challenges. Return to `explore` when accepted facts do not support the design.
- Use [../../references/ddd-core.md](../../references/ddd-core.md) for Aggregate, Entity, Value Object, Domain Service, Repository, and tactical ownership semantics.
- Use [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) for Domain Event and Integration Message classification, Process Managers, event timing, recovery, or cross-context collaboration.
- Use a language House Style only when implementation placement or capability constrains a tactical decision.
- For Go, start with [../../references/ddd-golang.md](../../references/ddd-golang.md) and follow only the layer, flow, or platform leaf that owns the constraint.
- For Python or TypeScript, load only the relevant section of the compact [../../references/ddd-python.md](../../references/ddd-python.md) or [../../references/ddd-typescript.md](../../references/ddd-typescript.md) guide.
- Load [../../references/database.md](../../references/database.md) only when persistence capabilities constrain an accepted consistency or transaction boundary. Physical schema, migration, index, and SQL mechanics belong to `codify`.
