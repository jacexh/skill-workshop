---
name: DDD Review Smell Protocol
description: Smell-queue protocol for DDD/backend reviews that need broad code-shape detection followed by focused investigation of individual risks.
---

# DDD Review Smell Protocol

Use this with `review` when lifecycle, repository/API, event/reaction, CQRS, runtime recovery, generated boundary, or persistence evidence is in scope.

## Core Model

The coordinator owns breadth. It scans model evidence and code shape to identify coarse smell families, then records them in one Smell Queue.

Investigators own depth. Each subagent or local fallback pass investigates exactly one coarse smell family, expands sibling shapes in that family, proves or falsifies the full chain, and may spawn related families when the real cause is outside the original row.

Fixed review axes are tags. They help classify coverage, but they do not own delegation and they do not close smells.

## Coordinator breadth scan

Breadth is a thin main-axis scan. It reads the user task, named spec/design/diff seeds, and the minimum model evidence needed to identify triggered axes. It does not try to enumerate every possible bad smell, and it does not produce findings.

Breadth emits coarse smell families, not per-method or per-flow inventories. Any touched shape that does not map to a whitelist row becomes a smell family.

## Coarse Family Work Packet

Each packet must be concrete enough for another agent to investigate without global context:

```text
coarse_family | whitelist_row | trigger_evidence | depth_scope | sibling_scope | positive_shape_evidence | verdict | judgment
```

Allowed `verdict`: `violation`, `return-to-domain-modeling`, `return-to-design`, `evidence-gap`, `positive-shape-no-finding`, `spawned-family`.

`positive_shape_evidence` is empty until the depth investigator has observed the correct shape. Empty positive evidence cannot support no-finding.

## Correct Shape Whitelist

The main axis states the correct shape first, then compares touched code shape against that whitelist. Any touched shape that does not map to a whitelist row becomes a smell.

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

## Depth investigation axes

Use one depth pass per triggered coarse family. Typical axes:

- lifecycle / event timeline / recovery / irreversible fact precedence;
- Repository/API candidate classification / aggregate ownership;
- collaboration/process mechanism / event-process-reconciler-task-message coordination;
- parent-state / FSM vocabulary and behavior ownership;
- CQRS read/write split / read-shaped write-side ports;
- runtime/wiring/persistence/protocol boundary when triggered.

Depth investigators start from one coarse smell family and then search for sibling shapes in the same family. Siblings include related methods, flows, states, execution facts, events, commands, ports, or adapters that share the same whitelist deviation.

When non-waiting subagent tooling is available, dispatch depth investigators before any local fallback. A local fallback verdict must name why delegation was unavailable.

Depth analysis is full-chain: business fact -> owner -> reaction/process -> failure tolerance -> implementation mechanism. Each depth pass asks whether the shape is truly required by the business invariant or compensating for a wrong aggregate, lifecycle, or boundary.

## No-finding is positive-shape proof

Do not clear an axis because negative examples were not found. A no-finding verdict requires observed positive correct-shape evidence for the relevant whitelist row.

Examples: a CQRS no-finding names the command-side write shape and the read-side DTO/read facade shape; a collaboration no-finding names the accepted mechanism and failure behavior; a repository no-finding names the aggregate owner and why sibling candidates are owned children or value objects.

## Investigation Contract

An investigator receives:

- one coarse smell family;
- expected model sources;
- relevant code seeds;
- the suspected risk card and required proof columns;
- an instruction to return only family verdicts and spawned families.

An investigator must not run a full global review. If it finds a linked issue outside the original scope, it returns `spawned-family` with the new trigger instead of expanding silently.

## Closure Rules

Final output waits for every triggered family to have a verdict or an evidence gap. Do not wait indefinitely.

A spawned family is appended to the same queue and follows the same closure rule. Keep fan-out bounded: spawn only when the new smell changes owner, risk card, or proof surface.

Findings can only be generated from negative or gap depth decisions: `violation`, `return-to-domain-modeling`, `return-to-design`, or `evidence-gap`.

A no-finding claim can only cite `positive-shape-no-finding` with positive correct-shape evidence.

## Liveness Rules

Use non-waiting subagents only when the runtime can return the verdict without wait/collab-wait loops.

If non-waiting delegation is unavailable, the coordinator investigates locally one coarse family at a time.

If a delegated family does not return, close it as `evidence-gap` or fill a bounded local verdict from already-read evidence. Do not wait indefinitely.

## Final report shape

The final answer reports judgments, not the full working ledger. Lead with findings, returns, evidence gaps, positive-shape no-finding rationale, verification, and residual risk. Print selected working evidence only when it is needed to understand a judgment or when the user asks.

## Proof Reminders

These reminders are generic risk-card proof requirements for depth passes, not project-specific findings:

- Depth notes may not collapse multiple repository methods, collaboration flows, terminal facts, parent states, commands, or CQRS methods when those siblings drive different judgments.
- If local fallback cannot prove positive CQRS shape, decision is evidence gap, not no branch finding.
- Local fallback stale-command matrix enumerates each later command after durable fact: cancel, retry/start, new payment, reopen, execution, and closure.
- Local fallback collaboration ledger enumerates delivery, refund, dispute, settlement, split closure, and payment recovery mechanisms independently.
- payment_pending must be classified as an open/stale parent state when durable child or payment facts can outrank it.
- Split refund/settlement terminal rows must decide whether terminal agreement facts or events occur before both execution facts and aggregate closure complete.
- Repository/API local fallback rows must be one row per semantic method; examples such as SaveDeliveryRejection or SaveDisputeResolutionAuthorization do not cover the family.
- Collaboration local fallback rows must be one row per lifecycle flow, not inherited from repository or recovery findings.
- A CQRS axis summary may not say no finding, no branch finding, or inventory-only unless visible method-level CQ rows are emitted.
- Do not emit a Checked Coverage table in complex lifecycle/repository/event/CQRS reviews.
- Positive clearance phrases such as no issue, no similar issue, no branch finding, inventory-only, 未发现, or 适配正确 are valid only when the same decision names positive correct-shape evidence.
- Triggered families with incomplete depth proof become evidence gap or return, never checked coverage.
