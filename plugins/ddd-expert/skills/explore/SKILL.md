---
name: explore
description: Use when product discovery, PRD/spec writing, feature scoping, backlog refinement, story mapping, or change-request intake needs backend domain clarification before architecture planning or ticket breakdown. Helps turn product requests, user workflows, and business rules into clear domain language, lifecycle, ownership, policies, and model decisions.
---

# Explore

## Workflow

Run a one-question-at-a-time strategic domain-modeling workflow. Start from PRD/spec/change-request evidence and end by updating the project's existing documentation surfaces, not by producing a standalone modeling report.

First inspect existing project evidence: the target PRD/spec/change request, glossary or terminology docs, `CONTEXT.md`, `CONTEXT-MAP.md`, domain docs, ADRs, product docs, current designs, code, tests, and API/proto contracts. Do not ask the user to restate facts the system already records.

Use DDD discovery methods to extract only confirmed model changes that matter for this request: glossary terms, domain concepts, business lifecycle, business rules, policies, authority, ownership, boundaries, and context relationships. Domain concepts are business-language concepts, not tactical classifications.

Talk about user scenarios, event storming, Core Domain focus, Bounded Contexts, Context Map relationships, business lifecycle, authority, policies, evidence, and language. Do not start with fields, schemas, event payloads, Entities, Aggregates, Repositories, or implementation objects. Do not decide Aggregate, Entity, Value Object, Repository, table, DTO, API, handler, or file placement in this phase.

Reconstruct an event-storming timeline before naming tactical objects: command or trigger -> past-tense business facts -> policy or decision -> follow-up reactions. Treat these facts as modeling evidence; only later decide which become Domain Events, Integration Messages, state, read models, process steps, or non-code facts.

## Clarification loop

If a critical model fact is missing, contradictory, or only a guess, do not write partial output or a gap list. Ask exactly one high-fidelity question at a time. Keep each turn short:

```text
Evidence: <one sentence>
Hotspot: <one sentence>
Recommendation: <one sentence>
Question: <one question>
```

Do not turn every answer into a conclusion. Ask a short chain of designed questions around one strategic hotspot, then synthesize.

Avoid low-fidelity questions:

- "What fields does this have?"
- "Is this an Entity?"
- "Do we need a Domain Event?"
- "What Aggregates are there?"
- "Should this have a Repository?"
- "What should the event payload contain?"

## Documentation output

When the critical facts are clear, write confirmed domain model changes to the project docs:

- Glossary / ubiquitous language: update the existing glossary, terminology section, `CONTEXT.md`, or equivalent source of truth.
- Boundaries / ownership / context relationships: update the existing context map, domain boundary doc, architecture/domain doc, or equivalent source of truth.
- Domain concepts, lifecycle, rules, policies, and authority: update the relevant PRD/spec section or a dedicated domain doc if one already exists.
- If no dedicated carrier exists, append a concise `Domain Model` section to the current PRD/spec. Include only model facts that changed, were clarified, or are required before `shape` can design safely.
- Add a Mermaid or text diagram only when it clarifies a flow, lifecycle, boundary, or rule better than prose. Do not add class diagrams, ERDs, component diagrams, deployment diagrams, API call graphs, schemas, or DTO shapes.

Do not duplicate content that the PRD/spec already states clearly. Do not produce a complete model inventory. If a plausible concept is material but unconfirmed, ask about it instead of writing it as a candidate. If the workspace is read-only or the target document cannot be identified, return patch-ready content with the intended destination.

Final response: list the files updated and summarize the confirmed model changes in one or two bullets. Do not paste the full model unless the user asks. If no documentation change is needed, say `No domain model changes needed` and name the evidence that made it safe.

## References

After project evidence exposes a strategic hotspot, load only the modeling guidance needed to resolve it: [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md) for authority, lifecycle, invariant, failure-tolerance, language, or coordination gates; and [../../references/ddd-modeling.md](../../references/ddd-modeling.md) for bounded-context, aggregate-candidate, or capability-classification depth. Do not load implementation, language, runtime, or database references during `explore`.
