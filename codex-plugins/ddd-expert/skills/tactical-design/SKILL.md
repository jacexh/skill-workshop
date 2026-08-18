---
name: tactical-design
description: Use when a confirmed EventStorming Model leaves a material Design Delta in domain-object responsibility, collaboration, state authority, transaction, concurrency, event, failure, recovery, or durable software-boundary ownership that must be challenged and reconciled before Guard.
---

# Tactical Design

Turn confirmed business meaning into the smallest credible system thesis, test it against alternatives and implementation evidence, and leave one reconciled collaboration design. Tactical Design may falsify structural hypotheses; only EventStorming may confirm changed business meaning.

Use this skill only for a real **Design Delta**. A delta exists when the requested realization creates or changes domain-object responsibility, collaboration among Aggregates or contexts, runtime or durable state authority, transaction or concurrency ownership, event timing, business-visible failure policy, semantic ports, or another durable software boundary. Several files or domain objects alone are not a delta.

Do not load `maintain-artifacts` while clarifying purpose, building the thesis, or challenging it. Read existing artifacts as evidence. Load the internal skill in full only when a coherent candidate needs structural validation or a write, or when an actual artifact-status ambiguity blocks authority resolution. It owns mechanics, never design judgment.

## Authority

Keep unlike conclusions unlike:

1. Canonical Models and scoped `ready` EventStorming minutes own confirmed business facts, constraints, permissions, and required outcomes.
2. Their Bounded Context, Aggregate, capability, and core-object decomposition is the current falsifiable strategic model of those facts.
3. Accepted Specs, PRDs, ADRs, project constraints, and current BC Architecture own the decisions they explicitly record.
4. A Tactical Design `draft` is an implementation candidate. A scoped `ready` Tactical Design owns the reconciled Design Delta.
5. House Style realizes an already selected design; it does not select a lifecycle, state authority, business sequence, or domain concept.
6. Code and tests are evidence. They may falsify a structural candidate but never silently become business authority.

Route a missing or contradictory business fact, rule, Bounded Context, Aggregate, capability, core-object decomposition, lifecycle meaning, or context boundary to EventStorming as one consolidated **Model Challenge**. Keep a tactical alternative here only when it preserves both the confirmed business facts and the current strategic structure. Route a hard-to-reverse platform, public-contract, data, security, or operational commitment to the project's decision mechanism.

## Sparse artifacts

- Each Bounded Context `model.md` owns current business meaning and its current structural hypothesis.
- One `docs/ddd-expert/tactical-design/<slug>.md` owns the current candidate for this Design Delta.
- Optional `context/<context-slug>/architecture.md` files own only durable BC-specific software decisions that survive the iteration.
- ADRs own hard-to-reverse decisions and rationale. Code owns reversible implementation detail.

Do not create a root Architecture file, a second mapping ledger, or one Tactical Design record per Model or conversation. An implemented record is history; current BC Architecture carries any surviving decisions.

## Design workflow

### 1. Pin the question

Name the implementation slice, governing business facts and constraints, current structural hypotheses, accepted project decisions, and the exact Design Delta. Also identify the entry mode:

- **user thesis**: restate the user's proposed object responsibilities and call direction, then look for the strongest fact or counterexample that could overturn it;
- **agent proposal**: state the evidence and uncertainty, construct the smallest candidate, then attack it before asking the user to accept it.

Ask the user what they want the review to accomplish when that purpose is not already explicit. Do not run a compliance audit when they want an explanation, comparison, or design challenge.

### 2. Build the domain-object thesis

Before layer or provider sequences, describe the affected Aggregate internals at domain-object level:

- a Mermaid `classDiagram` showing Aggregate Roots, owned Entities and Value Objects, and meaningful relationships/cardinality;
- for each object: identity and lifecycle, owned facts/state, rules and change reasons, semantic result, and why it belongs inside or outside the Aggregate;
- the Root's composition responsibility rather than an assumption that the Root must contain every behavior.

This is a candidate realization of the confirmed business facts, not a new business fact. If the current Model cannot support it, open a Model Challenge rather than inventing meaning.

### 3. Make authority and flow explicit

Record only the state and collaboration that determine the design:

- **state authority**: for each material mutable fact, name its business owner, live runtime authority, optional durable checkpoint or external authority, and what remains valid after failure;
- **semantic flow**: name the producer, minimal domain result, consumer, business sequencer, and technical executor;
- **call ownership**: Domain owns when a business capability is required and owns any Domain-language collaborator contract it invokes. Application supplies use-case context, transactions, and implementations of inner contracts; it owns an outbound port only when it owns the use-case continuation. Infrastructure performs provider, database, protocol, and retry mechanics.

Do not infer `Repository.Get -> Root -> Repository.Save`, resident state, event publication, rollback, or asynchronous coordination from House Style. Select those only when project authority and the thesis require them.

### 4. Apply the necessity test

For every proposed participant, state, event, checkpoint, transaction, coordinator, or recovery mechanism, answer:

> Which confirmed responsibility or guarantee becomes impossible if this is removed?

Delete the concept when there is no concrete answer. Prefer a normal semantic flow that explains the system over a catalogue of defensive mechanisms. Add an adverse path only when it changes a business right, obligation, value, required next action, responsibility, guarantee, durable state, or externally visible result. Provider errors that do not do so remain implementation and verification concerns.

If two or more corrections point to the same responsibility or state-authority mistake, or mechanisms grow while business scenarios do not, stop local patching. Rebuild the smallest whole thesis from supported facts and require every old concept to earn its way back.

### 5. Challenge before persisting

Compare the thesis with one credible alternative, including deletion or a different object split. Explain the decisive trade-off and ask one high-impact frontier question when one remains. Stop when further questions have diminishing decision value.

Do not write a complete solution artifact before the first design question. Keep early reasoning in conversation so an untested draft does not become an anchor. If the user supplied the thesis, challenge it rather than merely confirming it. If the agent supplied it, show uncertainty and the strongest objection rather than asking the user to validate unexplained output.

Return `no_design_change` with zero artifact writes when established seams cover the work. Otherwise continue only after the object thesis, state authority, semantic flow, and necessity test are coherent.

### 6. Derive critical sequences

Draw the fewest Mermaid `sequenceDiagram` views needed to make the Design Delta checkable. Derive participants and calls from the object thesis; do not use a template topology as the answer.

Group technical objects by owning Bounded Context. Keep business Roles, external authorities, and unowned external systems outside those boxes. Label calls `Public Method: <receiver operation>(<semantic inputs>)` and replies `Returns: <semantic result>`. Preserve adjacent traceability to accepted Commands, Capabilities, Domain Events, Published Fact Contracts, Integration Messages, or explicit coordination without multiplying operations by pre-state.

Show the normal path first. Add a separate or `alt` path only under the materiality rule in step 4. Make transaction, state, concurrency, event publication, and visible outcome ownership explicit where they are part of the delta.

### 7. Materialize an exploration draft

After the candidate is coherent, validate and write one exploration `draft` plus its README entry. Include the scope, object thesis, state authority, semantic flow, necessity proof, material sequences, changed ownership, non-goals, discretion, and challenged alternative. Do not add final `TD-NNN` claims or BC Architecture dispositions yet; they would turn an untested candidate into a conformance target. Cite the path and fingerprint. Existing Models, BC Architecture, and project decisions remain unchanged.

Codify may now perform reversible implementation exploration against the draft when the user has authorized implementation and the confirmed business boundary is explicit. It must preserve business facts, record design evidence and semantic deviations, and avoid irreversible external actions. It cannot hand off to Guard while the Tactical Design remains `draft`.

If the user requested design only, stop with this draft. Without implementation evidence it does not become `ready`.

### 8. Reconcile implementation evidence

Review the implemented normal flow, deleted or introduced concepts, state authority, and any deviation from the draft:

- a business contradiction becomes one Model Challenge to EventStorming;
- a smaller or different collaboration that preserves the facts and current strategic structure revises this same draft;
- unsupported mechanisms are deleted, not retained under a new name;
- unchanged conclusions are preserved only after the whole thesis still explains them.

Rewrite the draft once per connected revision batch, not after every question. Then replay the class diagram, state authority, semantic flow, material sequences, non-goals, and Codify discretion as one current whole. Only now extract a small set of independently falsifiable `TD-NNN` claims about the reconciled semantic ownership, boundaries, ordering, or atomicity. Account for each exactly once as a durable BC Architecture projection or `iteration-only` with a concrete reason.

The same reconciliation rule applies when later concrete implementation evidence falsifies a candidate while its ready EventStorming facts and strategic model remain unchanged. If the candidate is still `draft` and the whole Design Delta disappears, discard it instead of preserving a cancelled mechanism. Never edit an unimplemented `ready` record: with explicit confirmation of the evidence-backed revision, replace it atomically with a new reconciled ready record when a material delta remains, or retire it directly when the current EventStorming authority is sufficient without that delta. Direct retirement points `superseded_by` to that surviving ready EventStorming record; this denotes the remaining authority, not a change to its business facts. Either ready path replaces or removes every BC Architecture source from the stale claims in the same consistency write. An `implemented` record remains provenance and is never reopened.

### 9. Confirm and hand off

Request explicit confirmation of the reconciled draft path and fingerprint. Apply the exact `draft -> ready` transition, README state, complete claim disposition, required BC Architecture projection, and ADR closure as one consistency set. Tactical Design never changes a canonical Model.

Codify then produces the final verified implementation checkpoint against this reconciled authority. Guard reviews the final code and `ready` design. An unreconciled tactical difference that preserves confirmed facts and current strategic structure is an `evidence_gap` routed here; evidence against Model-owned structure routes to EventStorming instead.

## Completion

Finish with one of:

- `no_design_change`: established seams cover the work and no draft or invalidated ready record remains;
- `reviewing`: cite the current thesis or draft and ask the single highest-impact frontier question;
- `draft`: the design-only candidate is coherent but has no implementation evidence and remains non-authoritative;
- `exploring`: cite the exact draft and authorized reversible implementation boundary;
- `awaiting_confirmation`: implementation evidence is reconciled and the exact draft whole awaits confirmation;
- `ready`: cite the confirmed record, claim dispositions, BC Architecture changes, and Codify handoff;
- `discarded` or `superseded`: cite the retired candidate, the surviving or replacement authority, and the evidence that invalidated it;
- `model_challenge`: cite the consolidated contradiction and route to EventStorming;
- `blocked`: identify the exact authority, validation, write, or external failure and current filesystem state.

## References

- Load [../../references/ddd-modeling.md](../../references/ddd-modeling.md) only when the strategic model may be missing business evidence.
- Load [../../references/ddd-core.md](../../references/ddd-core.md) for responsibility, state authority, business sequencing, and realization seams.
- Load [../../references/ddd-collaboration.md](../../references/ddd-collaboration.md) only when selected cross-context collaboration is affected.
