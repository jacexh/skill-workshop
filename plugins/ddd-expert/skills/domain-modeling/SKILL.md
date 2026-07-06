---
name: domain-modeling
description: Use after a product spec or change request exists and before DDD design when implicit domain objects, existing-model impact, lifecycle rules, invariants, events, repositories, bounded contexts, glossary terms, or ADR candidates need to be made explicit through a one-question-at-a-time modeling interview.
---

# Domain Modeling Interview

Use this skill to turn a spec into explicit domain model decisions. The goal is not to teach DDD concepts; it is to ask high-fidelity questions that force business facts to become model inputs for `design`.

## When To Use

- Use after a brainstorming/product spec exists and before `design` when the spec contains implicit domain objects or unclear model impact.
- Use for incremental requirements that may introduce new Entities, Value Objects, Aggregates, Domain Events, Repositories, policies, or bounded-context changes.
- Use for existing systems when a new requirement may change known terms, lifecycles, invariants, events, repository responsibilities, or ADR decisions.
- If concrete files or diffs already exist and the model is being evaluated, use `review`.
- If the Domain Modeling Brief is already accepted and design details are being produced, use `design`.

## Workflow

1. Read the product spec or change request, plus the smallest available project sources for existing language: `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, design specs, memory query output, and relevant code when available.
2. Read [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md) for shared risk-card routing. Use it to calibrate high-risk topics; do not ask generic risk-card questions verbatim.
3. Internally list candidate implicit domain objects and existing objects that may be affected.
4. Ask exactly one high-fidelity question at a time. Include your recommended answer and the model impact of accepting it.
5. After each user answer, record the result as `Decision`, `Hypothesis`, or `Open question`.
6. Continue until all material implicit objects and existing-model impacts are either decided or explicitly left open.
7. Produce a Domain Modeling Brief for `design`.
8. Write durable conclusions into the current spec's `Domain Modeling` section or a sibling domain brief when asked or when the workflow is writing docs. Do not write `docs/superpowers/memory/` directly; emit Memory candidates for later `superpowers-memory:ingest`.

## High-Fidelity Question Rule

Ask scenario-grounded questions that force domain decisions. Avoid abstract DDD-label questions until the underlying business fact is settled.

A high-fidelity question must:

- be grounded in a concrete spec scenario;
- use the project's domain language, not generic DDD vocabulary;
- distinguish at least two plausible business interpretations;
- affect model shape, boundary, invariant, lifecycle, event, repository, or ADR choice;
- include your recommended answer and the consequence if the user chooses differently.

Avoid low-fidelity questions such as:

- "Is this an Entity?"
- "Do we need a Domain Event?"
- "What Aggregates are there?"
- "Should this have a Repository?"
- "Which bounded context owns this?" without first stating the concrete language or authority conflict.

Better question shape:

```text
When <specific spec scenario> happens, should <domain object A> remain valid,
be superseded, or become impossible to use? I recommend <answer> because
<business reason>. If we choose that, it implies <model impact>.
```

## Modeling Probes

Use these probes to generate high-fidelity questions. Do not ask them as a checklist.

- **Identity:** Does the concept keep identity across changes, retries, versions, or ownership transfers?
- **Lifecycle:** What states can users/operators observe, and which transitions are impossible or terminal?
- **Authority:** Who is allowed to create, confirm, mutate, cancel, publish, or archive it?
- **Invariant:** Which rule must be true in the same consistency boundary, or the business outcome is wrong?
- **Versioning:** Can old versions be selected, referenced, disputed, paid, replayed, or superseded?
- **Evidence:** Which facts must be append-only, auditable, or reconstructable later?
- **Event:** Is there a completed business fact that another workflow must react to?
- **Repository:** Is this a persisted Aggregate boundary, a read model, an external adapter, or just a query?
- **Bounded context:** Is there separate language, authority, lifecycle, or policy that makes a different model necessary?
- **Existing impact:** Which existing terms, invariants, events, repositories, tests, ADRs, or memory entries would become stale?

## Documentation Strategy

Prefer spec-local durable sources before project memory:

- Add a `Domain Modeling` section to the current spec when the model is local to that requirement.
- Use a sibling domain brief when the model is large, crosses multiple specs, or affects multiple bounded contexts.
- Add glossary terms to the project glossary or `CONTEXT.md` only when the term is stable and reused.
- Offer ADR candidates only for decisions that are hard to reverse, surprising without context, and the result of a real trade-off.
- Emit Memory candidates, not direct memory writes. `superpowers-memory:ingest` owns durable KB updates at a maintenance checkpoint.

## Output

```text
Domain Modeling Brief:
- Source spec:
- Existing language and decisions read:
- New domain objects:
  - Name:
  - Classification: Decision | Hypothesis | Open question
  - Business fact:
  - Model impact:
- Existing objects affected:
  - Object:
  - Impact:
  - Required design attention:
- Invariants:
- Lifecycle / state transitions:
- Aggregate candidates:
- Domain event candidates:
- Repository candidates:
- Bounded context impact:
- Decisions:
- Hypotheses:
- Open questions:
- ADR candidates:
- Memory candidates:
- Proceed / Stop:
```

Proceed to `design` only when material domain questions are decided or explicitly marked as acceptable design risks.

