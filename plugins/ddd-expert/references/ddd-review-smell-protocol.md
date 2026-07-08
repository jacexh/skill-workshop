---
name: DDD Review Smell Protocol
description: Smell-queue protocol for DDD/backend reviews that need broad code-shape detection followed by focused investigation of individual risks.
---

# DDD Review Smell Protocol

Use this with `review` when lifecycle, repository/API, event/reaction, CQRS, runtime recovery, generated boundary, or persistence evidence is in scope.

## Core Model

The coordinator owns breadth. It scans model evidence and code shape to identify bad smells, then records them in one Smell Queue.

Investigators own depth. Each subagent or local fallback pass investigates exactly one smell, proves or falsifies it with row-local evidence, and may spawn related smells when the real cause is outside the original row.

Fixed review axes are tags. They help classify coverage, but they do not own delegation and they do not close smells.

## Smell Queue Row

Each row must be concrete enough for another agent to investigate without global context:

```text
smell_id | code shape | trigger evidence | suspected risk card | investigator | status | verdict | spawned_smells | final decision
```

Allowed `status`: `queued`, `investigating`, `closed`, `missing-evidence`.

Allowed `verdict`: `violation`, `return-to-domain-modeling`, `return-to-design`, `evidence-gap`, `harmless-local-style`, `spawned-smell`.

Allowed `final decision`: one of the verdicts above, or `not-applicable` only when the row names inspected evidence proving the smell does not exist.

## Correct Shape Whitelist

The main axis does not try to enumerate every possible bad smell. It states the correct shape first, then compares touched code shape against that whitelist. Any touched shape that does not map to a whitelist row becomes a smell.

Use these whitelist rows as the default DDD shape unless accepted model evidence says otherwise:

- Aggregate lifecycle: one Aggregate Root owns one lifecycle and invariant boundary; state words name parent lifecycle facts, not child process outcomes.
- Repository/API: one Repository saves one Aggregate Root plus owned children/value objects; cross-owner coordination is done by Domain Event, process manager, reconciler, task processor, Integration Message, or an accepted atomic decision with failure-tolerance proof.
- Durable fact precedence: succeeded/accepted/completed/executed facts outrank open workflow states; later commands check durable facts before retry, cancel, reopen, refund, execute, or close.
- Terminal closure: aggregate terminal facts and terminal events occur after required execution facts, idempotency/replay rules, and closure conditions are complete.
- Collaboration: repeated delivery, refund, dispute, settlement, split closure, or recovery reactions have one named collaboration mechanism and recovery behavior.
- CQRS: write repositories serve command-side aggregate facts; product reads use QueryRepository/read facades returning DTO/read models.
- Boundary isolation: Domain/Application semantic APIs use domain-owned language, not generated protocol, storage, runtime, or adapter concepts.
- Recovery reachability: reconciler, task, event, or message recovery has a production entrypoint, runtime registration, and failure behavior.

The coordinator may use risk-router cards to classify a deviation, but it must not convert a card name into a finding before investigation.

## Investigation Contract

An investigator receives:

- one smell row;
- expected model sources;
- relevant code seeds;
- the suspected risk card and required proof columns;
- an instruction to return only smell verdict rows and spawned smells.

An investigator must not run a full global review. If it finds a linked issue outside the original scope, it returns `spawned-smell` with the new row trigger instead of expanding silently.

## Closure Rules

Final output is blocked until every smell row is terminal: `closed` or `missing-evidence`.

A spawned smell is appended to the same queue and follows the same closure rule. Keep fan-out bounded: spawn only when the new smell changes owner, risk card, or proof surface.

Findings can only be generated from terminal negative rows: `violation`, `return-to-domain-modeling`, `return-to-design`, or `evidence-gap`.

A no-finding claim can only cite a terminal `harmless-local-style` or `not-applicable` row with row-local proof.

## Liveness Rules

Use non-waiting subagents only when the runtime can return the verdict without wait/collab-wait loops.

If non-waiting delegation is unavailable, the coordinator investigates locally one smell at a time.

If a delegated smell does not return, close it as `missing-evidence` or fill a bounded local verdict from already-read evidence. Do not wait indefinitely.

## Proof Reminders

These reminders are generic risk-card proof requirements, not project-specific findings:

- A bounded local ledger may not use one grouped row for multiple repository methods, collaboration flows, terminal facts, parent states, commands, or CQRS methods.
- If local fallback cannot complete row-level CQRS inventory, decision is evidence gap, not no branch finding.
- Local fallback stale-command matrix enumerates each later command after durable fact: cancel, retry/start, new payment, reopen, execution, and closure.
- Local fallback collaboration ledger enumerates delivery, refund, dispute, settlement, split closure, and payment recovery mechanisms independently.
- payment_pending must be classified as an open/stale parent state when durable child or payment facts can outrank it.
- Split refund/settlement terminal rows must decide whether terminal agreement facts or events occur before both execution facts and aggregate closure complete.
- Repository/API local fallback rows must be one row per semantic method; examples such as SaveDeliveryRejection or SaveDisputeResolutionAuthorization do not cover the family.
- Collaboration local fallback rows must be one row per lifecycle flow, not inherited from repository or recovery findings.
- A CQRS axis summary may not say no finding, no branch finding, or inventory-only unless visible method-level CQ rows are emitted.
- Do not emit a Checked Coverage table in complex lifecycle/repository/event/CQRS reviews.
- Positive clearance phrases such as no issue, no similar issue, no branch finding, inventory-only, 未发现, or 适配正确 are forbidden unless exact admitted rows are printed.
- Complex multi-axis review must include a ledger appendix for triggered terminal/execution, collaboration, repository/API, parent-state, and CQRS axes.
- Triggered rows with incomplete exact proof become evidence gap or return, never checked coverage.
