# ADR 0008: Design Artifacts Are Falsifiable Candidates

- Status: Accepted
- Date: 2026-08-18
- Refines: authority and lifecycle in [ADR 0005](0005-event-storming-minutes-and-current-models.md) and [ADR 0007](0007-conditional-tactical-design-and-claims.md)

## Context

The workflow treated several unlike conclusions as if they had the same authority. Confirmed business facts, a proposed Aggregate decomposition, and a technical collaboration sequence could all become downstream conformance targets. Once an early structural choice was wrong, Codify and Guard made it increasingly complete instead of using implementation evidence to expose the mistake.

More instructions did not solve this. Exhaustive path requirements, a prewritten Tactical Design draft, and templates that depicted one request-scoped `Get -> Root -> Save` topology anchored the model before its object responsibilities and runtime state authority were understood. The resulting artifacts increased the cost of reframing and displaced the design question with artifact completion.

## Decision

The workflow distinguishes three kinds of conclusion:

1. **Confirmed business facts and constraints** are binding until explicit evidence reopens EventStorming.
2. **Strategic structure**—Bounded Context, Aggregate, capability, and core-object decomposition—is the current falsifiable model of those facts. A `ready` EventStorming record means reviewed and usable, not proven or immune to later counterexamples.
3. **Tactical structure**—object collaboration, state authority, interfaces, checkpoints, transactions, and failure handling—is an implementation candidate. It remains `draft` while reversible implementation work tests it and becomes `ready` only after the candidate is reconciled with that evidence and confirmed as a whole.

Artifacts are checkpoints for shared reasoning, not instructions to preserve a discarded idea. Code and tests never silently become domain authority, but concrete implementation evidence may falsify a structural hypothesis. A contradiction in business meaning or the current Bounded Context, Aggregate, capability, or core-object strategic structure routes to EventStorming. A smaller collaboration or lifecycle routes to Tactical Design reconciliation only when it preserves both confirmed business facts and that strategic structure. Neither Codify nor Guard may silently accept drift.

Tactical Design starts with the smallest explanatory system thesis: the affected domain objects and relationships, their responsibilities and lifecycles, runtime and durable state authority, semantic result flow, and business-versus-technical call ownership. It challenges the user's thesis when one is supplied, or challenges its own candidate before presenting it. It persists a draft only after that conversational candidate is coherent. Typed sequences are derived from the thesis and cover only paths that change responsibility, guarantee, durable state, or visible business outcome.

Codify may consume a scoped Tactical Design `draft` for reversible exploration when the business facts and exploration boundary are explicit. The exploration draft deliberately omits final claims and Architecture dispositions so an untested candidate does not become a conformance target. Codify records supported deviations and obsolete mechanisms in the Review Handoff, updates no DDD authority, and cannot request Guard or claim iteration completion until Tactical Design reconciles concrete implementation evidence and transitions the exact final record to `ready`. A design-only candidate remains `draft`. Guard reviews the reconciled authority; an unreconciled tactical difference that preserves current strategic structure is an evidence gap routed to Tactical Design, while a strategic contradiction routes to EventStorming.

Reconciliation can also invalidate a Tactical Design without changing the EventStorming Model. When evidence eliminates an unconfirmed draft, remove it and its navigation entry. Never edit an unimplemented `ready` record: after explicit confirmation, atomically replace it with a new reconciled ready record when a material delta remains, or retire it with `superseded_by` pointing to the surviving ready EventStorming authority when no extra tactical authority remains. The same write removes or reprojects every stale BC Architecture claim. An implemented record remains immutable provenance.

House Style owns realization rules only. It may describe conditional implementation branches after the project or Tactical Design has selected a lifecycle or collaboration shape. It does not choose request-scoped versus resident state, business sequencing, failure policy, Aggregate boundaries, or domain concepts. Generic references therefore avoid turning one conditional Repository lifecycle into a universal modeling recommendation.

The existing status vocabulary remains sufficient:

```text
EventStorming ready business facts + current falsifiable strategic model
    -> Tactical Design draft candidate
    -> reversible Codify exploration
    -> Tactical Design reconciliation and confirmation
    -> Tactical Design ready
    -> Codify verified checkpoint
    -> Guard
    -> implemented
```

No new permanent artifact, architecture ledger, or system-design skill is introduced.

## Consequences

- Early artifacts can be replaced when evidence changes the system thesis; downstream fidelity is no longer mistaken for design quality.
- Tactical Design spends attention on object responsibility, state authority, and necessity before mechanisms and exhaustive paths.
- Codify gains bounded falsification power without gaining silent model-write authority.
- Guard remains a realization reviewer and judges the reconciled design rather than an obsolete first draft.
- House Style becomes smaller and more conditional, leaving scenario-specific modeling to project authority.
- Behavioral evaluation may test question and deletion quality without prescribing one architecture name or keyword answer.

## Verification

- Release contracts assert the three authority kinds, the draft exploration/reconciliation boundary, and the absence of a prewritten solution topology.
- Representative behavior cases check that incomplete business facts produce one decisive question with no artifact write, and that unsupported mechanisms are deleted rather than renamed.
- Claude and Codex plugin bodies remain mirrored.
