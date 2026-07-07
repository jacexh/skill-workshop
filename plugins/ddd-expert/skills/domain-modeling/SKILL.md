---
name: domain-modeling
description: Use after a product spec or change request exists and before DDD design when user scenarios, event storming, lifecycle rules, authority boundaries, business policies, glossary terms, ADR candidates, or strategic domain decisions need a one-question-at-a-time modeling interview.
---

# Domain Modeling

Run a strategic domain-modeling grilling session.

First inspect existing evidence: spec, `CONTEXT.md`, `CONTEXT-MAP.md`, ADRs, product docs, current designs, code, tests, API/proto contracts, [../../references/ddd-modeling-gates.md](../../references/ddd-modeling-gates.md), and [../../references/ddd-risk-router.md](../../references/ddd-risk-router.md). Do not ask the user to restate facts the system already records.

Talk about user scenarios, event storming, business lifecycle, authority, policies, evidence, and language. Do not start with fields, schemas, event payloads, Entities, Aggregates, Repositories, or implementation objects.

Reconstruct an event-storming timeline before naming tactical objects: command or trigger -> past-tense business facts -> policy or decision -> follow-up reactions. Treat these facts as modeling evidence; only later decide which become Domain Events, Integration Messages, state, read models, process steps, or non-code facts.

Ask exactly one high-fidelity question at a time. Keep each turn short:

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

When shared understanding is reached, write a PRD-shaped Domain Modeling Brief. Use these content dimensions: Problem Statement, Solution / Scenario, User Stories, Strategic Decisions, Model Decisions, Testing Decisions, Out of Scope, Further Notes. User Stories are required and should be a numbered list large enough to cover the actors, major stages, exception paths, and boundary decisions discovered. Keep Strategic Decisions business-level; put tactical DDD only in Further Notes when it is a real handoff. Include compact Model Decisions when lifecycle, ownership, consistency, integration, or model boundaries are material: story/command, event timeline/facts, authority/data owner, lifecycle owner, invariant owner, failure tolerance, collaboration style, and explicit non-aggregate nouns. Omit empty sections; never produce a complete inventory.

Write durable conclusions into the current spec or a sibling domain brief when appropriate. Do not write `docs/superpowers/memory/` directly; emit Memory candidates for later `superpowers-memory:ingest`.
