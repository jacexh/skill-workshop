---
name: standards
description: Use when explicitly requested for general architecture standards, REST APIs, frontend React/Next.js structure, browser QA flows, or project-provided non-DDD standards. For DDD/backend architecture work, use superpowers-ddd-architect design, implement, or review instead.
---

# Apply Project Architecture Standards

Use this explicit-only legacy skill when the user asks for general architecture standards, REST/API conventions, frontend structure, UI implementation patterns, browser QA, refactoring, implementation planning, execution, or code review.

For DDD/backend architecture work, prefer the phase-specific `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, or `$superpowers-ddd-architect:review` skill. This legacy skill no longer bundles DDD/backend pattern files.

## Workflow

1. Identify the task area: API, database, frontend, browser QA, general architecture, refactor, or code review.
2. If the task is DDD/backend architecture, Go backend layering, bounded contexts, ports, Domain Events, Integration Messages, taskqueue/runtime boundaries, or database-backed backend persistence, stop using this skill and use `$superpowers-ddd-architect:design`, `$superpowers-ddd-architect:implement`, or `$superpowers-ddd-architect:review` unless the user explicitly asks for legacy general architect standards.
3. Use the injected Architect Standards index if it is present. If it is not present, inspect these directories from highest to lowest priority:
   - `<repo>/docs/design-patterns/`
   - `$SPA_GLOBAL`
   - `<plugin-root>/design-patterns/`
4. Read the full content of every relevant non-DDD/general pattern before planning, editing, or reviewing. The active pattern set is dynamic; do not assume a bundled pattern exists unless it appears in the injected index or discovered directories.
5. If a project-provided DDD pattern appears in this legacy pattern set and the user explicitly asked to use it, state that `superpowers-ddd-architect` is the canonical DDD/backend path before applying the project pattern.
6. If the applicable patterns define API, frontend, browser QA, database, or other domain-specific gates, apply those gates exactly as written. Do not invent DDD-specific requirements for a project that did not provide DDD standards.
7. State which patterns apply and the constraints that affect the work.
8. State which listed patterns do not apply when that helps avoid ambiguity.
9. If the user request conflicts with a pattern, call out the conflict explicitly and choose the smallest compliant approach unless the user overrides it.

## Architecture Gate

For architecture, implementation planning, execution, refactor, or code review work, include this gate before proposing code, applying edits, or approving a design. Use the generic block below unless an applicable pattern prescribes a richer block; in that case use the richer block in place of the generic one and do not emit both.

```text
Architecture Gate:
- Applicable standards: <patterns read>
- Required gate/checklist: <from applicable patterns>
- Key constraints: <constraints affecting plan, code, or review>
- Proceed / Stop: <proceed only if the gate is complete and applicable full patterns were read>
```

Stop and gather more context before implementation or approval when any required gate answer is unknown, when the applicable full pattern files have not been read, or when current code conflicts with dependency rules.

When a project-provided pattern defines a richer gate, replace the generic block above with that richer block. Do not emit both blocks.

## Technical Capability Checklist

Apply this checklist only when the active pattern set includes DDD, Clean Architecture, layer-ownership, or another pattern that asks for capability classification. Otherwise skip the entire section.

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
