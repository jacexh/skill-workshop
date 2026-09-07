---
name: event-storming
description: Discover or challenge backend Bounded Contexts and Aggregate Roots, or record an already-confirmed strategic model.
---

# Event Storming

Discover the smallest strategic model that explains the business. The user owns domain decisions; the facilitator supplies repository evidence, counterexamples, and a recommended answer for each design fork.

Read the [workflow contract](../../references/workflow.md) for scope, existing authorization, and instruction conflicts.

```text
business purpose
-> causal discussion
-> Bounded Contexts and Aggregate Roots
-> integrated confirmation
-> current strategic artifacts
```

## Start with the user

Infer the requested outcome when it is explicit. Otherwise ask what the user wants to understand or decide before evaluating the model.

Choose the shortest useful entry:

- **discovery** builds a model from a story or scenario;
- **thesis review** tests an existing proposed model at its weakest assumption;
- **model challenge** revisits a strategic conclusion contradicted by later concrete evidence.
- **recording** writes a complete already-confirmed strategic model using the artifact steps below.

An explanation request remains an explanation request. A local change inside an accepted model does not require repository-wide discovery.

## Discovery and challenge

For discovery, thesis review, or model challenge, read the
[discussion method](../../references/event-storming-discovery.md). It owns the
conversation contract, working board, all ten causal steps, and strategic
rule selection. Reuse established evidence and focus on the affected boundary.

For **recording**, use the accepted integrated proposal and proceed directly to
the artifact steps below. Read affected current artifacts to preserve unrelated
meaning. Ask only if missing or contradictory business meaning prevents an
accurate write; formatting differences are resolved through the templates.

## Current strategic artifacts

Persist only accepted current knowledge:

- `docs/ddd-expert/context-map.md` owns the Bounded Context inventory and semantic dependencies.
- `docs/ddd-expert/context/<context-slug>/model.md` owns one context's purpose, essential language, Aggregate Roots, and strategic business rules.

`model.md` remains strategic. Tactical Design records object definition, Facts, Lifecycle State, behavior, Domain-owned Ports where present, and actual Domain Events in `domain-objects.md`; conversational working state remains transient.

## Confirmation and writing

Present one compact integrated proposal:

- scope and exclusions;
- Bounded Contexts and their purpose;
- Aggregate Roots and their consistency boundary;
- strategic business rules;
- semantic dependencies and named contracts;
- remaining non-blocking uncertainty.

Reuse an already-confirmed integrated proposal. Otherwise obtain its confirmation under the workflow contract before writing.

Before writing, read the [artifact layout and write checks](../../templates/artifact-layout.md), [Context Map template](../../templates/context-map.md), and [Model template](../../templates/model.md). Update only accepted current meaning that changed. Validate each changed Context Map with the linked script and verify affected Model links before declaring the write complete.

Then classify the next step:

- use Tactical Design when Aggregate internals or domain-object behavior still needs a decision;
- use Codify when the accepted `domain-objects.md` already covers the change;
- stop when the user requested design only.

## Completion

End with the strategic result, supporting evidence, changed artifacts, and write-check results. If a material decision remains, ask the decisive question with the current proposal. Continue to Tactical Design or Codify only when that work is in scope.
