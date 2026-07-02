---
name: DDD Design Playbook
description: Phase playbook for turning product-oriented backend specs into DDD model decisions before implementation.
---

# DDD Design Playbook

Use this with `ddd-risk-router.md` when the task is still deciding the backend model. The goal is a traceable model decision, not a schema, file list, or framework shape.

## Inputs

- Product spec, user story, API intent, or change request.
- Existing domain terms, bounded contexts, APIs, events, docs, or tests.
- Repo calibration from the risk router.

## Thinking Framework

### 1. Product semantics intake

Extract facts before naming code:

- actors/users;
- business capability;
- user actions and system triggers;
- product-visible outcomes;
- business rules and invariants;
- data authority/source of truth;
- state lifecycle;
- external collaborators;
- read/query needs;
- unknowns that would change the model.

### 2. Semantic classification

Classify each fact before choosing layers:

- **Command:** asks the system to change state or start a process.
- **Query/read model:** returns product-visible information without changing state.
- **Invariant/rule:** must hold across a state change.
- **State lifecycle:** named states, transitions, admission rules, terminal rules.
- **Domain Event:** same bounded-context fact after a domain change.
- **Integration Message:** cross-context published fact or command-like contract.
- **External collaborator:** upstream/downstream system, vendor, runtime, storage, or broker.
- **Technical capability:** runtime/storage/routing behavior that may or may not carry domain semantics.

### 3. Boundary decisions

Make decisions in this order:

1. Bounded context and business capability.
2. Stable language and data authority.
3. Aggregate, Value Object, Domain Service, policy, or explicit none.
4. Commands, queries/read models, Domain Events, Integration Messages.
5. Consistency, transaction, idempotency, and failure boundaries.
6. Layer ownership: Domain, Application, Interface, Infrastructure.
7. On-demand references needed for unresolved rules.

### 4. Stop/proceed gate

Stop before implementation when any of these are unknown and material:

- owning bounded context;
- data authority;
- invariant or state lifecycle;
- aggregate/policy/service ownership;
- cross-context contract;
- command/query/event responsibility;
- technical capability classification.

## Reference Routing

- Read `ddd-modeling.md` for bounded context, aggregate, state, and technical-capability classification decisions.
- Read `ddd-core.md` for layer ownership, ports, Domain Events, Integration Messages, and generated protocol boundaries.
- Read `database.md` only after data authority and aggregate/read-model boundaries are clear.
- Read a language guide only when implementation shape constrains the design.

## Minimum Output Contract

Use the smallest output that preserves the decision.

- **Small change:** emit only Repo calibration, affected bounded context/capability, the model decision, references loaded, and Proceed/Stop. Use this when the existing model is clear and the change does not introduce a new context, aggregate, invariant, cross-context contract, or technical capability.
- **Full design:** emit the complete output below. Use this when the request adds or changes bounded context boundaries, aggregate/policy/service ownership, state lifecycle, data authority, command/query/event responsibilities, persistence authority, or cross-context contracts.
- **Stop-only:** if a material modeling fact is missing, emit the unknowns and stop questions instead of filling the full template with guesses.

## Output

```text
DDD design:
- Product semantics intake:
- Spec trace:
- Repo calibration:
- Semantic classification:
- Bounded context / capability:
- Stable language and data authority:
- Aggregate, policy, or service boundary:
- Commands / queries / events:
- Consistency / transaction / failure boundary:
- Layer ownership:
- References loaded:
- Stop questions:
- Proceed / Stop:
```

## Common Mistakes

- Starting from tables, DTOs, RPC methods, files, or framework packages.
- Treating `ddd-modeling.md` or `ddd-core.md` as the task instead of using them to answer a modeling question.
- Inventing missing invariants or data authority instead of stopping.
- Turning every external mechanism into an Application port.
- Modeling runtime or storage vocabulary as Domain language without product/operator semantics.
