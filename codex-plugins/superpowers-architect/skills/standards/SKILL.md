---
name: standards
description: Use before designing, implementing, refactoring, or reviewing architecture, REST APIs, database schemas, backend services, DDD/Clean Architecture code, frontend React/Next.js code, or browser QA flows. Loads applicable design pattern standards and requires stating applicable, non-applicable, and conflicting patterns.
---

# Apply Project Architecture Standards

Use this skill whenever the task may touch architecture, APIs, databases, backend boundaries, DDD/Clean Architecture, frontend structure, UI implementation patterns, browser QA, refactoring, implementation planning, execution, or code review.

## Workflow

1. Identify the task area: API, database, backend domain model, language-specific DDD, frontend, browser QA, refactor, or code review.
2. Use the injected Project Architecture Standards index if it is present. If it is not present, inspect these directories from highest to lowest priority:
   - `<repo>/docs/design-patterns/`
   - `<repo>/design-patterns/`
   - `$SPA_GLOBAL`
   - `$SP_ARCHITECT_DIR`
   - `~/.claude/superpowers-architect/design-patterns/`
   - `<plugin-root>/design-patterns/`
3. Read the full content of every relevant pattern before planning, editing, or reviewing. The active pattern set is dynamic; do not assume a bundled pattern such as `ddd-modeling.md`, `ddd-core.md`, or `ddd-golang.md` exists unless it appears in the injected index or discovered directories.
4. If `ddd-modeling.md` is present and the task is backend, DDD, service-boundary, technical-capability, Go backend, or refactor work, read it first and follow its own gate/checklist/workflow before reading tactical DDD or language-specific patterns.
5. If `ddd-modeling.md` is absent but other DDD or layered-architecture patterns are present, do not require a missing modeling file. Read the actual applicable patterns and follow their declared prerequisites, gates, and checklists.
6. If the applicable patterns define technical-capability, layer-ownership, API, database, frontend, browser QA, or other domain-specific gates, apply those gates exactly as written. Do not invent DDD-specific requirements for a project that did not provide DDD standards.
7. State which patterns apply and the constraints that affect the work.
8. State which listed patterns do not apply when that helps avoid ambiguity.
9. If the user request conflicts with a pattern, call out the conflict explicitly and choose the smallest compliant approach unless the user overrides it.

## Architecture Gate

For architecture, implementation planning, execution, refactor, or code review work, include this gate before proposing code, applying edits, or approving a design. Use the generic block below **unless** an applicable pattern prescribes a richer block — in that case use the richer block in place of the generic one (do not emit both):

```text
Architecture Gate:
- Applicable standards: <patterns read>
- Required gate/checklist: <from applicable patterns>
- Key constraints: <constraints affecting plan, code, or review>
- Proceed / Stop: <proceed only if the gate is complete and applicable full patterns were read>
```

Stop and gather more context before implementation or approval when any required gate answer is unknown, when the applicable full pattern files have not been read, or when current code conflicts with dependency rules.

When `ddd-modeling.md` is present **and** it defines a richer DDD Architecture Gate, **replace** the generic block above with that richer block. If the active `ddd-modeling.md` is the bundled pattern, this is the full DDD block defined in `ddd-modeling.md §0` (Gate level / Bounded context / business capability / Stable language / data authority / Affected aggregate, policy, or service / Invariants and rules / Technical capability classification / Layer ownership / Proceed-Stop). Do not emit both blocks.

## Technical Capability Checklist

**Apply this checklist only when the active pattern set includes DDD, Clean Architecture, layer-ownership, or another pattern that asks for capability classification. Otherwise skip the entire section.**

When applicable, use the following questions for modules, interfaces, schedulers, registries, dispatchers, connectors, projections, and other technical-facing code:

- Classify the capability before deciding interface ownership. Do not conclude "Application owns a port" merely because Application code calls an Infrastructure implementation.
- Does the module define stable terms used by the product or operators?
- Does it own state transitions, admission rules, naming rules, ownership rules, routing policy, or lifecycle semantics?
- Can its rules be tested without a database, queue, network, generated protocol package, or framework?
- Would duplicating the rule in another adapter create inconsistent behavior?
- If the answers above identify stable language, state transitions, policies, or invariants, name the Domain-facing rule and keep that rule out of Infrastructure. Application may orchestrate it; Infrastructure may only adapt external systems or enforce the already-named rule mechanically.
- Separately check for Infrastructure-shaped contract details: peer addresses, hop headers, queue subjects, retry/backoff settings, storage tables/keys, cache/coordination read models, replica selection, or deployment topology. Classify those portions as Infrastructure unless the Application use case names and observes a stable semantic lifecycle independent of the mechanism.

## Expected Output Discipline

For implementation or planning work, include a short architecture-standards note before the plan or code changes:

```text
Architecture standards:
- Applies: <patterns>
- Constraints: <key constraints>
- Not relevant: <patterns, if useful>
- Conflicts: <none or explicit conflict>
```

For code review work, findings related to standards must cite the relevant pattern and explain the violation or compliance risk.

When the active pattern set includes DDD, Clean Architecture, or another layered-architecture pattern, also review at least these items:

- Import boundaries: Domain has no framework, generated protocol, storage, queue, HTTP, or Infrastructure imports.
- Package/path consistency: package names match the bounded context and layer they claim to represent.
- Technical capability placement: registries, dispatchers, schedulers, routing, ownership, projection, and observability code are classified before being accepted as Infrastructure.
- Interface ownership: Domain owns write repository interfaces and domain services; Application owns use-case orchestration, product/read-use-case query interfaces, semantic ports needed by use cases after capability classification, DTOs, and event handlers; Infrastructure owns adapter selection, peer forwarding, routing directories, transport headers, queue subjects, storage schemas, retry/backoff mechanics, and deployment topology.
- Cross-context boundaries: no direct imports or calls into another context's Domain or Application layer.

For pattern sets that do not include any layered-architecture pattern, drive the review from whatever gates / checklists the active patterns themselves define and skip the layered-architecture items above.
