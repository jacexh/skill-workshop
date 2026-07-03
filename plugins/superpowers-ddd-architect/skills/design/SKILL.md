---
name: design
description: Use when designing DDD/backend behavior before implementation from a product-oriented spec, change request, or unclear backend boundary.
---

# Design DDD Model

Use this skill when the backend model is still being decided. The goal is a traceable model decision, not a schema, file list, or framework shape.

## When To Use

- Use before file placement or implementation when subdomain, bounded context, context map, aggregate/policy/service boundary, data authority, or layer ownership is not explicit.
- Do not use as a code audit checklist. Use `review` once a diff, plan, or concrete file set exists.
- Do not use as an implementation placement checklist. Use `implement` after the design direction is accepted.

## Workflow

1. Confirm the work is DDD/backend architecture-sensitive. For non-backend work, stop using this plugin.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for shared risk-card routing. Router probes are calibration aids, not fixed commands.
3. Run Strategic Model Gate before tactical modeling. Record the problem-space decision or stop question before naming Aggregates, ports, handlers, layers, files, or packages.
4. Run Tactical Model Gate only after the strategic model is clear.
5. Follow Product semantics intake, Spec trace, strategic classification, tactical classification, boundary decision, and stop/proceed gate.
6. Use the Minimum Output Contract: keep small changes small, use the full template only when the model changes, and emit stop questions instead of guesses.
7. Do not scan generic `design-patterns/` directories for this plugin. This plugin's shared references live under [../../references/](../../references/).
8. Read deeper references only when this skill, a risk card, or an unresolved decision requires them:
   - [../../references/ddd-modeling.md](../../references/ddd-modeling.md) first for subdomain, bounded context, context map, aggregate, state, and technical-capability classification.
   - [../../references/ddd-core.md](../../references/ddd-core.md) for layer ownership, ports, Domain Events, Integration Messages, and generated protocol boundaries.
   - [../../references/database.md](../../references/database.md) after data authority and aggregate/read-model boundaries are clear.
   - Active language or Go support references only when implementation shape constrains the design.

## Strategic Model Gate

Design starts from problem space before solution model. Before naming code structures, record or ask for:

- subdomain and business capability;
- bounded context and ubiquitous language boundary;
- data authority / source of truth;
- context-map relationship to upstream/downstream collaborators;
- product/operator-visible lifecycle, invariants, and outcomes;
- unknown strategic facts that would change ownership.

If a strategic fact is missing and material, stop before tactical modeling and load `ddd-modeling.md`.

## Tactical Model Gate

After the strategic model is clear, choose the smallest tactical model that explains the behavior:

- Aggregate, Entity, Value Object, Domain Service, policy, or explicit none;
- Commands, queries/read models, Domain Events, Integration Messages, and cross-context contracts;
- consistency, transaction, idempotency, and failure boundaries;
- Application coordination, Repository, ACL, Infrastructure adapter, or exceptional command-side Application port;
- layer ownership only after the semantic owner is known.

Use `ddd-risk-router.md` to route high-risk questions to deeper references. Do not copy the router's risk-card details into the design output.

## Thinking Framework

### 1. Product semantics intake

Extract facts before naming code:

- actors/users;
- subdomain and business capability;
- user actions and system triggers;
- product-visible outcomes;
- business rules and invariants;
- data authority/source of truth;
- state lifecycle;
- external collaborators;
- read/query needs;
- unknowns that would change the model.

### 2. Strategic classification

Classify the problem space before tactical design:

- **Subdomain / business capability:** what problem area the work belongs to.
- **Bounded context:** language and model boundary that owns the behavior.
- **Ubiquitous language:** terms that users/operators and the model must share.
- **Data authority:** source of truth and ownership of state changes.
- **Context-map relationship:** upstream/downstream, ACL, published language, customer/supplier, conformist, shared kernel, or explicit none.
- **External collaborator:** upstream/downstream system, vendor, runtime, storage, or broker.

### 3. Tactical classification

Classify each fact before choosing layers:

- **Command:** asks the system to change state or start a process.
- **Query/read model:** returns product-visible information without changing state.
- **Invariant/rule:** must hold across a state change.
- **State lifecycle:** named states, transitions, admission rules, terminal rules.
- **Domain Event:** same bounded-context fact after a domain change.
- **Integration Message:** cross-context published fact or command-like contract.
- **Technical capability:** runtime/storage/routing behavior that may or may not carry domain semantics.

### 4. Boundary decisions

Make decisions in this order:

1. Subdomain and business capability.
2. Bounded context, ubiquitous language, data authority, and context-map relationship.
3. Aggregate, Value Object, Domain Service, policy, or explicit none.
4. Commands, queries/read models, Domain Events, Integration Messages.
5. Consistency, transaction, idempotency, and failure boundaries.
6. Layer ownership: Domain, Application, Interface, Infrastructure.
7. On-demand references needed for unresolved rules.

### 5. Stop/proceed gate

Stop before implementation when any of these are unknown and material:

- subdomain or business capability;
- owning bounded context;
- ubiquitous language or context-map relationship;
- data authority;
- invariant or state lifecycle;
- aggregate/policy/service ownership;
- cross-context contract;
- command/query/event responsibility;
- technical capability classification.

## Minimum Output Contract

Use the smallest output that preserves the decision.

- **Small change:** emit only Existing model inventory, affected bounded context/capability, the model decision, references loaded, and Proceed/Stop. Use this when the existing strategic and tactical model is clear and the change does not introduce a new context, aggregate, invariant, cross-context contract, or technical capability.
- **Full design:** emit the complete output below. Use this when the request adds or changes bounded context boundaries, aggregate/policy/service ownership, state lifecycle, data authority, command/query/event responsibilities, persistence authority, or cross-context contracts.
- **Stop-only:** if a material modeling fact is missing, emit the unknowns and stop questions instead of filling the full template with guesses.

## Output

```text
DDD design:
- Product semantics intake:
- Spec trace:
- Existing model inventory:
- Strategic model:
  - Subdomain / business capability:
  - Bounded context:
  - Ubiquitous language:
  - Data authority:
  - Context-map relationship:
- Tactical model:
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
- Starting tactical Aggregate/port/layer design before subdomain, context, language, and data authority are clear.
- Treating `ddd-modeling.md` or `ddd-core.md` as the task instead of using them to answer a modeling question.
- Inventing missing invariants or data authority instead of stopping.
- Turning every external mechanism into an Application port.
- Modeling runtime or storage vocabulary as Domain language without product/operator semantics.
