---
name: architecture-design
description: Use when a Bounded Context's contract catalog (Query Repositories, Application Ports, inbound sources, tasks, technical mechanisms) needs deciding, when a change adds a read need or an external dependency, or when Codify raised a Conflict against the catalog.
---

# Architecture Design

Decide one Bounded Context's closed contract catalog: its Query Repositories, Application Ports, Inbound Sources, tasks, and technical mechanisms on seams. Codify adds no contract or task outside the catalog, so each contract is decided here, once, from accepted sources. This is a design review, not an interview. The facilitator derives the complete catalog, the user challenges it, and the facilitator revises it until the user confirms.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts. Read [Architecture writing](../../templates/artifact-layout.md#architecture-writing) for the catalog's sections, granularity, accepted Reasons, and the closed-catalog rule.

```text
read needs, Context Map, domain objects, Policies, delivery constraints
-> catalog derived through five steps
-> missing facts, one per turn
-> self-check
-> design review until confirmed
-> architecture.md and its generated view
```

## Entry

Work on one Bounded Context at a time. Read:

- `context-map.md`;
- the context's `model.md`, and its `domain-objects.md` when it exists;
- any existing `architecture.md`;
- confirmed delivery constraints and relevant project decisions;
- open decisions handed on by earlier steps, from the spec or the conversation;
- a Codify ⚠️ Conflict against the catalog, when one brought you here;
- the context's existing code, as evidence of its current state only.

For House Style, read [ddd-core.md](../../references/ddd-core.md) and the active-language router: [Go](../../references/ddd-golang.md), [Python](../../references/ddd-python.md), or [TypeScript](../../references/ddd-typescript.md).

For a **Codify Conflict**, start from the need, the checked row, and the proposed row or missing fact that the Conflict states, and judge them by the steps below. Add the row when an accepted source supports it, map the need onto an existing row when one covers it, or send an unmodeled fact to the step that owns it. Change the catalog only where the Conflict reaches, then go to [Design review](#design-review).

## Derive the catalog

Derive each section from its sources, in this order. Each step reuses what the earlier steps produced.

1. **Read needs to modeled facts.** Collect the read needs: Business Rules in `model.md` that state a query or a reading, query contracts that `context-map.md` says this context supplies, and delivery constraints that name a read. State each read need with the facts that `model.md` and `domain-objects.md` hold. When a read need needs a fact that neither holds, do not invent a query concept for it; make it a [correction](../../references/workflow.md#progressive-refinement) through the step that owns the fact. An existing read that matches no source is a missing fact: ask whether it is a read need.
2. **Facts to Query Repositories.** Group the read needs by the concept whose facts they return: one Query Repository per Root or per read model this context maintains. A read of data that another authority writes is not a Query Repository; it goes to step 3.
3. **External dependencies to Application Ports.** Collect every authority the context reaches: each Context Map contract it uses or Asynchronous Intent Contract it sends, each external system that a project decision or a Supplied Fact names, its own Published Fact Contracts, and its task queue. Give each authority one Port that covers its capabilities in the authority's published language.
4. **Inbound Sources.** Add one row for each external system outside the Context Map that sends this context input. Context Map subscribers follow from `context-map.md` and are not listed.
5. **Tasks and mechanisms.** Add a task for each Policy failure outcome that needs a durable retry, each deferred or polling step, and each periodic piece of work, one per object it advances. Add a mechanism for each delivery constraint on volume, latency, or availability, and for each Policy failure outcome that needs durable delivery ([ddd-collaboration.md](../../references/ddd-collaboration.md)), on its seam.

Apply the granularity of [Architecture writing](../../templates/artifact-layout.md#architecture-writing) at every step: a second row over one concept, authority, or object needs one of the named Reasons.

Then compare the derived catalog with the existing code. List each existing Query Repository, Application Port, Inbound Source, or task that the catalog does not hold, with the row that absorbs it or the reason it goes away. This consolidation list is handed on through the spec, the issue, or the conversation, and never enters `architecture.md`.

Some facts are missing from the repository and have no House Style or code default. When such a fact would change a row, ask the user before presenting. Ask one question per turn. Decide design choices yourself and show them in the review. When a fact has a default you are not sure of, use the default and list it as an assumption.

Settle each open decision whose evidence the catalog supplies. When the derivation exposes a fact or contradiction that changes `context-map.md`, `model.md`, or `domain-objects.md`, such as a read need without a modeled fact, an adapter that keeps its own lifecycle state that no Root owns, or a Domain Event that no Policy or Published Fact Contract needs, make it a correction before relying on it.

## Self-check

Present the catalog only when all of these hold:

- every read need maps to a Query Repository or an Application Port, using modeled facts only;
- every authority the context reaches has exactly one Application Port, unless a named Reason splits it;
- every concept has at most one Query Repository and every object at most one task, unless a named Reason splits it;
- every row's Reason names an accepted source, and none names existing code, an issue, or design history;
- every delivery constraint on volume, latency, or availability has a mechanism on a seam, or is listed as needing none;
- every Policy failure outcome that needs a durable retry has a task, or an existing task's retry covers it;
- the [Architecture validator](../../scripts/validate-architecture.mjs) passes on the draft with `--artifacts` pointing at the context directory.

## Design review

Write the draft `architecture.md` to a temporary directory outside the repository. Render its view with the [view renderer](../../scripts/render-architecture.mjs), using `--artifacts` for the context directory and `--out` for the temporary page. When the user cannot open local files, serve the page over HTTP and give its URL.

Present the catalog tables themselves, not the page: the page helps the user see the whole context, and the tables are what binds Codify. Beside them, list:

- the consolidation list;
- each row that a named Reason split from another;
- each assumption;
- each open decision this catalog settles, and each one it hands on to Codify with its default.

Treat each user question or challenge as review input. Judge it against the sources and the granularity rules: revise the catalog when the challenge shows a source, a fact, or a rule that the derivation missed; otherwise keep the row, cite its Reason, and leave the decision to the user. Render again after each revision. Review ends when the user confirms the catalog.

## Write

Before writing, read the [artifact layout and write checks](../../templates/artifact-layout.md). Write `docs/ddd-expert/context/<context-slug>/architecture.md` from the [architecture template](../../templates/architecture.md). Regenerate `architecture.html` beside it with the view renderer, then run the Architecture validator without `--artifacts`. If it fails, correct the catalog and run both again; a seam or name that the catalog cannot resolve is a correction to the artifact that owns it.

## Completion

Report the written files, the validator result, the consolidation list, the stated assumptions, and any decision that remains open. Continue to Codify when implementation is in scope. A design-only request ends with the confirmed catalog.
